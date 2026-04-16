"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

/* ─── Exports ───────────────────────────────────────────── */

export const CW = 700;
export const CH = 480;

export interface TidalSurgeCanvasHandle {
  reset(): void;
  triggerTick(price: number, entryPrice: number, direction: "rise" | "fall"): void;
  triggerCountdown(secondsLeft: number, totalSeconds: number): void;
  triggerResult(won: boolean): void;
}

/* ─── Particle types ────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  r: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Bubble {
  x: number;
  y: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  wobbleSpeed: number;
  wobbleOffset: number;
}

/* ─── Constants ─────────────────────────────────────────── */

const WATER_BASE_Y = CH * 0.50; // default water line (entry price level)
const MAX_SHIFT = 100;          // max px the water can rise/fall
const WAVE_LAYERS = 4;
const SKY_TOP = "#040818";
const SKY_BOT = "#0a1628";

/* ─── Helpers ───────────────────────────────────────────── */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * CW,
      y: Math.random() * (CH * 0.45),
      r: 0.3 + Math.random() * 1.2,
      twinkleSpeed: 0.5 + Math.random() * 2,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

/* ─── Canvas Component ──────────────────────────────────── */

const TidalSurgeCanvas = forwardRef<TidalSurgeCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTime = useRef(0);

  /* ── Internal state (all in refs) ── */
  const time = useRef(0);
  const waterYTarget = useRef(WATER_BASE_Y);
  const waterYCurrent = useRef(WATER_BASE_Y);
  const directionRef = useRef<"rise" | "fall" | null>(null);
  const priceDelta = useRef(0);       // (current - entry) normalised to -1..1
  const countdownFrac = useRef(0);    // 0..1 (remaining / total)
  const countdownSecs = useRef(0);
  const totalSecsRef = useRef(0);
  const resultState = useRef<{ won: boolean; t: number } | null>(null);
  const particles = useRef<Particle[]>([]);
  const bubbles = useRef<Bubble[]>([]);
  const stars = useRef<Star[]>(generateStars(80));
  const shipAngle = useRef(0);
  const tickFlash = useRef(0);        // tick glow intensity (decays)
  const lightningFlash = useRef(0);   // flash for loss result

  /* ── Draw helpers ── */

  function drawSky(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.4, SKY_BOT);
    grad.addColorStop(1, "#0d2040");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
  }

  function drawMoon(ctx: CanvasRenderingContext2D) {
    const mx = 80, my = 65, mr = 28;
    // Glow
    const glow = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 3);
    glow.addColorStop(0, "rgba(200,220,255,0.12)");
    glow.addColorStop(0.5, "rgba(160,180,220,0.04)");
    glow.addColorStop(1, "rgba(160,180,220,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CW * 0.4, CH * 0.4);
    // Moon disc
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220,230,255,0.85)";
    ctx.fill();
    // Shadow crescent
    ctx.beginPath();
    ctx.arc(mx + 8, my - 4, mr * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = SKY_TOP;
    ctx.fill();
  }

  function drawStars(ctx: CanvasRenderingContext2D, t: number) {
    for (const s of stars.current) {
      const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.fill();
    }
  }

  function waveY(x: number, layerIndex: number, t: number, baseY: number): number {
    const freq = 0.008 + layerIndex * 0.003;
    const amp = 8 + layerIndex * 5;
    const speed = 0.6 + layerIndex * 0.25;
    const phase = layerIndex * 1.2;
    return baseY + Math.sin(x * freq + t * speed + phase) * amp
      + Math.sin(x * freq * 2.3 + t * speed * 0.7 + phase + 1.5) * (amp * 0.4);
  }

  function drawWaves(ctx: CanvasRenderingContext2D, t: number, waterY: number) {
    const colors = [
      "rgba(0,40,80,0.35)",
      "rgba(0,60,100,0.30)",
      "rgba(0,90,120,0.25)",
      "rgba(0,120,140,0.20)",
    ];

    for (let layer = 0; layer < WAVE_LAYERS; layer++) {
      const yOff = layer * 12;
      ctx.beginPath();
      ctx.moveTo(0, CH);
      for (let x = 0; x <= CW; x += 3) {
        const y = waveY(x, layer, t, waterY + yOff);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CW, CH);
      ctx.closePath();
      ctx.fillStyle = colors[layer];
      ctx.fill();
    }
  }

  function drawProfitZone(ctx: CanvasRenderingContext2D, waterY: number) {
    const dir = directionRef.current;
    if (!dir) return;

    // Show green zone above entry for rise, below for fall
    if (dir === "rise" && waterYCurrent.current < WATER_BASE_Y) {
      // Profit zone — tide is above entry
      const grad = ctx.createLinearGradient(0, waterYCurrent.current, 0, WATER_BASE_Y);
      grad.addColorStop(0, "rgba(34,197,94,0.15)");
      grad.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, waterYCurrent.current, CW, WATER_BASE_Y - waterYCurrent.current);
    } else if (dir === "fall" && waterYCurrent.current > WATER_BASE_Y) {
      // Profit zone — tide is below entry
      const grad = ctx.createLinearGradient(0, WATER_BASE_Y, 0, waterYCurrent.current);
      grad.addColorStop(0, "rgba(34,197,94,0)");
      grad.addColorStop(1, "rgba(34,197,94,0.15)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, WATER_BASE_Y, CW, waterYCurrent.current - WATER_BASE_Y);
    }
    // Loss zone
    if (dir === "rise" && waterYCurrent.current > WATER_BASE_Y) {
      const grad = ctx.createLinearGradient(0, WATER_BASE_Y, 0, waterYCurrent.current);
      grad.addColorStop(0, "rgba(239,68,68,0)");
      grad.addColorStop(1, "rgba(239,68,68,0.12)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, WATER_BASE_Y, CW, waterYCurrent.current - WATER_BASE_Y);
    } else if (dir === "fall" && waterYCurrent.current < WATER_BASE_Y) {
      const grad = ctx.createLinearGradient(0, waterYCurrent.current, 0, WATER_BASE_Y);
      grad.addColorStop(0, "rgba(239,68,68,0.12)");
      grad.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, waterYCurrent.current, CW, WATER_BASE_Y - waterYCurrent.current);
    }
  }

  function drawEntryLine(ctx: CanvasRenderingContext2D) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, WATER_BASE_Y);
    ctx.lineTo(CW, WATER_BASE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "left";
    ctx.fillText("ENTRY", 8, WATER_BASE_Y - 5);
  }

  function drawPriceIndicator(ctx: CanvasRenderingContext2D, waterY: number) {
    const x = CW - 6;
    const y = waterY;
    const isUp = waterY < WATER_BASE_Y;
    const color = isUp ? "#22c55e" : waterY > WATER_BASE_Y ? "#ef4444" : "#ffffff";

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y - 5);
    ctx.lineTo(x - 10, y + 5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawTideArrow(ctx: CanvasRenderingContext2D, waterY: number, t: number) {
    if (!directionRef.current) return;
    const delta = priceDelta.current;
    if (Math.abs(delta) < 0.02) return;

    const isUp = delta > 0;
    const x = CW - 40;
    const baseY = waterY;
    const arrowLen = 20 + Math.abs(delta) * 30;
    const bob = Math.sin(t * 3) * 3;

    ctx.save();
    ctx.translate(x, baseY + bob);
    ctx.strokeStyle = isUp ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -arrowLen);
      ctx.moveTo(-6, -arrowLen + 8);
      ctx.lineTo(0, -arrowLen);
      ctx.lineTo(6, -arrowLen + 8);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, arrowLen);
      ctx.moveTo(-6, arrowLen - 8);
      ctx.lineTo(0, arrowLen);
      ctx.lineTo(6, arrowLen - 8);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShip(ctx: CanvasRenderingContext2D, t: number, waterY: number) {
    const shipX = CW * 0.35;
    // Ship rides the top wave (layer 0)
    const shipBaseY = waveY(shipX, 0, t, waterY);
    // Tilt based on wave slope
    const slopeLeft = waveY(shipX - 10, 0, t, waterY);
    const slopeRight = waveY(shipX + 10, 0, t, waterY);
    const targetAngle = Math.atan2(slopeRight - slopeLeft, 20);
    shipAngle.current = lerp(shipAngle.current, targetAngle, 0.1);

    ctx.save();
    ctx.translate(shipX, shipBaseY - 8);
    ctx.rotate(shipAngle.current);

    // Hull
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-14, 8);
    ctx.lineTo(14, 8);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fillStyle = "#5c3a1e";
    ctx.fill();
    ctx.strokeStyle = "#7a4f2e";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hull stripe
    ctx.beginPath();
    ctx.moveTo(-15, 3);
    ctx.lineTo(15, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mast
    ctx.fillStyle = "#8b6f47";
    ctx.fillRect(-1.5, -32, 3, 32);

    // Sail
    ctx.beginPath();
    ctx.moveTo(2, -30);
    ctx.lineTo(2, -6);
    ctx.lineTo(16, -10);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200,200,200,0.5)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Flag at top of mast
    const flagColor = directionRef.current === "rise" ? "#22c55e" : directionRef.current === "fall" ? "#ef4444" : "#eab308";
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(8 + Math.sin(t * 3) * 2, -36);
    ctx.lineTo(0, -38);
    ctx.fillStyle = flagColor;
    ctx.fill();

    ctx.restore();

    // Spray particles at hull front when moving
    if (Math.random() < 0.3 && directionRef.current) {
      const sprayX = shipX + 18 * Math.cos(shipAngle.current);
      const sprayY = shipBaseY - 2;
      for (let i = 0; i < 2; i++) {
        particles.current.push({
          x: sprayX,
          y: sprayY,
          vx: 0.5 + Math.random() * 1.5,
          vy: -(1 + Math.random() * 2),
          life: 0.3 + Math.random() * 0.4,
          maxLife: 0.7,
          color: "rgba(180,220,255,",
          r: 1 + Math.random() * 2,
        });
      }
    }
  }

  function drawCountdown(ctx: CanvasRenderingContext2D) {
    if (totalSecsRef.current <= 0) return;
    const cx = CW - 44, cy = 44, radius = 24;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(6,11,20,0.75)";
    ctx.fill();

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Progress arc
    const frac = countdownFrac.current;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + frac * Math.PI * 2;
    const color = frac > 0.25 ? "#06b6d4" : "#ef4444";

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    // Text
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${countdownSecs.current}`, cx, cy);
    ctx.textBaseline = "alphabetic";
  }

  function drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.05 * dt * 60;
      p.life -= dt;
      if (p.life <= 0) { particles.current.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      if (p.color.endsWith(",")) {
        // RGBA prefix style
        ctx.fillStyle = p.color + alpha.toFixed(2) + ")";
      } else {
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
      }
      ctx.fill();
    }
  }

  function drawBubbles(ctx: CanvasRenderingContext2D, dt: number, t: number) {
    for (let i = bubbles.current.length - 1; i >= 0; i--) {
      const b = bubbles.current[i];
      b.y += b.vy * dt * 60;
      b.life -= dt;
      if (b.life <= 0) { bubbles.current.splice(i, 1); continue; }
      const alpha = (b.life / b.maxLife) * 0.5;
      const wobbleX = Math.sin(t * b.wobbleSpeed + b.wobbleOffset) * 3;
      ctx.beginPath();
      ctx.arc(b.x + wobbleX, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150,200,255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  function spawnBubbles(count: number, waterY: number) {
    for (let i = 0; i < count; i++) {
      bubbles.current.push({
        x: Math.random() * CW,
        y: waterY + 20 + Math.random() * (CH - waterY - 20),
        vy: -(0.3 + Math.random() * 0.6),
        r: 1.5 + Math.random() * 3,
        life: 1 + Math.random() * 2,
        maxLife: 3,
        wobbleSpeed: 1 + Math.random() * 2,
        wobbleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnResultParticles(won: boolean) {
    const count = won ? 60 : 30;
    const color = won ? "#fbbf24" : "#ef4444";
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.current.push({
        x: CW / 2 + (Math.random() - 0.5) * 200,
        y: won ? CH * 0.4 : CH * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (won ? 2 : 0.5),
        life: 1 + Math.random() * 1.5,
        maxLife: 2.5,
        color,
        r: won ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
      });
    }
    // Extra green sparkles for win
    if (won) {
      for (let i = 0; i < 30; i++) {
        particles.current.push({
          x: Math.random() * CW,
          y: Math.random() * CH * 0.5,
          vx: (Math.random() - 0.5) * 2,
          vy: 0.3 + Math.random() * 1,
          life: 1 + Math.random() * 2,
          maxLife: 3,
          color: "#22c55e",
          r: 1.5 + Math.random() * 2,
        });
      }
    }
  }

  function drawResultOverlay(ctx: CanvasRenderingContext2D, t: number, res: { won: boolean; t: number }) {
    const elapsed = t - res.t;

    if (res.won) {
      // Golden sunrise glow from horizon
      const intensity = Math.min(1, elapsed * 0.5);
      const grad = ctx.createRadialGradient(CW / 2, WATER_BASE_Y, 0, CW / 2, WATER_BASE_Y, CW * 0.6);
      grad.addColorStop(0, `rgba(251,191,36,${(0.25 * intensity).toFixed(2)})`);
      grad.addColorStop(0.4, `rgba(251,146,36,${(0.1 * intensity).toFixed(2)})`);
      grad.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);
    } else {
      // Storm overlay
      const intensity = Math.min(1, elapsed * 0.8);
      ctx.fillStyle = `rgba(10,5,15,${(0.35 * intensity).toFixed(2)})`;
      ctx.fillRect(0, 0, CW, CH);

      // Dark clouds (circles)
      const cloudAlpha = (0.4 * intensity).toFixed(2);
      ctx.fillStyle = `rgba(30,25,40,${cloudAlpha})`;
      for (let i = 0; i < 6; i++) {
        const cx = (i * CW / 5) + Math.sin(t * 0.5 + i) * 20;
        const cy = 30 + Math.sin(t * 0.3 + i * 2) * 15;
        const cr = 40 + Math.sin(i * 1.7) * 15;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lightning flash
      if (lightningFlash.current > 0) {
        ctx.fillStyle = `rgba(255,255,255,${lightningFlash.current.toFixed(2)})`;
        ctx.fillRect(0, 0, CW, CH);
      }
    }
  }

  function drawDeepWater(ctx: CanvasRenderingContext2D, waterY: number) {
    // Fill below waves with dark water gradient
    const grad = ctx.createLinearGradient(0, waterY + 30, 0, CH);
    grad.addColorStop(0, "rgba(0,20,50,0.6)");
    grad.addColorStop(0.5, "rgba(0,10,30,0.8)");
    grad.addColorStop(1, "rgba(2,5,15,0.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, waterY + 30, CW, CH - waterY - 30);
  }

  /* ── Main draw ── */

  function draw(ctx: CanvasRenderingContext2D, dt: number) {
    time.current += dt;
    const t = time.current;

    // Smooth water Y lerp
    waterYCurrent.current = lerp(waterYCurrent.current, waterYTarget.current, 0.05);

    // Decay tick flash
    if (tickFlash.current > 0) tickFlash.current = Math.max(0, tickFlash.current - dt * 4);
    // Decay lightning
    if (lightningFlash.current > 0) lightningFlash.current = Math.max(0, lightningFlash.current - dt * 5);

    ctx.clearRect(0, 0, CW, CH);

    const wy = waterYCurrent.current;

    // Sky
    drawSky(ctx);
    drawMoon(ctx);
    drawStars(ctx, t);

    // Profit/loss zone (behind waves)
    drawProfitZone(ctx, wy);

    // Entry line
    drawEntryLine(ctx);

    // Deep water fill
    drawDeepWater(ctx, wy);

    // Waves
    drawWaves(ctx, t, wy);

    // Ship
    drawShip(ctx, t, wy);

    // Price indicator
    drawPriceIndicator(ctx, wy);

    // Tide arrow
    drawTideArrow(ctx, wy, t);

    // Bubbles
    drawBubbles(ctx, dt, t);

    // Particles (spray, confetti, sparks)
    drawParticles(ctx, dt);

    // Countdown ring
    drawCountdown(ctx);

    // Tick flash overlay
    if (tickFlash.current > 0) {
      const flashDir = directionRef.current;
      const flashColor = flashDir === "rise" ? "rgba(34,197,94," : "rgba(239,68,68,";
      ctx.fillStyle = flashColor + (tickFlash.current * 0.08).toFixed(3) + ")";
      ctx.fillRect(0, 0, CW, CH);
    }

    // Result overlay
    if (resultState.current) {
      drawResultOverlay(ctx, t, resultState.current);
    }
  }

  /* ── RAF loop ── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    function loop(now: number) {
      const dt = Math.min((now - lastTime.current) / 1000, 0.05);
      lastTime.current = now;
      draw(ctx!, dt);
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame((now) => {
      lastTime.current = now;
      animId = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(animId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Imperative handle ── */

  useImperativeHandle(ref, () => ({
    reset() {
      time.current = 0;
      waterYTarget.current = WATER_BASE_Y;
      waterYCurrent.current = WATER_BASE_Y;
      directionRef.current = null;
      priceDelta.current = 0;
      countdownFrac.current = 0;
      countdownSecs.current = 0;
      totalSecsRef.current = 0;
      resultState.current = null;
      particles.current = [];
      bubbles.current = [];
      tickFlash.current = 0;
      lightningFlash.current = 0;
      shipAngle.current = 0;
    },

    triggerTick(price: number, entryPrice: number, direction: "rise" | "fall") {
      if (resultState.current) return;
      directionRef.current = direction;

      // Normalise delta: positive = price above entry (water rises = Y goes down)
      const rawDelta = entryPrice !== 0 ? (price - entryPrice) / entryPrice : 0;
      // Clamp to reasonable range and scale
      const normalised = clamp(rawDelta * 500, -1, 1);
      priceDelta.current = normalised;

      // Water Y: above entry = Y goes UP (lower number), below entry = Y goes DOWN
      waterYTarget.current = WATER_BASE_Y - normalised * MAX_SHIFT;

      // Tick flash
      tickFlash.current = 1;

      // Spawn some bubbles on strong moves
      if (Math.abs(normalised) > 0.3) {
        spawnBubbles(3, waterYCurrent.current);
      }

      // Directional sparkles
      const sparkColor = normalised > 0 ? "#22c55e" : "#ef4444";
      for (let i = 0; i < 4; i++) {
        particles.current.push({
          x: CW * 0.35 + (Math.random() - 0.5) * 60,
          y: waterYCurrent.current - 10 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 2,
          vy: -(0.5 + Math.random() * 1.5),
          life: 0.4 + Math.random() * 0.5,
          maxLife: 0.9,
          color: sparkColor,
          r: 1.5 + Math.random() * 2,
        });
      }
    },

    triggerCountdown(secondsLeft: number, totalSeconds: number) {
      countdownSecs.current = secondsLeft;
      totalSecsRef.current = totalSeconds;
      countdownFrac.current = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
    },

    triggerResult(won: boolean) {
      resultState.current = { won, t: time.current };
      spawnResultParticles(won);
      if (!won) {
        lightningFlash.current = 1;
        // More lightning flashes
        setTimeout(() => { lightningFlash.current = 0.7; }, 300);
        setTimeout(() => { lightningFlash.current = 0.5; }, 600);
      }
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{ display: "block", margin: "0 auto", borderRadius: 12 }}
    />
  );
});

TidalSurgeCanvas.displayName = "TidalSurgeCanvas";
export default TidalSurgeCanvas;
