"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Crosshair, Flame, Shield, Zap } from "lucide-react";
import type { PressureCanvasHandle } from "./MeteorBlasterCanvas";

/* ─── Dynamic import (SSR disabled for Three.js) ───────────── */

const MeteorBlasterCanvas = dynamic(() => import("./MeteorBlasterCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#01030b" }}
    >
      <span
        style={{
          color: "var(--text-muted)",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        Pressurising chamber…
      </span>
    </div>
  ),
});

/* ─── Types & constants ────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type ContractSide = "detonate" | "defuse";
type MarketType = "crash" | "boom";

interface GameMarket {
  symbol: string;
  label: string;
  type: MarketType;
  accent: string;
}

interface PressureResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

interface TickDeltaPoint {
  n: number;
  delta: number;
}

interface TickHistoryItem {
  n: number;
  quote: number;
  dir: "up" | "down" | "flat";
}

const GAME_MARKETS: GameMarket[] = [
  { symbol: "CRASH500", label: "Crash 500", type: "crash", accent: "#ef4444" },
  { symbol: "CRASH1000", label: "Crash 1000", type: "crash", accent: "#f87171" },
  { symbol: "BOOM500", label: "Boom 500", type: "boom", accent: "#22c55e" },
  { symbol: "BOOM1000", label: "Boom 1000", type: "boom", accent: "#4ade80" },
];

const STAKE_PRESETS = [5, 10, 25, 50];
const TICK_OPTIONS = [20, 30, 50] as const;

/* ─── Sounds ───────────────────────────────────────────────── */

function usePressureSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playTickRumble = useCallback(
    (intensity: number) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      const now = ctx.currentTime;
      const baseFreq = 70 + intensity * 40;
      osc.frequency.setValueAtTime(baseFreq, now);
      gain.gain.setValueAtTime(0.015 + intensity * 0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    },
    [getCtx],
  );

  const playWarningBeep = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  }, [getCtx]);

  const playExplosion = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.start(now);
    osc.stop(now + 0.7);
  }, [getCtx]);

  const playDefuseRelief = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.5);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.start(now);
    osc.stop(now + 0.55);
  }, [getCtx]);

  return { playTickRumble, playWarningBeep, playExplosion, playDefuseRelief };
}

/* ─── Tick feed ──────────────────────────────────────────────── */

function TickFeed({ ticks }: { ticks: TickHistoryItem[] }) {
  if (ticks.length === 0) return null;
  return (
    <div style={{
      position: "absolute", right: 14, top: 70, width: 130,
      display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none", zIndex: 10,
    }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: 2 }}>
        LIVE TICKS
      </div>
      {ticks.slice(-8).reverse().map((t, i) => (
        <div key={t.n} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "3px 7px", borderRadius: 4, background: "rgba(4,7,15,0.88)",
          border: `1px solid ${t.dir === "up" ? "rgba(34,197,94,0.3)" : t.dir === "down" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.05)"}`,
          opacity: Math.max(0.25, 1 - i * 0.1),
        }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>#{t.n}</span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-primary)" }}>{t.quote.toFixed(2)}</span>
          <span style={{ fontSize: 12, color: t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "var(--text-muted)" }}>
            {t.dir === "up" ? "\u2191" : t.dir === "down" ? "\u2193" : "\u2014"}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpikeSeismograph({ points }: { points: TickDeltaPoint[] }) {
  if (points.length === 0) return null;
  const last = points.slice(-10);
  const maxAbs = last.reduce((m, p) => Math.max(m, Math.abs(p.delta)), 0) || 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: "50%",
        transform: "translateX(-50%)",
        width: 220,
        height: 52,
        padding: "6px 8px",
        borderRadius: 10,
        background: "rgba(4,7,15,0.9)",
        border: "1px solid rgba(148,163,184,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontFamily: "monospace",
          color: "var(--text-muted)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        SPIKE DETECTOR
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
        }}
      >
        {last.map((p) => {
          const h = (Math.abs(p.delta) / maxAbs) * 26;
          const isUp = p.delta >= 0;
          return (
            <div
              key={p.n}
              style={{
                flex: 1,
                height: 26,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: Math.max(2, h),
                  borderRadius: 3,
                  background: isUp
                    ? "linear-gradient(to top,#16a34a,#22c55e)"
                    : "linear-gradient(to top,#b91c1c,#ef4444)",
                  opacity: 0.9,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export function MeteorBlasterGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = usePressureSounds();

  const [selectedMarket, setSelectedMarket] = useState<GameMarket | null>(
    GAME_MARKETS[0] ?? null,
  );
  const [side, setSide] = useState<ContractSide>("detonate");
  const [stake, setStake] = useState<number>(10);
  const [tickWindow, setTickWindow] = useState<(typeof TICK_OPTIONS)[number]>(30);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [tickCount, setTickCount] = useState(0);
  const [result, setResult] = useState<PressureResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [livePriceDisplay, setLivePriceDisplay] = useState<string>("");
  const [tensionMessage, setTensionMessage] = useState<string>("");
  const [deltaPoints, setDeltaPoints] = useState<TickDeltaPoint[]>([]);
  const [tickHistory, setTickHistory] = useState<TickHistoryItem[]>([]);

  const gameStateRef = useRef<GameState>("idle");
  const sideRef = useRef<ContractSide>("detonate");
  const totalTicksRef = useRef<number>(tickWindow);
  const tickCountRef = useRef(0);
  const stakeRef = useRef<number>(10);
  const idleQuotesRef = useRef<number[]>([]);
  const avgDeltaRef = useRef<number>(0);
  const spikeTriggeredRef = useRef(false);
  const contractIdRef = useRef<number | null>(null);
  const prevTickEpoch = useRef<number | null>(null);
  const prevQuoteRef = useRef<number | null>(null);
  const marketTypeRef = useRef<MarketType>("crash");
  const canvasRef = useRef<PressureCanvasHandle>(null);
  const needsCanvasReset = useRef<string | null>(null);

  const { tick } = useTicks(selectedMarket?.symbol ?? null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { totalTicksRef.current = tickWindow; }, [tickWindow]);
  useEffect(() => { sideRef.current = side; }, [side]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);

  const onCanvasReady = useCallback((handle: PressureCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<PressureCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current !== null) {
      handle.reset(needsCanvasReset.current);
      needsCanvasReset.current = null;
    }
  }, []);

  /* ─── Buy contract (simple CALL — same as Bear vs Bull) ──── */

  const buyContract = useCallback(
    (sym: string, stakeAmt: number) => {
      if (!authWs || authStatus !== "connected") return;
      authWs.send({
        proposal: 1,
        amount: stakeAmt,
        basis: "stake",
        contract_type: "CALL",
        currency,
        duration: totalTicksRef.current,
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
    },
    [authWs, authStatus, currency],
  );

  /* ─── Launch game ─────────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;
    if (!selectedMarket) return;
    if (idleQuotesRef.current.length < 5) return;

    marketTypeRef.current = selectedMarket.type;
    spikeTriggeredRef.current = false;
    tickCountRef.current = 0;
    avgDeltaRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    contractIdRef.current = null;
    idleQuotesRef.current = [];

    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setDeltaPoints([]);
    setTickHistory([]);
    setTensionMessage("");
    needsCanvasReset.current = selectedMarket.accent;
    if (canvasRef.current) {
      canvasRef.current.reset(selectedMarket.accent);
      needsCanvasReset.current = null;
    }

    totalTicksRef.current = tickWindow;
    gameStateRef.current = "live";
    setGameState("live");

    buyContract(selectedMarket.symbol, stake);
  };

  /* ─── Live tick processing ────────────────────────────────── */

  useEffect(() => {
    if (!tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    setLivePriceDisplay(tick.quote.toFixed(2));

    if (gameStateRef.current === "idle") {
      idleQuotesRef.current = [
        ...idleQuotesRef.current.slice(-60),
        tick.quote,
      ];
      return;
    }

    if (gameStateRef.current !== "live") return;

    const total = totalTicksRef.current;
    if (tickCountRef.current >= total) return;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ == null) return;

    const delta = tick.quote - prevQ;
    const absDelta = Math.abs(delta);

    // Spike detection
    const prevAvg = avgDeltaRef.current || absDelta;
    const newAvg = prevAvg * 0.9 + absDelta * 0.1;
    avgDeltaRef.current = newAvg;

    if (!spikeTriggeredRef.current && newAvg > 0 && absDelta > newAvg * 15) {
      spikeTriggeredRef.current = true;
      const mType = marketTypeRef.current;
      canvasRef.current?.triggerSpike(mType);
      sounds.playExplosion();
    }

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    const pct = Math.min(1, total > 0 ? nextCount / total : 0);

    canvasRef.current?.triggerTick(nextCount, total);
    sounds.playTickRumble(pct);

    if (pct >= 0.9) {
      setTensionMessage("Pressure critical — chamber at 90%!");
      sounds.playWarningBeep();
    } else if (pct >= 0.8) {
      setTensionMessage("Chamber screaming — last few ticks!");
    } else if (pct >= 0.66) {
      setTensionMessage("Tension rising fast — hold your nerve.");
    } else if (pct >= 0.25) {
      setTensionMessage("Pressure building — watching for a spike.");
    }

    setDeltaPoints((prev) => [...prev.slice(-19), { n: nextCount, delta }]);

    const dir: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    setTickHistory((prev) => [...prev, { n: nextCount, quote: tick.quote, dir }]);

    // Tick window complete — resolve locally
    if (nextCount >= total && total > 0) {
      const currentSide = sideRef.current;
      const spiked = spikeTriggeredRef.current;
      const won = currentSide === "detonate" ? spiked : !spiked;

      if (!spiked) {
        canvasRef.current?.triggerDefusal();
        sounds.playDefuseRelief();
      }

      setTensionMessage(won ? "You called it!" : "Chamber survived…");

      // Sell the contract to get the real payout
      setTimeout(() => {
        if (gameStateRef.current !== "live") return;
        const cid = contractIdRef.current;
        if (cid && authWs && authStatus === "connected") {
          authWs.send({ sell: cid, price: 0 }, (sellData) => {
            const sold = sellData.sell as { sold_for?: number } | undefined;
            const payout = sold?.sold_for ?? 0;
            setResult({ won: payout > stakeRef.current, buyPrice: stakeRef.current, payout });
            setGameState("result");
            gameStateRef.current = "result";
          });
        } else {
          // No contract — use local determination
          const bp = stakeRef.current;
          setResult({ won, buyPrice: bp, payout: won ? bp * 1.85 : 0 });
          setGameState("result");
          gameStateRef.current = "result";
        }
      }, 1500);
    }
  }, [tick, sounds, authWs, authStatus]);

  /* ─── Reset ──────────────────────────────────────────────── */

  const resetGame = () => {
    contractIdRef.current = null;
    spikeTriggeredRef.current = false;
    avgDeltaRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    idleQuotesRef.current = [];

    setGameState("idle");
    gameStateRef.current = "idle";
    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setDeltaPoints([]);
    setTickHistory([]);
    setTensionMessage("");
  };

  /* ─── Idle screen ─────────────────────────────────────────── */

  if (gameState === "idle") {
    const ready =
      authStatus === "connected" && idleQuotesRef.current.length >= 5;
    const market = selectedMarket ?? GAME_MARKETS[0];

    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 620 }}>
        {/* Hero banner */}
        <div
          style={{
            padding: "14px 16px 16px",
            borderRadius: 12,
            background:
              "radial-gradient(circle at 0 0, rgba(248,113,113,0.35), transparent 55%)," +
              "radial-gradient(circle at 100% 100%, rgba(34,197,94,0.32), transparent 55%)," +
              "linear-gradient(135deg,#020617,#020617)",
            border: "1px solid rgba(148,163,184,0.5)",
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "999px",
              background:
                "radial-gradient(circle,rgba(248,113,113,0.65),transparent 60%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 30px rgba(248,113,113,0.5)",
            }}
          >
            <Crosshair size={30} color="#fef2f2" />
          </div>
          <div className="flex-1">
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(148,163,184,0.9)",
                fontFamily: "monospace",
                marginBottom: 4,
              }}
            >
              PRESSURE BLASTER
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Crash/Boom pressure chamber — arm the core and decide: will it
              <span style={{ color: "#f97316", fontWeight: 600 }}> DETONATE</span>
              , or can you
              <span style={{ color: "#22c55e", fontWeight: 600 }}> DEFUSE</span>
              ?
            </div>
          </div>
        </div>

        {/* Mode selection */}
        <div className="flex flex-col gap-2">
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 10,
              letterSpacing: "0.22em",
              fontFamily: "monospace",
            }}
          >
            CHOOSE YOUR BET
          </span>
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              onClick={() => setSide("detonate")}
              style={{
                flex: 1,
                padding: "14px 14px",
                borderRadius: 10,
                cursor: "pointer",
                border:
                  side === "detonate"
                    ? "2px solid rgba(248,113,113,0.95)"
                    : "1px solid rgba(148,163,184,0.6)",
                background:
                  side === "detonate"
                    ? "radial-gradient(circle at 0 0,rgba(248,113,113,0.4),transparent 60%),rgba(15,23,42,0.9)"
                    : "rgba(15,23,42,0.8)",
                display: "flex",
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                transition: "all 0.18s ease",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background:
                    "radial-gradient(circle,rgba(248,113,113,0.7),transparent 60%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Flame size={22} color="#fee2e2" />
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: side === "detonate" ? "#f97316" : "#e5e7eb",
                    fontFamily: "monospace",
                  }}
                >
                  DETONATE
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Bet the spike hits during the window.
                </span>
              </div>
            </button>

            <button
              onClick={() => setSide("defuse")}
              style={{
                flex: 1,
                padding: "14px 14px",
                borderRadius: 10,
                cursor: "pointer",
                border:
                  side === "defuse"
                    ? "2px solid rgba(34,211,238,0.9)"
                    : "1px solid rgba(148,163,184,0.6)",
                background:
                  side === "defuse"
                    ? "radial-gradient(circle at 100% 0,rgba(34,211,238,0.35),transparent 60%),rgba(15,23,42,0.9)"
                    : "rgba(15,23,42,0.8)",
                display: "flex",
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                transition: "all 0.18s ease",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background:
                    "radial-gradient(circle,rgba(34,211,238,0.7),transparent 60%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield size={22} color="#e0f2fe" />
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: side === "defuse" ? "#22d3ee" : "#e5e7eb",
                    fontFamily: "monospace",
                  }}
                >
                  DEFUSE
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Bet it survives the tick window.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Markets */}
        <div className="flex flex-col gap-2">
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 10,
              letterSpacing: "0.22em",
              fontFamily: "monospace",
            }}
          >
            CRASH / BOOM MARKET
          </span>
          <div className="grid grid-cols-2 gap-2" style={{ maxWidth: 420 }}>
            {GAME_MARKETS.map((m) => {
              const active = selectedMarket?.symbol === m.symbol;
              return (
                <button
                  key={m.symbol}
                  onClick={() => {
                    setSelectedMarket(m);
                    idleQuotesRef.current = [];
                  }}
                  style={{
                    padding: "9px 11px",
                    borderRadius: 9,
                    cursor: "pointer",
                    border: active
                      ? `1px solid ${m.accent}`
                      : "1px solid rgba(148,163,184,0.55)",
                    background: active ? `${m.accent}22` : "rgba(15,23,42,0.85)",
                    color: active ? m.accent : "var(--text-muted)",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.17s ease",
                  }}
                >
                  <span>{m.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {m.type === "crash" ? "CRASH" : "BOOM"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tick window + Stake */}
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex flex-col gap-2" style={{ flex: 1 }}>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 10,
                letterSpacing: "0.22em",
                fontFamily: "monospace",
              }}
            >
              TICK WINDOW
            </span>
            <div className="grid grid-cols-3 gap-2" style={{ maxWidth: 260 }}>
              {TICK_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTickWindow(t)}
                  style={{
                    padding: "8px 0",
                    borderRadius: 7,
                    cursor: "pointer",
                    border:
                      tickWindow === t
                        ? "1px solid rgba(250,204,21,0.95)"
                        : "1px solid rgba(148,163,184,0.6)",
                    background:
                      tickWindow === t
                        ? "linear-gradient(135deg,#facc15,#f97316)"
                        : "rgba(15,23,42,0.85)",
                    color: tickWindow === t ? "#020617" : "var(--text-muted)",
                    fontSize: 12,
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {t} TICKS
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2" style={{ flex: 1 }}>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 10,
                letterSpacing: "0.22em",
                fontFamily: "monospace",
              }}
            >
              STAKE
            </span>
            <div className="grid grid-cols-4 gap-2" style={{ maxWidth: 280 }}>
              {STAKE_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  style={{
                    padding: "8px 0",
                    borderRadius: 7,
                    cursor: "pointer",
                    border:
                      stake === s
                        ? "1px solid rgba(96,165,250,0.9)"
                        : "1px solid rgba(148,163,184,0.6)",
                    background:
                      stake === s
                        ? "linear-gradient(135deg,#38bdf8,#6366f1)"
                        : "rgba(15,23,42,0.85)",
                    color: stake === s ? "#0b1120" : "var(--text-muted)",
                    fontSize: 12,
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 9,
            fontSize: 11,
            lineHeight: 1.5,
            background:
              "linear-gradient(90deg,rgba(248,113,113,0.2),rgba(34,197,94,0.15))",
            border: "1px solid rgba(148,163,184,0.5)",
            color: "var(--text-muted)",
          }}
        >
          Crash symbols spike
          <br className="sm:hidden" />
          <span style={{ color: "#ef4444", fontWeight: 600 }}> down</span>; Boom
          symbols spike
          <span style={{ color: "#22c55e", fontWeight: 600 }}> up</span>. Pick
          DETONATE if you think a spike will happen, DEFUSE if you think
          the market stays calm.
        </div>

        {/* Error + live price */}
        {buyError && (
          <div
            style={{
              fontSize: 12,
              color: "#fecaca",
              background: "rgba(127,29,29,0.65)",
              padding: "8px 12px",
              borderRadius: 7,
              border: "1px solid rgba(248,113,113,0.7)",
            }}
          >
            {buyError}
          </div>
        )}

        {livePriceDisplay && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            Live: {" "}
            <span style={{ color: "var(--text-primary)" }}>
              {livePriceDisplay}
            </span>
            {idleQuotesRef.current.length < 5 && (
              <span style={{ color: "#f97316", marginLeft: 8 }}>calibrating…</span>
            )}
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={!ready}
          style={{
            marginTop: 4,
            padding: "14px 26px",
            borderRadius: 999,
            border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            background: ready
              ? "linear-gradient(90deg,#f97316,#ef4444)"
              : "rgba(15,23,42,0.7)",
            color: "#f9fafb",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.18em",
            fontFamily: "monospace",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            opacity: ready ? 1 : 0.4,
          }}
        >
          <Zap size={15} />
          ARM CHAMBER — {stake} {currency}
        </button>

        {authStatus !== "connected" && (
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Connect your Deriv account to arm the chamber.
          </p>
        )}
      </div>
    );
  }

  /* ─── Result view ─────────────────────────────────────────── */

  if (gameState === "result" && result) {
    return (
      <div style={{ position: "relative" }}>
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

  /* ─── Live HUD ────────────────────────────────────────────── */

  const total = totalTicksRef.current || tickWindow;
  const pct = Math.min(100, total > 0 ? (tickCount / total) * 100 : 0);
  const market = selectedMarket ?? GAME_MARKETS[0];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 520,
        background: "#020617",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(148,163,184,0.7)",
      }}
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <MeteorBlasterCanvas ref={onCanvasReady} />
      </div>

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

        {/* Left vertical pressure gauge */}
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 70,
            bottom: 70,
            width: 20,
            borderRadius: 999,
            background: "linear-gradient(to top,rgba(15,23,42,0.95),rgba(15,23,42,0.9))",
            border: "1px solid rgba(148,163,184,0.7)",
            padding: 3,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${pct}%`,
              borderRadius: 999,
              background: "linear-gradient(to top,#dc2626,#f97316,#facc15,#22c55e)",
              boxShadow: "0 0 16px rgba(248,113,113,0.6)",
              transition: "height 0.25s ease-out",
            }}
          />
        </div>

        {/* Top HUD */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 52,
            right: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Bet badge */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.9)",
              border: `1px solid ${market.accent}aa`,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Crosshair size={14} style={{ color: market.accent, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#e5e7eb",
              }}
            >
              {side === "detonate" ? "DETONATE" : "DEFUSE"} · {market.label}
            </span>
          </div>

          {/* Tick progress */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.18em" }}>
                TICK WINDOW
              </span>
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>
                {tickCount}/{total}
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(15,23,42,0.9)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "linear-gradient(90deg,#22c55e,#facc15,#ef4444)",
                  boxShadow: "0 0 18px rgba(248,113,113,0.7)",
                  borderRadius: 999,
                  transition: "width 0.25s ease-out",
                }}
              />
            </div>
          </div>

          {/* Stake */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.7)",
              fontSize: 11,
              fontFamily: "monospace",
              color: market.accent,
            }}
          >
            {stake} {currency}
          </div>
        </div>

        {/* Tension commentary */}
        {tensionMessage && (
          <div
            style={{
              position: "absolute",
              top: 54,
              left: 66,
              right: 18,
              fontSize: 11,
              color: "#e5e7eb",
              textShadow: "0 0 8px rgba(15,23,42,0.9)",
            }}
          >
            {tensionMessage}
          </div>
        )}

        {/* Tick feed */}
        <TickFeed ticks={tickHistory} />

        {/* Spike detector */}
        <SpikeSeismograph points={deltaPoints} />
      </div>
    </div>
  );
}
