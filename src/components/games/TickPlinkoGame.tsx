"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { PlinkoCanvasHandle } from "./TickPlinkoCanvas";
import { MULTIPLIERS } from "./TickPlinkoCanvas";

/* ─── Dynamic import (SSR disabled for Canvas) ───────────── */

const TickPlinkoCanvas = dynamic(() => import("./TickPlinkoCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#080d18" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading board…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const TOTAL_TICKS  = 14;
const TOTAL_SLOTS  = MULTIPLIERS.length; // 15
const START_COL    = 7;

const GAME_MARKETS = [
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "R_75",  label: "Volatility 75"  },
  { symbol: "R_50",  label: "Volatility 50"  },
];
const STAKE_PRESETS = [5, 10, 25, 50];

const MULT_COLORS: Record<string, string> = {
  "5":   "#f59e0b",
  "3":   "#f97316",
  "2":   "#a855f7",
  "1.5": "#14b8a6",
  "1":   "#6366f1",
  "0.5": "#64748b",
  "0.3": "#94a3b8",
  "0.2": "#94a3b8",
};
function multColor(m: number): string {
  return MULT_COLORS[String(m)] ?? "#475569";
}

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type Side = "bull" | "bear";

interface PlinkoResult {
  won: boolean;
  slot: number;
  multiplier: number;
  buyPrice: number;
  payout: number;
  cashedOut?: boolean;
}

/* ─── Sound engine ───────────────────────────────────────── */

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

  const playBounce = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  }, [getCtx]);

  const playLandWin = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.11);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.2);
      osc.start(ctx.currentTime + i * 0.11); osc.stop(ctx.currentTime + i * 0.11 + 0.2);
    });
  }, [getCtx]);

  const playLandLose = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.55);
  }, [getCtx]);

  return { playBounce, playLandWin, playLandLose };
}

/* ─── Tick feed ──────────────────────────────────────────── */

interface TickEntry { n: number; quote: number; delta: number; dir: "up" | "down" | "flat" }

function TickFeed({ ticks }: { ticks: TickEntry[] }) {
  if (ticks.length === 0) return null;
  return (
    <div style={{ position: "absolute", right: 14, top: 60, width: 126, display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: 2 }}>LIVE TICKS</div>
      {ticks.slice(-8).reverse().map((t, i) => (
        <div key={t.n} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "3px 7px", borderRadius: 4, background: "rgba(6,11,20,0.82)",
          border: `1px solid ${t.dir === "up" ? "rgba(34,197,94,0.25)" : t.dir === "down" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.05)"}`,
          opacity: Math.max(0.25, 1 - i * 0.1),
        }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>#{t.n}</span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-primary)" }}>{t.quote.toFixed(2)}</span>
          <span style={{ fontSize: 12, color: t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "var(--text-muted)" }}>
            {t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Streak indicator ───────────────────────────────────── */

function StreakBadge({ count, dir }: { count: number; dir: "up" | "down" }) {
  if (count < 2) return null;
  const isUp = dir === "up";
  const color = isUp ? "#22c55e" : "#ef4444";
  const icon  = isUp ? "🔥" : "🧊";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 6,
      background: `${color}18`,
      border: `1px solid ${color}50`,
      fontSize: 11, fontFamily: "monospace", color,
      letterSpacing: "0.05em",
      animation: count >= 4 ? "pulse 0.6s ease-in-out infinite alternate" : undefined,
    }}>
      {icon} {count}× {isUp ? "UP" : "DOWN"} STREAK
    </div>
  );
}

/* ─── Multiplier preview bar ─────────────────────────────── */

function MultiplierBar({ currentCol }: { currentCol: number }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
      {MULTIPLIERS.map((m, i) => {
        const isCurrent = i === currentCol;
        const color = multColor(m);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{
              fontSize: 9, fontFamily: "monospace",
              color: isCurrent ? color : "var(--text-muted)",
              fontWeight: isCurrent ? "bold" : "normal",
              opacity: isCurrent ? 1 : 0.5,
              transition: "all 0.2s",
            }}>
              {m}×
            </span>
            <div style={{
              width: isCurrent ? 14 : 10,
              height: isCurrent ? 20 : 14,
              borderRadius: 3,
              background: isCurrent ? color : "rgba(255,255,255,0.06)",
              border: `1px solid ${isCurrent ? color : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.2s",
            }} />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function TickPlinkoGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useGameSounds();

  const [symbol, setSymbol]       = useState("R_100");
  const [stake, setStake]         = useState(10);
  const [playerSide, setPlayerSide] = useState<Side>("bull");
  const [gameState, setGameState] = useState<GameState>("idle");

  const [tickCount, setTickCount] = useState(0);
  const [currentCol, setCurrentCol] = useState(START_COL);
  const [result, setResult]       = useState<PlinkoResult | null>(null);
  const [buyError, setBuyError]   = useState<string | null>(null);
  const [tickHistory, setTickHistory] = useState<TickEntry[]>([]);
  const [streak, setStreak]       = useState<{ count: number; dir: "up" | "down" } | null>(null);

  // Refs
  const gameStateRef    = useRef<GameState>("idle");
  const stakeRef        = useRef(10);
  const playerSideRef   = useRef<Side>("bull");
  const tickCountRef    = useRef(0);
  const ballColRef      = useRef(START_COL);
  const prevTickEpoch   = useRef<number | null>(null);
  const prevQuoteRef    = useRef<number | null>(null);
  const contractIdRef   = useRef<number | null>(null);
  const streakCountRef  = useRef(0);
  const streakDirRef    = useRef<"up" | "down" | null>(null);
  const canvasRef       = useRef<PlinkoCanvasHandle>(null);

  const { tick } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; },   [gameState]);
  useEffect(() => { stakeRef.current = stake; },           [stake]);
  useEffect(() => { playerSideRef.current = playerSide; }, [playerSide]);

  /* ─── Buy contract ─────────────────────────────────── */

  const buyContract = useCallback((side: Side, stakeAmt: number, sym: string) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "bull" ? "CALL" : "PUT";
    authWs.send({
      proposal: 1, amount: stakeAmt, basis: "stake",
      contract_type: contractType, currency,
      duration: TOTAL_TICKS, duration_unit: "t", symbol: sym,
    }, (propData) => {
      if (propData.error) { setBuyError((propData.error as { message: string }).message); return; }
      const prop = propData.proposal as { id: string; ask_price: number } | undefined;
      if (!prop?.id) return;
      authWs.send({ buy: prop.id, price: prop.ask_price }, (buyData) => {
        if (buyData.error) { setBuyError((buyData.error as { message: string }).message); return; }
        const bought = buyData.buy as { contract_id?: number } | undefined;
        if (bought?.contract_id) contractIdRef.current = bought.contract_id;
      });
    });
  }, [authWs, authStatus, currency]);

  /* ─── Cash out ─────────────────────────────────────── */

  const handleCashOut = useCallback(() => {
    if (!authWs || authStatus !== "connected") return;
    if (gameStateRef.current !== "live") return;
    const contractId = contractIdRef.current;
    if (!contractId) return;

    setGameState("result");
    gameStateRef.current = "result";

    const col  = ballColRef.current;
    const mult = MULTIPLIERS[col] ?? 1;

    authWs.send({ sell: contractId, price: 0 }, (sellData) => {
      const sold = sellData.sell as { sold_for?: number } | undefined;
      const derivPayout = sold?.sold_for ?? 0;
      const won = derivPayout > 0;
      const payout = won ? stakeRef.current * mult : 0;
      setResult({ won, slot: col, multiplier: mult, buyPrice: stakeRef.current, payout, cashedOut: true });
      if (won) sounds.playLandWin(); else sounds.playLandLose();
    });
  }, [authWs, authStatus, sounds]);

  /* ─── Launch ───────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    setTickCount(0);
    setCurrentCol(START_COL);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    setStreak(null);
    tickCountRef.current = 0;
    ballColRef.current   = START_COL;
    streakCountRef.current = 0;
    streakDirRef.current   = null;
    prevTickEpoch.current  = null;
    prevQuoteRef.current   = null;
    contractIdRef.current  = null;

    setGameState("live");
    gameStateRef.current = "live";

    const playerColor = playerSide === "bull" ? "#22c55e" : "#ef4444";
    canvasRef.current?.reset(TOTAL_TICKS, playerColor);
    buyContract(playerSide, stake, symbol);
  };

  /* ─── Tick processing ──────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return;

    const delta = tick.quote - prevQ;
    const dir: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;

    // Move ball column
    let newCol = ballColRef.current;
    if (dir === "up")   newCol = Math.min(TOTAL_SLOTS - 1, newCol + 1);
    else if (dir === "down") newCol = Math.max(0, newCol - 1);
    ballColRef.current = newCol;

    // Streak tracking
    if (dir !== "flat") {
      if (dir === streakDirRef.current) {
        streakCountRef.current += 1;
      } else {
        streakCountRef.current = 1;
        streakDirRef.current   = dir;
      }
      setStreak({ count: streakCountRef.current, dir });
    }

    setTickCount(nextCount);
    setCurrentCol(newCol);
    setTickHistory((prev) => [...prev, { n: nextCount, quote: tick.quote, delta, dir }]);

    // Trigger canvas animation
    canvasRef.current?.triggerTick(dir === "flat" ? "up" : dir, newCol, nextCount - 1);
    if (dir !== "flat") sounds.playBounce();

    // Check end of round
    if (nextCount >= TOTAL_TICKS) {
      const mult = MULTIPLIERS[newCol] ?? 1;

      setTimeout(() => {
        const contractId = contractIdRef.current;
        if (contractId && authWs && authStatus === "connected") {
          authWs.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }, () => {});
          const unsub = authWs.subscribe("proposal_open_contract", (data) => {
            const poc = data.proposal_open_contract as {
              contract_id: number;
              is_sold: number;
              profit: number;
              status: string;
            } | undefined;
            if (!poc || poc.contract_id !== contractId) return;
            if (poc.is_sold !== 1 && poc.status !== "sold") return;

            unsub();
            const won = poc.profit >= 0;
            const payout = won ? stakeRef.current * mult : 0;

            canvasRef.current?.triggerLand(newCol, TOTAL_SLOTS, won);
            setResult({ won, slot: newCol, multiplier: mult, buyPrice: stakeRef.current, payout });
            setGameState("result");
            gameStateRef.current = "result";
            if (won) sounds.playLandWin(); else sounds.playLandLose();
          });
        } else {
          // Fallback if no contract ID yet
          canvasRef.current?.triggerLand(newCol, TOTAL_SLOTS, true);
          const payout = stakeRef.current * mult;
          setResult({ won: true, slot: newCol, multiplier: mult, buyPrice: stakeRef.current, payout });
          setGameState("result");
          gameStateRef.current = "result";
          sounds.playLandWin();
        }
      }, 600);
    }
  }, [tick, sounds, authWs, authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle");
    gameStateRef.current = "idle";
    setTickCount(0);
    setCurrentCol(START_COL);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    setStreak(null);
    streakCountRef.current = 0;
    streakDirRef.current   = null;
    prevTickEpoch.current  = null;
    prevQuoteRef.current   = null;
  };

  const canLaunch = authStatus === "connected";

  /* ─── Idle ─────────────────────────────────────────── */

  if (gameState === "idle") {
    const sideColor = playerSide === "bull" ? "#22c55e" : "#ef4444";
    return (
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Hero header */}
        <div style={{
          borderRadius: 16, overflow: "hidden", marginBottom: 24,
          background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.06) 100%)",
          border: "1px solid rgba(139,92,246,0.25)", padding: "24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.25em", color: "#8b5cf6", marginBottom: 6 }}>
            TICK PLINKO
          </div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>
            Drop the Ball
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {TOTAL_TICKS} ticks steer the ball &middot; Land on a high multiplier to win big
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
                  {isBull ? "Market UP = contract wins" : "Market DOWN = contract wins"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Market */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#fff", fontWeight: "bold", marginBottom: 10 }}>
            MARKET
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {GAME_MARKETS.map((m) => {
              const sel = symbol === m.symbol;
              return (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "12px 8px", borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
                  border: `2px solid ${sel ? "#8b5cf6" + "70" : "rgba(255,255,255,0.08)"}`,
                  background: sel ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.03)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  fontSize: 12, fontFamily: "monospace", fontWeight: sel ? "bold" : "normal",
                }}>
                  {m.label}
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

        {/* Payout slots preview */}
        <div style={{
          padding: "14px 16px", borderRadius: 12, marginBottom: 16,
          background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
        }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.15em", color: "#8b5cf6", marginBottom: 10, fontWeight: "bold" }}>
            PAYOUT SLOTS &middot; {TOTAL_SLOTS} SLOTS
          </div>
          <MultiplierBar currentCol={START_COL} />
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", lineHeight: 1.5 }}>
            Ball starts center. Up-ticks steer right, down-ticks steer left. Multiplier &times; stake = payout.
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: `${sideColor}10`, border: `1px solid ${sideColor}25`,
          fontSize: 12, color: sideColor, fontFamily: "monospace", textAlign: "center",
        }}>
          {playerSide === "bull"
            ? "BULL — market must trend UP for your contract to win"
            : "BEAR — market must trend DOWN for your contract to win"}
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
          border: "2px solid rgba(139,92,246,0.6)",
          background: canLaunch
            ? "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.08) 100%)"
            : "rgba(255,255,255,0.02)",
          color: canLaunch ? "#fff" : "var(--text-muted)",
          fontSize: 18, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.15em",
          opacity: canLaunch ? 1 : 0.45,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.25s", boxShadow: canLaunch ? "0 4px 24px rgba(139,92,246,0.25)" : "none",
        }}>
          <Zap style={{ width: 20, height: 20 }} />
          DROP BALL
        </button>
      </div>
    );
  }

  /* ─── Live + Result: full arena view ─────────────────── */

  const currentMult = MULTIPLIERS[currentCol] ?? 1;

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Canvas */}
      <div className="absolute inset-0">
        <TickPlinkoCanvas ref={canvasRef} />
      </div>

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Top bar */}
        <div className="flex items-start justify-between" style={{ padding: "16px 20px" }}>
          {/* Left: tick counter + streak */}
          <div className="flex flex-col gap-2">
            {gameState === "live" && (
              <>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
                  TICK {tickCount} / {TOTAL_TICKS}
                </span>
                <div style={{ width: 120, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${(tickCount / TOTAL_TICKS) * 100}%`, height: "100%",
                    background: playerSide === "bull" ? "#22c55e" : "#ef4444",
                    transition: "width 0.3s ease", borderRadius: 2,
                  }} />
                </div>
                {streak && <StreakBadge count={streak.count} dir={streak.dir} />}
              </>
            )}
            {gameState === "result" && result && (
              <div style={{
                padding: "6px 14px", borderRadius: 6,
                background: result.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${result.won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                color: result.won ? "#22c55e" : "#ef4444",
                fontSize: 16, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.1em",
              }}>
                {result.won ? `${result.multiplier}× — YOU WIN!` : "YOU LOSE"}
              </div>
            )}
          </div>

          {/* Centre: current multiplier */}
          {gameState === "live" && (
            <div className="flex flex-col items-center gap-1">
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>CURRENT SLOT</span>
              <span style={{
                fontSize: 22, fontFamily: "monospace", fontWeight: "bold",
                color: multColor(currentMult),
                transition: "color 0.25s",
              }}>
                {currentMult}×
              </span>
            </div>
          )}

          {/* Right: multiplier bar */}
          {gameState === "live" && (
            <div className="flex flex-col items-end gap-1">
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>SLOTS</span>
              <MultiplierBar currentCol={currentCol} />
            </div>
          )}
        </div>

        {/* Tick feed */}
        {gameState === "live" && <TickFeed ticks={tickHistory} />}

        {/* Bottom bar — live */}
        {gameState === "live" && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between pointer-events-auto"
            style={{ padding: "12px 20px", background: "rgba(6,11,20,0.75)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {playerSide === "bull" ? "🐂 BULL — CALL contract live" : "🐻 BEAR — PUT contract live"}
            </div>
            <button onClick={handleCashOut} style={{
              padding: "10px 20px", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
              border: "1px solid rgba(234,179,8,0.5)", background: "rgba(234,179,8,0.1)",
              color: "#eab308", fontSize: 12, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.1em",
            }}>
              💰 CASH OUT
            </button>
          </div>
        )}

        {/* Bottom bar — result */}
        {gameState === "result" && result && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.92)" }}>
            {result.cashedOut && (
              <div style={{ marginBottom: 10, fontSize: 11, fontFamily: "monospace", color: "#eab308", letterSpacing: "0.12em", padding: "4px 12px", borderRadius: 4, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)" }}>
                ⚡ CASHED OUT EARLY
              </div>
            )}
            {result.won && (
              <div style={{ marginBottom: 8, fontSize: 13, fontFamily: "monospace", color: multColor(result.multiplier) }}>
                Slot {result.slot + 1} of {TOTAL_SLOTS} — {result.multiplier}× multiplier
              </div>
            )}
            <GameResult
              won={result.won}
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
