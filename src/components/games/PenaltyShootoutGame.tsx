"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Target, Zap, ChevronUp, ChevronDown } from "lucide-react";
import type { ShootoutCanvasHandle } from "./PenaltyShootoutCanvas";

/* ─── Dynamic import (SSR disabled for Three.js) ───────────── */

const PenaltyShootoutCanvas = dynamic(() => import("./PenaltyShootoutCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#0a1a0f" }}
    >
      <span
        style={{
          color: "var(--text-muted)",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        Setting up the pitch…
      </span>
    </div>
  ),
});

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",    label: "Volatility 100" },
  { symbol: "R_75",     label: "Volatility 75"  },
  { symbol: "R_50",     label: "Volatility 50"  },
  { symbol: "1HZ100V",  label: "Vol 100 (1s)"   },
  { symbol: "1HZ75V",   label: "Vol 75 (1s)"    },
  { symbol: "1HZ50V",   label: "Vol 50 (1s)"    },
  { symbol: "1HZ25V",   label: "Vol 25 (1s)"    },
  { symbol: "1HZ10V",   label: "Vol 10 (1s)"    },
];
const STAKE_PRESETS = [5, 10, 25, 50];
const TOTAL_KICKS = 5;

type KickPrediction = "odd" | "even";

const GOAL_MULTIPLIERS: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 1.5,
  4: 3,
  5: 8,
};

/* ─── Types ──────────────────────────────────────────────── */

type GamePhase = "idle" | "waitingForPick" | "waitingForTick" | "result";

interface ShootoutResult {
  won: boolean;
  buyPrice: number;
  payout: number;
  goals: number;
  saves: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

function getLastDigit(quote: number): number {
  const str = quote.toString().replace(".", "");
  return parseInt(str[str.length - 1], 10);
}

/* ─── Sounds ─────────────────────────────────────────────── */

function useShootoutSounds() {
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

  const playKick = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }, [getCtx]);

  const playGoal = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.exponentialRampToValueAtTime(1047, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [getCtx]);

  const playSave = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }, [getCtx]);

  const playWhistle = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.type = "sine";
    osc2.type = "sine";
    const now = ctx.currentTime;
    osc1.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }, [getCtx]);

  return { playKick, playGoal, playSave, playWhistle };
}

/* ─── Main Component ─────────────────────────────────────── */

export function PenaltyShootoutGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useShootoutSounds();

  /* ── State ── */
  const [symbol, setSymbol]           = useState("R_100");
  const [stake, setStake]             = useState(10);
  const [phase, setPhase]             = useState<GamePhase>("idle");
  const [currentKick, setCurrentKick] = useState(0);
  const [goals, setGoals]             = useState(0);
  const [saves, setSaves]             = useState(0);
  const [kickResults, setKickResults] = useState<("goal" | "save" | null)[]>([null, null, null, null, null]);
  const [result, setResult]           = useState<ShootoutResult | null>(null);
  const [buyError, setBuyError]       = useState<string | null>(null);
  const [waitingLabel, setWaitingLabel] = useState("");

  /* ── Refs mirror state for callbacks ── */
  const phaseRef          = useRef<GamePhase>("idle");
  const symbolRef         = useRef("R_100");
  const stakeRef          = useRef(10);
  const playerPickRef     = useRef<KickPrediction | null>(null);
  const currentKickRef    = useRef(0);
  const goalsRef          = useRef(0);
  const savesRef          = useRef(0);
  const kickResultsRef    = useRef<("goal" | "save" | null)[]>([null, null, null, null, null]);
  const prevTickEpoch     = useRef<number | null>(null);
  const canvasRef         = useRef<ShootoutCanvasHandle>(null);
  const needsCanvasReset  = useRef(false);

  const { tick, direction: tickDirection } = useTicks(symbol);

  /* ── Sync refs ── */
  useEffect(() => { phaseRef.current = phase; },   [phase]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { stakeRef.current = stake; },   [stake]);

  const onCanvasReady = useCallback((handle: ShootoutCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<ShootoutCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset();
    }
  }, []);

  /* ── Buy a single kick contract ── */
  const buyKickContract = useCallback((prediction: KickPrediction) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = prediction === "even" ? "DIGITEVEN" : "DIGITODD";
    authWs.send({
      proposal: 1,
      amount: stakeRef.current / TOTAL_KICKS,
      basis: "stake",
      contract_type: contractType,
      currency,
      duration: 1,
      duration_unit: "t",
      underlying_symbol: symbolRef.current,
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
      });
    });
  }, [authWs, authStatus, currency]);

  /* ── Launch ── */
  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    setCurrentKick(0);
    setGoals(0);
    setSaves(0);
    setKickResults([null, null, null, null, null]);
    setResult(null);
    setBuyError(null);
    setWaitingLabel("");

    currentKickRef.current  = 0;
    goalsRef.current        = 0;
    savesRef.current        = 0;
    kickResultsRef.current  = [null, null, null, null, null];
    playerPickRef.current   = null;
    prevTickEpoch.current   = null;

    needsCanvasReset.current = true;
    if (canvasRef.current) {
      canvasRef.current.reset();
      needsCanvasReset.current = false;
    }

    phaseRef.current = "waitingForPick";
    setPhase("waitingForPick");
  };

  /* ── Make pick (interactive) ── */
  const makePick = useCallback((pick: KickPrediction) => {
    if (phaseRef.current !== "waitingForPick") return;
    playerPickRef.current = pick;
    phaseRef.current = "waitingForTick";
    setPhase("waitingForTick");
    setWaitingLabel(pick === "even" ? "Predicted EVEN — waiting for tick…" : "Predicted ODD — waiting for tick…");

    sounds.playKick();
    buyKickContract(pick);
  }, [sounds, buyKickContract]);

  /* ── Tick processing ── */
  useEffect(() => {
    if (!tick) return;
    if (phaseRef.current !== "waitingForTick") return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const pick = playerPickRef.current;
    if (!pick) return;

    // Block further ticks during animation
    phaseRef.current = "idle";

    const digit = getLastDigit(tick.quote);
    const isEven = digit % 2 === 0;
    const kick = currentKickRef.current;
    const scored = (pick === "even" && isEven) || (pick === "odd" && !isEven);

    canvasRef.current?.triggerKick(kick);

    setTimeout(() => {
      if (scored) {
        canvasRef.current?.triggerGoal(kick);
        sounds.playGoal();
        goalsRef.current++;
        setGoals(goalsRef.current);
        kickResultsRef.current[kick] = "goal";
      } else {
        canvasRef.current?.triggerSave(kick);
        sounds.playSave();
        savesRef.current++;
        setSaves(savesRef.current);
        kickResultsRef.current[kick] = "save";
      }
      setKickResults([...kickResultsRef.current]);

      const nextKick = kick + 1;
      currentKickRef.current = nextKick;
      setCurrentKick(nextKick);
      playerPickRef.current = null;

      if (nextKick >= TOTAL_KICKS) {
        const g = goalsRef.current;
        canvasRef.current?.triggerFinalResult(g);
        sounds.playWhistle();
        const mult = GOAL_MULTIPLIERS[g] ?? 0;
        const payout = mult > 0 ? stakeRef.current * mult : 0;
        setTimeout(() => {
          setResult({
            won: mult > 0,
            buyPrice: stakeRef.current,
            payout,
            goals: g,
            saves: savesRef.current,
          });
          phaseRef.current = "result";
          setPhase("result");
        }, 2000);
      } else {
        setTimeout(() => {
          if ((phaseRef.current as GamePhase) !== "result") {
            phaseRef.current = "waitingForPick";
            setPhase("waitingForPick");
            setWaitingLabel("");
          }
        }, 1200);
      }
    }, 800);
  }, [tick, sounds, buyKickContract]);

  /* ── Reset ── */
  const resetGame = () => {
    phaseRef.current = "idle";
    setPhase("idle");
    setCurrentKick(0);
    setGoals(0);
    setSaves(0);
    setKickResults([null, null, null, null, null]);
    setResult(null);
    setBuyError(null);
    setWaitingLabel("");
    playerPickRef.current   = null;
    prevTickEpoch.current   = null;
    currentKickRef.current  = 0;
    goalsRef.current        = 0;
    savesRef.current        = 0;
    kickResultsRef.current  = [null, null, null, null, null];
  };

  const canLaunch = authStatus === "connected";

  /* ─── Idle screen ─────────────────────────────────────── */

  if (phase === "idle") {
    const accentGreen = "#22c55e";

    return (
      <div className="flex flex-col gap-0" style={{ maxWidth: 560 }}>

        {/* ── Hero banner ── */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: "14px 14px 0 0",
          padding: "32px 24px 28px", textAlign: "center",
          background: "linear-gradient(135deg, #0a1a0f 0%, rgba(34,197,94,0.25) 40%, rgba(22,163,74,0.15) 100%)",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.12,
            background: `radial-gradient(circle at 50% 80%, ${accentGreen}, transparent 70%)`,
          }} />
          <Target
            size={42}
            style={{ color: accentGreen, filter: `drop-shadow(0 0 12px ${accentGreen})`, marginBottom: 10 }}
          />
          <h2 style={{
            margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "0.08em",
            fontFamily: "monospace", color: "#fff",
            textShadow: `0 0 20px ${accentGreen}80`,
          }}>
            PENALTY SHOOTOUT
          </h2>
          <p style={{
            margin: "6px 0 0", fontSize: 12,
            color: "rgba(255,255,255,0.55)", fontFamily: "monospace",
          }}>
            5 kicks. Pick odd or even each kick. Score goals.
          </p>
        </div>

        <div className="flex flex-col gap-5" style={{
          padding: "20px 20px 24px",
          background: "linear-gradient(180deg, rgba(10,26,15,0.6) 0%, rgba(6,2,12,0.95) 100%)",
          borderRadius: "0 0 14px 14px",
          border: `1px solid ${accentGreen}15`, borderTop: "none",
        }}>

          {/* ── Market selector ── */}
          <div className="flex flex-col gap-2">
            <span style={{
              color: "rgba(255,255,255,0.4)", fontSize: 10,
              letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700,
            }}>
              MARKET
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {GAME_MARKETS.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                  transition: "all 0.15s",
                  background: symbol === m.symbol
                    ? `linear-gradient(135deg, ${accentGreen}18, ${accentGreen}08)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${symbol === m.symbol ? `${accentGreen}80` : "rgba(255,255,255,0.06)"}`,
                  color: symbol === m.symbol ? accentGreen : "rgba(255,255,255,0.45)",
                  fontSize: 11, fontFamily: "monospace",
                  fontWeight: symbol === m.symbol ? 700 : 400,
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Stake ── */}
          <div className="flex flex-col gap-2">
            <span style={{
              color: "rgba(255,255,255,0.4)", fontSize: 10,
              letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700,
            }}>
              STAKE ({currency})
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {STAKE_PRESETS.map((s) => (
                <button key={s} onClick={() => setStake(s)} style={{
                  padding: "12px 0", borderRadius: 8, cursor: "pointer",
                  transition: "all 0.15s",
                  background: stake === s
                    ? `linear-gradient(135deg, ${accentGreen}20, ${accentGreen}0a)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${stake === s ? `${accentGreen}80` : "rgba(255,255,255,0.06)"}`,
                  color: stake === s ? accentGreen : "rgba(255,255,255,0.45)",
                  fontSize: 18, fontFamily: "monospace", fontWeight: 700,
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Multiplier info ── */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: `linear-gradient(135deg, ${accentGreen}08, rgba(249,115,22,0.06))`,
            border: `1px solid ${accentGreen}25`,
            fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8,
            fontFamily: "monospace", textAlign: "center",
          }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>3 goals = 1.5x</span>
            {" | "}
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>4 goals = 3x</span>
            {" | "}
            <span style={{ color: "#ef4444", fontWeight: 700 }}>5 goals = 8x</span>
          </div>

          {/* ── Info banner ── */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: `linear-gradient(135deg, ${accentGreen}08, rgba(20,184,166,0.06))`,
            border: `1px solid ${accentGreen}25`,
            fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontFamily: "monospace",
          }}>
            <Target
              size={12}
              style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: accentGreen }}
            />
            Pick <span style={{ color: "#f97316", fontWeight: 700 }}>ODD</span> or{" "}
            <span style={{ color: accentGreen, fontWeight: 700 }}>EVEN</span> for each kick.
            The last digit of the next tick decides the outcome.
          </div>

          {buyError && (
            <div style={{
              padding: "8px 12px", borderRadius: 6,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444", fontSize: 12,
            }}>
              {buyError}
            </div>
          )}

          {/* ── Launch button ── */}
          <button onClick={handleLaunch} disabled={!canLaunch} style={{
            width: "100%", padding: "16px 32px", borderRadius: 10,
            cursor: canLaunch ? "pointer" : "not-allowed",
            background: canLaunch
              ? `linear-gradient(135deg, #15803d, ${accentGreen}, #16a34a)`
              : "rgba(255,255,255,0.04)",
            border: "none",
            color: "#fff", fontSize: 16, fontWeight: 900,
            letterSpacing: "0.12em", fontFamily: "monospace",
            opacity: canLaunch ? 1 : 0.4,
            transition: "all 0.2s",
            boxShadow: canLaunch
              ? `0 0 30px ${accentGreen}40, 0 4px 16px rgba(0,0,0,0.4)`
              : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Zap size={16} />
            TAKE THE SHOT — {stake} {currency}
          </button>

          {!canLaunch && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.35)",
              textAlign: "center", margin: 0,
            }}>
              Connect your Deriv account to play.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ─── Result view ─────────────────────────────────────── */

  if (phase === "result" && result) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{
          textAlign: "center", marginBottom: 8,
          fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)",
        }}>
          Final: {result.goals} goals, {result.saves} saves
          {result.won && (
            <span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 8 }}>
              {GOAL_MULTIPLIERS[result.goals] ?? 0}x multiplier
            </span>
          )}
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

  /* ─── Live HUD ────────────────────────────────────────── */

  return (
    <div style={{
      position: "relative", width: "100%", height: 520,
      background: "#0a1a0f", borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(34,197,94,0.3)",
    }}>
      {/* 3D Canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <PenaltyShootoutCanvas ref={onCanvasReady} />
      </div>

      {/* Top: kick counter + score + stake */}
      <div style={{
        position: "absolute", top: 12, left: 14, right: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 10, pointerEvents: "none",
      }}>
        <div style={{
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(10,26,15,0.88)",
          border: "1px solid rgba(34,197,94,0.25)",
          fontSize: 12, fontFamily: "monospace", fontWeight: 700,
          color: "#ffffff", letterSpacing: "0.08em",
        }}>
          KICK {Math.min(currentKick + 1, TOTAL_KICKS)} / {TOTAL_KICKS}
        </div>

        <div style={{
          display: "flex", gap: 16, padding: "6px 14px", borderRadius: 8,
          background: "rgba(10,26,15,0.88)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{
            color: "#22c55e", fontSize: 13, fontFamily: "monospace", fontWeight: 800,
          }}>
            GOALS: {goals}
          </span>
          <span style={{
            color: "#ef4444", fontSize: 13, fontFamily: "monospace", fontWeight: 800,
          }}>
            SAVES: {saves}
          </span>
        </div>

        <div style={{
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(10,26,15,0.88)",
          border: "1px solid rgba(34,197,94,0.25)",
          fontSize: 12, fontFamily: "monospace", fontWeight: 600,
          color: "#22c55e",
        }}>
          {stake} {currency}
        </div>
      </div>

      {/* Live tick display */}
      {tick && (
        <div style={{
          position: "absolute", top: 38, left: "50%",
          transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: 6,
          background: "rgba(10,26,15,0.85)",
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
            <span style={{ color: tickDirection === "up" ? "#22c55e" : "#ef4444", fontSize: 11 }}>
              {tickDirection === "up" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          )}
        </div>
      )}

      {/* Bottom: kick results + ODD/EVEN buttons */}
      <div style={{
        position: "absolute", bottom: 14, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        zIndex: 10,
      }}>
        {/* Kick result circles */}
        <div style={{ display: "flex", gap: 8, pointerEvents: "none" }}>
          {Array.from({ length: TOTAL_KICKS }, (_, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: kickResults[i] === "goal"
                ? "rgba(34,197,94,0.3)"
                : kickResults[i] === "save"
                  ? "rgba(239,68,68,0.3)"
                  : "rgba(255,255,255,0.05)",
              border: `2px solid ${
                kickResults[i] === "goal"
                  ? "#22c55e"
                  : kickResults[i] === "save"
                    ? "#ef4444"
                    : "rgba(255,255,255,0.1)"
              }`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontFamily: "monospace",
              color: kickResults[i] === "goal"
                ? "#22c55e"
                : kickResults[i] === "save"
                  ? "#ef4444"
                  : "rgba(255,255,255,0.2)",
            }}>
              {kickResults[i] === "goal" ? "G" : kickResults[i] === "save" ? "X" : i + 1}
            </div>
          ))}
        </div>

        {/* ODD / EVEN pick buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => makePick("odd")}
            disabled={phase !== "waitingForPick"}
            style={{
              padding: "10px 28px", borderRadius: 8, cursor: phase === "waitingForPick" ? "pointer" : "not-allowed",
              background: phase === "waitingForPick"
                ? "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.10))"
                : "rgba(255,255,255,0.04)",
              border: `2px solid ${phase === "waitingForPick" ? "#f97316" : "rgba(255,255,255,0.08)"}`,
              color: phase === "waitingForPick" ? "#f97316" : "rgba(255,255,255,0.25)",
              fontSize: 14, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em",
              transition: "all 0.15s",
              boxShadow: phase === "waitingForPick" ? "0 0 16px rgba(249,115,22,0.2)" : "none",
            }}
          >
            ODD
          </button>
          <button
            onClick={() => makePick("even")}
            disabled={phase !== "waitingForPick"}
            style={{
              padding: "10px 28px", borderRadius: 8, cursor: phase === "waitingForPick" ? "pointer" : "not-allowed",
              background: phase === "waitingForPick"
                ? "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.10))"
                : "rgba(255,255,255,0.04)",
              border: `2px solid ${phase === "waitingForPick" ? "#22c55e" : "rgba(255,255,255,0.08)"}`,
              color: phase === "waitingForPick" ? "#22c55e" : "rgba(255,255,255,0.25)",
              fontSize: 14, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em",
              transition: "all 0.15s",
              boxShadow: phase === "waitingForPick" ? "0 0 16px rgba(34,197,94,0.2)" : "none",
            }}
          >
            EVEN
          </button>
        </div>
      </div>

      {/* Waiting label */}
      {phase === "waitingForTick" && waitingLabel && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          padding: "8px 16px", borderRadius: 8,
          background: "rgba(10,26,15,0.9)",
          border: "1px solid rgba(34,197,94,0.3)",
          fontSize: 11, fontFamily: "monospace",
          color: "rgba(255,255,255,0.5)",
          zIndex: 10, pointerEvents: "none",
          letterSpacing: "0.1em",
        }}>
          {waitingLabel}
        </div>
      )}
    </div>
  );
}
