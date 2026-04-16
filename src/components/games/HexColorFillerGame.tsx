"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { HexFillerCanvasHandle } from "./HexColorFillerCanvas";

/* ─── Dynamic import ─────────────────────────────────────── */

const HexColorFillerCanvas = dynamic(() => import("./HexColorFillerCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#070b16" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading honeycomb…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "R_75",  label: "Volatility 75"  },
  { symbol: "R_50",  label: "Volatility 50"  },
];
const TICK_OPTIONS = [40, 60] as const;
const STAKE_PRESETS = [5, 10, 25, 50];

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type Side = "green" | "red";

interface HexResult {
  won: boolean;
  buyPrice: number;
  payout: number;
  cashedOut?: boolean;
}

/* ─── Streak badge ───────────────────────────────────────── */

function StreakBadge({ count, dir }: { count: number; dir: "up" | "down" }) {
  if (count < 2) return null;
  const isUp = dir === "up";
  const color = isUp ? "#22c55e" : "#ef4444";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 6,
      background: `${color}18`, border: `1px solid ${color}50`,
      fontSize: 11, fontFamily: "monospace", color, letterSpacing: "0.05em",
    }}>
      {isUp ? "🔥" : "🧊"} {count}× {isUp ? "GREEN" : "RED"} RUN
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function HexColorFillerGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";

  const [symbol, setSymbol]       = useState("R_100");
  const [totalTicks, setTotalTicks] = useState<40 | 60>(40);
  const [stake, setStake]         = useState(10);
  const [playerSide, setPlayerSide] = useState<Side>("green");
  const [gameState, setGameState] = useState<GameState>("idle");

  const [tickCount, setTickCount] = useState(0);
  const [greenCount, setGreenCount] = useState(0);
  const [redCount, setRedCount]   = useState(0);
  const [result, setResult]       = useState<HexResult | null>(null);
  const [buyError, setBuyError]   = useState<string | null>(null);
  const [streak, setStreak]       = useState<{ count: number; dir: "up" | "down" } | null>(null);

  // Refs
  const gameStateRef    = useRef<GameState>("idle");
  const totalTicksRef   = useRef(40);
  const stakeRef        = useRef(10);
  const playerSideRef   = useRef<Side>("green");
  const tickCountRef    = useRef(0);
  const greenCountRef   = useRef(0);
  const redCountRef     = useRef(0);
  const prevTickEpoch   = useRef<number | null>(null);
  const prevQuoteRef    = useRef<number | null>(null);
  const contractIdRef   = useRef<number | null>(null);
  const streakCountRef  = useRef(0);
  const streakDirRef    = useRef<"up" | "down" | null>(null);
  const canvasRef       = useRef<HexFillerCanvasHandle>(null);

  const { tick } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; },    [gameState]);
  useEffect(() => { totalTicksRef.current = totalTicks; },  [totalTicks]);
  useEffect(() => { stakeRef.current = stake; },            [stake]);
  useEffect(() => { playerSideRef.current = playerSide; },  [playerSide]);

  /* ─── Buy contract ─────────────────────────────────── */

  const buyContract = useCallback((side: Side, stakeAmt: number, sym: string, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "green" ? "CALL" : "PUT";
    authWs.send({
      proposal: 1, amount: stakeAmt, basis: "stake",
      contract_type: contractType, currency,
      duration: ticks, duration_unit: "t", symbol: sym,
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

  /* ─── Launch ───────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    setTickCount(0); setGreenCount(0); setRedCount(0);
    setResult(null); setBuyError(null); setStreak(null);
    tickCountRef.current  = 0;
    greenCountRef.current = 0;
    redCountRef.current   = 0;
    streakCountRef.current = 0;
    streakDirRef.current   = null;
    prevTickEpoch.current  = null;
    prevQuoteRef.current   = null;
    contractIdRef.current  = null;

    setGameState("live");
    gameStateRef.current = "live";
    // canvas mounts after state update; reset is called in the useEffect below
    buyContract(playerSide, stake, symbol, totalTicks);
  };

  /* ─── Reset canvas when game goes live ─────────────── */

  useEffect(() => {
    if (gameState === "live") {
      canvasRef.current?.reset(playerSideRef.current);
    }
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Update counts
    if (dir === "up") greenCountRef.current++;
    else if (dir === "down") redCountRef.current++;
    setGreenCount(greenCountRef.current);
    setRedCount(redCountRef.current);
    setTickCount(nextCount);

    // Streak
    if (dir !== "flat") {
      if (dir === streakDirRef.current) streakCountRef.current++;
      else { streakCountRef.current = 1; streakDirRef.current = dir; }
      setStreak({ count: streakCountRef.current, dir });
    }

    // Canvas
    canvasRef.current?.triggerTick(dir);

    // End of round
    if (nextCount >= totalTicksRef.current) {
      const contractId = contractIdRef.current;
      setTimeout(() => {
        if (contractId && authWs && authStatus === "connected") {
          authWs.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }, () => {});
          const unsub = authWs.subscribe("proposal_open_contract", (data) => {
            const poc = data.proposal_open_contract as { contract_id: number; is_sold: number; profit: number; status: string } | undefined;
            if (!poc || poc.contract_id !== contractId) return;
            if (poc.is_sold !== 1 && poc.status !== "sold") return;
            unsub();
            const won = poc.profit >= 0;
            const payout = won ? stakeRef.current * 1.85 : 0;
            canvasRef.current?.triggerEnd(won);
            setResult({ won, buyPrice: stakeRef.current, payout });
            setGameState("result");
            gameStateRef.current = "result";
          });
        } else {
          const won = greenCountRef.current > redCountRef.current
            ? playerSideRef.current === "green"
            : playerSideRef.current === "red";
          const payout = won ? stakeRef.current * 1.85 : 0;
          canvasRef.current?.triggerEnd(won);
          setResult({ won, buyPrice: stakeRef.current, payout });
          setGameState("result");
          gameStateRef.current = "result";
        }
      }, 800);
    }
  }, [tick, authWs, authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle"); gameStateRef.current = "idle";
    setTickCount(0); setGreenCount(0); setRedCount(0);
    setResult(null); setBuyError(null); setStreak(null);
    streakCountRef.current = 0; streakDirRef.current = null;
    prevTickEpoch.current = null; prevQuoteRef.current = null;
  };

  const canLaunch = authStatus === "connected";

  /* ─── Idle ─────────────────────────────────────────── */

  if (gameState === "idle") {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 520 }}>
        {/* Market */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>MARKET</span>
          <div className="flex gap-2">
            {GAME_MARKETS.map((m) => (
              <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                padding: "8px 14px", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${symbol === m.symbol ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                background: symbol === m.symbol ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                color: symbol === m.symbol ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 12, fontFamily: "monospace",
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Round length */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>ROUND LENGTH</span>
          <div className="flex gap-2">
            {TICK_OPTIONS.map((t) => (
              <button key={t} onClick={() => setTotalTicks(t)} style={{
                flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${totalTicks === t ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                background: totalTicks === t ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                color: totalTicks === t ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 13, fontFamily: "monospace",
              }}>{t} ticks</button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>STAKE ({currency})</span>
          <div className="flex gap-2">
            {STAKE_PRESETS.map((p) => (
              <button key={p} onClick={() => setStake(p)} style={{
                flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${stake === p ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                background: stake === p ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                color: stake === p ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 13, fontFamily: "monospace",
              }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Side */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>YOUR COLOR</span>
          <div className="flex gap-3">
            {(["green", "red"] as Side[]).map((side) => {
              const color = side === "green" ? "#22c55e" : "#ef4444";
              const sel = playerSide === side;
              return (
                <button key={side} onClick={() => setPlayerSide(side)} style={{
                  flex: 1, padding: "16px 0", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${sel ? `${color}80` : "var(--border)"}`,
                  background: sel ? `${color}1a` : "rgba(255,255,255,0.02)",
                  color: sel ? color : "var(--text-secondary)",
                  fontSize: 15, fontWeight: "bold", fontFamily: "monospace",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {side === "green" ? <TrendingUp style={{ width: 18, height: 18 }} /> : <TrendingDown style={{ width: 18, height: 18 }} />}
                  {side === "green" ? "🟢 GREEN (UP)" : "🔴 RED (DOWN)"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {playerSide === "green"
            ? "🟢 GREEN — each UP tick fills a hex green. You buy a CALL. Payout if price trends UP."
            : "🔴 RED — each DOWN tick fills a hex red. You buy a PUT. Payout if price trends DOWN."}
        </div>

        {buyError && (
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>
            {buyError}
          </div>
        )}
        {!canLaunch && (
          <div style={{ color: "#eab308", fontSize: 11, fontFamily: "monospace" }}>Connecting to trading server…</div>
        )}

        <button onClick={handleLaunch} disabled={!canLaunch} style={{
          padding: "16px 0", borderRadius: 8, transition: "all 0.2s", cursor: canLaunch ? "pointer" : "not-allowed",
          border: "1px solid rgba(20,184,166,0.5)",
          background: canLaunch ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.02)",
          color: canLaunch ? "var(--accent)" : "var(--text-muted)",
          fontSize: 14, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.15em",
          opacity: canLaunch ? 1 : 0.45, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Zap style={{ width: 16, height: 16 }} />
          FILL THE COMB
        </button>
      </div>
    );
  }

  /* ─── Live + Result ───────────────────────────────────── */

  const progPct = (tickCount / totalTicks) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Canvas */}
      <div className="absolute inset-0">
        <HexColorFillerCanvas ref={canvasRef} />
      </div>

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Top bar */}
        <div className="flex items-start justify-between" style={{ padding: "16px 20px" }}>
          {/* Left: progress + streak */}
          <div className="flex flex-col gap-2">
            {gameState === "live" && (
              <>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
                  TICK {tickCount} / {totalTicks}
                </span>
                <div style={{ width: 140, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${progPct}%`, height: "100%", background: playerSide === "green" ? "#22c55e" : "#ef4444", transition: "width 0.3s ease", borderRadius: 2 }} />
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
                fontSize: 16, fontWeight: "bold", fontFamily: "monospace",
              }}>
                {result.won ? "YOU WIN! 🏆" : "YOU LOSE"}
              </div>
            )}
          </div>

          {/* Centre: live hex counts */}
          {gameState === "live" && (
            <div className="flex gap-4 items-center">
              <div className="flex flex-col items-center">
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#22c55e" }}>{greenCount}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(34,197,94,0.7)" }}>GREEN</span>
              </div>
              <span style={{ fontSize: 16, color: "var(--text-muted)" }}>vs</span>
              <div className="flex flex-col items-center">
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444" }}>{redCount}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(239,68,68,0.7)" }}>RED</span>
              </div>
            </div>
          )}

          {/* Right: side indicator */}
          <div style={{ fontSize: 11, fontFamily: "monospace", color: playerSide === "green" ? "#22c55e" : "#ef4444", textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, letterSpacing: "0.2em" }}>YOUR COLOR</div>
            {playerSide === "green" ? "🟢 GREEN" : "🔴 RED"}
          </div>
        </div>

        {/* Result panel */}
        {gameState === "result" && result && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.92)" }}>
            <div style={{ marginBottom: 8, fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>
              Final: 🟢 {greenCount} vs 🔴 {redCount}
            </div>
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
