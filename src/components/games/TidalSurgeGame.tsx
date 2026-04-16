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
import { Waves, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import type { TidalSurgeCanvasHandle } from "./TidalSurgeCanvas";

/* ─── Dynamic import (SSR disabled for Canvas) ─────────── */

const TidalSurgeCanvas = dynamic(() => import("./TidalSurgeCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#040818" }}
    >
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Charting the tides…
      </span>
    </div>
  ),
});

/* ─── Constants ─────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",     label: "Volatility 100", pip: 0.01 },
  { symbol: "R_75",      label: "Volatility 75",  pip: 0.01 },
  { symbol: "R_50",      label: "Volatility 50",  pip: 0.01 },
  { symbol: "R_25",      label: "Volatility 25",  pip: 0.001 },
  { symbol: "1HZ100V",   label: "Vol 100 (1s)",   pip: 0.01 },
  { symbol: "1HZ75V",    label: "Vol 75 (1s)",    pip: 0.01 },
  { symbol: "1HZ50V",    label: "Vol 50 (1s)",    pip: 0.01 },
  { symbol: "1HZ25V",    label: "Vol 25 (1s)",    pip: 0.01 },
  { symbol: "1HZ10V",    label: "Vol 10 (1s)",    pip: 0.01 },
];

const DURATIONS = [
  { label: "5s",  value: 5,  unit: "s" },
  { label: "15s", value: 15, unit: "s" },
  { label: "30s", value: 30, unit: "s" },
  { label: "1m",  value: 1,  unit: "m" },
];

const STAKE_PRESETS = [1, 5, 10, 25];

type GameState = "idle" | "confirming" | "live" | "result";
type Direction = "CALL" | "PUT";

interface ContractResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

interface TickHistoryItem {
  quote: number;
  dir: "up" | "down" | "flat";
  ts: number;
}

/* ─── Sounds ────────────────────────────────────────────── */

function useSurgeSounds() {
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

  const playTick = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }, [getCtx]);

  const playCountdownBeep = useCallback((urgency: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const now = ctx.currentTime;
    const freq = 400 + urgency * 600;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }, [getCtx]);

  const playWin = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
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
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }, [getCtx]);

  return { playTick, playCountdownBeep, playWin, playLose };
}

/* ─── Component ─────────────────────────────────────────── */

export function TidalSurgeGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency || "USD";
  const sounds = useSurgeSounds();

  const canvasRef = useRef<TidalSurgeCanvasHandle>(null);
  const needsCanvasReset = useRef(false);

  /* ── State ── */
  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedMarket, setSelectedMarket] = useState(GAME_MARKETS[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[0]);
  const [stake, setStake] = useState(5);
  const [prediction, setPrediction] = useState<Direction | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<ContractResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showMarketPicker, setShowMarketPicker] = useState(false);
  const [entryPrice, setEntryPrice] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [tickHistory, setTickHistory] = useState<TickHistoryItem[]>([]);

  /* ── Refs for callbacks ── */
  const gameStateRef = useRef<GameState>("idle");
  const contractIdRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const entryPriceRef = useRef(0);
  const predictionRef = useRef<Direction | null>(null);
  const prevTickEpoch = useRef(0);
  const unsubContractRef = useRef<(() => void) | null>(null);

  const { tick, direction } = useTicks(selectedMarket.symbol);

  const onCanvasReady = useCallback((handle: TidalSurgeCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<TidalSurgeCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset();
    }
  }, []);

  /* ── Proposal for preview ── */
  const proposalParams = useMemo(() => {
    if (gameState !== "idle") return null;
    return {
      amount: stake,
      basis: "stake" as const,
      contractType: "CALL",
      currency,
      duration: selectedDuration.value,
      durationUnit: selectedDuration.unit,
      symbol: selectedMarket.symbol,
    };
  }, [gameState, stake, currency, selectedDuration, selectedMarket.symbol]);

  const { proposal, loading: proposalLoading } = useProposal(proposalParams);

  const displayPrice = tick
    ? Number(tick.quote).toFixed(Math.max(2, selectedMarket.pip < 0.001 ? 5 : 2))
    : "—";

  const durationSecs = selectedDuration.unit === "m"
    ? selectedDuration.value * 60
    : selectedDuration.value;

  /* ── Feed ticks to canvas during live ── */
  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick || tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    setCurrentPrice(tick.quote);
    sounds.playTick();

    const dir: "up" | "down" | "flat" = direction === "up" ? "up" : direction === "down" ? "down" : "flat";
    setTickHistory(prev => [{ quote: tick.quote, dir, ts: tick.epoch }, ...prev].slice(0, 20));

    if (canvasRef.current && entryPriceRef.current > 0) {
      canvasRef.current.triggerTick(
        tick.quote,
        entryPriceRef.current,
        predictionRef.current === "CALL" ? "rise" : "fall",
      );
    }
  }, [tick, direction, sounds]);

  /* ── Countdown timer ── */
  function clearCountdownTimer() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown(seconds: number) {
    setCountdown(seconds);
    clearCountdownTimer();
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      canvasRef.current?.triggerCountdown(remaining, seconds);
      if (remaining <= 5 && remaining > 0) {
        sounds.playCountdownBeep(1 - remaining / 5);
      }
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    countdownRef.current = interval;
  }

  /* ── Watch contract result ── */
  const watchContract = useCallback(
    (contractId: number) => {
      if (!authWs) return;

      const handleSettled = (poc: {
        is_sold: number;
        profit: number;
        buy_price: number;
        payout: number;
        status: string;
      }) => {
        unsubContractRef.current?.();
        unsubContractRef.current = null;
        clearCountdownTimer();

        const won = poc.profit >= 0;
        if (won) sounds.playWin(); else sounds.playLose();
        canvasRef.current?.triggerResult(won);

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
          entry_spot: number;
        } | undefined;

        if (!poc || poc.contract_id !== contractId) return;

        if (poc.entry_spot && entryPriceRef.current === 0) {
          entryPriceRef.current = poc.entry_spot;
          setEntryPrice(poc.entry_spot);
        }

        if (poc.is_sold === 1 || poc.status === "sold") {
          handleSettled(poc);
        }
      });

      unsubContractRef.current = unsub;

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
            entry_spot: number;
          } | undefined;

          if (!poc) return;

          if (poc.entry_spot && entryPriceRef.current === 0) {
            entryPriceRef.current = poc.entry_spot;
            setEntryPrice(poc.entry_spot);
          }

          if (poc.is_sold === 1 || poc.status === "sold") {
            handleSettled(poc);
          }
        },
      );

      return unsub;
    },
    [authWs, sounds],
  );

  /* ── Place bet ── */
  function placeBet(dir: Direction) {
    if (!authWs || authStatus !== "connected" || !proposal) return;

    setPrediction(dir);
    predictionRef.current = dir;
    setGameState("confirming");
    gameStateRef.current = "confirming";
    setBuyError(null);
    setTickHistory([]);
    setEntryPrice(0);
    setCurrentPrice(0);
    entryPriceRef.current = 0;
    prevTickEpoch.current = 0;

    needsCanvasReset.current = true;
    if (canvasRef.current) {
      canvasRef.current.reset();
      needsCanvasReset.current = false;
    }

    authWs.send(
      {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: dir,
        currency,
        duration: selectedDuration.value,
        duration_unit: selectedDuration.unit,
        underlying_symbol: selectedMarket.symbol,
      },
      (propData) => {
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

          const buy = buyData.buy as { contract_id: number; buy_price: number };
          contractIdRef.current = buy.contract_id;
          setGameState("live");
          gameStateRef.current = "live";
          startCountdown(durationSecs);
          watchContract(buy.contract_id);
        });
      },
    );
  }

  /* ── Reset ── */
  function resetGame() {
    clearCountdownTimer();
    unsubContractRef.current?.();
    unsubContractRef.current = null;
    setGameState("idle");
    gameStateRef.current = "idle";
    setPrediction(null);
    predictionRef.current = null;
    setResult(null);
    setBuyError(null);
    setCountdown(0);
    setTickHistory([]);
    setEntryPrice(0);
    setCurrentPrice(0);
    entryPriceRef.current = 0;
    contractIdRef.current = null;
    canvasRef.current?.reset();
  }

  useEffect(() => () => {
    clearCountdownTimer();
    unsubContractRef.current?.();
  }, []);

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
            background: "linear-gradient(135deg, #06283830, #0a192820)",
            border: "1px solid rgba(6,182,212,0.15)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 40%, rgba(6,182,212,0.12) 0%, transparent 70%)",
            }}
          />
          <Waves
            style={{
              width: 48,
              height: 48,
              color: "#ffffff",
              filter: "drop-shadow(0 0 16px rgba(6,182,212,0.8))",
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
            TIDAL SURGE
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", position: "relative" }}>
            Ride the market waves &middot; Predict the tide
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

        {/* Direction cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {/* RISE */}
          <button
            onClick={() => placeBet("CALL")}
            disabled={isNotReady || !tick}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 16px",
              borderRadius: 14,
              border: "1px solid rgba(34,197,94,0.3)",
              background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))",
              cursor: isNotReady || !tick ? "not-allowed" : "pointer",
              opacity: isNotReady || !tick ? 0.5 : 1,
              transition: "all 0.2s",
            }}
          >
            <TrendingUp style={{ width: 36, height: 36, color: "#22c55e", filter: "drop-shadow(0 0 8px rgba(34,197,94,0.5))" }} />
            <span style={{ fontSize: 20, fontWeight: "bold", color: "#22c55e" }}>RISE</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Price goes UP = you WIN</span>
          </button>
          {/* FALL */}
          <button
            onClick={() => placeBet("PUT")}
            disabled={isNotReady || !tick}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "24px 16px",
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))",
              cursor: isNotReady || !tick ? "not-allowed" : "pointer",
              opacity: isNotReady || !tick ? 0.5 : 1,
              transition: "all 0.2s",
            }}
          >
            <TrendingDown style={{ width: 36, height: 36, color: "#ef4444", filter: "drop-shadow(0 0 8px rgba(239,68,68,0.5))" }} />
            <span style={{ fontSize: 20, fontWeight: "bold", color: "#ef4444" }}>FALL</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Price goes DOWN = you WIN</span>
          </button>
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.15em", fontWeight: "bold" }}>
            DURATION
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => setSelectedDuration(d)}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${selectedDuration.label === d.label ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: selectedDuration.label === d.label ? "rgba(6,182,212,0.1)" : "rgba(255,255,255,0.02)",
                  color: selectedDuration.label === d.label ? "#06b6d4" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

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
              <div className="flex items-center gap-2">
                {tick && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: direction === "up" ? "#22c55e" : direction === "down" ? "#ef4444" : "var(--text-muted)",
                    }}
                  >
                    {displayPrice}
                  </span>
                )}
                <ChevronDown style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
              </div>
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
                {GAME_MARKETS.map((m) => (
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
                      color: selectedMarket.symbol === m.symbol ? "#06b6d4" : "var(--text-secondary)",
                      background: selectedMarket.symbol === m.symbol ? "rgba(6,182,212,0.08)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.15s",
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

        {/* Stake */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", fontWeight: "bold" }}>
              STAKE ({currency})
            </span>
            {proposal && !proposalLoading && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Win up to{" "}
                <span style={{ color: "#06b6d4", fontFamily: "monospace" }}>
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
                  border: `1px solid ${stake === p ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: stake === p ? "rgba(6,182,212,0.1)" : "rgba(255,255,255,0.02)",
                  color: stake === p ? "#06b6d4" : "var(--text-muted)",
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
            background: "rgba(6,182,212,0.05)",
            border: "1px solid rgba(6,182,212,0.12)",
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.5,
          }}
        >
          Pick a direction. If the closing price is higher (RISE) or lower (FALL) than the entry price when the timer ends, you win.
        </div>
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
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>Riding out to sea…</p>
        </div>
      </div>
    );
  }

  /* ── Live ── */
  if (gameState === "live") {
    const isRise = prediction === "CALL";
    const pricePrecision = Math.max(2, selectedMarket.pip < 0.001 ? 5 : 2);
    const pnlDelta = entryPrice > 0 ? currentPrice - entryPrice : 0;
    const isWinning = isRise ? pnlDelta >= 0 : pnlDelta <= 0;

    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Canvas container */}
        <div
          style={{
            width: "100%",
            height: 480,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <TidalSurgeCanvas ref={onCanvasReady} />
        </div>

        {/* Live HUD */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {/* Direction badge */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 14px",
              border: `1px solid ${isRise ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              background: isRise ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>PREDICTION</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: isRise ? "#22c55e" : "#ef4444" }}>
              {isRise ? "RISE" : "FALL"}
            </div>
          </div>
          {/* Prices */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 14px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>PRICE</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
              Entry: {entryPrice > 0 ? Number(entryPrice).toFixed(pricePrecision) : "…"}
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                fontWeight: "bold",
                color: isWinning ? "#22c55e" : "#ef4444",
              }}
            >
              {currentPrice > 0 ? Number(currentPrice).toFixed(pricePrecision) : "…"}
            </div>
          </div>
          {/* Timer */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 14px",
              border: `1px solid ${countdown <= 5 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
              background: countdown <= 5 ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>TIME LEFT</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: "bold",
                fontFamily: "monospace",
                color: countdown <= 5 ? "#ef4444" : "#ffffff",
              }}
            >
              {countdown}s
            </div>
          </div>
        </div>

        {/* Status + tick feed */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Status */}
          <div
            style={{
              borderRadius: 10,
              padding: "10px 14px",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              textAlign: "center",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>STATUS</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: isWinning ? "#22c55e" : "#ef4444",
              }}
            >
              {pnlDelta === 0 ? "EVEN" : isWinning ? "WINNING" : "LOSING"}
            </div>
          </div>
          {/* Tick feed */}
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
            {tickHistory.length === 0 && (
              <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: "var(--text-muted)" }}>
                Waiting for ticks…
              </div>
            )}
            {tickHistory.slice(0, 8).map((t, i) => (
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
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{Number(t.quote).toFixed(pricePrecision)}</span>
                <span style={{ color: t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "var(--text-muted)" }}>
                  {t.dir === "up" ? "\u25B2" : t.dir === "down" ? "\u25BC" : "\u25CF"}
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
