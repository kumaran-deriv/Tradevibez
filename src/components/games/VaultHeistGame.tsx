"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Lock, ChevronUp, ChevronDown, Zap, Shield, LogOut } from "lucide-react";
import type { VaultHeistCanvasHandle, VaultTier } from "./VaultHeistCanvas";
import { VAULT_CONFIG } from "./VaultHeistCanvas";

/* ─── Dynamic import ────────────────────────────────────── */

const VaultHeistCanvas = dynamic(() => import("./VaultHeistCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#0a0e17" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Opening vault…
      </span>
    </div>
  ),
});

/* ─── Constants ─────────────────────────────────────────── */

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

/* ─── Types ─────────────────────────────────────────────── */

type GamePhase = "idle" | "waitingForPick" | "waitingForTick" | "result";

interface VaultResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

/* ─── Sound engine ──────────────────────────────────────── */

function useVaultSounds() {
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

  const playCorrect = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
  }, [getCtx]);

  const playAlarm = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  }, [getCtx]);

  const playVaultOpen = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
    const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(523, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + 0.5);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.6);
  }, [getCtx]);

  const playUnlock = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
  }, [getCtx]);

  return { playCorrect, playAlarm, playVaultOpen, playUnlock };
}

/* ─── Main Component ────────────────────────────────────── */

export function VaultHeistGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";
  const sounds = useVaultSounds();

  /* ── State ── */
  const [tier, setTier] = useState<VaultTier>("bronze");
  const [symbol, setSymbol] = useState("R_100");
  const [stake, setStake] = useState(10);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [currentLock, setCurrentLock] = useState(0);
  const [alarmLevel, setAlarmLevel] = useState(0);
  const [locksOpened, setLocksOpened] = useState(0);
  const [result, setResult] = useState<VaultResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [waitingLabel, setWaitingLabel] = useState("");

  /* ── Refs ── */
  const phaseRef = useRef<GamePhase>("idle");
  const tierRef = useRef<VaultTier>("bronze");
  const stakeRef = useRef(10);
  const currentLockRef = useRef(0);
  const alarmRef = useRef(0);
  const locksOpenedRef = useRef(0);
  const playerPickRef = useRef<"up" | "down" | null>(null);
  const contractIdRef = useRef<number | null>(null);
  const prevTickEpoch = useRef<number | null>(null);
  const prevQuoteRef = useRef<number | null>(null);
  const lockStepsRef = useRef<number[]>([]);
  const totalLocksRef = useRef(3);
  const canvasRef = useRef<VaultHeistCanvasHandle>(null);

  const { tick, direction: tickDirection } = useTicks(symbol);
  const needsCanvasReset = useRef(false);

  /* ── Sync refs ── */
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tierRef.current = tier; }, [tier]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);

  /* ─── Loot display helper ─────────────────────────── */

  const updateLoot = useCallback((opened: number) => {
    const config = VAULT_CONFIG[tierRef.current];
    const partialMult = 1 + (opened / config.lockCount) * (config.multiplier - 1);
    const potentialPayout = (stakeRef.current * partialMult).toFixed(2);
    canvasRef.current?.setLootDisplay(`${potentialPayout} ${currency}`);
  }, [currency]);

  const onCanvasReady = useCallback((handle: VaultHeistCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<VaultHeistCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset(tierRef.current);
      updateLoot(0);
    }
  }, [updateLoot]);

  /* ─── Buy contract ────────────────────────────────── */

  const buyContract = useCallback((sym: string, stakeAmt: number, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    authWs.send({
      proposal: 1,
      amount: stakeAmt,
      basis: "stake",
      contract_type: "CALL",
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
        if (bought?.contract_id) {
          contractIdRef.current = bought.contract_id;
        }
      });
    });
  }, [authWs, authStatus, currency]);

  /* ─── Launch ──────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    const config = VAULT_CONFIG[tier];
    const lockCount = config.lockCount;

    currentLockRef.current = 0;
    alarmRef.current = 0;
    locksOpenedRef.current = 0;
    playerPickRef.current = null;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    contractIdRef.current = null;
    lockStepsRef.current = new Array(lockCount).fill(0);
    totalLocksRef.current = lockCount;

    setCurrentLock(0);
    setAlarmLevel(0);
    setLocksOpened(0);
    setResult(null);
    setBuyError(null);
    setWaitingLabel("");

    needsCanvasReset.current = true;
    if (canvasRef.current) {
      canvasRef.current.reset(tier);
      needsCanvasReset.current = false;
      updateLoot(0);
    }

    const tickDuration = Math.min(lockCount * 6, 50);
    buyContract(symbol, stake, tickDuration);

    phaseRef.current = "waitingForPick";
    setPhase("waitingForPick");
  };

  /* ─── Make pick ───────────────────────────────────── */

  const makePick = useCallback((pick: "up" | "down") => {
    if (phaseRef.current !== "waitingForPick") return;
    playerPickRef.current = pick;
    phaseRef.current = "waitingForTick";
    setPhase("waitingForTick");
    setWaitingLabel(pick === "up" ? "Predicted UP — waiting for tick…" : "Predicted DOWN — waiting for tick…");
  }, []);

  /* ─── Tick processing ─────────────────────────────── */

  useEffect(() => {
    if (!tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;

    if (phaseRef.current !== "waitingForTick") return;
    if (prevQ === null) return;

    const delta = tick.quote - prevQ;
    const dir: "up" | "down" = delta >= 0 ? "up" : "down";
    const pick = playerPickRef.current;
    if (!pick) return;

    const lockIdx = currentLockRef.current;
    const correct = dir === pick;

    if (correct) {
      sounds.playCorrect();
      canvasRef.current?.triggerCorrect(lockIdx);

      const steps = lockStepsRef.current;
      steps[lockIdx] = (steps[lockIdx] ?? 0) + 1;

      if (steps[lockIdx] >= 2) {
        // Lock cracked
        sounds.playUnlock();
        canvasRef.current?.triggerUnlock(lockIdx);

        const newOpened = locksOpenedRef.current + 1;
        locksOpenedRef.current = newOpened;
        setLocksOpened(newOpened);

        const nextLockIdx = lockIdx + 1;
        if (nextLockIdx >= totalLocksRef.current) {
          // ALL LOCKS CRACKED
          canvasRef.current?.triggerVaultOpen();
          sounds.playVaultOpen();

          const config = VAULT_CONFIG[tierRef.current];
          const payout = stakeRef.current * config.multiplier;

          if (contractIdRef.current && authWs && authStatus === "connected") {
            authWs.send({ sell: contractIdRef.current, price: 0 }, () => {});
          }

          setTimeout(() => {
            setResult({ won: true, buyPrice: stakeRef.current, payout });
            phaseRef.current = "result";
            setPhase("result");
          }, 3500);
          return;
        }

        // Advance to next lock
        currentLockRef.current = nextLockIdx;
        setCurrentLock(nextLockIdx);
        canvasRef.current?.setCurrentLock(nextLockIdx);
        updateLoot(newOpened);
      }

      playerPickRef.current = null;
      if ((phaseRef.current as GamePhase) !== "result") {
        phaseRef.current = "waitingForPick";
        setPhase("waitingForPick");
        setWaitingLabel("");
      }
    } else {
      // WRONG
      sounds.playAlarm();
      canvasRef.current?.triggerWrong(lockIdx);

      const newAlarm = alarmRef.current + 1;
      alarmRef.current = newAlarm;
      setAlarmLevel(newAlarm);
      canvasRef.current?.setAlarmLevel(newAlarm);

      if (newAlarm >= 3) {
        // CAUGHT — game over
        if (contractIdRef.current && authWs && authStatus === "connected") {
          authWs.send({ sell: contractIdRef.current, price: 0 }, () => {});
        }

        setTimeout(() => {
          const opened = locksOpenedRef.current;
          let payout = 0;
          if (opened > 0) {
            const config = VAULT_CONFIG[tierRef.current];
            const partialMult = 1 + (opened / config.lockCount) * (config.multiplier - 1);
            payout = stakeRef.current * partialMult;
          }
          setResult({ won: opened > 0, buyPrice: stakeRef.current, payout });
          phaseRef.current = "result";
          setPhase("result");
        }, 1200);
      } else {
        // Revert after flash, back to picking
        setTimeout(() => {
          if (phaseRef.current === "result") return;
          playerPickRef.current = null;
          phaseRef.current = "waitingForPick";
          setPhase("waitingForPick");
          setWaitingLabel("");
        }, 500);
      }
    }
  }, [tick, sounds, authWs, authStatus, updateLoot]);

  /* ─── Cash out ────────────────────────────────────── */

  const handleCashOut = useCallback(() => {
    if (phaseRef.current !== "waitingForPick") return;
    if (locksOpenedRef.current === 0) return;

    const config = VAULT_CONFIG[tierRef.current];
    const opened = locksOpenedRef.current;
    const partialMult = 1 + (opened / config.lockCount) * (config.multiplier - 1);
    const payout = stakeRef.current * partialMult;

    if (contractIdRef.current && authWs && authStatus === "connected") {
      authWs.send({ sell: contractIdRef.current, price: 0 }, () => {});
    }

    setResult({ won: true, buyPrice: stakeRef.current, payout });
    phaseRef.current = "result";
    setPhase("result");
  }, [authWs, authStatus]);

  /* ─── Reset ───────────────────────────────────────── */

  const resetGame = () => {
    phaseRef.current = "idle";
    setPhase("idle");
    setCurrentLock(0);
    setAlarmLevel(0);
    setLocksOpened(0);
    setResult(null);
    setBuyError(null);
    setWaitingLabel("");
    playerPickRef.current = null;
    contractIdRef.current = null;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
  };

  /* ─── Idle screen ─────────────────────────────────── */

  if (phase === "idle") {
    const canLaunch = authStatus === "connected";
    const accentGold = "#d4a017";

    return (
      <div className="flex flex-col gap-0" style={{ maxWidth: 560 }}>
        {/* Hero banner */}
        <div style={{
          position: "relative", overflow: "hidden", borderRadius: "14px 14px 0 0",
          padding: "32px 24px 28px", textAlign: "center",
          background: "linear-gradient(135deg, #0a0e17 0%, rgba(212,160,23,0.25) 40%, rgba(148,163,184,0.15) 100%)",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.12,
            background: `radial-gradient(circle at 50% 80%, ${accentGold}, transparent 70%)`,
          }} />
          <Lock size={42} style={{ color: accentGold, filter: `drop-shadow(0 0 12px ${accentGold})`, marginBottom: 10 }} />
          <h2 style={{
            margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "0.08em",
            fontFamily: "monospace", color: "#fff",
            textShadow: `0 0 20px rgba(212,160,23,0.8)`,
          }}>
            VAULT HEIST
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
            Crack the locks. Predict the ticks. Open the vault.
          </p>
        </div>

        <div className="flex flex-col gap-5" style={{
          padding: "20px 20px 24px",
          background: "linear-gradient(180deg, rgba(10,14,23,0.6) 0%, rgba(6,2,12,0.95) 100%)",
          borderRadius: "0 0 14px 14px",
          border: `1px solid ${accentGold}15`, borderTop: "none",
        }}>

          {/* Vault tier selector */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              VAULT TIER
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {(["bronze", "silver", "gold"] as VaultTier[]).map((t) => {
                const sel = tier === t;
                const cfg = VAULT_CONFIG[t];
                return (
                  <button key={t} onClick={() => setTier(t)} style={{
                    position: "relative", overflow: "hidden",
                    padding: "16px 10px 14px", borderRadius: 10, cursor: "pointer",
                    background: sel
                      ? `linear-gradient(145deg, ${cfg.color}20, ${cfg.color}08)`
                      : "rgba(255,255,255,0.02)",
                    border: `2px solid ${sel ? cfg.color : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.2s ease",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transform: sel ? "scale(1.03)" : "scale(1)",
                    boxShadow: sel ? `0 0 20px ${cfg.color}25` : "none",
                  }}>
                    {sel && <div style={{
                      position: "absolute", inset: 0, opacity: 0.1,
                      background: `radial-gradient(circle at 50% 30%, ${cfg.color}, transparent 65%)`,
                    }} />}
                    <Lock size={20} style={{
                      color: sel ? cfg.color : "rgba(255,255,255,0.25)",
                      filter: sel ? `drop-shadow(0 0 6px ${cfg.color})` : "none",
                    }} />
                    <span style={{
                      fontSize: 13, fontWeight: 800, fontFamily: "monospace",
                      color: sel ? cfg.color : "rgba(255,255,255,0.4)",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>{t}</span>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>
                      {cfg.lockCount} locks
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: sel ? "#22c55e" : "rgba(255,255,255,0.25)", fontWeight: 700 }}>
                      {cfg.multiplier}x payout
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              MARKET
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {GAME_MARKETS.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  padding: "8px 6px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: symbol === m.symbol
                    ? `linear-gradient(135deg, ${accentGold}18, ${accentGold}08)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${symbol === m.symbol ? `${accentGold}80` : "rgba(255,255,255,0.06)"}`,
                  color: symbol === m.symbol ? accentGold : "rgba(255,255,255,0.45)",
                  fontSize: 11, fontFamily: "monospace", fontWeight: symbol === m.symbol ? 700 : 400,
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stake */}
          <div className="flex flex-col gap-2">
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace", fontWeight: 700 }}>
              STAKE ({currency})
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {STAKE_PRESETS.map((s) => (
                <button key={s} onClick={() => setStake(s)} style={{
                  padding: "12px 0", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  background: stake === s
                    ? `linear-gradient(135deg, ${accentGold}20, ${accentGold}0a)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${stake === s ? `${accentGold}80` : "rgba(255,255,255,0.06)"}`,
                  color: stake === s ? accentGold : "rgba(255,255,255,0.45)",
                  fontSize: 18, fontFamily: "monospace", fontWeight: 700,
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: `linear-gradient(135deg, ${accentGold}08, rgba(148,163,184,0.06))`,
            border: `1px solid ${accentGold}25`,
            fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontFamily: "monospace",
          }}>
            <Shield size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: accentGold }} />
            Each lock needs <span style={{ color: "#22c55e", fontWeight: 700 }}>2 correct</span> UP/DOWN predictions.
            Wrong prediction = <span style={{ color: "#ef4444", fontWeight: 700 }}>alarm +1</span>.
            3 alarms = caught! Cash out mid-heist for partial loot.
          </div>

          {buyError && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>
              {buyError}
            </div>
          )}

          {/* Launch */}
          <button onClick={handleLaunch} disabled={!canLaunch} style={{
            width: "100%", padding: "16px 32px", borderRadius: 10,
            cursor: canLaunch ? "pointer" : "not-allowed",
            background: canLaunch
              ? `linear-gradient(135deg, #8b6914, ${accentGold}, #b8860b)`
              : "rgba(255,255,255,0.04)",
            border: "none",
            color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", fontFamily: "monospace",
            opacity: canLaunch ? 1 : 0.4,
            transition: "all 0.2s",
            boxShadow: canLaunch ? `0 0 30px ${accentGold}40, 0 4px 16px rgba(0,0,0,0.4)` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Zap size={16} />
            START HEIST — {stake} {currency}
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

  /* ─── Result ──────────────────────────────────────── */

  if (phase === "result" && result) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{
          textAlign: "center", marginBottom: 12,
          fontSize: 13, color: result.won ? "#d4a017" : "#ef4444",
          fontFamily: "monospace",
        }}>
          {result.won
            ? locksOpened >= VAULT_CONFIG[tier].lockCount
              ? "Vault cracked — full payout!"
              : `Escaped with ${locksOpened}/${VAULT_CONFIG[tier].lockCount} locks cracked`
            : `Caught! Alarm level: ${alarmLevel}/3`
          }
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

  /* ─── Live HUD ────────────────────────────────────── */

  const config = VAULT_CONFIG[tier];
  const isWaiting = phase === "waitingForTick";
  const canCashOut = phase === "waitingForPick" && locksOpened > 0;
  const partialMult = locksOpened > 0
    ? 1 + (locksOpened / config.lockCount) * (config.multiplier - 1)
    : 0;
  const cashOutAmount = (stake * partialMult).toFixed(2);

  return (
    <div style={{
      position: "relative", width: "100%", maxWidth: 620,
      background: "#0a0e17", borderRadius: 12, overflow: "hidden",
      border: `1px solid ${config.color}40`,
    }}>
      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <VaultHeistCanvas ref={onCanvasReady} />
      </div>

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

        {/* Top HUD */}
        <div style={{
          position: "absolute", top: 8, left: 14, right: 14,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(6,11,20,0.88)",
            border: `1px solid ${config.color}50`,
            fontSize: 10, fontFamily: "monospace", color: config.color,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            {tier} VAULT
          </div>

          <div style={{
            padding: "4px 12px", borderRadius: 6,
            background: "rgba(6,11,20,0.88)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 11, fontFamily: "monospace", color: "#fff", fontWeight: 700,
          }}>
            LOCK {Math.min(currentLock + 1, config.lockCount)} / {config.lockCount}
          </div>

          {/* Alarm dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: "50%",
                background: i < alarmLevel ? "#ef4444" : "#1a2030",
                border: `1px solid ${i < alarmLevel ? "#ef4444" : "#2a3a50"}`,
                boxShadow: i < alarmLevel ? "0 0 8px #ef4444" : "none",
              }} />
            ))}
          </div>
        </div>

        {/* Live tick price */}
        {tick && (
          <div style={{
            position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)",
            padding: "3px 10px", borderRadius: 6,
            background: "rgba(6,11,20,0.88)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11, fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>TICK</span>
            <span style={{
              color: tickDirection === "up" ? "#22c55e" : tickDirection === "down" ? "#ef4444" : "rgba(255,255,255,0.6)",
              fontWeight: 700,
            }}>
              {tick.quote.toFixed(2)}
            </span>
            {tickDirection && (
              <span style={{ fontSize: 13, color: tickDirection === "up" ? "#22c55e" : "#ef4444" }}>
                {tickDirection === "up" ? "↑" : "↓"}
              </span>
            )}
          </div>
        )}

        {/* Waiting label */}
        {isWaiting && waitingLabel && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "8px 18px", borderRadius: 8,
            background: "rgba(6,11,20,0.9)",
            border: `1px solid ${config.color}40`,
            fontSize: 12, fontFamily: "monospace", color: config.color,
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
            {waitingLabel}
          </div>
        )}
      </div>

      {/* Bottom controls (pointer-events: auto) */}
      <div style={{
        padding: "12px 16px 14px",
        background: "rgba(6,11,20,0.95)",
        borderTop: `1px solid ${config.color}25`,
        display: "flex", gap: 10, alignItems: "center", justifyContent: "center",
      }}>
        {/* UP button */}
        <button
          onClick={() => makePick("up")}
          disabled={isWaiting}
          style={{
            flex: 1, maxWidth: 160,
            padding: "14px 0", borderRadius: 10, cursor: isWaiting ? "not-allowed" : "pointer",
            background: isWaiting
              ? "rgba(34,197,94,0.05)"
              : "linear-gradient(145deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))",
            border: `2px solid ${isWaiting ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.7)"}`,
            color: isWaiting ? "rgba(34,197,94,0.3)" : "#22c55e",
            fontSize: 14, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s",
            opacity: isWaiting ? 0.4 : 1,
          }}
        >
          <ChevronUp size={18} />
          UP
        </button>

        {/* Cash out */}
        {canCashOut && (
          <button
            onClick={handleCashOut}
            style={{
              padding: "10px 14px", borderRadius: 8, cursor: "pointer",
              background: "linear-gradient(135deg, rgba(212,160,23,0.2), rgba(212,160,23,0.08))",
              border: `1px solid ${config.color}70`,
              color: config.color,
              fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.1em",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              transition: "all 0.15s",
            }}
          >
            <LogOut size={14} />
            <span>CASH OUT</span>
            <span style={{ fontSize: 11, fontWeight: 800 }}>{cashOutAmount}</span>
          </button>
        )}

        {/* DOWN button */}
        <button
          onClick={() => makePick("down")}
          disabled={isWaiting}
          style={{
            flex: 1, maxWidth: 160,
            padding: "14px 0", borderRadius: 10, cursor: isWaiting ? "not-allowed" : "pointer",
            background: isWaiting
              ? "rgba(239,68,68,0.05)"
              : "linear-gradient(145deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08))",
            border: `2px solid ${isWaiting ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.7)"}`,
            color: isWaiting ? "rgba(239,68,68,0.3)" : "#ef4444",
            fontSize: 14, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.1em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.15s",
            opacity: isWaiting ? 0.4 : 1,
          }}
        >
          <ChevronDown size={18} />
          DOWN
        </button>
      </div>
    </div>
  );
}
