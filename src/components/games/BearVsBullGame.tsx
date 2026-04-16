"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { CanvasHandle, TickEvent } from "./BearVsBullCanvas";
import type { DuelConfig } from "@/components/games/multiplayer/GameLobby";

/* ─── Dynamic import (SSR disabled for Three.js) ────────── */

const BearVsBullCanvas = dynamic(() => import("./BearVsBullCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#080d18" }}
    >
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading arena…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",   label: "Volatility 100" },
  { symbol: "R_75",    label: "Volatility 75"  },
  { symbol: "R_50",    label: "Volatility 50"  },
  { symbol: "1HZ100V", label: "Vol 100 (1s)"   },
  { symbol: "1HZ75V",  label: "Vol 75 (1s)"    },
  { symbol: "1HZ50V",  label: "Vol 50 (1s)"    },
  { symbol: "1HZ25V",  label: "Vol 25 (1s)"    },
  { symbol: "1HZ10V",  label: "Vol 10 (1s)"    },
];

const TICK_OPTIONS = [5, 10, 20] as const;
const STAKE_PRESETS = [5, 10, 25, 50];

/* ─── Commentary ─────────────────────────────────────────── */

const COMMENTARY = {
  critBull:  ["MASSIVE BULL SURGE! 🐂⚡", "PRICE EXPLODES! 🚀", "BULL DOMINATES THE RING! 💥", "UNSTOPPABLE GREEN CANDLE! 🟢"],
  critBear:  ["BEAR SMASHES THROUGH! 🐻⚡", "MARKET CRASHES HARD! 📉", "BRUTAL BEAR MAULING! 💥", "RED CANDLE DEVASTATION! 🔴"],
  comboBull: ["BULL ON A ROLL! 🔥🐂", "CONSECUTIVE GREENS! 🟢🟢🟢", "THE BULLS WON'T STOP! ⚡"],
  comboBear: ["BEARS KEEP HAMMERING! 🔥🐻", "RED CANDLES ALL DAY! 🔴🔴🔴", "RELENTLESS BEAR FORCE! ⚡"],
  powerBull: ["POWER COMBO! BULL SURGING! 🌊", "5× BULL STREAK! THE CROWD GOES WILD! 🎉"],
  powerBear: ["POWER COMBO! BEAR RAMPAGING! 🌊", "5× BEAR STREAK! PANIC IN THE ARENA! 😱"],
  lowHpBull: ["BULL IS IN DANGER! ❤️", "THE BULL IS BARELY STANDING! 😰", "BULL ON THE ROPES! 🚨"],
  lowHpBear: ["BEAR IS WOBBLING! ❤️", "THE BEAR IS DOWN TO LAST HP! 😱", "BEAR ON THE BRINK! 🚨"],
};

function pickComment(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ─── Damage calculation ─────────────────────────────────── */

function getDamage(
  consecutiveCount: number,
  delta: number,
  totalTicks: number
): number {
  const base = (100 * 0.6) / totalTicks;
  const sizeMult = Math.abs(delta) > 0.8 ? 1.4 : Math.abs(delta) > 0.2 ? 1.0 : 0.8;
  const comboMult = consecutiveCount >= 5 ? 2.2 : consecutiveCount >= 3 ? 1.5 : 1.0;
  return Math.max(1, Math.round(base * sizeMult * comboMult));
}

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type Side = "bull" | "bear";

interface FightResult {
  bullHP: number;
  bearHP: number;
  winner: Side;
  playerWon: boolean;
  buyPrice: number;
  payout: number;
  cashedOut?: boolean;
}

/* ─── HP Bar ─────────────────────────────────────────────── */

function HpBar({ hp, maxHp = 100, color, label, align }: {
  hp: number;
  maxHp?: number;
  color: string;
  label: string;
  align: "left" | "right";
}) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const barColor = pct > 50 ? color : pct > 25 ? "#eab308" : "#ef4444";

  return (
    <div
      className="flex flex-col gap-1"
      style={{ minWidth: 160, alignItems: align === "left" ? "flex-start" : "flex-end" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color }}>
          {Math.max(0, hp)}HP
        </span>
      </div>
      <div
        style={{
          width: 160,
          height: 8,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 4,
          overflow: "hidden",
          ...(align === "right" ? { direction: "rtl" } : {}),
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            borderRadius: 4,
            transition: "width 0.3s ease, background 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Tick feed entry ────────────────────────────────────── */

interface TickEntry {
  n: number;
  quote: number;
  delta: number;
  dir: "up" | "down" | "flat";
}

function TickFeed({ ticks }: { ticks: TickEntry[] }) {
  if (ticks.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 70,
        width: 130,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: 2 }}>
        LIVE TICKS
      </div>
      {ticks.slice(-8).reverse().map((t, i) => (
        <div
          key={t.n}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "3px 8px",
            borderRadius: 4,
            background: "rgba(6,11,20,0.82)",
            border: `1px solid ${t.dir === "up" ? "rgba(34,197,94,0.25)" : t.dir === "down" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.05)"}`,
            opacity: Math.max(0.25, 1 - i * 0.1),
          }}
        >
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>
            #{t.n}
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-primary)" }}>
            {t.quote.toFixed(2)}
          </span>
          <span style={{ fontSize: 13, color: t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "var(--text-muted)" }}>
            {t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "—"}
          </span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "var(--text-muted)" }}>
            {t.delta > 0 ? "+" : ""}{t.delta.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Sound engine (Web Audio API — no files) ────────────── */

function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playHit = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.16);
  }, [getCtx]);

  const playCritical = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [0, 0.04].forEach((delay, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(i === 0 ? 380 : 190, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + delay + 0.28);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.30);
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.30);
    });
  }, [getCtx]);

  const playCombo = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [330, 440, 550].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
      gain.gain.setValueAtTime(0.09, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.14);
      osc.start(ctx.currentTime + i * 0.09); osc.stop(ctx.currentTime + i * 0.09 + 0.14);
    });
  }, [getCtx]);

  const playKO = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.85);
  }, [getCtx]);

  const playVictory = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.13);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.22);
      osc.start(ctx.currentTime + i * 0.13); osc.stop(ctx.currentTime + i * 0.13 + 0.22);
    });
  }, [getCtx]);

  return { playHit, playCritical, playCombo, playKO, playVictory };
}

/* ─── Hit announcement ───────────────────────────────────── */

function HitAnnouncement({ text, color }: { text: string; color: string }) {
  return (
    <div
      className="animate-in zoom-in-75 duration-200"
      style={{
        fontSize: 20,
        fontWeight: "bold",
        fontFamily: "monospace",
        color,
        textShadow: `0 0 20px ${color}`,
        letterSpacing: "0.1em",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function BearVsBullGame({ duelConfig }: { duelConfig?: DuelConfig } = {}) {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useGameSounds();

  const [symbol, setSymbol] = useState(duelConfig?.symbol ?? "R_100");
  const [totalTicks, setTotalTicks] = useState<5 | 10 | 20>(
    (duelConfig?.ticksPerRound as 5 | 10 | 20 | undefined) ?? 10
  );
  const [stake, setStake] = useState(10);
  const [playerSide, setPlayerSide] = useState<Side>(duelConfig?.myRole ?? "bull");
  const [gameState, setGameState] = useState<GameState>("idle");

  // Live state
  const [bullHP, setBullHP] = useState(100);
  const [bearHP, setBearHP] = useState(100);
  const [tickCount, setTickCount] = useState(0);
  const [announcement, setAnnouncement] = useState<{ text: string; color: string } | null>(null);
  const [result, setResult] = useState<FightResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [tickHistory, setTickHistory] = useState<TickEntry[]>([]);

  // Refs
  const gameStateRef = useRef<GameState>("idle");
  const bullHPRef = useRef(100);
  const bearHPRef = useRef(100);
  const tickCountRef = useRef(0);
  const prevTickEpoch = useRef<number | null>(null);
  const prevQuoteRef = useRef<number | null>(null);
  const consecutiveDir = useRef<"up" | "down" | null>(null);
  const consecutiveCount = useRef(0);
  const totalTicksRef = useRef(10);
  const stakeRef = useRef(10);
  const playerSideRef = useRef<Side>("bull");
  const canvasRef = useRef<CanvasHandle>(null);
  const needsCanvasReset = useRef(false);
  const contractIdRef = useRef<number | null>(null);
  const announcementTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tick, direction } = useTicks(symbol);

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { totalTicksRef.current = totalTicks; }, [totalTicks]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { playerSideRef.current = playerSide; }, [playerSide]);

  const onCanvasReady = useCallback((handle: CanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<CanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.triggerBattleStart();
    }
  }, []);

  /* ─── Show announcement ──────────────────────────────── */

  const showAnnouncement = useCallback((text: string, color: string) => {
    if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
    setAnnouncement({ text, color });
    announcementTimeout.current = setTimeout(() => setAnnouncement(null), 1500);
  }, []);

  /* ─── Buy contract ───────────────────────────────────── */

  const buyContract = useCallback((side: Side, stakeAmt: number, sym: string, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "bull" ? "CALL" : "PUT";

    authWs.send({
      proposal: 1,
      amount: stakeAmt,
      basis: "stake",
      contract_type: contractType,
      currency,
      duration: ticks,
      duration_unit: "t",
      underlying_symbol: sym,
    }, (propData) => {
      if (propData.error) {
        setBuyError((propData.error as { message: string }).message);
        return;
      }
      const prop = propData.proposal as { id: string; ask_price: number } | undefined;
      if (!prop?.id) return;

      authWs.send({ buy: prop.id, price: prop.ask_price }, (buyData) => {
        if (buyData.error) {
          setBuyError((buyData.error as { message: string }).message);
          return;
        }
        const bought = buyData.buy as { contract_id?: number } | undefined;
        if (bought?.contract_id) contractIdRef.current = bought.contract_id;
      });
    });
  }, [authWs, authStatus, currency]);

  /* ─── Cash Out (sell contract early) ────────────────── */

  const handleCashOut = useCallback(() => {
    if (!authWs || authStatus !== "connected") return;
    if (gameStateRef.current !== "live") return;
    const contractId = contractIdRef.current;
    if (!contractId) return;

    setGameState("result");
    gameStateRef.current = "result";

    authWs.send({ sell: contractId, price: 0 }, (sellData) => {
      const sold = sellData.sell as { sold_for?: number } | undefined;
      const payout = sold?.sold_for ?? 0;
      setResult({
        bullHP: bullHPRef.current,
        bearHP: bearHPRef.current,
        winner: bullHPRef.current >= bearHPRef.current ? "bull" : "bear",
        playerWon: payout > stakeRef.current,
        buyPrice: stakeRef.current,
        payout,
        cashedOut: true,
      });
    });
  }, [authWs, authStatus]);

  /* ─── Launch ─────────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    // Reset
    setBullHP(100);
    setBearHP(100);
    bullHPRef.current = 100;
    bearHPRef.current = 100;
    setTickCount(0);
    tickCountRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    consecutiveDir.current = null;
    consecutiveCount.current = 0;
    contractIdRef.current = null;
    setBuyError(null);
    setAnnouncement(null);
    setTickHistory([]);

    setGameState("live");
    gameStateRef.current = "live";

    needsCanvasReset.current = true;
    if (canvasRef.current) {
      canvasRef.current.triggerBattleStart();
      needsCanvasReset.current = false;
    }
    buyContract(playerSide, stake, symbol, totalTicks);
  };

  /* ─── Tick processing ────────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return; // First tick — no delta yet

    const delta = tick.quote - prevQ;
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    // Update combo state
    if (dir !== "flat") {
      if (dir === consecutiveDir.current) {
        consecutiveCount.current += 1;
      } else {
        consecutiveDir.current = dir;
        consecutiveCount.current = 1;
      }
    }

    const count = consecutiveCount.current;
    const isCombo = count >= 3;
    const isCritical = Math.abs(delta) > 0.8;

    // Calculate damage
    const attacker: Side | null = dir === "up" ? "bull" : dir === "down" ? "bear" : null;
    let damage = 0;
    if (attacker) {
      damage = getDamage(count, delta, totalTicksRef.current);
    }

    // Update HP
    if (attacker === "bull") {
      const newHP = Math.max(0, bearHPRef.current - damage);
      bearHPRef.current = newHP;
      setBearHP(newHP);
    } else if (attacker === "bear") {
      const newHP = Math.max(0, bullHPRef.current - damage);
      bullHPRef.current = newHP;
      setBullHP(newHP);
    }

    // Sync HP to 3D canvas bars
    canvasRef.current?.updateHP(bullHPRef.current, bearHPRef.current);

    // Trigger canvas animation
    if (canvasRef.current && attacker) {
      const impactPoint: [number, number, number] =
        attacker === "bull" ? [2.2, 1.2, 0] : [-2.2, 1.2, 0];

      const tickEvent: TickEvent = {
        direction: dir,
        attacker,
        damage,
        isCombo,
        isCritical,
        impactPoint,
      };
      canvasRef.current.triggerTick(tickEvent);
    }

    // Push to tick history
    setTickHistory((prev) => [
      ...prev,
      { n: tickCountRef.current + 1, quote: tick.quote, delta, dir },
    ]);

    // Sounds + announcements
    const bullColor = "#22c55e";
    const bearColor = "#ef4444";
    if (isCritical && attacker) {
      sounds.playCritical();
      showAnnouncement(
        pickComment(attacker === "bull" ? COMMENTARY.critBull : COMMENTARY.critBear),
        attacker === "bull" ? bullColor : bearColor,
      );
    } else if (count >= 5 && attacker) {
      sounds.playCombo();
      showAnnouncement(
        pickComment(attacker === "bull" ? COMMENTARY.powerBull : COMMENTARY.powerBear),
        attacker === "bull" ? bullColor : bearColor,
      );
    } else if (count === 3 && attacker) {
      sounds.playCombo();
      showAnnouncement(
        pickComment(attacker === "bull" ? COMMENTARY.comboBull : COMMENTARY.comboBear),
        attacker === "bull" ? bullColor : bearColor,
      );
    } else if (attacker) {
      sounds.playHit();
    }

    // Low-HP commentary (trigger once when crossing 30%)
    if (attacker === "bull" && bearHPRef.current <= 30 && bearHPRef.current + damage > 30) {
      showAnnouncement(pickComment(COMMENTARY.lowHpBear), bearColor);
    } else if (attacker === "bear" && bullHPRef.current <= 30 && bullHPRef.current + damage > 30) {
      showAnnouncement(pickComment(COMMENTARY.lowHpBull), bullColor);
    }

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    // Check for early KO or end of round
    const bullKO = bullHPRef.current <= 0;
    const bearKO = bearHPRef.current <= 0;
    const roundOver = nextCount >= totalTicksRef.current || bullKO || bearKO;

    if (roundOver) {
      const winner: Side =
        bullKO ? "bear" :
        bearKO ? "bull" :
        bullHPRef.current >= bearHPRef.current ? "bull" : "bear";

      setTimeout(() => {
        canvasRef.current?.triggerKO(winner === "bull" ? "bear" : "bull");
        sounds.playKO();
        setTimeout(() => {
          canvasRef.current?.triggerVictory(winner);
          sounds.playVictory();
          const fightResult: FightResult = {
            bullHP: bullHPRef.current,
            bearHP: bearHPRef.current,
            winner,
            playerWon: winner === playerSideRef.current,
            buyPrice: stakeRef.current,
            payout: winner === playerSideRef.current ? stakeRef.current * 1.85 : 0,
          };
          setResult(fightResult);
          setGameState("result");
          gameStateRef.current = "result";
        }, 1500);
      }, 400);
    }
  }, [tick, showAnnouncement, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ──────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle");
    gameStateRef.current = "idle";
    setBullHP(100);
    setBearHP(100);
    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setAnnouncement(null);
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    consecutiveDir.current = null;
    consecutiveCount.current = 0;
    canvasRef.current?.resetArena();
  };

  useEffect(() => () => {
    if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
  }, []);

  const displayPrice = tick ? tick.quote.toString() : "—";
  const canLaunch = authStatus === "connected";

  /* ─── Idle (Duel mode) ──────────────────────────────────── */

  if (gameState === "idle" && duelConfig) {
    const roleColor = duelConfig.myRole === "bull" ? "#22c55e" : "#ef4444";
    return (
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        {/* Hero banner */}
        <div style={{
          borderRadius: 16, overflow: "hidden", marginBottom: 20,
          background: `linear-gradient(135deg, ${roleColor}20 0%, rgba(168,85,247,0.08) 100%)`,
          border: `1px solid ${roleColor}30`,
          padding: "28px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.2em", color: roleColor, marginBottom: 8 }}>
            DUEL MODE
          </div>
          <div style={{ fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 16 }}>
            {duelConfig.myRole === "bull" ? "BULL" : "BEAR"}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 4 }}>MARKET</div>
              <div style={{ fontSize: 15, fontFamily: "monospace", color: "#fff", fontWeight: "bold" }}>{duelConfig.symbol}</div>
            </div>
            <div style={{ width: 1, background: `${roleColor}40` }} />
            <div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 4 }}>ROUND</div>
              <div style={{ fontSize: 15, fontFamily: "monospace", color: "#fff", fontWeight: "bold" }}>{duelConfig.ticksPerRound} ticks</div>
            </div>
          </div>
        </div>

        {/* Stake selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#fff", fontWeight: "bold", marginBottom: 10 }}>
            YOUR STAKE ({currency})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {STAKE_PRESETS.map((p) => (
              <button key={p} onClick={() => setStake(p)} style={{
                padding: "14px 0", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                border: `2px solid ${stake === p ? roleColor : "rgba(255,255,255,0.1)"}`,
                background: stake === p ? `${roleColor}18` : "rgba(255,255,255,0.03)",
                color: stake === p ? "#fff" : "var(--text-secondary)",
                fontSize: 18, fontWeight: "bold", fontFamily: "monospace",
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {buyError && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
            {buyError}
          </div>
        )}

        {!canLaunch && (
          <div style={{ color: "#eab308", fontSize: 12, fontFamily: "monospace", marginBottom: 12, textAlign: "center" }}>
            Connecting to trading server…
          </div>
        )}

        <button onClick={handleLaunch} disabled={!canLaunch} style={{
          width: "100%", padding: "18px 0", borderRadius: 12, cursor: canLaunch ? "pointer" : "not-allowed",
          border: `2px solid ${roleColor}80`,
          background: `linear-gradient(135deg, ${roleColor}25 0%, ${roleColor}10 100%)`,
          color: canLaunch ? "#fff" : "var(--text-muted)",
          fontSize: 18, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.15em",
          opacity: canLaunch ? 1 : 0.45, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.25s", boxShadow: canLaunch ? `0 4px 20px ${roleColor}30` : "none",
        }}>
          <Zap style={{ width: 20, height: 20 }} />
          FIGHT!
        </button>
      </div>
    );
  }

  /* ─── Idle (Solo mode) ───────────────────────────────────── */

  if (gameState === "idle") {
    const sideColor = playerSide === "bull" ? "#22c55e" : "#ef4444";
    return (
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Hero header */}
        <div style={{
          borderRadius: 16, overflow: "hidden", marginBottom: 24,
          background: "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.05) 100%)",
          border: "1px solid rgba(168,85,247,0.2)", padding: "24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.25em", color: "#a855f7", marginBottom: 6 }}>
            BEAR VS BULL
          </div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>
            Choose Your Fighter
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            3D arena fight powered by live market ticks
          </div>
        </div>

        {/* Side selection — big visual cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {(["bull", "bear"] as Side[]).map((side) => {
            const isBull = side === "bull";
            const c = isBull ? "#22c55e" : "#ef4444";
            const sel = playerSide === side;
            return (
              <button key={side} onClick={() => setPlayerSide(side)} style={{
                padding: "22px 16px", borderRadius: 14, cursor: "pointer", transition: "all 0.25s",
                border: `2px solid ${sel ? c + "80" : "rgba(255,255,255,0.08)"}`,
                background: sel
                  ? `linear-gradient(135deg, ${c}20 0%, ${c}08 100%)`
                  : "rgba(255,255,255,0.02)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                boxShadow: sel ? `0 4px 24px ${c}25` : "none",
                transform: sel ? "scale(1.02)" : "scale(1)",
              }}>
                {isBull
                  ? <TrendingUp style={{ width: 32, height: 32, color: sel ? "#fff" : c, filter: sel ? `drop-shadow(0 0 8px ${c})` : "none" }} />
                  : <TrendingDown style={{ width: 32, height: 32, color: sel ? "#fff" : c, filter: sel ? `drop-shadow(0 0 8px ${c})` : "none" }} />
                }
                <div style={{ fontSize: 18, fontWeight: "bold", fontFamily: "monospace", color: sel ? "#fff" : "var(--text-secondary)" }}>
                  {side.toUpperCase()}
                </div>
                <div style={{ fontSize: 10, color: sel ? c : "var(--text-muted)", fontFamily: "monospace" }}>
                  {isBull ? "Price goes UP = you win" : "Price goes DOWN = you win"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Market selection */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#fff", fontWeight: "bold", marginBottom: 10 }}>
            MARKET
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {GAME_MARKETS.map((m) => {
              const sel = symbol === m.symbol;
              return (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "8px 6px", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                  border: `2px solid ${sel ? "#a855f7" + "70" : "rgba(255,255,255,0.08)"}`,
                  background: sel ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  fontSize: 11, fontFamily: "monospace", fontWeight: sel ? "bold" : "normal",
                }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Round length */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#fff", fontWeight: "bold", marginBottom: 10 }}>
            ROUND LENGTH
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {TICK_OPTIONS.map((t) => {
              const sel = totalTicks === t;
              return (
                <button key={t} onClick={() => setTotalTicks(t)} style={{
                  padding: "14px 0", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                  border: `2px solid ${sel ? sideColor + "60" : "rgba(255,255,255,0.08)"}`,
                  background: sel ? `${sideColor}12` : "rgba(255,255,255,0.03)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  fontSize: 16, fontWeight: "bold", fontFamily: "monospace",
                }}>
                  {t}
                  <span style={{ fontSize: 10, fontWeight: "normal", marginLeft: 4, opacity: 0.7 }}>ticks</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stake */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#fff", fontWeight: "bold", marginBottom: 10 }}>
            STAKE ({currency})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {STAKE_PRESETS.map((p) => {
              const sel = stake === p;
              return (
                <button key={p} onClick={() => setStake(p)} style={{
                  padding: "14px 0", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                  border: `2px solid ${sel ? sideColor + "60" : "rgba(255,255,255,0.08)"}`,
                  background: sel ? `${sideColor}12` : "rgba(255,255,255,0.03)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  fontSize: 18, fontWeight: "bold", fontFamily: "monospace",
                }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: `${sideColor}10`, border: `1px solid ${sideColor}25`,
          fontSize: 12, color: sideColor, fontFamily: "monospace", textAlign: "center",
        }}>
          {playerSide === "bull"
            ? "Bull wins if price trends UP — buys a CALL contract"
            : "Bear wins if price trends DOWN — buys a PUT contract"}
        </div>

        {buyError && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
            {buyError}
          </div>
        )}

        {!canLaunch && (
          <div style={{ color: "#eab308", fontSize: 12, fontFamily: "monospace", marginBottom: 12, textAlign: "center" }}>
            Connecting to trading server…
          </div>
        )}

        <button onClick={handleLaunch} disabled={!canLaunch} style={{
          width: "100%", padding: "18px 0", borderRadius: 12, cursor: canLaunch ? "pointer" : "not-allowed",
          border: `2px solid ${sideColor}80`,
          background: canLaunch
            ? `linear-gradient(135deg, ${sideColor}25 0%, ${sideColor}10 100%)`
            : "rgba(255,255,255,0.02)",
          color: canLaunch ? "#fff" : "var(--text-muted)",
          fontSize: 18, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.15em",
          opacity: canLaunch ? 1 : 0.45,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.25s", boxShadow: canLaunch ? `0 4px 24px ${sideColor}30` : "none",
        }}>
          <Zap style={{ width: 20, height: 20 }} />
          FIGHT!
        </button>
      </div>
    );
  }

  /* ─── Live + Result: full arena view ────────────────────── */

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ minHeight: "calc(100vh - 220px)" }}
    >
      {/* 3D Canvas fills entire container */}
      <div className="absolute inset-0">
        <BearVsBullCanvas ref={onCanvasReady} />
      </div>

      {/* HUD overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Top HUD: HP bars + tick counter */}
        <div
          className="flex items-start justify-between"
          style={{ padding: "16px 20px" }}
        >
          <HpBar hp={bullHP} color="#22c55e" label="🐂 BULL" align="left" />

          {/* Center: tick counter + direction */}
          <div className="flex flex-col items-center gap-1">
            {gameState === "live" && (
              <>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--text-muted)",
                    letterSpacing: "0.2em",
                  }}
                >
                  TICK {tickCount} / {totalTicks}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "monospace",
                    color:
                      direction === "up" ? "#22c55e"
                      : direction === "down" ? "#ef4444"
                      : "var(--text-muted)",
                  }}
                >
                  {displayPrice}
                </span>
                {direction && (
                  <span style={{ fontSize: 16 }}>
                    {direction === "up" ? "↑" : "↓"}
                  </span>
                )}
              </>
            )}
            {gameState === "result" && result && (
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: result.playerWon
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(239,68,68,0.15)",
                  border: `1px solid ${result.playerWon ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                  color: result.playerWon ? "#22c55e" : "#ef4444",
                  fontSize: 16,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                }}
              >
                {result.playerWon ? "YOU WIN!" : "YOU LOSE"}
              </div>
            )}
          </div>

          <HpBar hp={bearHP} color="#ef4444" label="🐻 BEAR" align="right" />
        </div>

        {/* Live tick feed */}
        {gameState === "live" && <TickFeed ticks={tickHistory} />}

        {/* Center announcement */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ paddingTop: "80px" }}
        >
          {announcement && (
            <HitAnnouncement text={announcement.text} color={announcement.color} />
          )}
        </div>

        {/* Bottom: cash out button (live) or result card */}
        {gameState === "live" && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between pointer-events-auto"
            style={{ padding: "12px 20px", background: "rgba(6,11,20,0.75)" }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {playerSide === "bull" ? "🐂 BULL — CALL contract live" : "🐻 BEAR — PUT contract live"}
            </div>
            <button
              onClick={handleCashOut}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.5)",
                background: "rgba(234,179,8,0.1)",
                color: "#eab308",
                fontSize: 12,
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              💰 CASH OUT
            </button>
          </div>
        )}

        {gameState === "result" && result && (
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.92)" }}
          >
            {result.cashedOut && (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#eab308",
                  letterSpacing: "0.12em",
                  padding: "4px 12px",
                  borderRadius: 4,
                  background: "rgba(234,179,8,0.1)",
                  border: "1px solid rgba(234,179,8,0.25)",
                }}
              >
                ⚡ CASHED OUT EARLY
              </div>
            )}
            <div className="flex items-center gap-8 mb-4">
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  BULL HP
                </span>
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#22c55e" }}>
                  {Math.max(0, result.bullHP)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 18, fontWeight: "bold", color: result.playerWon ? "#22c55e" : "#ef4444" }}>
                  {result.cashedOut ? "CASHED OUT" : `${result.winner === "bull" ? "🐂 BULL" : "🐻 BEAR"} WINS`}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  You bet on {playerSide === "bull" ? "🐂 BULL" : "🐻 BEAR"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  BEAR HP
                </span>
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444" }}>
                  {Math.max(0, result.bearHP)}
                </span>
              </div>
            </div>

            <GameResult
              won={result.playerWon}
              buyPrice={result.buyPrice}
              payout={result.payout}
              currency={currency}
              onPlayAgain={resetGame}
            />
          </div>
        )}
      </div>
    </div>
  );
}
