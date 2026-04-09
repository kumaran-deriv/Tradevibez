"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { GameResult } from "@/components/games/GameResult";
import { useProposal } from "@/hooks/useProposal";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/utils/formatters";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100",  label: "Volatility 100",  pip: 0.01 },
  { symbol: "R_75",   label: "Volatility 75",   pip: 0.01 },
  { symbol: "R_50",   label: "Volatility 50",   pip: 0.01 },
  { symbol: "R_25",   label: "Volatility 25",   pip: 0.001 },
  { symbol: "frxEURUSD", label: "EUR/USD",       pip: 0.00001 },
  { symbol: "frxGBPUSD", label: "GBP/USD",       pip: 0.00001 },
];

const DURATIONS = [
  { label: "5s",  value: 5,  unit: "s" },
  { label: "15s", value: 15, unit: "s" },
  { label: "30s", value: 30, unit: "s" },
  { label: "1m",  value: 1,  unit: "m" },
];

const STAKE_PRESETS = [1, 5, 10, 25];

type GameState = "idle" | "confirming" | "live" | "result";

interface ContractResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

/* ─── Component ──────────────────────────────────────────── */

export function RiseFallGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency || "USD";

  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedMarket, setSelectedMarket] = useState(GAME_MARKETS[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[0]);
  const [stake, setStake] = useState(5);
  const [prediction, setPrediction] = useState<"CALL" | "PUT" | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<ContractResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showMarketPicker, setShowMarketPicker] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contractIdRef = useRef<number | null>(null);

  const { tick, direction } = useTicks(selectedMarket.symbol);

  // Proposal for currently hovered direction (or CALL by default for preview)
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

  // Format tick price
  const displayPrice = tick
    ? tick.quote.toFixed(Math.max(2, selectedMarket.pip < 0.001 ? 5 : 2))
    : "—";

  function clearCountdownTimer() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown(seconds: number) {
    setCountdown(seconds);
    clearCountdownTimer();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    countdownRef.current = interval;
  }

  // Watch for contract result via portfolio subscription
  const checkContract = useCallback(
    (contractId: number) => {
      if (!authWs) return;

      const unsub = authWs.subscribe("proposal_open_contract", (data) => {
        const poc = data.proposal_open_contract as {
          contract_id: number;
          is_sold: number;
          profit: number;
          buy_price: number;
          payout: number;
          status: string;
        } | undefined;

        if (!poc || poc.contract_id !== contractId) return;

        if (poc.is_sold === 1 || poc.status === "sold") {
          unsub();
          clearCountdownTimer();
          setResult({
            won: poc.profit >= 0,
            buyPrice: poc.buy_price,
            payout: poc.payout,
          });
          setGameState("result");
        }
      });

      // Subscribe to this specific contract
      authWs.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });

      return unsub;
    },
    [authWs]
  );

  function placeBet(dir: "CALL" | "PUT") {
    if (!authWs || authStatus !== "connected" || !proposal) return;

    setPrediction(dir);
    setGameState("confirming");
    setBuyError(null);

    // Get fresh proposal for chosen direction
    const reqMsg = {
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: dir,
      currency,
      duration: selectedDuration.value,
      duration_unit: selectedDuration.unit,
      underlying_symbol: selectedMarket.symbol,
    };

    authWs.send(reqMsg, (propData) => {
      if (propData.error) {
        const err = propData.error as { message: string };
        setBuyError(err.message);
        setGameState("idle");
        return;
      }

      const prop = propData.proposal as { id: string; ask_price: number };
      if (!prop?.id) {
        setBuyError("Could not get a price. Try again.");
        setGameState("idle");
        return;
      }

      // Buy it
      authWs.send({ buy: prop.id, price: prop.ask_price }, (buyData) => {
        if (buyData.error) {
          const err = buyData.error as { message: string };
          setBuyError(err.message);
          setGameState("idle");
          return;
        }

        const buy = buyData.buy as { contract_id: number };
        contractIdRef.current = buy.contract_id;
        setGameState("live");

        const durationSecs =
          selectedDuration.unit === "m"
            ? selectedDuration.value * 60
            : selectedDuration.value;

        startCountdown(durationSecs);
        checkContract(buy.contract_id);
      });
    });
  }

  function resetGame() {
    clearCountdownTimer();
    setGameState("idle");
    setPrediction(null);
    setResult(null);
    setBuyError(null);
    contractIdRef.current = null;
  }

  useEffect(() => () => clearCountdownTimer(), []);

  const isNotReady = authStatus !== "connected";

  /* ─── Idle state ─────────────────────────────────────────── */
  if (gameState === "idle") {
    return (
      <div className="max-w-lg">
        <Card>
          <div className="space-y-5">
            {/* Auth warning */}
            {isNotReady && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2">
                <Spinner size="sm" />
                <span className="text-xs text-yellow-400">Connecting to trading server…</span>
              </div>
            )}

            {/* Market selector */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Market</label>
              <div className="relative">
                <button
                  onClick={() => setShowMarketPicker(!showMarketPicker)}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{selectedMarket.label}</span>
                  <div className="flex items-center gap-2">
                    {tick && (
                      <span className={`text-sm font-mono ${direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-gray-400"}`}>
                        {displayPrice}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </div>
                </button>
                {showMarketPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
                    {GAME_MARKETS.map((m) => (
                      <button
                        key={m.symbol}
                        onClick={() => { setSelectedMarket(m); setShowMarketPicker(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                          selectedMarket.symbol === m.symbol
                            ? "bg-emerald-600/10 text-emerald-400"
                            : "text-gray-300 hover:bg-gray-800"
                        }`}
                      >
                        {m.label}
                        {selectedMarket.symbol === m.symbol && <span className="text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Duration</label>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => setSelectedDuration(d)}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors border ${
                      selectedDuration.label === d.label
                        ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-500 uppercase tracking-widest">Stake ({currency})</label>
                {proposal && !proposalLoading && (
                  <span className="text-xs text-gray-500">
                    Win up to{" "}
                    <span className="text-emerald-400 font-mono">
                      {formatCurrency(proposal.payout, currency)}
                    </span>
                  </span>
                )}
                {proposalLoading && <Spinner size="sm" />}
              </div>
              <div className="flex gap-2 mb-2">
                {STAKE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setStake(p)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors border ${
                      stake === p
                        ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
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
                onChange={e => setStake(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Error */}
            {buyError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {buyError}
              </div>
            )}

            {/* Rise / Fall buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => placeBet("CALL")}
                disabled={isNotReady || !tick}
                className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 hover:border-emerald-400/50"
              >
                <TrendingUp className="h-5 w-5" />
                Rise
              </button>
              <button
                onClick={() => placeBet("PUT")}
                disabled={isNotReady || !tick}
                className="flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600/25 hover:border-red-400/50"
              >
                <TrendingDown className="h-5 w-5" />
                Fall
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ─── Confirming state ───────────────────────────────────── */
  if (gameState === "confirming") {
    return (
      <div className="max-w-lg">
        <Card>
          <div className="flex flex-col items-center py-10 gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-gray-400">Placing your trade…</p>
          </div>
        </Card>
      </div>
    );
  }

  /* ─── Live state ─────────────────────────────────────────── */
  if (gameState === "live") {
    const isRise = prediction === "CALL";
    return (
      <div className="max-w-lg">
        <Card>
          <div className="flex flex-col items-center py-8 gap-6">
            {/* Direction indicator */}
            <div
              className={`flex items-center gap-2 text-lg font-bold ${isRise ? "text-emerald-400" : "text-red-400"}`}
            >
              {isRise ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              You predicted {isRise ? "Rise" : "Fall"}
            </div>

            {/* Live price */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest">{selectedMarket.label}</p>
              <p
                className={`text-4xl font-mono font-bold transition-colors duration-150 ${
                  direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-white"
                }`}
              >
                {displayPrice}
              </p>
            </div>

            {/* Countdown ring */}
            <div className="relative flex items-center justify-center w-24 h-24">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="rgb(55,65,81)" strokeWidth="6" />
                <circle
                  cx="48" cy="48" r="42" fill="none"
                  stroke={isRise ? "rgb(52,211,153)" : "rgb(248,113,113)"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - countdown / (selectedDuration.unit === "m" ? selectedDuration.value * 60 : selectedDuration.value))}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="text-2xl font-mono font-bold text-white">{countdown}</span>
            </div>

            <p className="text-xs text-gray-500">Waiting for result…</p>
          </div>
        </Card>
      </div>
    );
  }

  /* ─── Result state ───────────────────────────────────────── */
  return (
    <div className="max-w-lg">
      <Card>
        {result && (
          <GameResult
            won={result.won}
            buyPrice={result.buyPrice}
            payout={result.payout}
            currency={currency}
            onPlayAgain={resetGame}
          />
        )}
      </Card>
    </div>
  );
}
