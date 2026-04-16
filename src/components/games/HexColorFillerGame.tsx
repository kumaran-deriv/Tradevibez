"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown, Palette, Hexagon, ChevronUp, ChevronDown } from "lucide-react";
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
  { symbol: "R_100",   label: "Volatility 100" },
  { symbol: "R_75",    label: "Volatility 75"  },
  { symbol: "R_50",    label: "Volatility 50"  },
  { symbol: "1HZ100V", label: "Vol 100 (1s)"   },
  { symbol: "1HZ75V",  label: "Vol 75 (1s)"    },
  { symbol: "1HZ50V",  label: "Vol 50 (1s)"    },
  { symbol: "1HZ25V",  label: "Vol 25 (1s)"    },
  { symbol: "1HZ10V",  label: "Vol 10 (1s)"    },
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
  const needsCanvasReset = useRef(false);

  const { tick, direction: tickDirection } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; },    [gameState]);
  useEffect(() => { totalTicksRef.current = totalTicks; },  [totalTicks]);
  useEffect(() => { stakeRef.current = stake; },            [stake]);
  useEffect(() => { playerSideRef.current = playerSide; },  [playerSide]);

  const onCanvasReady = useCallback((handle: HexFillerCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<HexFillerCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset(playerSideRef.current);
    }
  }, []);

  /* ─── Buy contract ─────────────────────────────────── */

  const buyContract = useCallback((side: Side, stakeAmt: number, sym: string, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "green" ? "CALL" : "PUT";
    authWs.send({
      proposal: 1, amount: stakeAmt, basis: "stake",
      contract_type: contractType, currency,
      duration: ticks, duration_unit: "t", underlying_symbol: sym,
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

    needsCanvasReset.current = true;
    setGameState("live");
    gameStateRef.current = "live";
    if (canvasRef.current) {
      canvasRef.current.reset(playerSideRef.current);
      needsCanvasReset.current = false;
    }
    buyContract(playerSide, stake, symbol, totalTicks);
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
    const accentGreen = "#22c55e";
    const accentRed = "#ef4444";
    const accentTeal = "#14b8a6";
    const activeAccent = playerSide === "green" ? accentGreen : accentRed;

    return (
      <div className="flex flex-col gap-0" style={{ maxWidth: 560 }}>

        {/* ── Hero banner ── */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: "14px 14px 0 0",
          padding: "32px 24px 28px", textAlign: "center",
          background: `linear-gradient(135deg, #030a08 0%, ${accentGreen}20 40%, ${accentRed}15 100%)`,
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.12,
            background: `radial-gradient(circle at 50% 80%, ${accentTeal}, transparent 70%)`,
          }} />
          <Palette size={42} style={{ color: accentTeal, filter: `drop-shadow(0 0 12px ${accentTeal})`, marginBottom: 10 }} />
          <h2 style={{
            margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "0.08em",
            fontFamily: "monospace", color: "#fff",
            textShadow: `0 0 20px ${accentTeal}80`,
          }}>
            HEX COLOR FILLER
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
            Claim the honeycomb. Dominate with your color.
          </p>
        </div>

        <div className="flex flex-col gap-5" style={{
          padding: "20px 20px 24px",
          background: "linear-gradient(180deg, rgba(3,10,8,0.6) 0%, rgba(6,2,12,0.95) 100%)",
          borderRadius: "0 0 14px 14px",
          border: `1px solid ${accentTeal}15`, borderTop: "none",
        }}>

          {/* ── Choose your color — big cards ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              CHOOSE YOUR COLOR
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(["green", "red"] as Side[]).map((side) => {
                const color = side === "green" ? accentGreen : accentRed;
                const sel = playerSide === side;
                return (
                  <button key={side} onClick={() => setPlayerSide(side)} style={{
                    position: "relative", overflow: "hidden",
                    padding: "22px 14px 18px", borderRadius: 12, cursor: "pointer",
                    background: sel
                      ? `linear-gradient(145deg, ${color}20, ${color}08)`
                      : "rgba(255,255,255,0.02)",
                    border: `2px solid ${sel ? color : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.2s ease",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    transform: sel ? "scale(1.03)" : "scale(1)",
                    boxShadow: sel ? `0 0 24px ${color}30, inset 0 0 20px ${color}10` : "none",
                  }}>
                    {sel && <div style={{
                      position: "absolute", inset: 0, opacity: 0.12,
                      background: `radial-gradient(circle at 50% 30%, ${color}, transparent 65%)`,
                    }} />}
                    <Hexagon size={32} style={{
                      color: sel ? color : "rgba(255,255,255,0.25)",
                      filter: sel ? `drop-shadow(0 0 8px ${color})` : "none",
                      transition: "all 0.2s",
                    }} />
                    <span style={{
                      fontSize: 15, fontWeight: 800, fontFamily: "monospace",
                      color: sel ? color : "rgba(255,255,255,0.4)",
                      letterSpacing: "0.06em",
                    }}>{side === "green" ? "GREEN" : "RED"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {side === "green"
                        ? <TrendingUp size={12} style={{ color: sel ? color : "rgba(255,255,255,0.25)" }} />
                        : <TrendingDown size={12} style={{ color: sel ? color : "rgba(255,255,255,0.25)" }} />}
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                        {side === "green" ? "UP ticks · CALL" : "DOWN ticks · PUT"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Market — CSS grid ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              MARKET
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {GAME_MARKETS.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "8px 6px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: symbol === m.symbol
                    ? `linear-gradient(135deg, ${activeAccent}18, ${activeAccent}08)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${symbol === m.symbol ? `${activeAccent}80` : "rgba(255,255,255,0.06)"}`,
                  color: symbol === m.symbol ? activeAccent : "rgba(255,255,255,0.45)",
                  fontSize: 11, fontFamily: "monospace", fontWeight: symbol === m.symbol ? 700 : 400,
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Round length ── */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              ROUND LENGTH
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {TICK_OPTIONS.map((t) => (
                <button key={t} onClick={() => setTotalTicks(t)} style={{
                  padding: "10px 0", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: totalTicks === t
                    ? `linear-gradient(135deg, ${activeAccent}18, ${activeAccent}08)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${totalTicks === t ? `${activeAccent}80` : "rgba(255,255,255,0.06)"}`,
                  color: totalTicks === t ? activeAccent : "rgba(255,255,255,0.45)",
                  fontSize: 14, fontFamily: "monospace", fontWeight: totalTicks === t ? 700 : 400,
                }}>
                  {t} ticks
                </button>
              ))}
            </div>
          </div>

          {/* ── Stake — grid ── */}
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
            background: `linear-gradient(135deg, ${activeAccent}08, ${accentTeal}06)`,
            border: `1px solid ${activeAccent}25`,
            fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontFamily: "monospace",
          }}>
            <Hexagon size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: accentTeal }} />
            UP ticks fill <span style={{ color: accentGreen, fontWeight: 700 }}>green</span> hexes.
            DOWN ticks fill <span style={{ color: accentRed, fontWeight: 700 }}>red</span> hexes.
            The dominant color after all ticks wins.
          </div>

          {buyError && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>
              {buyError}
            </div>
          )}

          {/* ── Launch button ── */}
          <button onClick={handleLaunch} disabled={!canLaunch} style={{
            width: "100%", padding: "16px 32px", borderRadius: 10,
            cursor: canLaunch ? "pointer" : "not-allowed",
            background: canLaunch
              ? `linear-gradient(135deg, ${playerSide === "green" ? "#15803d" : "#b91c1c"}, ${activeAccent}, ${playerSide === "green" ? "#16a34a" : "#dc2626"})`
              : "rgba(255,255,255,0.04)",
            border: "none",
            color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", fontFamily: "monospace",
            opacity: canLaunch ? 1 : 0.4,
            transition: "all 0.2s",
            boxShadow: canLaunch ? `0 0 30px ${activeAccent}40, 0 4px 16px rgba(0,0,0,0.4)` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Zap size={16} />
            FILL THE COMB — {stake} {currency}
          </button>

          {!canLaunch && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: 0 }}>
              Connect your Deriv account to play.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ─── Live + Result ───────────────────────────────────── */

  const progPct = (tickCount / totalTicks) * 100;
  const sideColor = playerSide === "green" ? "#22c55e" : "#ef4444";

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Canvas */}
      <div className="absolute inset-0">
        <HexColorFillerCanvas ref={onCanvasReady} />
      </div>

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

        {/* ── Top center: score vs ── */}
        {gameState === "live" && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 14,
            padding: "8px 18px", borderRadius: 10,
            background: "rgba(6,11,20,0.88)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 900, color: "#22c55e" }}>{greenCount}</span>
              <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(34,197,94,0.7)", letterSpacing: "0.15em" }}>GREEN</span>
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>vs</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 900, color: "#ef4444" }}>{redCount}</span>
              <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(239,68,68,0.7)", letterSpacing: "0.15em" }}>RED</span>
            </div>
          </div>
        )}

        {/* ── Live tick price ── */}
        {gameState === "live" && tick && (
          <div style={{
            position: "absolute", top: 52, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 6,
            background: "rgba(6,11,20,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em" }}>TICK</span>
            <span style={{
              color: tickDirection === "up" ? "#22c55e" : tickDirection === "down" ? "#ef4444" : "rgba(255,255,255,0.6)",
              fontSize: 12, fontFamily: "monospace", fontWeight: 700,
            }}>
              {tick.quote.toFixed(2)}
            </span>
            {tickDirection && (
              <span style={{ color: tickDirection === "up" ? "#22c55e" : "#ef4444" }}>
                {tickDirection === "up" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            )}
          </div>
        )}

        {/* ── Left: your color badge + streak ── */}
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            padding: "5px 12px", borderRadius: 6,
            background: "rgba(6,11,20,0.88)",
            border: `1px solid ${sideColor}40`,
            fontSize: 11, fontFamily: "monospace", color: sideColor,
          }}>
            <Hexagon size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
            {playerSide === "green" ? "GREEN" : "RED"}
          </div>
          {gameState === "live" && streak && <StreakBadge count={streak.count} dir={streak.dir} />}
          {gameState === "result" && result && (
            <div style={{
              padding: "6px 14px", borderRadius: 6,
              background: result.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${result.won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: result.won ? "#22c55e" : "#ef4444",
              fontSize: 14, fontWeight: "bold", fontFamily: "monospace",
            }}>
              {result.won ? "YOU WIN!" : "YOU LOSE"}
            </div>
          )}
        </div>

        {/* ── Right: tick counter + progress ── */}
        {gameState === "live" && (
          <div style={{
            position: "absolute", top: 14, right: 14,
            display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(6,11,20,0.88)",
            border: "1px solid rgba(255,255,255,0.08)",
            minWidth: 130,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "baseline" }}>
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>TICKS</span>
              <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 800, color: "#fff" }}>
                {tickCount}<span style={{ color: "rgba(255,255,255,0.3)" }}>/{totalTicks}</span>
              </span>
            </div>
            <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progPct}%`, borderRadius: 3,
                background: `linear-gradient(90deg, ${sideColor}, ${sideColor}cc)`,
                transition: "width 0.35s ease",
              }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: sideColor }}>
              {stake} {currency}
            </span>
          </div>
        )}

        {/* ── Result panel ── */}
        {gameState === "result" && result && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.92)" }}>
            <div style={{ marginBottom: 8, fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>
              Final: {greenCount} green vs {redCount} red
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
