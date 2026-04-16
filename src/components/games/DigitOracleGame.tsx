"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { useProposal } from "@/hooks/useProposal";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency } from "@/utils/formatters";
import { Sparkles, ChevronDown } from "lucide-react";
import type { DigitOracleCanvasHandle } from "./DigitOracleCanvas";
import type { Tick } from "@/types/deriv";

/* ─── Dynamic import (SSR disabled for Three.js) ────────── */

const DigitOracleCanvas = dynamic(() => import("./DigitOracleCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#0a0520" }}
    >
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Summoning the oracle…
      </span>
    </div>
  ),
});

/* ─── Constants ─────────────────────────────────────────── */

const DIGIT_MARKETS = [
  { symbol: "R_100",   label: "Volatility 100" },
  { symbol: "R_75",    label: "Volatility 75"  },
  { symbol: "R_50",    label: "Volatility 50"  },
  { symbol: "R_25",    label: "Volatility 25"  },
  { symbol: "R_10",    label: "Volatility 10"  },
  { symbol: "1HZ100V", label: "Vol 100 (1s)"   },
  { symbol: "1HZ75V",  label: "Vol 75 (1s)"    },
  { symbol: "1HZ50V",  label: "Vol 50 (1s)"    },
  { symbol: "1HZ25V",  label: "Vol 25 (1s)"    },
  { symbol: "1HZ10V",  label: "Vol 10 (1s)"    },
];

const TICK_DURATIONS = [5, 10];
const STAKE_PRESETS = [1, 5, 10, 25];

type DigitMode = "even-odd" | "match";
type GameState = "idle" | "confirming" | "live" | "result";

interface ContractResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

interface TickFeedItem {
  digit: number;
  quote: number;
  isMatch: boolean;
}

/* ─── Helpers ───────────────────────────────────────────── */

function getLastDigit(tick: Tick): number {
  const str = tick.quote.toString().replace(".", "");
  return parseInt(str[str.length - 1], 10);
}

/* ─── Sounds ────────────────────────────────────────────── */

function useOracleSounds() {
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

  const playSpin = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.3);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [getCtx]);

  const playReveal = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }, [getCtx]);

  const playMatch = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }, [getCtx]);

  const playMiss = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }, [getCtx]);

  const playWin = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }, [getCtx]);

  const playLose = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }, [getCtx]);

  return { playSpin, playReveal, playMatch, playMiss, playWin, playLose };
}

/* ─── Component ─────────────────────────────────────────── */

export function DigitOracleGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency || "USD";
  const sounds = useOracleSounds();

  const canvasRef = useRef<DigitOracleCanvasHandle>(null);
  const needsCanvasReset = useRef(false);

  /* ── State ── */
  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedMarket, setSelectedMarket] = useState(DIGIT_MARKETS[0]);
  const [mode, setMode] = useState<DigitMode>("even-odd");
  const [evenOddChoice, setEvenOddChoice] = useState<"DIGITEVEN" | "DIGITODD">("DIGITEVEN");
  const [matchDigit, setMatchDigit] = useState(5);
  const [matchMode, setMatchMode] = useState<"DIGITMATCH" | "DIGITDIFF">("DIGITMATCH");
  const [tickDuration, setTickDuration] = useState(5);
  const [stake, setStake] = useState(5);
  const [result, setResult] = useState<ContractResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [ticksLeft, setTicksLeft] = useState(0);
  const [tickFeed, setTickFeed] = useState<TickFeedItem[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [showMarketPicker, setShowMarketPicker] = useState(false);

  /* ── Refs for callbacks ── */
  const gameStateRef = useRef<GameState>("idle");
  const contractIdRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const prevSpotRef = useRef(0);

  const { tick } = useTicks(gameState === "idle" ? selectedMarket.symbol : null);

  const onCanvasReady = useCallback((handle: DigitOracleCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<DigitOracleCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset();
    }
  }, []);
  const lastDigit = tick ? getLastDigit(tick) : null;

  const contractType = useMemo(() => {
    if (mode === "even-odd") return evenOddChoice;
    return matchMode;
  }, [mode, evenOddChoice, matchMode]);

  const proposalParams = useMemo(() => {
    if (gameState !== "idle") return null;
    return {
      amount: stake,
      basis: "stake" as const,
      contractType,
      currency,
      duration: tickDuration,
      durationUnit: "t",
      symbol: selectedMarket.symbol,
      ...(mode === "match" ? { barrier: String(matchDigit) } : {}),
    };
  }, [gameState, stake, contractType, currency, tickDuration, selectedMarket.symbol, mode, matchDigit]);

  const { proposal, loading: proposalLoading } = useProposal(proposalParams);

  /* ── Determine if a digit is a "match" for the chosen mode ── */
  function isDigitMatch(digit: number): boolean {
    if (mode === "even-odd") {
      return evenOddChoice === "DIGITEVEN" ? digit % 2 === 0 : digit % 2 !== 0;
    }
    return matchMode === "DIGITMATCH" ? digit === matchDigit : digit !== matchDigit;
  }

  /* ── Watch contract ── */
  const watchContract = useCallback(
    (contractId: number, totalTicks: number) => {
      if (!authWs) return;

      let tickCount = 0;
      setTicksLeft(totalTicks);

      const handleSettled = (poc: {
        is_sold: number;
        profit: number;
        buy_price: number;
        payout: number;
        status: string;
      }) => {
        unsubRef.current?.();
        unsubRef.current = null;

        const won = poc.profit >= 0;
        if (won) { sounds.playWin(); } else { sounds.playLose(); }
        canvasRef.current?.triggerEnd(won);

        setTimeout(() => {
          setResult({ won, buyPrice: poc.buy_price, payout: poc.payout });
          setGameState("result");
          gameStateRef.current = "result";
        }, 1500);
      };

      const unsub = authWs.subscribe("proposal_open_contract", (data) => {
        const poc = data.proposal_open_contract as {
          contract_id: number;
          is_sold: number;
          profit: number;
          buy_price: number;
          payout: number;
          status: string;
          current_spot: number;
        } | undefined;

        if (!poc || poc.contract_id !== contractId) return;

        if (poc.current_spot && poc.current_spot !== prevSpotRef.current) {
          prevSpotRef.current = poc.current_spot;
          tickCount += 1;

          const d = parseInt(poc.current_spot.toString().replace(".", "").slice(-1), 10);
          const match = mode === "even-odd"
            ? (evenOddChoice === "DIGITEVEN" ? d % 2 === 0 : d % 2 !== 0)
            : (matchMode === "DIGITMATCH" ? d === matchDigit : d !== matchDigit);

          sounds.playSpin();
          canvasRef.current?.triggerSpin();

          setTimeout(() => {
            sounds.playReveal();
            if (match) sounds.playMatch(); else sounds.playMiss();
            canvasRef.current?.triggerReveal(d, match);
          }, 400);

          setTickFeed(prev => [{ digit: d, quote: poc.current_spot, isMatch: match }, ...prev].slice(0, 12));
          setTicksLeft(Math.max(0, totalTicks - tickCount));
          if (match) setHits(prev => prev + 1); else setMisses(prev => prev + 1);
        }

        if (poc.is_sold === 1 || poc.status === "sold") {
          handleSettled(poc);
        }
      });

      unsubRef.current = unsub;

      authWs.send(
        { proposal_open_contract: 1, contract_id: contractId, subscribe: 1 },
        (resp) => {
          const poc = resp.proposal_open_contract as {
            contract_id: number;
            is_sold: number;
            profit: number;
            buy_price: number;
            payout: number;
            status: string;
          } | undefined;

          if (poc && (poc.is_sold === 1 || poc.status === "sold")) {
            handleSettled(poc);
          }
        },
      );

      return unsub;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authWs, sounds, mode, evenOddChoice, matchMode, matchDigit],
  );

  /* ── Place bet ── */
  function placeBet() {
    if (!authWs || authStatus !== "connected") return;

    setGameState("confirming");
    gameStateRef.current = "confirming";
    setBuyError(null);
    setTickFeed([]);
    setHits(0);
    setMisses(0);
    prevSpotRef.current = 0;

    needsCanvasReset.current = true;
    if (canvasRef.current) {
      canvasRef.current.reset();
      needsCanvasReset.current = false;
    }

    const reqMsg: Record<string, unknown> = {
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: contractType,
      currency,
      duration: tickDuration,
      duration_unit: "t",
      underlying_symbol: selectedMarket.symbol,
    };

    if (mode === "match") {
      reqMsg.barrier = String(matchDigit);
    }

    authWs.send(reqMsg, (propData) => {
      if (propData.error) {
        const err = propData.error as { message: string };
        setBuyError(err.message);
        setGameState("idle");
        gameStateRef.current = "idle";
        return;
      }

      const prop = propData.proposal as { id: string; ask_price: number };
      if (!prop?.id) {
        setBuyError("Could not get a price. Try again.");
        setGameState("idle");
        gameStateRef.current = "idle";
        return;
      }

      authWs.send({ buy: prop.id, price: prop.ask_price }, (buyData) => {
        if (buyData.error) {
          const err = buyData.error as { message: string };
          setBuyError(err.message);
          setGameState("idle");
          gameStateRef.current = "idle";
          return;
        }

        const buy = buyData.buy as { contract_id: number };
        contractIdRef.current = buy.contract_id;
        setGameState("live");
        gameStateRef.current = "live";
        watchContract(buy.contract_id, tickDuration);
      });
    });
  }

  /* ── Reset ── */
  function resetGame() {
    unsubRef.current?.();
    unsubRef.current = null;
    setGameState("idle");
    gameStateRef.current = "idle";
    setResult(null);
    setBuyError(null);
    setTickFeed([]);
    setHits(0);
    setMisses(0);
    contractIdRef.current = null;
    canvasRef.current?.reset();
  }

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const isNotReady = authStatus !== "connected";

  /* ── Idle screen ── */
  if (gameState === "idle") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Hero banner */}
        <div
          style={{
            borderRadius: 16,
            padding: "32px 24px",
            marginBottom: 20,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.06))",
            border: "1px solid rgba(139,92,246,0.15)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 40%, rgba(139,92,246,0.15) 0%, transparent 70%)",
            }}
          />
          <Sparkles
            style={{
              width: 48,
              height: 48,
              color: "#ffffff",
              filter: "drop-shadow(0 0 16px rgba(139,92,246,0.8))",
              margin: "0 auto 12px",
              position: "relative",
            }}
            strokeWidth={1.8}
          />
          <div
            style={{
              fontSize: 28,
              fontWeight: "bold",
              color: "#ffffff",
              letterSpacing: "0.12em",
              marginBottom: 6,
              position: "relative",
            }}
          >
            DIGIT ORACLE
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", position: "relative" }}>
            The crystal ball reveals the last digit
          </div>
        </div>

        {/* Auth warning */}
        {isNotReady && (
          <div
            className="flex items-center gap-2"
            style={{
              borderRadius: 10,
              background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.2)",
              padding: "8px 12px",
              marginBottom: 16,
            }}
          >
            <Spinner size="sm" />
            <span style={{ fontSize: 11, color: "#eab308" }}>Connecting to trading server…</span>
          </div>
        )}

        {/* Mode selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setMode("even-odd")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "20px 16px",
              borderRadius: 14,
              border: `1px solid ${mode === "even-odd" ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
              background: mode === "even-odd"
                ? "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))"
                : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 24 }}>&#x1F3B2;</span>
            <span style={{ fontSize: 15, fontWeight: "bold", color: mode === "even-odd" ? "#a855f7" : "var(--text-secondary)" }}>
              Even / Odd
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Predict last digit parity</span>
          </button>
          <button
            onClick={() => setMode("match")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "20px 16px",
              borderRadius: 14,
              border: `1px solid ${mode === "match" ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
              background: mode === "match"
                ? "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))"
                : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 24 }}>&#x1F3AF;</span>
            <span style={{ fontSize: 15, fontWeight: "bold", color: mode === "match" ? "#a855f7" : "var(--text-secondary)" }}>
              Match Digit
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Pick the exact digit</span>
          </button>
        </div>

        {/* Mode-specific controls */}
        {mode === "even-odd" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <button
              onClick={() => setEvenOddChoice("DIGITEVEN")}
              style={{
                padding: "18px 0",
                borderRadius: 12,
                border: `1px solid ${evenOddChoice === "DIGITEVEN" ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: evenOddChoice === "DIGITEVEN" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                color: evenOddChoice === "DIGITEVEN" ? "#22c55e" : "var(--text-muted)",
                fontSize: 18,
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              EVEN
            </button>
            <button
              onClick={() => setEvenOddChoice("DIGITODD")}
              style={{
                padding: "18px 0",
                borderRadius: 12,
                border: `1px solid ${evenOddChoice === "DIGITODD" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: evenOddChoice === "DIGITODD" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
                color: evenOddChoice === "DIGITODD" ? "#ef4444" : "var(--text-muted)",
                fontSize: 18,
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              ODD
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setMatchMode("DIGITMATCH")}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${matchMode === "DIGITMATCH" ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: matchMode === "DIGITMATCH" ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                  color: matchMode === "DIGITMATCH" ? "#a855f7" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                MATCHES
              </button>
              <button
                onClick={() => setMatchMode("DIGITDIFF")}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${matchMode === "DIGITDIFF" ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: matchMode === "DIGITDIFF" ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                  color: matchMode === "DIGITDIFF" ? "#a855f7" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                DIFFERS
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  onClick={() => setMatchDigit(d)}
                  style={{
                    padding: "12px 0",
                    borderRadius: 10,
                    border: `1px solid ${matchDigit === d ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                    background: matchDigit === d ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)",
                    color: matchDigit === d ? "#a855f7" : "var(--text-muted)",
                    fontSize: 16,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live digit preview */}
        {lastDigit !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 10,
              padding: "10px 14px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>LAST DIGIT</span>
            <span style={{ fontSize: 24, fontFamily: "monospace", fontWeight: "bold", color: "#a855f7" }}>{lastDigit}</span>
            <span style={{ fontSize: 11, color: isDigitMatch(lastDigit) ? "#22c55e" : "#ef4444" }}>
              {isDigitMatch(lastDigit) ? "MATCH" : "MISS"}
            </span>
          </div>
        )}

        {/* Market */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.15em", fontWeight: "bold" }}>
            MARKET
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMarketPicker(!showMarketPicker)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                color: "var(--text-primary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span>{selectedMarket.label}</span>
              <ChevronDown style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
            </button>
            {showMarketPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  zIndex: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#0c1424",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                  overflow: "hidden",
                }}
              >
                {DIGIT_MARKETS.map((m) => (
                  <button
                    key={m.symbol}
                    onClick={() => { setSelectedMarket(m); setShowMarketPicker(false); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      fontSize: 13,
                      color: selectedMarket.symbol === m.symbol ? "#a855f7" : "var(--text-secondary)",
                      background: selectedMarket.symbol === m.symbol ? "rgba(139,92,246,0.08)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                    {selectedMarket.symbol === m.symbol && <span style={{ fontSize: 11 }}>&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tick duration */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.15em", fontWeight: "bold" }}>
            TICKS (DURATION)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TICK_DURATIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTickDuration(t)}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${tickDuration === t ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: tickDuration === t ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                  color: tickDuration === t ? "#a855f7" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {t} ticks
              </button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", fontWeight: "bold" }}>
              STAKE ({currency})
            </span>
            {proposal && !proposalLoading && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Win up to{" "}
                <span style={{ color: "#a855f7", fontFamily: "monospace" }}>
                  {formatCurrency(proposal.payout, currency)}
                </span>
              </span>
            )}
            {proposalLoading && <Spinner size="sm" />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
            {STAKE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setStake(p)}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${stake === p ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: stake === p ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                  color: stake === p ? "#a855f7" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={500}
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              color: "#ffffff",
              fontSize: 13,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
        </div>

        {/* Error */}
        {buyError && (
          <div
            style={{
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              padding: "8px 12px",
              marginBottom: 16,
              fontSize: 11,
              color: "#ef4444",
            }}
          >
            {buyError}
          </div>
        )}

        {/* Info */}
        <div
          style={{
            borderRadius: 10,
            background: "rgba(139,92,246,0.05)",
            border: "1px solid rgba(139,92,246,0.12)",
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.5,
          }}
        >
          {mode === "even-odd"
            ? "The oracle reveals each tick's last digit. If the majority of digits match your prediction (even/odd), you win."
            : `The oracle reveals each tick's last digit. Win if the digits ${matchMode === "DIGITMATCH" ? "match" : "differ from"} ${matchDigit}.`}
        </div>

        {/* Launch button */}
        <button
          onClick={placeBet}
          disabled={isNotReady || !proposal}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 12,
            border: "none",
            background: isNotReady || !proposal
              ? "rgba(139,92,246,0.2)"
              : "linear-gradient(135deg, #7c3aed, #6d28d9)",
            color: "#ffffff",
            fontSize: 15,
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            cursor: isNotReady || !proposal ? "not-allowed" : "pointer",
            opacity: isNotReady || !proposal ? 0.5 : 1,
            transition: "all 0.2s",
          }}
        >
          CONSULT THE ORACLE
        </button>
      </div>
    );
  }

  /* ── Confirming ── */
  if (gameState === "confirming") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          className="flex flex-col items-center justify-center"
          style={{
            padding: "60px 0",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <Spinner size="lg" />
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>The oracle awakens…</p>
        </div>
      </div>
    );
  }

  /* ── Live ── */
  if (gameState === "live") {
    const modeLabel = mode === "even-odd"
      ? `Predicting ${evenOddChoice === "DIGITEVEN" ? "EVEN" : "ODD"}`
      : `${matchMode === "DIGITMATCH" ? "Matching" : "Differs from"} digit ${matchDigit}`;

    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* 3D Canvas */}
        <div
          style={{
            width: "100%",
            height: 420,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <DigitOracleCanvas ref={onCanvasReady} />
        </div>

        {/* HUD */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {/* Mode */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(139,92,246,0.2)",
              background: "rgba(139,92,246,0.06)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>PREDICTION</div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#a855f7" }}>{modeLabel}</div>
          </div>
          {/* Score */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>SCORE</div>
            <div style={{ fontSize: 14, fontWeight: "bold" }}>
              <span style={{ color: "#22c55e" }}>{hits}</span>
              <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>/</span>
              <span style={{ color: "#ef4444" }}>{misses}</span>
            </div>
          </div>
          {/* Ticks left */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>TICKS LEFT</div>
            <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
              {Array.from({ length: tickDuration }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: i < tickDuration - ticksLeft ? "#a855f7" : "rgba(255,255,255,0.1)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tick feed */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              padding: "8px",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6, paddingLeft: 4 }}>
              TICK FEED
            </div>
            {tickFeed.length === 0 && (
              <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: "var(--text-muted)" }}>
                Waiting for ticks…
              </div>
            )}
            {tickFeed.slice(0, 8).map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 6px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "monospace",
                  background: i === 0 ? "rgba(255,255,255,0.04)" : "transparent",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{t.quote}</span>
                <span style={{ fontWeight: "bold", color: t.isMatch ? "#22c55e" : "#ef4444" }}>
                  {t.digit} {t.isMatch ? "\u2713" : "\u2717"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Result ── */
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {result && (
        <GameResult
          won={result.won}
          buyPrice={result.buyPrice}
          payout={result.payout}
          currency={currency}
          onPlayAgain={resetGame}
        />
      )}
    </div>
  );
}
