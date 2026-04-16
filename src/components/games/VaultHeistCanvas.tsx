"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

/* ─── Shared types ─────────────────────────────────────── */

export type VaultTier = "bronze" | "silver" | "gold";
export type LockStatus = "locked" | "cracking" | "unlocked" | "failed";

export interface LockState {
  status: LockStatus;
  currentStep: number;
  rotation: number;
  targetRotation: number;
  failFlashTimer: number;
}

export const VAULT_CONFIG: Record<
  VaultTier,
  { lockCount: number; multiplier: number; color: string; glowColor: string }
> = {
  bronze: { lockCount: 3, multiplier: 2, color: "#cd7f32", glowColor: "#e8a850" },
  silver: { lockCount: 5, multiplier: 4, color: "#c0c0c0", glowColor: "#e0e0e0" },
  gold:   { lockCount: 7, multiplier: 8, color: "#ffd700", glowColor: "#ffe44d" },
};

export interface VaultHeistCanvasHandle {
  reset(tier: VaultTier): void;
  setLocks(locks: LockState[]): void;
  setCurrentLock(index: number): void;
  setAlarmLevel(level: number): void;
  triggerCorrect(lockIndex: number): void;
  triggerWrong(lockIndex: number): void;
  triggerUnlock(lockIndex: number): void;
  triggerVaultOpen(): void;
  setLootDisplay(amount: string): void;
}

/* ─── Constants ────────────────────────────────────────── */

export const CW = 600;
export const CH = 500;

/* ─── Particle ─────────────────────────────────────────── */

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; r: number;
}

/* ─── Component ────────────────────────────────────────── */

const VaultHeistCanvas = forwardRef<VaultHeistCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTime = useRef(0);

  const tierRef = useRef<VaultTier>("bronze");
  const locksRef = useRef<LockState[]>([]);
  const currentLockRef = useRef(0);
  const alarmLevelRef = useRef(0);
  const lootTextRef = useRef("");
  const vaultOpenRef = useRef(false);
  const vaultOpenTimer = useRef(0);

  const shakeRef = useRef(0);
  const frameCount = useRef(0);
  const particles = useRef<Particle[]>([]);

  /* ─── Helpers ──────────────────────────────────────── */

  function tierColor(): string {
    return VAULT_CONFIG[tierRef.current].color;
  }

  function tierGlow(): string {
    return VAULT_CONFIG[tierRef.current].glowColor;
  }

  function getDialLayout(total: number): { cx: number; cy: number; r: number }[] {
    if (total <= 3) {
      const r = 55;
      const spacing = 140;
      const startX = CW / 2 - ((total - 1) * spacing) / 2;
      return Array.from({ length: total }, (_, i) => ({
        cx: startX + i * spacing, cy: 200, r,
      }));
    }
    if (total <= 5) {
      const r = 42;
      const spacing = 110;
      const startX = CW / 2 - ((total - 1) * spacing) / 2;
      return Array.from({ length: total }, (_, i) => ({
        cx: startX + i * spacing, cy: 200, r,
      }));
    }
    // 7 locks: two rows (4 top, 3 bottom)
    const r = 38;
    const spacing = 110;
    const topCount = 4;
    const botCount = 3;
    const topStartX = CW / 2 - ((topCount - 1) * spacing) / 2;
    const botStartX = CW / 2 - ((botCount - 1) * spacing) / 2;
    const result: { cx: number; cy: number; r: number }[] = [];
    for (let i = 0; i < topCount; i++) {
      result.push({ cx: topStartX + i * spacing, cy: 160, r });
    }
    for (let i = 0; i < botCount; i++) {
      result.push({ cx: botStartX + i * spacing, cy: 280, r });
    }
    return result;
  }

  function burstParticles(cx: number, cy: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particles.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 0.5 + Math.random() * 0.7,
        maxLife: 1.2,
        color, r: 2 + Math.random() * 4,
      });
    }
  }

  /* ─── Draw ─────────────────────────────────────────── */

  function draw(ctx: CanvasRenderingContext2D, dt: number) {
    const locks = locksRef.current;
    const total = locks.length;
    const alarm = alarmLevelRef.current;
    const fc = frameCount.current;
    const layout = getDialLayout(total);

    /* ── Update animations ── */
    if (shakeRef.current > 0.05) {
      shakeRef.current *= 0.85;
    } else {
      shakeRef.current = 0;
    }

    if (vaultOpenRef.current) {
      vaultOpenTimer.current += dt;
    }

    for (let i = 0; i < total; i++) {
      const l = locks[i];
      if (l.failFlashTimer > 0) {
        l.failFlashTimer = Math.max(0, l.failFlashTimer - dt * 1000);
        if (l.failFlashTimer <= 0 && l.status === "failed") {
          l.status = "cracking";
        }
      }
      l.rotation += (l.targetRotation - l.rotation) * 0.1;
    }

    /* ── Clear + shake ── */
    ctx.save();
    ctx.clearRect(0, 0, CW, CH);

    if (shakeRef.current > 0.05) {
      const sx = (Math.random() - 0.5) * 2 * shakeRef.current;
      const sy = (Math.random() - 0.5) * 2 * shakeRef.current;
      ctx.translate(sx, sy);
    }

    /* ── Background ── */
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, CW, CH);

    // Building facade
    ctx.fillStyle = "rgba(255,255,255,0.012)";
    for (let x = 30; x < CW; x += 60) {
      ctx.fillRect(x, 0, 24, CH);
    }

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.015)";
    ctx.lineWidth = 1;
    for (let y = 0; y < CH; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }

    // Radial tier glow behind dials
    const bgGlow = ctx.createRadialGradient(CW / 2, 210, 0, CW / 2, 210, CW * 0.45);
    bgGlow.addColorStop(0, tierColor() + "18");
    bgGlow.addColorStop(0.5, tierColor() + "08");
    bgGlow.addColorStop(1, "transparent");
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, CW, CH);

    // Alarm red pulse
    if (alarm > 0) {
      const pulse = alarm * 0.04 + alarm * 0.025 * Math.sin(fc * 0.1);
      ctx.fillStyle = `rgba(239,68,68,${Math.max(0, pulse)})`;
      ctx.fillRect(0, 0, CW, CH);
    }

    /* ── Title ── */
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = tierColor() + "b0";
    ctx.fillText("VAULT HEIST", CW / 2, 28);

    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(tierRef.current.toUpperCase() + " VAULT", CW / 2, 44);

    /* ── Alarm indicators (top-right) ── */
    for (let i = 0; i < 3; i++) {
      const ax = CW - 60 + i * 22;
      const ay = 22;
      const active = i < alarm;

      ctx.beginPath();
      ctx.arc(ax, ay, 8, 0, Math.PI * 2);

      if (active) {
        const pulseAlpha = 0.7 + 0.3 * Math.sin(fc * 0.15 + i);
        ctx.save();
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(239,68,68,${pulseAlpha})`;
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = "#1a2030";
        ctx.fill();
        ctx.strokeStyle = "#2a3a50";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* ── Lock dials (main visual) ── */
    for (let i = 0; i < total; i++) {
      const l = locks[i];
      const pos = layout[i];
      if (!pos) continue;
      const { cx: lx, cy: ly, r: dialR } = pos;
      const isCurrent = i === currentLockRef.current;

      // Outer ring glow for cracking/current
      if (l.status === "cracking" && isCurrent) {
        ctx.save();
        ctx.shadowColor = tierColor();
        ctx.shadowBlur = 18 + 8 * Math.sin(fc * 0.08);
        ctx.beginPath();
        ctx.arc(lx, ly, dialR + 4, 0, Math.PI * 2);
        ctx.strokeStyle = tierColor() + "50";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Main dial circle
      ctx.save();
      let fillColor: string;
      let borderColor: string;
      let borderWidth = 2;

      switch (l.status) {
        case "locked":
          fillColor = "#1a2540";
          borderColor = "#3a5070";
          break;
        case "cracking":
          fillColor = "#182440";
          borderColor = isCurrent ? tierColor() + "ee" : tierColor() + "70";
          borderWidth = isCurrent ? 3 : 2;
          if (isCurrent) {
            ctx.shadowColor = tierColor();
            ctx.shadowBlur = 10;
          }
          break;
        case "unlocked":
          fillColor = "rgba(34,197,94,0.15)";
          borderColor = "#22c55e";
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 12;
          break;
        case "failed":
          fillColor = "rgba(239,68,68,0.2)";
          borderColor = "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 14;
          break;
      }

      ctx.beginPath();
      ctx.arc(lx, ly, dialR, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      ctx.restore();

      // Inner content by status
      if (l.status === "unlocked") {
        // Green checkmark
        const s = dialR * 0.4;
        ctx.save();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(lx - s * 0.6, ly);
        ctx.lineTo(lx - s * 0.1, ly + s * 0.5);
        ctx.lineTo(lx + s * 0.7, ly - s * 0.5);
        ctx.stroke();
        ctx.restore();
      } else if (l.status === "failed") {
        // Red X
        const s = dialR * 0.35;
        ctx.save();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lx - s, ly - s);
        ctx.lineTo(lx + s, ly + s);
        ctx.moveTo(lx + s, ly - s);
        ctx.lineTo(lx - s, ly + s);
        ctx.stroke();
        ctx.restore();
      } else if (l.status === "cracking") {
        // Rotating dial with 8 notch marks + pointer
        const rotRad = (l.rotation * Math.PI) / 180;

        // 8 notch marks
        for (let n = 0; n < 8; n++) {
          const nAngle = rotRad + (Math.PI * 2 * n) / 8;
          const innerR = dialR - dialR * 0.3;
          const outerR = dialR - 4;
          ctx.beginPath();
          ctx.moveTo(lx + Math.cos(nAngle) * innerR, ly + Math.sin(nAngle) * innerR);
          ctx.lineTo(lx + Math.cos(nAngle) * outerR, ly + Math.sin(nAngle) * outerR);
          ctx.strokeStyle = isCurrent ? tierGlow() + "cc" : "rgba(255,255,255,0.3)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Pointer line
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(
          lx + Math.cos(rotRad) * (dialR * 0.7),
          ly + Math.sin(rotRad) * (dialR * 0.7),
        );
        ctx.strokeStyle = isCurrent ? tierColor() : "rgba(255,255,255,0.4)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? tierColor() : "rgba(255,255,255,0.4)";
        ctx.fill();
      } else {
        // Locked — padlock icon
        const s = dialR * 0.25;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(lx, ly - s * 0.6, s * 0.7, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(lx - s, ly, s * 2, s * 1.4);
        ctx.restore();
      }

      /* ── Progress dots (2 per lock) ── */
      const dotY = ly + dialR + 16;
      for (let d = 0; d < 2; d++) {
        const dx = lx - 7 + d * 14;
        const filled = d < l.currentStep;
        ctx.beginPath();
        ctx.arc(dx, dotY, 4, 0, Math.PI * 2);
        if (filled) {
          ctx.fillStyle = l.status === "unlocked" ? "#22c55e" : tierColor();
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Lock index label
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = isCurrent && l.status === "cracking"
        ? tierColor() + "cc"
        : "rgba(255,255,255,0.2)";
      ctx.fillText(`${i + 1}`, lx, dotY + 18);
    }

    /* ── Loot display bar ── */
    if (lootTextRef.current) {
      ctx.fillStyle = "rgba(10,14,23,0.9)";
      ctx.fillRect(0, CH - 50, CW, 50);
      ctx.strokeStyle = tierColor() + "30";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, CH - 50); ctx.lineTo(CW, CH - 50);
      ctx.stroke();

      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = tierColor() + "cc";
      ctx.fillText("POTENTIAL LOOT", CW / 2, CH - 32);
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = tierColor();
      ctx.fillText(lootTextRef.current, CW / 2, CH - 14);
    }

    /* ── Vault open celebration overlay ── */
    if (vaultOpenRef.current) {
      const t = Math.min(vaultOpenTimer.current, 2);
      const fadeIn = Math.min(1, t / 0.5);

      // Golden radial glow expanding from center
      ctx.save();
      ctx.globalAlpha = fadeIn * 0.35;
      const glow = ctx.createRadialGradient(CW / 2, 210, 0, CW / 2, 210, CW * 0.6 * Math.min(1, t / 1.2));
      glow.addColorStop(0, "#ffd700");
      glow.addColorStop(0.4, tierColor());
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();

      // Dark overlay for text readability
      ctx.fillStyle = `rgba(7,11,22,${fadeIn * 0.4})`;
      ctx.fillRect(0, 0, CW, CH);

      if (t > 0.3) {
        const textAlpha = Math.min(1, (t - 0.3) / 0.4);
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = tierColor();
        ctx.shadowBlur = 30;
        ctx.fillStyle = tierColor();
        ctx.fillText("VAULT CRACKED!", CW / 2, CH / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.font = "14px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText("All locks opened", CW / 2, CH / 2 + 14);
        ctx.restore();
      }
    }

    /* ── Particles ── */
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.06 * dt * 60;
      p.life -= dt;
      if (p.life <= 0) { particles.current.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      const hex = Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.fillStyle = p.color + hex;
      ctx.fill();
    }

    ctx.restore();
    frameCount.current++;
  }

  /* ─── RAF loop ─────────────────────────────────────── */

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
    id = requestAnimationFrame((now) => {
      lastTime.current = now;
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Handle ───────────────────────────────────────── */

  useImperativeHandle(ref, () => ({
    reset(tier: VaultTier) {
      tierRef.current = tier;
      const config = VAULT_CONFIG[tier];
      locksRef.current = Array.from({ length: config.lockCount }, (_, i) => ({
        status: (i === 0 ? "cracking" : "locked") as LockStatus,
        currentStep: 0,
        rotation: 0,
        targetRotation: 0,
        failFlashTimer: 0,
      }));
      currentLockRef.current = 0;
      alarmLevelRef.current = 0;
      lootTextRef.current = "";
      vaultOpenRef.current = false;
      vaultOpenTimer.current = 0;
      shakeRef.current = 0;
      particles.current = [];
    },

    setLocks(locks: LockState[]) {
      locksRef.current = locks.map((l, i) => {
        const existing = locksRef.current[i];
        return { ...l, rotation: existing?.rotation ?? l.rotation };
      });
    },

    setCurrentLock(index: number) {
      currentLockRef.current = index;
    },

    setAlarmLevel(level: number) {
      alarmLevelRef.current = level;
    },

    triggerCorrect(lockIndex: number) {
      const lock = locksRef.current[lockIndex];
      if (lock) {
        lock.targetRotation += 90;
        lock.currentStep = Math.min(2, lock.currentStep + 1);
      }
      const pos = getDialLayout(locksRef.current.length)[lockIndex];
      if (pos) {
        burstParticles(pos.cx, pos.cy, "#22c55e", 10);
        burstParticles(pos.cx, pos.cy, tierColor(), 6);
      }
    },

    triggerWrong(lockIndex: number) {
      const lock = locksRef.current[lockIndex];
      if (lock) {
        lock.status = "failed";
        lock.failFlashTimer = 500;
      }
      shakeRef.current = 12;
      const pos = getDialLayout(locksRef.current.length)[lockIndex];
      if (pos) {
        burstParticles(pos.cx, pos.cy, "#ef4444", 14);
      }
    },

    triggerUnlock(lockIndex: number) {
      const pos = getDialLayout(locksRef.current.length)[lockIndex];
      setTimeout(() => {
        const lock = locksRef.current[lockIndex];
        if (lock) lock.status = "unlocked";
        if (pos) {
          burstParticles(pos.cx, pos.cy, "#22c55e", 18);
          burstParticles(pos.cx, pos.cy, "#ffd700", 12);
        }
        const next = locksRef.current[lockIndex + 1];
        if (next && next.status === "locked") {
          next.status = "cracking";
        }
      }, 400);
    },

    triggerVaultOpen() {
      vaultOpenRef.current = true;
      vaultOpenTimer.current = 0;
      // Massive burst from each dial
      const layout = getDialLayout(locksRef.current.length);
      for (const pos of layout) {
        burstParticles(pos.cx, pos.cy, "#ffd700", 20);
        burstParticles(pos.cx, pos.cy, "#ffffff", 8);
      }
      // Center burst
      burstParticles(CW / 2, 210, "#ffd700", 30);
      burstParticles(CW / 2, 210, tierColor(), 15);
    },

    setLootDisplay(amount: string) {
      lootTextRef.current = amount;
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

VaultHeistCanvas.displayName = "VaultHeistCanvas";
export default VaultHeistCanvas;
