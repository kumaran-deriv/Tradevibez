"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, Flame, Crown, TrendingUp, TrendingDown } from "lucide-react";
import type { DragonRaceCanvasHandle } from "./DragonRaceCanvas";

/* ─── Dynamic import (SSR disabled for Three.js) ────────── */

const DragonRaceCanvas = dynamic(() => import("./DragonRaceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#040810" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading track…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",    label: "Volatility 100" },
  { symbol: "R_50",     label: "Volatility 50"  },
  { symbol: "CRASH500", label: "Crash 500"       },
  { symbol: "BOOM500",  label: "Boom 500"        },
];

const STAKE_PRESETS = [5, 10, 25, 50];
const TOTAL_TICKS   = 10;
const FINISH_Z      = 13;   // world-space finish line Z

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

  const playSurge = useCallback((isGold: boolean) => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "square";
    const base = isGold ? 440 : 330;
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.055, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  }, [getCtx]);

  const playWin = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.22);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.22);
    });
  }, [getCtx]);

  const playLose = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.55);
  }, [getCtx]);

  return { playSurge, playWin, playLose };
}

/* ─── Tick feed ──────────────────────────────────────────── */

interface TickEntry { n: number; quote: number; delta: number; dir: "up" | "down" | "flat" }

function TickFeed({ ticks }: { ticks: TickEntry[] }) {
  if (ticks.length === 0) return null;
  return (
    <div style={{
      position: "absolute", right: 14, top: 60, width: 128,
      display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none",
    }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: 2 }}>
        LIVE TICKS
      </div>
      {ticks.slice(-8).reverse().map((t, i) => (
        <div key={t.n} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "3px 7px", borderRadius: 4, background: "rgba(6,11,20,0.82)",
          border: `1px solid ${t.dir === "up" ? "rgba(245,158,11,0.3)" : t.dir === "down" ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)"}`,
          opacity: Math.max(0.25, 1 - i * 0.1),
        }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>#{t.n}</span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-primary)" }}>{t.quote.toFixed(2)}</span>
          <span style={{ fontSize: 12, color: t.dir === "up" ? "#f59e0b" : t.dir === "down" ? "#a855f7" : "var(--text-muted)" }}>
            {t.dir === "up" ? "🐉" : t.dir === "down" ? "🐉" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Dragon Progress Bar ────────────────────────────────── */

function DragonProgressBars({
  goldPct,
  purplePct,
  bet,
}: {
  goldPct: number;
  purplePct: number;
  bet: "gold" | "purple" | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
      {/* Gold dragon */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: bet === "gold" ? "#f59e0b" : "var(--text-muted)", fontWeight: bet === "gold" ? "bold" : "normal" }}>
            🔸 GOLD DRAGON {bet === "gold" ? "← YOUR BET" : ""}
          </span>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#f59e0b" }}>{Math.round(goldPct)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${goldPct}%`, background: "#f59e0b", borderRadius: 3, transition: "width 0.35s ease" }} />
        </div>
      </div>

      {/* Purple dragon */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: bet === "purple" ? "#a855f7" : "var(--text-muted)", fontWeight: bet === "purple" ? "bold" : "normal" }}>
            🔹 PURPLE DRAGON {bet === "purple" ? "← YOUR BET" : ""}
          </span>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#a855f7" }}>{Math.round(purplePct)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${purplePct}%`, background: "#a855f7", borderRadius: 3, transition: "width 0.35s ease" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "racing" | "result";
type DragonBet = "gold" | "purple";

interface RaceResult {
  won: boolean;
  buyPrice: number;
  payout: number;
  winner: DragonBet;
}

/* ─── Main Component ─────────────────────────────────────── */

export function DragonRaceGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useGameSounds();

  const [symbol, setSymbol]     = useState("R_100");
  const [stake, setStake]       = useState(10);
  const [bet, setBet]           = useState<DragonBet>("gold");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [tickCount, setTickCount] = useState(0);
  const [goldPct, setGoldPct]   = useState(0);
  const [purplePct, setPurplePct] = useState(0);
  const [result, setResult]     = useState<RaceResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [tickHistory, setTickHistory] = useState<TickEntry[]>([]);

  // Refs
  const gameStateRef    = useRef<GameState>("idle");
  const stakeRef        = useRef(10);
  const betRef          = useRef<DragonBet>("gold");
  const tickCountRef    = useRef(0);
  const goldZRef        = useRef(0);
  const purpleZRef      = useRef(0);
  const contractIdRef   = useRef<number | null>(null);
  const unsubFnRef      = useRef<(() => void) | null>(null);
  const prevTickEpoch   = useRef<number | null>(null);
  const prevQuoteRef    = useRef<number | null>(null);
  const canvasRef       = useRef<DragonRaceCanvasHandle>(null);

  const { tick } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { betRef.current = bet; }, [bet]);

  /* ─── Subscribe to contract result ──────────────────── */

  const subscribeContractResult = useCallback((contractId: number, buyPrice: number) => {
    if (!authWs || authStatus !== "connected") return;
    authWs.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }, () => {});
    const unsub = authWs.subscribe("proposal_open_contract", (data) => {
      const poc = data.proposal_open_contract as {
        contract_id: number;
        is_sold: number;
        profit: number;
        status: string;
        payout: number;
      } | undefined;
      if (!poc || poc.contract_id !== contractId) return;
      if (poc.is_sold !== 1 && poc.status !== "sold") return;
      unsub();
      unsubFnRef.current = null;

      const won = poc.profit >= 0;
      const payout = won ? (poc.payout ?? 0) : 0;
      // Winner dragon: gold = CALL (up), purple = PUT (down)
      const winner: DragonBet = won
        ? betRef.current
        : (betRef.current === "gold" ? "purple" : "gold");

      canvasRef.current?.triggerFinish(winner);
      if (won) sounds.playWin(); else sounds.playLose();

      setTimeout(() => {
        setResult({ won, buyPrice, payout, winner });
        setGameState("result");
        gameStateRef.current = "result";
      }, 2200);
    });
    unsubFnRef.current = unsub;
  }, [authWs, authStatus, sounds]);

  /* ─── Buy contract (CALL/PUT) ────────────────────────── */

  const buyContract = useCallback((sym: string, stakeAmt: number, side: DragonBet) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "gold" ? "CALL" : "PUT";
    authWs.send({
      proposal: 1,
      amount: stakeAmt,
      basis: "stake",
      contract_type: contractType,
      currency,
      duration: TOTAL_TICKS,
      duration_unit: "t",
      symbol: sym,
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
        const bought = buyData.buy as { contract_id?: number; buy_price?: number } | undefined;
        if (bought?.contract_id) {
          contractIdRef.current = bought.contract_id;
          subscribeContractResult(bought.contract_id, bought.buy_price ?? stakeAmt);
        }
      });
    });
  }, [authWs, authStatus, currency, subscribeContractResult]);

  /* ─── Start race ─────────────────────────────────────── */

  const handleStartRace = () => {
    if (authStatus !== "connected") return;

    setTickCount(0);
    setGoldPct(0);
    setPurplePct(0);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    tickCountRef.current = 0;
    goldZRef.current = 0;
    purpleZRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    contractIdRef.current = null;

    canvasRef.current?.reset();

    setGameState("racing");
    gameStateRef.current = "racing";

    buyContract(symbol, stake, bet);
  };

  /* ─── Tick processing ────────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "racing" || !tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return;

    const delta = tick.quote - prevQ;
    const dir: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    // Dragon surge magnitude based on tick size (min 0.4, max 2.8 world units per tick)
    const mag = Math.min(Math.abs(delta) * 14 + 0.35, 2.8);

    if (dir === "up") {
      goldZRef.current = Math.min(FINISH_Z, goldZRef.current + mag);
    } else if (dir === "down") {
      purpleZRef.current = Math.min(FINISH_Z, purpleZRef.current + mag);
    } else {
      // flat: tiny nudge for both so the race doesn't stall
      goldZRef.current = Math.min(FINISH_Z, goldZRef.current + 0.2);
      purpleZRef.current = Math.min(FINISH_Z, purpleZRef.current + 0.2);
    }

    setGoldPct((goldZRef.current / FINISH_Z) * 100);
    setPurplePct((purpleZRef.current / FINISH_Z) * 100);

    canvasRef.current?.triggerTick(
      dir === "flat" ? (Math.random() > 0.5 ? "up" : "down") : dir,
      goldZRef.current,
      purpleZRef.current
    );

    sounds.playSurge(dir !== "down");

    setTickHistory((prev) => [...prev, { n: nextCount, quote: tick.quote, delta, dir }]);

    // After all ticks, subscribe to contract if we haven't received result yet
    if (nextCount >= TOTAL_TICKS) {
      setTimeout(() => {
        if (gameStateRef.current === "racing" && !contractIdRef.current) {
          // Fallback: contract ID not yet available
          const guessWinner: DragonBet = goldZRef.current >= purpleZRef.current ? "gold" : "purple";
          const won = guessWinner === betRef.current;
          canvasRef.current?.triggerFinish(guessWinner);
          if (won) sounds.playWin(); else sounds.playLose();
          setTimeout(() => {
            setResult({ won, buyPrice: stakeRef.current, payout: won ? stakeRef.current * 1.95 : 0, winner: guessWinner });
            setGameState("result");
            gameStateRef.current = "result";
          }, 2200);
        }
      }, 2000);
    }
  }, [tick, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ──────────────────────────────────────────── */

  const resetGame = () => {
    unsubFnRef.current?.();
    unsubFnRef.current = null;
    setGameState("idle");
    gameStateRef.current = "idle";
    setTickCount(0);
    setGoldPct(0);
    setPurplePct(0);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    contractIdRef.current = null;
  };

  /* ─── Idle UI ─────────────────────────────────────────── */

  if (gameState === "idle") {
    const accentGold = "#f59e0b";
    const accentPurple = "#a855f7";
    const accentLava = "#ff4500";
    const activeAccent = bet === "gold" ? accentGold : accentPurple;

    return (
      <div className="flex flex-col gap-0" style={{ maxWidth: 560 }}>

        {/* ── Hero banner ── */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: "14px 14px 0 0",
          padding: "32px 24px 28px", textAlign: "center",
          background: `linear-gradient(135deg, #1a0505 0%, ${accentLava}30 40%, ${activeAccent}25 100%)`,
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.15,
            background: `radial-gradient(circle at 50% 80%, ${activeAccent}, transparent 70%)`,
          }} />
          <Flame size={42} style={{ color: accentLava, filter: `drop-shadow(0 0 12px ${accentLava})`, marginBottom: 10 }} />
          <h2 style={{
            margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "0.08em",
            fontFamily: "monospace", color: "#fff",
            textShadow: `0 0 20px ${accentLava}80`,
          }}>
            DRAGON RACE
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
            Two dragons. One track. {TOTAL_TICKS} ticks of pure fire.
          </p>
        </div>

        <div className="flex flex-col gap-5" style={{
          padding: "20px 20px 24px",
          background: "linear-gradient(180deg, rgba(26,5,5,0.6) 0%, rgba(6,2,12,0.95) 100%)",
          borderRadius: "0 0 14px 14px",
          border: "1px solid rgba(255,69,0,0.15)", borderTop: "none",
        }}>

          {/* ── Choose your dragon — big visual cards ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              CHOOSE YOUR DRAGON
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* Gold Dragon card */}
              <button onClick={() => setBet("gold")} style={{
                position: "relative", overflow: "hidden",
                padding: "22px 14px 18px", borderRadius: 12, cursor: "pointer",
                background: bet === "gold"
                  ? `linear-gradient(145deg, ${accentGold}20, ${accentGold}08)`
                  : "rgba(255,255,255,0.02)",
                border: `2px solid ${bet === "gold" ? accentGold : "rgba(255,255,255,0.08)"}`,
                transition: "all 0.2s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                transform: bet === "gold" ? "scale(1.03)" : "scale(1)",
                boxShadow: bet === "gold" ? `0 0 24px ${accentGold}30, inset 0 0 20px ${accentGold}10` : "none",
              }}>
                {bet === "gold" && <div style={{
                  position: "absolute", inset: 0, opacity: 0.12,
                  background: `radial-gradient(circle at 50% 30%, ${accentGold}, transparent 65%)`,
                }} />}
                <Crown size={32} style={{
                  color: bet === "gold" ? accentGold : "rgba(255,255,255,0.25)",
                  filter: bet === "gold" ? `drop-shadow(0 0 8px ${accentGold})` : "none",
                  transition: "all 0.2s",
                }} />
                <span style={{
                  fontSize: 15, fontWeight: 800, fontFamily: "monospace",
                  color: bet === "gold" ? accentGold : "rgba(255,255,255,0.4)",
                  letterSpacing: "0.06em",
                }}>GOLD DRAGON</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingUp size={12} style={{ color: bet === "gold" ? accentGold : "rgba(255,255,255,0.25)" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                    UP ticks · CALL
                  </span>
                </div>
              </button>

              {/* Purple Dragon card */}
              <button onClick={() => setBet("purple")} style={{
                position: "relative", overflow: "hidden",
                padding: "22px 14px 18px", borderRadius: 12, cursor: "pointer",
                background: bet === "purple"
                  ? `linear-gradient(145deg, ${accentPurple}20, ${accentPurple}08)`
                  : "rgba(255,255,255,0.02)",
                border: `2px solid ${bet === "purple" ? accentPurple : "rgba(255,255,255,0.08)"}`,
                transition: "all 0.2s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                transform: bet === "purple" ? "scale(1.03)" : "scale(1)",
                boxShadow: bet === "purple" ? `0 0 24px ${accentPurple}30, inset 0 0 20px ${accentPurple}10` : "none",
              }}>
                {bet === "purple" && <div style={{
                  position: "absolute", inset: 0, opacity: 0.12,
                  background: `radial-gradient(circle at 50% 30%, ${accentPurple}, transparent 65%)`,
                }} />}
                <Crown size={32} style={{
                  color: bet === "purple" ? accentPurple : "rgba(255,255,255,0.25)",
                  filter: bet === "purple" ? `drop-shadow(0 0 8px ${accentPurple})` : "none",
                  transition: "all 0.2s",
                }} />
                <span style={{
                  fontSize: 15, fontWeight: 800, fontFamily: "monospace",
                  color: bet === "purple" ? accentPurple : "rgba(255,255,255,0.4)",
                  letterSpacing: "0.06em",
                }}>PURPLE DRAGON</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingDown size={12} style={{ color: bet === "purple" ? accentPurple : "rgba(255,255,255,0.25)" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                    DOWN ticks · PUT
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ── Market selection — CSS grid ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              MARKET
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {GAME_MARKETS.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: symbol === m.symbol
                    ? `linear-gradient(135deg, ${activeAccent}18, ${activeAccent}08)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${symbol === m.symbol ? `${activeAccent}80` : "rgba(255,255,255,0.06)"}`,
                  color: symbol === m.symbol ? activeAccent : "rgba(255,255,255,0.45)",
                  fontSize: 13, fontFamily: "monospace", fontWeight: symbol === m.symbol ? 700 : 400,
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Stake — grid buttons ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              STAKE ({currency})
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {STAKE_PRESETS.map((s) => (
                <button key={s} onClick={() => setStake(s)} style={{
                  padding: "12px 0", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: stake === s
                    ? `linear-gradient(135deg, ${activeAccent}20, ${activeAccent}0a)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${stake === s ? `${activeAccent}80` : "rgba(255,255,255,0.06)"}`,
                  color: stake === s ? activeAccent : "rgba(255,255,255,0.45)",
                  fontSize: 18, fontFamily: "monospace", fontWeight: 700,
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Info banner ── */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: `linear-gradient(135deg, ${accentLava}08, ${activeAccent}06)`,
            border: `1px solid ${accentLava}25`,
            fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontFamily: "monospace",
          }}>
            <Flame size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: accentLava }} />
            UP ticks fuel the <span style={{ color: accentGold, fontWeight: 700 }}>Gold Dragon</span>.
            DOWN ticks fuel the <span style={{ color: accentPurple, fontWeight: 700 }}>Purple Dragon</span>.
            After {TOTAL_TICKS} ticks, the dragon furthest ahead wins.
          </div>

          {buyError && (
            <div style={{ fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
              {buyError}
            </div>
          )}

          {/* ── Start Race button ── */}
          <button
            onClick={handleStartRace}
            disabled={authStatus !== "connected"}
            style={{
              width: "100%", padding: "16px 32px", borderRadius: 10,
              cursor: authStatus === "connected" ? "pointer" : "not-allowed",
              background: authStatus === "connected"
                ? bet === "gold"
                  ? `linear-gradient(135deg, #b45309, ${accentGold}, #d97706)`
                  : `linear-gradient(135deg, #6d28d9, ${accentPurple}, #7c3aed)`
                : "rgba(255,255,255,0.04)",
              border: "none",
              color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", fontFamily: "monospace",
              opacity: authStatus !== "connected" ? 0.4 : 1,
              transition: "all 0.2s",
              boxShadow: authStatus === "connected" ? `0 0 30px ${activeAccent}40, 0 4px 16px rgba(0,0,0,0.4)` : "none",
            }}
          >
            <Zap size={16} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
            START RACE — {stake} {currency}
          </button>

          {authStatus !== "connected" && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: 0 }}>
              Connect your Deriv account to race.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ─── Result UI ──────────────────────────────────────── */

  if (gameState === "result" && result) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{
          textAlign: "center", marginBottom: 12,
          fontSize: 13, color: result.winner === "gold" ? "#f59e0b" : "#a855f7",
          fontFamily: "monospace",
        }}>
          {result.winner === "gold" ? "🔸 Gold Dragon wins the race!" : "🔹 Purple Dragon wins the race!"}
        </div>
        <GameResult
          won={result.won}
          buyPrice={result.buyPrice}
          payout={result.payout}
          currency={currency}
          onPlayAgain={resetGame}
        />
      </div>
    );
  }

  /* ─── Racing UI ──────────────────────────────────────── */

  const tickPct = Math.min(100, (tickCount / TOTAL_TICKS) * 100);

  return (
    <div style={{ position: "relative", width: "100%", height: 520, background: "#040810", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(245,158,11,0.2)" }}>
      {/* 3D canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <DragonRaceCanvas ref={canvasRef} />
      </div>

      {/* HUD — top bar */}
      <div style={{
        position: "absolute", top: 14, left: 14, right: 160,
        display: "flex", alignItems: "center", gap: 12, zIndex: 10, pointerEvents: "none",
      }}>
        {/* Your bet */}
        <div style={{
          padding: "5px 12px", borderRadius: 6, background: "rgba(6,11,20,0.88)",
          border: `1px solid ${bet === "gold" ? "rgba(245,158,11,0.4)" : "rgba(168,85,247,0.4)"}`,
          fontSize: 11, fontFamily: "monospace",
          color: bet === "gold" ? "#f59e0b" : "#a855f7",
        }}>
          {bet === "gold" ? "🔸 GOLD" : "🔹 PURPLE"}
        </div>

        {/* Tick progress */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.15em" }}>TICKS</span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>{tickCount}/{TOTAL_TICKS}</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${tickPct}%`, background: bet === "gold" ? "#f59e0b" : "#a855f7", borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Stake */}
        <div style={{ fontSize: 12, fontFamily: "monospace", color: bet === "gold" ? "#f59e0b" : "#a855f7" }}>
          {stake} {currency}
        </div>
      </div>

      {/* Dragon progress bars — bottom HUD */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 10, pointerEvents: "none",
        background: "rgba(4,8,16,0.86)", padding: "10px 14px", borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <DragonProgressBars goldPct={goldPct} purplePct={purplePct} bet={gameState === "racing" ? bet : null} />
      </div>

      <TickFeed ticks={tickHistory} />
    </div>
  );
}
