"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { MeteorCanvasHandle } from "./MeteorBlasterCanvas";

/* ─── Dynamic import (SSR disabled for Three.js) ────────── */

const MeteorBlasterCanvas = dynamic(() => import("./MeteorBlasterCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#01030b" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading space…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",     label: "Volatility 100" },
  { symbol: "R_75",      label: "Volatility 75"  },
  { symbol: "BOOM1000",  label: "Boom 1000"       },
  { symbol: "CRASH1000", label: "Crash 1000"      },
];

const STAKE_PRESETS = [5, 10, 25, 50];
const TOTAL_TICKS   = 10;
const RING_Y        = 2.6;   // world-space Y of the target rings (±)

/* ─── World-Y mapper ─────────────────────────────────────── */

// Maps price to 3D Y coordinate. Anchor = price at game start.
// offset = barrier distance (ring sits at ±RING_Y in world space).
function toWorldY(price: number, anchor: number, offset: number): number {
  if (offset <= 0) return 0;
  return Math.max(-4.5, Math.min(4.5, ((price - anchor) / offset) * RING_Y));
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

  const playTick = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.09);
  }, [getCtx]);

  const playHit = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    [880, 1108, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.22);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.22);
    });
  }, [getCtx]);

  const playMiss = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  }, [getCtx]);

  return { playTick, playHit, playMiss };
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

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type AimChoice = "up" | "down";

interface MeteorResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

/* ─── Main Component ─────────────────────────────────────── */

export function MeteorBlasterGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useGameSounds();

  const [symbol, setSymbol]   = useState("R_100");
  const [stake, setStake]     = useState(10);
  const [aimChoice, setAimChoice] = useState<AimChoice>("up");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [tickCount, setTickCount] = useState(0);
  const [result, setResult]   = useState<MeteorResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [tickHistory, setTickHistory] = useState<TickEntry[]>([]);
  const [livePriceDisplay, setLivePriceDisplay] = useState<string>("");

  // Refs
  const gameStateRef    = useRef<GameState>("idle");
  const stakeRef        = useRef(10);
  const aimChoiceRef    = useRef<AimChoice>("up");
  const tickCountRef    = useRef(0);
  const anchorPriceRef  = useRef<number>(0);
  const barrierOffsetRef = useRef<number>(0.5);
  const contractIdRef   = useRef<number | null>(null);
  const unsubFnRef      = useRef<(() => void) | null>(null);
  const prevTickEpoch   = useRef<number | null>(null);
  const prevQuoteRef    = useRef<number | null>(null);
  const canvasRef       = useRef<MeteorCanvasHandle>(null);
  // Idle tick buffer to calibrate barrier offset before game starts
  const idleTicksRef    = useRef<number[]>([]);
  const wonRef          = useRef<boolean>(false);

  const { tick } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { aimChoiceRef.current = aimChoice; }, [aimChoice]);

  /* ─── Calibrate barrier from idle tick buffer ────────── */

  function calcBarrierOffset(anchor: number): number {
    const quotes = idleTicksRef.current;
    if (quotes.length < 3) return anchor * 0.00025;
    const deltas = quotes.slice(-10).map((q, i, arr) => i > 0 ? Math.abs(q - arr[i - 1]) : 0).filter(d => d > 0);
    const atr = deltas.length > 0 ? deltas.reduce((a, b) => a + b) / deltas.length : anchor * 0.00005;
    return Math.max(atr * 4, anchor * 0.0002);
  }

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
      wonRef.current = won;
      const payout = won ? (poc.payout ?? 0) : 0;
      if (won) {
        canvasRef.current?.triggerHit(aimChoiceRef.current === "up" ? "upper" : "lower");
        sounds.playHit();
      } else {
        canvasRef.current?.triggerMiss();
        sounds.playMiss();
      }
      setTimeout(() => {
        setResult({ won, buyPrice, payout });
        setGameState("result");
        gameStateRef.current = "result";
      }, won ? 1600 : 800);
    });
    unsubFnRef.current = unsub;
  }, [authWs, authStatus, sounds]);

  /* ─── Buy contract (ONETOUCH) ────────────────────────── */

  const buyContract = useCallback((
    sym: string,
    stakeAmt: number,
    barrier: string,
  ) => {
    if (!authWs || authStatus !== "connected") return;
    authWs.send({
      proposal: 1,
      amount: stakeAmt,
      basis: "stake",
      contract_type: "ONETOUCH",
      currency,
      duration: TOTAL_TICKS,
      duration_unit: "t",
      symbol: sym,
      barrier,
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

  /* ─── Fire (start game) ──────────────────────────────── */

  const handleFire = () => {
    if (authStatus !== "connected") return;
    const currentPrice = idleTicksRef.current[idleTicksRef.current.length - 1];
    if (!currentPrice) return;

    const offset = calcBarrierOffset(currentPrice);
    anchorPriceRef.current = currentPrice;
    barrierOffsetRef.current = offset;

    const barrierPrice = aimChoice === "up"
      ? currentPrice + offset
      : currentPrice - offset;

    const barrierStr = barrierPrice.toFixed(
      currentPrice < 10 ? 4 : currentPrice < 100 ? 3 : 2
    );

    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    tickCountRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = currentPrice;
    contractIdRef.current = null;
    wonRef.current = false;

    // Reset canvas — upper ring at +RING_Y, lower ring at -RING_Y
    canvasRef.current?.reset(RING_Y, -RING_Y);

    setGameState("live");
    gameStateRef.current = "live";

    buyContract(symbol, stake, barrierStr);
  };

  /* ─── Idle tick accumulation + live tick processing ──── */

  useEffect(() => {
    if (!tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    setLivePriceDisplay(tick.quote.toFixed(2));

    // Accumulate during idle for barrier calibration
    if (gameStateRef.current === "idle") {
      idleTicksRef.current = [...idleTicksRef.current.slice(-30), tick.quote];
      return;
    }

    if (gameStateRef.current !== "live") return;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return;

    const delta = tick.quote - prevQ;
    const dir: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    // Map current price to meteor world Y
    const meteorY = toWorldY(tick.quote, anchorPriceRef.current, barrierOffsetRef.current);
    canvasRef.current?.triggerTick(meteorY);

    setTickHistory((prev) => [...prev, { n: nextCount, quote: tick.quote, delta, dir }]);
    sounds.playTick();

    // Fallback: after TOTAL_TICKS, if contract hasn't settled yet, end the game
    if (nextCount >= TOTAL_TICKS) {
      setTimeout(() => {
        if (gameStateRef.current === "live") {
          // If contract subscription hasn't fired yet, unsub and show miss
          unsubFnRef.current?.();
          unsubFnRef.current = null;
          canvasRef.current?.triggerMiss();
          sounds.playMiss();
          setTimeout(() => {
            setResult({ won: false, buyPrice: stakeRef.current, payout: 0 });
            setGameState("result");
            gameStateRef.current = "result";
          }, 800);
        }
      }, 1800);
    }
  }, [tick, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ──────────────────────────────────────────── */

  const resetGame = () => {
    unsubFnRef.current?.();
    unsubFnRef.current = null;
    setGameState("idle");
    gameStateRef.current = "idle";
    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setTickHistory([]);
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    contractIdRef.current = null;
  };

  /* ─── Idle UI ────────────────────────────────────────── */

  if (gameState === "idle") {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 520 }}>
        {/* How to play */}
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(249,115,22,0.06)",
          border: "1px solid rgba(249,115,22,0.2)",
          fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
        }}>
          <span style={{ color: "#f97316", fontWeight: "bold" }}>☄️ How to play:</span>
          {" "}A glowing meteor drifts with live ticks. Two target rings float in space — green above, red below. Pick a direction, set your stake, then FIRE. If the meteor hits your ring within {TOTAL_TICKS} ticks, you win.
        </div>

        {/* Market */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>MARKET</span>
          <div className="flex gap-2">
            {GAME_MARKETS.map((m) => (
              <button key={m.symbol} onClick={() => { setSymbol(m.symbol); idleTicksRef.current = []; }} style={{
                padding: "8px 14px", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                background: symbol === m.symbol ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${symbol === m.symbol ? "#f97316" : "var(--border)"}`,
                color: symbol === m.symbol ? "#f97316" : "var(--text-muted)",
                fontSize: 12,
              }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aim direction */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>AIM DIRECTION</span>
          <div className="flex gap-3">
            <button onClick={() => setAimChoice("up")} style={{
              flex: 1, padding: "16px 12px", borderRadius: 8, cursor: "pointer",
              background: aimChoice === "up" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${aimChoice === "up" ? "#22c55e" : "var(--border)"}`,
              transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <TrendingUp size={22} color={aimChoice === "up" ? "#22c55e" : "var(--text-muted)"} />
              <span style={{ fontSize: 13, fontWeight: "bold", color: aimChoice === "up" ? "#22c55e" : "var(--text-muted)" }}>AIM UP</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Bet price rises</span>
            </button>
            <button onClick={() => setAimChoice("down")} style={{
              flex: 1, padding: "16px 12px", borderRadius: 8, cursor: "pointer",
              background: aimChoice === "down" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${aimChoice === "down" ? "#ef4444" : "var(--border)"}`,
              transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <TrendingDown size={22} color={aimChoice === "down" ? "#ef4444" : "var(--text-muted)"} />
              <span style={{ fontSize: 13, fontWeight: "bold", color: aimChoice === "down" ? "#ef4444" : "var(--text-muted)" }}>AIM DOWN</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Bet price falls</span>
            </button>
          </div>
        </div>

        {/* Stake */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>STAKE</span>
          <div className="flex gap-2">
            {STAKE_PRESETS.map((s) => (
              <button key={s} onClick={() => setStake(s)} style={{
                padding: "8px 16px", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                background: stake === s ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${stake === s ? "#f97316" : "var(--border)"}`,
                color: stake === s ? "#f97316" : "var(--text-muted)",
                fontSize: 13, fontFamily: "monospace",
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {buyError && (
          <div style={{ fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
            {buyError}
          </div>
        )}

        {/* Live price indicator */}
        {livePriceDisplay && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
            Live: <span style={{ color: "var(--text-primary)" }}>{livePriceDisplay}</span>
            {idleTicksRef.current.length < 3 && (
              <span style={{ color: "#f97316", marginLeft: 8 }}>calibrating…</span>
            )}
          </div>
        )}

        {/* Fire button */}
        <button
          onClick={handleFire}
          disabled={authStatus !== "connected" || idleTicksRef.current.length < 3}
          style={{
            padding: "14px 32px", borderRadius: 8, cursor: authStatus === "connected" && idleTicksRef.current.length >= 3 ? "pointer" : "not-allowed",
            background: authStatus === "connected" && idleTicksRef.current.length >= 3
              ? aimChoice === "up" ? "linear-gradient(135deg,#f97316,#ef4444)" : "linear-gradient(135deg,#ef4444,#f97316)"
              : "rgba(255,255,255,0.04)",
            border: "none",
            color: "#fff", fontSize: 14, fontWeight: "bold", letterSpacing: "0.12em", fontFamily: "monospace",
            opacity: authStatus !== "connected" || idleTicksRef.current.length < 3 ? 0.4 : 1,
            transition: "all 0.2s",
          }}
        >
          <Zap size={14} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
          FIRE CONTRACT
        </button>

        {authStatus !== "connected" && (
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Connect your Deriv account to play.</p>
        )}
      </div>
    );
  }

  /* ─── Result UI ──────────────────────────────────────── */

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

  /* ─── Live game UI ───────────────────────────────────── */

  const pct = Math.min(100, (tickCount / TOTAL_TICKS) * 100);

  return (
    <div style={{ position: "relative", width: "100%", height: 520, background: "#01030b", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(249,115,22,0.2)" }}>
      {/* 3D Canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MeteorBlasterCanvas ref={canvasRef} />
      </div>

      {/* HUD — top bar */}
      <div style={{
        position: "absolute", top: 14, left: 14, right: 160,
        display: "flex", alignItems: "center", gap: 12, zIndex: 10, pointerEvents: "none",
      }}>
        {/* Target ring indicator */}
        <div style={{
          padding: "5px 12px", borderRadius: 6, background: "rgba(6,11,20,0.85)",
          border: `1px solid ${aimChoice === "up" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {aimChoice === "up"
            ? <TrendingUp size={13} color="#22c55e" />
            : <TrendingDown size={13} color="#ef4444" />}
          <span style={{ fontSize: 11, fontFamily: "monospace", color: aimChoice === "up" ? "#22c55e" : "#ef4444" }}>
            {aimChoice === "up" ? "AIM UP" : "AIM DOWN"}
          </span>
        </div>

        {/* Tick progress bar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.15em" }}>TICKS</span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>{tickCount}/{TOTAL_TICKS}</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#f97316", borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* Stake */}
        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#f97316" }}>
          {stake} {currency}
        </div>
      </div>

      <TickFeed ticks={tickHistory} />
    </div>
  );
}
