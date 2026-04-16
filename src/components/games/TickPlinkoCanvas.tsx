"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

export interface PlinkoCanvasHandle {
  triggerTick: (dir: "up" | "down", col: number, row: number) => void;
  triggerLand: (slot: number, totalSlots: number, won: boolean) => void;
  reset: (totalTicks: number, playerColor: string) => void;
}

/* ─── Board geometry (fixed: 14 rows → 15 slots) ─────────── */

const CW = 600;
const ROWS = 14;
const SLOTS = 15;
const COL_SPACING = 38;
const PAD_SIDES = (CW - COL_SPACING * (SLOTS - 1)) / 2;   // 34 px
const ROW_SPACING = 31;
const PAD_TOP = 28;
const SLOT_H = 58;
const PAD_BOT = 18;
export const CH = PAD_TOP + ROWS * ROW_SPACING + SLOT_H + PAD_BOT; // 528 px

const PEG_R = 4;
const BALL_R = 7;

export const MULTIPLIERS = [5, 3, 2, 1.5, 1, 0.5, 0.3, 0.2, 0.3, 0.5, 1, 1.5, 2, 3, 5];

/* ─── Helpers ────────────────────────────────────────────── */

const colToX = (col: number) => PAD_SIDES + col * COL_SPACING;
const rowToY  = (row: number) => PAD_TOP   + row * ROW_SPACING;

function slotColor(mult: number): string {
  if (mult >= 5)    return "#f59e0b";
  if (mult >= 3)    return "#f97316";
  if (mult >= 2)    return "#a855f7";
  if (mult >= 1.5)  return "#14b8a6";
  if (mult >= 1)    return "#6366f1";
  if (mult >= 0.5)  return "#64748b";
  return "#94a3b8";
}

function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getRowPegs(row: number): { x: number; y: number }[] {
  const n = row + 2;
  const startX = (CW - (n - 1) * COL_SPACING) / 2;
  const y = rowToY(row);
  return Array.from({ length: n }, (_, i) => ({ x: startX + i * COL_SPACING, y }));
}

function nearestPegIdx(pegs: { x: number }[], x: number): number {
  let best = 0, min = Infinity;
  for (let i = 0; i < pegs.length; i++) {
    const d = Math.abs(pegs[i].x - x);
    if (d < min) { min = d; best = i; }
  }
  return best;
}

/* ─── Particle ───────────────────────────────────────────── */

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number }

/* ─── Canvas ─────────────────────────────────────────────── */

const TickPlinkoCanvas = forwardRef<PlinkoCanvasHandle>((_, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const lastTime   = useRef(0);
  const rafId      = useRef(0);

  /* ball */
  const bx = useRef(CW / 2);
  const by = useRef(PAD_TOP - 20);
  const tx = useRef(CW / 2);
  const ty = useRef(PAD_TOP - 20);

  /* game state */
  const playerColor   = useRef("#a855f7");
  const currentCol    = useRef(7);
  const currentRow    = useRef(-1);
  const trail         = useRef<{ x: number; y: number }[]>([]);
  const pegGlows      = useRef<Map<string, number>>(new Map());
  const activeSlot    = useRef<number | null>(null);
  const slotWon       = useRef(false);
  const particles     = useRef<Particle[]>([]);
  const landTimer     = useRef(0);
  const progressFrac  = useRef(0);

  /* intermediate bounce queue for faster feel */
  const bounceQueue   = useRef<{ targetX: number; targetY: number; delay: number }[]>([]);
  const bounceTimer   = useRef(0);

  /* ─── Draw ─────────────────────────────────────────────── */

  function draw(ctx: CanvasRenderingContext2D, dt: number) {
    ctx.clearRect(0, 0, CW, CH);

    /* vibrant gradient background */
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0,   "#1a0533");
    bg.addColorStop(0.3, "#0f1a3d");
    bg.addColorStop(0.6, "#15082e");
    bg.addColorStop(1,   "#0a1628");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    /* purple radial glow — brighter */
    const gr = ctx.createRadialGradient(CW / 2, CH * 0.38, 0, CW / 2, CH * 0.38, CW * 0.75);
    gr.addColorStop(0,    "rgba(139,92,246,0.28)");
    gr.addColorStop(0.35, "rgba(99,102,241,0.12)");
    gr.addColorStop(0.65, "rgba(236,72,153,0.06)");
    gr.addColorStop(1,    "rgba(139,92,246,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, CW, CH);

    /* warm edge glow — left orange, right cyan */
    const glLeft = ctx.createRadialGradient(0, CH * 0.5, 0, 0, CH * 0.5, CW * 0.45);
    glLeft.addColorStop(0, "rgba(249,115,22,0.08)");
    glLeft.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = glLeft;
    ctx.fillRect(0, 0, CW, CH);
    const glRight = ctx.createRadialGradient(CW, CH * 0.5, 0, CW, CH * 0.5, CW * 0.45);
    glRight.addColorStop(0, "rgba(56,189,248,0.08)");
    glRight.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = glRight;
    ctx.fillRect(0, 0, CW, CH);

    /* process bounce queue — intermediate micro-bounces */
    if (bounceQueue.current.length > 0) {
      bounceTimer.current -= dt;
      if (bounceTimer.current <= 0) {
        const next = bounceQueue.current.shift()!;
        tx.current = next.targetX;
        ty.current = next.targetY;
        bounceTimer.current = (bounceQueue.current[0]?.delay ?? 0) / 1000;
      }
    }

    /* lerp ball — very fast snap */
    const spd = Math.min(1, dt * 28);
    bx.current += (tx.current - bx.current) * spd;
    by.current += (ty.current - by.current) * spd;

    /* track progress */
    progressFrac.current = Math.max(0, Math.min(1,
      (by.current - PAD_TOP) / (ROWS * ROW_SPACING)
    ));

    /* trail */
    trail.current.push({ x: bx.current, y: by.current });
    if (trail.current.length > 22) trail.current.shift();
    const rgb = hexToRgb(playerColor.current);
    for (let i = 0; i < trail.current.length - 1; i++) {
      const frac = i / trail.current.length;
      const p = trail.current[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * frac * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${frac * 0.28})`;
      ctx.fill();
    }

    /* column guide — dashed line from ball down to slot row */
    if (activeSlot.current === null && currentRow.current >= 0) {
      const gx = colToX(currentCol.current);
      const slotY = PAD_TOP + ROWS * ROW_SPACING;
      ctx.beginPath();
      ctx.moveTo(gx, by.current + BALL_R + 3);
      ctx.lineTo(gx, slotY);
      ctx.strokeStyle = `rgba(${rgb},0.13)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* peg glow decay — slower for more visible effect */
    pegGlows.current.forEach((v, k) => {
      const next = Math.max(0, v - dt * 1.8);
      if (next === 0) pegGlows.current.delete(k);
      else pegGlows.current.set(k, next);
    });

    /* pegs */
    for (let row = 0; row < ROWS; row++) {
      const pegs = getRowPegs(row);
      for (let pi = 0; pi < pegs.length; pi++) {
        const peg = pegs[pi];
        const glow = pegGlows.current.get(`${row}-${pi}`) ?? 0;

        if (glow > 0.01) {
          ctx.save();
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur  = 14 * glow;
          ctx.beginPath();
          ctx.arc(peg.x, peg.y, PEG_R + glow * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168,85,247,${0.3 + glow * 0.7})`;
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2);
          ctx.fillStyle = "#6b7a92";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(peg.x - 1, peg.y - 1, PEG_R * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fill();
        }
      }
    }

    /* slots */
    const slotY = PAD_TOP + ROWS * ROW_SPACING;
    if (landTimer.current > 0) landTimer.current = Math.max(0, landTimer.current - dt * 1.4);

    for (let i = 0; i < SLOTS; i++) {
      const sx   = colToX(i);
      const sw   = COL_SPACING - 4;
      const slotX = sx - sw / 2;
      const mult  = MULTIPLIERS[i];
      const color = slotColor(mult);
      const isActive  = activeSlot.current === i;
      const isHigh    = mult >= 5;

      const nearHigh = isHigh && activeSlot.current === null
        && currentRow.current >= 0
        && Math.abs(i - currentCol.current) <= 2;

      const proximity = activeSlot.current === null
        ? Math.max(0, 1 - Math.abs(i - currentCol.current) * 0.5) * progressFrac.current
        : 0;

      /* always draw a solid, bright slot background */
      ctx.save();
      if (isActive) {
        const pulse = 0.75 + Math.sin(Date.now() * 0.009) * 0.25;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 30 * pulse;
        ctx.fillStyle   = color;
        roundRect(ctx, slotX, slotY, sw, SLOT_H, 6);
        ctx.fill();
      } else if (nearHigh) {
        const shimmer = 0.5 + Math.sin(Date.now() * 0.013 + i) * 0.3;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur  = 18 * shimmer;
        ctx.fillStyle   = color;
        ctx.globalAlpha = 0.7;
        roundRect(ctx, slotX, slotY, sw, SLOT_H, 6);
        ctx.fill();
      } else {
        const alpha = 0.55 + proximity * 0.25;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        roundRect(ctx, slotX, slotY, sw, SLOT_H, 6);
        ctx.fill();
      }
      ctx.restore();

      /* bright border on every slot */
      ctx.strokeStyle = color;
      ctx.globalAlpha = isActive ? 1 : 0.6;
      ctx.lineWidth = isActive ? 2 : 1.5;
      roundRect(ctx, slotX, slotY, sw, SLOT_H, 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* multiplier label — large, bold, white on colored bg */
      ctx.fillStyle   = isActive ? "#ffffff" : nearHigh ? "#ffffff" : "#ffffff";
      ctx.font        = `bold ${mult >= 3 ? 16 : 14}px monospace`;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.shadowColor = "#000000";
      ctx.shadowBlur  = 4;
      ctx.fillText(`${mult}×`, sx, slotY + SLOT_H / 2);
      ctx.restore();
      ctx.textBaseline = "alphabetic";
    }

    /* ball — brighter with outer glow ring */
    ctx.save();
    ctx.shadowColor = playerColor.current;
    ctx.shadowBlur  = 28;
    ctx.beginPath();
    ctx.arc(bx.current, by.current, BALL_R + 3, 0, Math.PI * 2);
    const ballRgb = hexToRgb(playerColor.current);
    ctx.fillStyle = `rgba(${ballRgb},0.15)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx.current, by.current, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = playerColor.current;
    ctx.fill();
    ctx.shadowBlur = 0;
    /* shine */
    ctx.beginPath();
    ctx.arc(bx.current - 2.2, by.current - 2.2, BALL_R * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fill();
    ctx.restore();

    /* particles */
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x  += p.vx * dt * 60;
      p.y  += p.vy * dt * 60;
      p.vy += 0.08 * dt * 60;
      p.life -= dt;
      if (p.life <= 0) { particles.current.splice(i, 1); continue; }
      const alpha = Math.max(0, p.life / p.maxLife);
      const hex = Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color + hex;
      ctx.fill();
    }
  }

  /* ─── RAF loop ─────────────────────────────────────────── */

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

  /* ─── Handle ───────────────────────────────────────────── */

  useImperativeHandle(ref, () => ({
    reset(ticks: number, color: string) {
      playerColor.current  = color;
      activeSlot.current   = null;
      landTimer.current    = 0;
      progressFrac.current = 0;
      trail.current        = [];
      particles.current    = [];
      bounceQueue.current  = [];
      bounceTimer.current  = 0;
      pegGlows.current.clear();
      currentRow.current = -1;
      currentCol.current = Math.floor(ticks / 2);
      const sx = colToX(currentCol.current);
      bx.current = sx; by.current = PAD_TOP - 20;
      tx.current = sx; ty.current = PAD_TOP - 20;
    },

    triggerTick(dir: "up" | "down", col: number, row: number) {
      currentCol.current = col;
      currentRow.current = row;

      /* find the actual peg position on this row closest to the slot column */
      const pegsNow = getRowPegs(row);
      const slotX = colToX(col);
      const ni = nearestPegIdx(pegsNow, slotX);
      const pegPos = pegsNow[ni];
      const finalX = pegPos.x;
      const finalY = pegPos.y;

      /* snap ball instantly to target, no slow lerp queue */
      bx.current = bx.current;  // keep current for trail
      by.current = by.current;
      tx.current = finalX;
      ty.current = finalY;

      /* queue quick bounces: deflect off peg then settle */
      const deflectX = finalX + (dir === "up" ? COL_SPACING * 0.3 : -COL_SPACING * 0.3);
      bounceQueue.current = [
        { targetX: deflectX, targetY: finalY - 5, delay: 60 },
        { targetX: finalX, targetY: finalY, delay: 60 },
      ];
      bounceTimer.current = 0.03;

      /* spark particles at peg hit */
      const pColor = playerColor.current;
      for (let b = 0; b < 5; b++) {
        const angle = Math.random() * Math.PI * 2;
        particles.current.push({
          x: finalX, y: finalY,
          vx: Math.cos(angle) * 2.0,
          vy: Math.sin(angle) * 2.0 - 1.5,
          life: 0.25 + Math.random() * 0.25,
          maxLife: 0.5,
          color: pColor,
          r: 1.5 + Math.random() * 2,
        });
      }

      /* glow the hit peg and neighbors */
      pegGlows.current.set(`${row}-${ni}`,     1.0);
      if (ni > 0)               pegGlows.current.set(`${row}-${ni-1}`, 0.65);
      if (ni < pegsNow.length-1) pegGlows.current.set(`${row}-${ni+1}`, 0.65);

      /* glow deflection peg in previous row */
      if (row > 0) {
        const prevPegs = getRowPegs(row - 1);
        const prevSlotX = colToX(dir === "up" ? col - 1 : col + 1);
        const pi = nearestPegIdx(prevPegs, prevSlotX);
        pegGlows.current.set(`${row - 1}-${pi}`, 0.9);
      }
    },

    triggerLand(slot: number, _total: number, won: boolean) {
      activeSlot.current = slot;
      landTimer.current  = 1;
      slotWon.current    = won;
      currentCol.current = slot;
      const slotY = PAD_TOP + ROWS * ROW_SPACING;
      tx.current = colToX(slot);
      ty.current = slotY + SLOT_H * 0.5;

      /* burst particles */
      const color = slotColor(MULTIPLIERS[slot]);
      const px = colToX(slot);
      const py = slotY + SLOT_H * 0.3;
      const count = won ? 50 : 22;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.6 + Math.random() * 3.8;
        particles.current.push({
          x: px, y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.8,
          life: 0.6 + Math.random() * 1.1,
          maxLife: 1.7,
          color,
          r: 2 + Math.random() * 3,
        });
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

TickPlinkoCanvas.displayName = "TickPlinkoCanvas";
export default TickPlinkoCanvas;
