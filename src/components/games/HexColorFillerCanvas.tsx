"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

export interface HexFillerCanvasHandle {
  triggerTick: (dir: "up" | "down" | "flat") => void;
  triggerEnd: (playerWon: boolean) => void;
  reset: (playerSide: "green" | "red") => void;
}

/* ─── Board geometry ─────────────────────────────────────── */

export const CW = 600;
export const CH = 520;
const HEX_SIZE  = 36;
const CENTER_X  = CW / 2;
const CENTER_Y  = CH / 2 - 14;
const RADIUS    = 4; // 61 hexes

/* ─── Hex types ──────────────────────────────────────────── */

type HexColor = "neutral" | "green" | "red";

interface Hex {
  q: number;
  r: number;
  x: number;
  y: number;
  color: HexColor;
  anim: number;      // 0→1 fill animation
  pulse: number;     // 0→1 glow pulse (decays)
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }

/* ─── Helpers ────────────────────────────────────────────── */

function hexToPixel(q: number, r: number): [number, number] {
  return [
    CENTER_X + HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r),
    CENTER_Y + HEX_SIZE * (3 / 2 * r),
  ];
}

function hexKey(q: number, r: number): string { return `${q},${r}`; }

function generateGrid(): Hex[] {
  const hexes: Hex[] = [];
  for (let r = -RADIUS; r <= RADIUS; r++) {
    const qMin = Math.max(-RADIUS, -r - RADIUS);
    const qMax = Math.min(RADIUS, -r + RADIUS);
    for (let q = qMin; q <= qMax; q++) {
      const [x, y] = hexToPixel(q, r);
      hexes.push({ q, r, x, y, color: "neutral", anim: 0, pulse: 0 });
    }
  }
  return hexes;
}

function drawHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    const px = cx + size * Math.cos(ang);
    const py = cy + size * Math.sin(ang);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* ─── Canvas component ───────────────────────────────────── */

const HexColorFillerCanvas = forwardRef<HexFillerCanvasHandle>((_, ref) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const lastTime    = useRef(0);

  /* board state */
  const hexes       = useRef<Hex[]>(generateGrid());
  const hexMapRef   = useRef<Map<string, Hex>>(new Map());
  const neutralKeys = useRef<string[]>([]); // unclaimed hex keys
  const greenCount  = useRef(0);
  const redCount    = useRef(0);
  const playerSide  = useRef<"green" | "red">("green");
  const endState    = useRef<{ playerWon: boolean } | null>(null);
  const particles   = useRef<Particle[]>([]);

  /* ─── Build map & neutral list ───────────────────────── */

  function rebuild() {
    const map = new Map<string, Hex>();
    hexes.current.forEach(h => map.set(hexKey(h.q, h.r), h));
    hexMapRef.current = map;
    neutralKeys.current = hexes.current
      .filter(h => h.color === "neutral")
      .map(h => hexKey(h.q, h.r));
    // Shuffle neutral list so random picks are fast
    for (let i = neutralKeys.current.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neutralKeys.current[i], neutralKeys.current[j]] = [neutralKeys.current[j], neutralKeys.current[i]];
    }
  }

  /* ─── Claim a random unclaimed hex ───────────────────── */

  function claimHex(color: "green" | "red") {
    const list = neutralKeys.current;
    if (list.length === 0) return;
    // Pop the last element (O(1) random removal after initial shuffle)
    const key = list.pop()!;
    const h = hexMapRef.current.get(key);
    if (!h) return;
    h.color = color;
    h.anim  = 0;
    h.pulse = 1;
    if (color === "green") greenCount.current++;
    else redCount.current++;

    // Burst particles
    const col = color === "green" ? "#22c55e" : "#ef4444";
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      particles.current.push({
        x: h.x, y: h.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
        color: col, r: 2 + Math.random() * 2,
      });
    }
  }

  /* ─── Draw ───────────────────────────────────────────── */

  function draw(ctx: CanvasRenderingContext2D, dt: number) {
    ctx.clearRect(0, 0, CW, CH);

    /* background */
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, CW, CH);

    /* centre glow */
    const gr = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.55);
    gr.addColorStop(0,   "rgba(139,92,246,0.10)");
    gr.addColorStop(0.6, "rgba(139,92,246,0.04)");
    gr.addColorStop(1,   "rgba(139,92,246,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, CW, CH);

    const end = endState.current;

    /* hexes */
    for (const h of hexes.current) {
      /* animate fill */
      if (h.anim < 1 && h.color !== "neutral") {
        h.anim = Math.min(1, h.anim + dt * 5);
      }
      /* decay pulse */
      if (h.pulse > 0) {
        h.pulse = Math.max(0, h.pulse - dt * 3);
      }

      const cx = h.x, cy = h.y;
      const innerSize = h.color === "neutral" ? HEX_SIZE - 1 : (HEX_SIZE - 1) * Math.max(0.05, h.anim);
      const isWinnerSide = end && ((end.playerWon && h.color === playerSide.current) || (!end.playerWon && h.color !== playerSide.current && h.color !== "neutral"));

      /* glow for pulse/winner */
      if (h.pulse > 0.05 || isWinnerSide) {
        const glowColor = h.color === "green" ? "#22c55e" : h.color === "red" ? "#ef4444" : "#6366f1";
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur  = 12 * (isWinnerSide ? 0.6 + 0.4 * Math.sin(Date.now() * 0.006) : h.pulse);
        drawHexPath(ctx, cx, cy, innerSize);
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = (isWinnerSide ? 0.85 : 0.5 + h.pulse * 0.5);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      /* border hex */
      drawHexPath(ctx, cx, cy, HEX_SIZE - 1);
      if (h.color === "neutral") {
        ctx.strokeStyle = "#1e2d42";
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.fillStyle   = "#0c1424";
        ctx.fill();
      } else {
        const baseColor = h.color === "green" ? "#22c55e" : "#ef4444";
        /* fill inner (animated scale) */
        ctx.fillStyle = "#070b16";
        ctx.fill();
        drawHexPath(ctx, cx, cy, innerSize);
        const alpha = end ? (isWinnerSide ? 1 : 0.45) : 1;
        ctx.fillStyle   = baseColor;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = baseColor + "88";
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
    }

    /* outer ring border */
    ctx.strokeStyle = "#1e3050";
    ctx.lineWidth   = 1.5;
    for (const h of hexes.current) {
      const dist = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
      if (dist === RADIUS) {
        drawHexPath(ctx, h.x, h.y, HEX_SIZE);
        ctx.stroke();
      }
    }

    /* particles */
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x  += p.vx * dt * 60;
      p.y  += p.vy * dt * 60;
      p.vy += 0.05 * dt * 60;
      p.life -= dt;
      if (p.life <= 0) { particles.current.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
    }

    /* count bar at bottom */
    const barY = CH - 38;
    const g  = greenCount.current;
    const r  = redCount.current;
    const n  = neutralKeys.current.length;
    const total = g + r + n;
    const gW = (g / total) * (CW - 40);
    const rW = (r / total) * (CW - 40);
    const nW = (n / total) * (CW - 40);

    /* bar background */
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(20, barY, CW - 40, 10, 5);
    ctx.fill();
    /* green segment */
    if (gW > 0) {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(20, barY, gW, 10, 5);
      ctx.fill();
    }
    /* red segment */
    if (rW > 0) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.roundRect(20 + gW, barY, rW, 10, 5);
      ctx.fill();
    }
    /* neutral segment */
    if (nW > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.roundRect(20 + gW + rW, barY, nW, 10, 5);
      ctx.fill();
    }

    /* count labels */
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`🟢 ${g}`, 20, barY + 26);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`${r} 🔴`, CW - 20, barY + 26);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(`${n} neutral`, CW / 2, barY + 26);

    /* end overlay */
    if (end) {
      const won  = end.playerWon;
      const text = won ? "🏆 YOU WIN!" : "💀 YOU LOSE";
      const col  = won ? "#22c55e" : "#ef4444";
      ctx.save();
      ctx.fillStyle = "rgba(7,11,22,0.65)";
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
      ctx.font        = "bold 42px monospace";
      ctx.textAlign   = "center";
      ctx.shadowColor = col;
      ctx.shadowBlur  = 32;
      ctx.fillStyle   = col;
      ctx.fillText(text, CW / 2, CH / 2 - 10);
      ctx.shadowBlur  = 0;
      ctx.font        = "13px monospace";
      ctx.fillStyle   = "rgba(255,255,255,0.55)";
      ctx.fillText(`GREEN ${g}  vs  RED ${r}`, CW / 2, CH / 2 + 28);
    }
  }

  /* ─── Initialize map on mount ───────────────────────── */

  useEffect(() => {
    rebuild();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── RAF loop ───────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let id: number;
    function loop(now: number) {
      const dt = Math.min((now - lastTime.current) / 1000, 0.05);
      lastTime.current = now;
      draw(ctx!, dt);
      id = requestAnimationFrame(loop);
    }
    id = requestAnimationFrame((now) => { lastTime.current = now; id = requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Handle ─────────────────────────────────────────── */

  useImperativeHandle(ref, () => ({
    reset(side: "green" | "red") {
      playerSide.current = side;
      endState.current   = null;
      greenCount.current = 0;
      redCount.current   = 0;
      particles.current  = [];
      hexes.current = generateGrid();
      rebuild();
    },

    triggerTick(dir: "up" | "down" | "flat") {
      if (endState.current) return;
      if (dir === "up")   claimHex("green");
      else if (dir === "down") claimHex("red");
    },

    triggerEnd(playerWon: boolean) {
      endState.current = { playerWon };
      // Celebration burst from winner hexes
      const winColor = playerWon ? playerSide.current : (playerSide.current === "green" ? "red" : "green");
      const winners  = hexes.current.filter(h => h.color === winColor);
      winners.forEach(h => {
        h.pulse = 1;
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 3;
          particles.current.push({
            x: h.x, y: h.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
            life: 0.8 + Math.random() * 0.8, maxLife: 1.6,
            color: winColor === "green" ? "#22c55e" : "#ef4444",
            r: 2 + Math.random() * 3,
          });
        }
      });
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

HexColorFillerCanvas.displayName = "HexColorFillerCanvas";
export default HexColorFillerCanvas;
