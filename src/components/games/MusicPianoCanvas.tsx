"use client";

import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

export interface PianoCanvasHandle {
  triggerTick: (dir: "up" | "down" | "flat") => void;
  triggerEnd: (playerWon: boolean) => void;
  playMelodyReplay: () => void;
  reset: () => void;
}

/* ─── Dimensions ─────────────────────────────────────────── */

export const CW = 600;
export const CH = 420;
const ROLL_H   = 220; // top section: note roll
const KEYS_H   = 200; // bottom section: keyboard
const KEYS_Y   = ROLL_H;

/* ─── Pentatonic scale: C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 C6 ── */

const NOTE_NAMES = ["C4","D4","E4","G4","A4","C5","D5","E5","G5","A5","C6"];
const NOTE_FREQS = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
const NOTE_COUNT = NOTE_NAMES.length; // 11
const START_NOTE = 5; // C5

/* ─── White key layout for 2 octaves C4–C6 ──────────────── */
// Notes in each octave order: C D E F G A B (7 white) + C (top)
// For our 2 octaves C4→C6 we have 15 white keys: C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6
const WHITE_NOTE_NAMES = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5","B5","C6"];
const WHITE_COUNT = 15;
const KEY_W = Math.floor((CW - 4) / WHITE_COUNT); // ~39px each
const KEY_H = KEYS_H - 8;

// Black keys: positions between specific white keys (in half-step semitones)
// "Cs4"=1,"Ds4"=3,"Fs4"=6,"Gs4"=8,"As4"=10, then same +12 for octave 5
interface BlackKey { label: string; whiteLeft: number }
const BLACK_KEYS: BlackKey[] = [
  { label: "C#4", whiteLeft: 0 }, { label: "D#4", whiteLeft: 1 },
  { label: "F#4", whiteLeft: 3 }, { label: "G#4", whiteLeft: 4 }, { label: "A#4", whiteLeft: 5 },
  { label: "C#5", whiteLeft: 7 }, { label: "D#5", whiteLeft: 8 },
  { label: "F#5", whiteLeft: 10 }, { label: "G#5", whiteLeft: 11 }, { label: "A#5", whiteLeft: 12 },
];
const BLACK_W = Math.round(KEY_W * 0.6);
const BLACK_H = Math.round(KEY_H * 0.62);

/* ─── Color gradient for note roll (low→high) ────────────── */

function noteColor(idx: number, alpha = 1): string {
  // low = cool blue, high = warm gold, middle = teal
  const t = idx / (NOTE_COUNT - 1);
  const r = Math.round(20  + t * 235);
  const g = Math.round(150 - t * 30);
  const b = Math.round(255 - t * 180);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ─── Note dot in roll ───────────────────────────────────── */

interface NoteDot { x: number; y: number; noteIdx: number; age: number }

/* ─── Canvas component ───────────────────────────────────── */

const MusicPianoCanvas = forwardRef<PianoCanvasHandle>((_, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const lastTime   = useRef(0);

  const noteIdx    = useRef(START_NOTE);
  const melody     = useRef<number[]>([]); // recorded note indices
  const dots       = useRef<NoteDot[]>([]); // visible roll dots
  const dotTimer   = useRef(0);
  const activeNote = useRef<number | null>(null); // key glow
  const glowTime   = useRef(0);
  const endState   = useRef<boolean | null>(null); // null=live, true=won, false=lost

  /* Web Audio context — lazily created on first note */
  const audioCtx   = useRef<AudioContext | null>(null);
  function getAudio(): AudioContext {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtx.current;
  }

  function playNote(idx: number, when: number, duration = 0.22) {
    try {
      const ctx = getAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(NOTE_FREQS[idx], when);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.35, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.01);
    } catch (_) { /* ignore */ }
  }

  /* ─── Draw ─────────────────────────────────────────────── */

  function draw(ctx: CanvasRenderingContext2D, dt: number) {
    /* tick timers */
    glowTime.current = Math.max(0, glowTime.current - dt);

    ctx.clearRect(0, 0, CW, CH);

    /* ── Background ── */
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, CW, CH);

    /* roll area bg */
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, CW, ROLL_H);

    /* scanlines effect */
    for (let y = 0; y < ROLL_H; y += 4) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, y, CW, 1);
    }

    /* horizontal note lanes */
    for (let i = 0; i < NOTE_COUNT; i++) {
      const ly = ROLL_H - 20 - (i / (NOTE_COUNT - 1)) * (ROLL_H - 40);
      ctx.strokeStyle = `rgba(255,255,255,0.04)`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(CW, ly);
      ctx.stroke();

      /* lane label */
      ctx.font      = "9px monospace";
      ctx.fillStyle = noteColor(i, 0.3);
      ctx.textAlign = "right";
      ctx.fillText(NOTE_NAMES[i], CW - 4, ly - 2);
    }
    ctx.textAlign = "left";

    /* active note lane highlight */
    if (glowTime.current > 0) {
      const aN = activeNote.current;
      if (aN !== null) {
        const ly = ROLL_H - 20 - (aN / (NOTE_COUNT - 1)) * (ROLL_H - 40);
        ctx.strokeStyle = noteColor(aN, glowTime.current / 0.35);
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(CW, ly);
        ctx.stroke();
      }
    }

    /* move + draw dots */
    const scrollSpeed = 80; // px/s
    for (let i = dots.current.length - 1; i >= 0; i--) {
      const d = dots.current[i];
      d.x -= scrollSpeed * dt;
      d.age += dt;
      if (d.x < -20) { dots.current.splice(i, 1); continue; }
      const alpha = Math.min(1, d.age * 4) * (d.x > 0 ? 1 : 0.5);
      const col   = noteColor(d.noteIdx, alpha);
      const r     = 6;
      /* glow */
      ctx.save();
      ctx.shadowColor = noteColor(d.noteIdx);
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    }

    /* playhead line */
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CW - 60, 0);
    ctx.lineTo(CW - 60, ROLL_H);
    ctx.stroke();
    ctx.setLineDash([]);

    /* ── Piano keyboard ── */
    const kbX = 2;
    const kbY = KEYS_Y + 4;
    const act  = activeNote.current;

    /* Draw white keys */
    for (let i = 0; i < WHITE_COUNT; i++) {
      const x = kbX + i * KEY_W;
      const wName = WHITE_NOTE_NAMES[i];
      const isActive = act !== null && NOTE_NAMES[act] === wName && glowTime.current > 0;
      ctx.fillStyle = isActive ? "#d4fce8" : "#e8eef4";
      ctx.fillRect(x, kbY, KEY_W - 2, KEY_H);
      ctx.strokeStyle = "#333";
      ctx.lineWidth   = 1;
      ctx.strokeRect(x, kbY, KEY_W - 2, KEY_H);

      /* glow overlay */
      if (isActive) {
        const alpha = glowTime.current / 0.35;
        ctx.fillStyle = `rgba(34,197,94,${0.45 * alpha})`;
        ctx.fillRect(x, kbY, KEY_W - 2, KEY_H);
        ctx.save();
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur  = 18 * alpha;
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth   = 2;
        ctx.strokeRect(x, kbY, KEY_W - 2, KEY_H);
        ctx.restore();
      }

      /* key label */
      if (i % 7 === 0) { // C notes only
        ctx.fillStyle = isActive ? "#22c55e" : "#667788";
        ctx.font      = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(wName, x + (KEY_W - 2) / 2, kbY + KEY_H - 8);
      }
    }
    ctx.textAlign = "left";

    /* Draw black keys (on top) */
    for (const bk of BLACK_KEYS) {
      const x = kbX + bk.whiteLeft * KEY_W + Math.round(KEY_W * 0.62);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(x, kbY, BLACK_W, BLACK_H);
      ctx.strokeStyle = "#000";
      ctx.lineWidth   = 1;
      ctx.strokeRect(x, kbY, BLACK_W, BLACK_H);
    }

    /* ── End overlay ── */
    if (endState.current !== null) {
      const won  = endState.current;
      const text = won ? "🏆 HARMONY!" : "💀 DISCORD";
      const col  = won ? "#22c55e" : "#ef4444";
      ctx.save();
      ctx.fillStyle = "rgba(7,11,22,0.70)";
      ctx.fillRect(0, 0, CW, ROLL_H);
      ctx.restore();
      ctx.font      = "bold 38px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = col;
      ctx.shadowBlur  = 30;
      ctx.fillStyle   = col;
      ctx.fillText(text, CW / 2, ROLL_H / 2 + 8);
      ctx.shadowBlur  = 0;
      ctx.font        = "12px monospace";
      ctx.fillStyle   = "rgba(255,255,255,0.5)";
      ctx.fillText(`${melody.current.length} notes played`, CW / 2, ROLL_H / 2 + 34);
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

  /* ─── Handle ────────────────────────────────────────────── */

  useImperativeHandle(ref, () => ({
    reset() {
      noteIdx.current    = START_NOTE;
      melody.current     = [];
      dots.current       = [];
      dotTimer.current   = 0;
      activeNote.current = null;
      glowTime.current   = 0;
      endState.current   = null;
    },

    triggerEnd(playerWon: boolean) {
      endState.current = playerWon;
    },

    triggerTick(dir: "up" | "down" | "flat") {
      if (endState.current !== null) return;

      let ni = noteIdx.current;
      if      (dir === "up")   ni = Math.min(NOTE_COUNT - 1, ni + 1);
      else if (dir === "down") ni = Math.max(0, ni - 1);
      noteIdx.current    = ni;
      activeNote.current = ni;
      glowTime.current   = 0.35;

      if (dir !== "flat") {
        melody.current.push(ni);
        /* Add dot to roll at playhead */
        const dotY = ROLL_H - 20 - (ni / (NOTE_COUNT - 1)) * (ROLL_H - 40);
        dots.current.push({ x: CW - 60, y: dotY, noteIdx: ni, age: 0 });
        /* Play note */
        playNote(ni, getAudio().currentTime);
      }
    },

    playMelodyReplay() {
      const notes = melody.current;
      if (notes.length === 0) return;
      const ctx = getAudio();
      const noteLen = 0.28;
      const gap     = 0.05;
      let t = ctx.currentTime + 0.1;
      for (const n of notes) {
        playNote(n, t, noteLen);
        t += noteLen + gap;
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

MusicPianoCanvas.displayName = "MusicPianoCanvas";
export default MusicPianoCanvas;
