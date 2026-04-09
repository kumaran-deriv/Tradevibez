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
import type { Tick } from "@/types/deriv";

/* ─── Constants ──────────────────────────────────────────── */

// Volatility synthetics are best for digits (predictable digit distribution)
const DIGIT_MARKETS = [
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "R_75",  label: "Volatility 75"  },
  { symbol: "R_50",  label: "Volatility 50"  },
  { symbol: "R_25",  label: "Volatility 25"  },
  { symbol: "R_10",  label: "Volatility 10"  },
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

/* ─── Helpers ────────────────────────────────────────────── */

function getLastDigit(tick: Tick): number {
  // e.g. 1234.567 → last digit is 7
  const str = tick.quote.toString().replace(".", "");
  return parseInt(str[str.length - 1], 10);
}

/* ─── Component ──────────────────────────────────────────── */

export function DigitsGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency || "USD";

  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedMarket, setSelectedMarket] = useState(DIGIT_MARKETS[0]);
  const [mode, setMode] = useState<DigitMode>("even-odd");
  const [evenOddChoice, setEvenOddChoice] = useState<"DIGITEVEN" | "DIGITODD">("DIGITEVEN");
  const [matchDigit, setMatchDigit] = useState<number>(5);
  const [matchMode, setMatchMode] = useState<"DIGITMATCH" | "DIGITDIFF">("DIGITMATCH");
  const [tickDuration, setTickDuration] = useState(5);
  const [stake, setStake] = useState(5);
  const [result, setResult] = useState<ContractResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [ticksLeft, setTicksLeft] = useState(0);
  const [tickFeed, setTickFeed] = useState<{ digit: number; quote: number }[]>([]);

  const contractIdRef = useRef<number | null>(null);
  const tickFeedUnsub = useRef<(() => void) | null>(null);

  const { tick } = useTicks(gameState === "idle" ? selectedMarket.symbol : null);

  const lastDigit = tick ? getLastDigit(tick) : null;

  // Determine contract type
  const contractType = useMemo(() => {
    if (mode === "even-odd") return evenOddChoice;
    return matchMode;
  }, [mode, evenOddChoice, matchMode]);

  // Proposal params
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

  function clearFeedSub() {
    if (tickFeedUnsub.current) {
      tickFeedUnsub.current();
      tickFeedUnsub.current = null;
    }
  }

  // Watch for contract result
  const watchContract = useCallback(
    (contractId: number, totalTicks: number) => {
      if (!authWs) return;

      let tickCount = 0;
      setTicksLeft(totalTicks);

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

        // Track ticks
        if (poc.current_spot) {
          const d = parseInt(poc.current_spot.toString().replace(".", "").slice(-1), 10);
          tickCount += 1;
          setTickFeed(prev => [{ digit: d, quote: poc.current_spot }, ...prev].slice(0, 8));
          setTicksLeft(Math.max(0, totalTicks - tickCount));
        }

        if (poc.is_sold === 1 || poc.status === "sold") {
          unsub();
          clearFeedSub();
          setResult({
            won: poc.profit >= 0,
            buyPrice: poc.buy_price,
            payout: poc.payout,
          });
          setGameState("result");
        }
      });

      authWs.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
      return unsub;
    },
    [authWs]
  );

  function placeBet() {
    if (!authWs || authStatus !== "connected") return;

    setGameState("confirming");
    setBuyError(null);
    setTickFeed([]);

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
        return;
      }

      const prop = propData.proposal as { id: string; ask_price: number };
      if (!prop?.id) {
        setBuyError("Could not get a price. Try again.");
        setGameState("idle");
        return;
      }

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
        watchContract(buy.contract_id, tickDuration);
      });
    });
  }

  function resetGame() {
    clearFeedSub();
    setGameState("idle");
    setResult(null);
    setBuyError(null);
    setTickFeed([]);
    contractIdRef.current = null;
  }

  useEffect(() => () => clearFeedSub(), []);

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

            {/* Market */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Market</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DIGIT_MARKETS.map((m) => (
                  <button
                    key={m.symbol}
                    onClick={() => setSelectedMarket(m)}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors border ${
                      selectedMarket.symbol === m.symbol
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {m.label.replace("Volatility ", "V")}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode selector */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Game Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("even-odd")}
                  className={`rounded-lg py-2.5 text-sm font-medium transition-colors border ${
                    mode === "even-odd"
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  🎲 Even or Odd
                </button>
                <button
                  onClick={() => setMode("match")}
                  className={`rounded-lg py-2.5 text-sm font-medium transition-colors border ${
                    mode === "match"
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  🎯 Match Digit
                </button>
              </div>
            </div>

            {/* Mode-specific controls */}
            {mode === "even-odd" ? (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Your Pick</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setEvenOddChoice("DIGITEVEN")}
                    className={`rounded-xl py-4 text-base font-bold transition-colors border ${
                      evenOddChoice === "DIGITEVEN"
                        ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    Even
                  </button>
                  <button
                    onClick={() => setEvenOddChoice("DIGITODD")}
                    className={`rounded-xl py-4 text-base font-bold transition-colors border ${
                      evenOddChoice === "DIGITODD"
                        ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    Odd
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Contract</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMatchMode("DIGITMATCH")}
                      className={`rounded-lg py-2.5 text-sm font-medium transition-colors border ${
                        matchMode === "DIGITMATCH"
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      Matches digit
                    </button>
                    <button
                      onClick={() => setMatchMode("DIGITDIFF")}
                      className={`rounded-lg py-2.5 text-sm font-medium transition-colors border ${
                        matchMode === "DIGITDIFF"
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                      }`}
                    >
                      Differs from digit
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Digit (0–9)</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <button
                        key={d}
                        onClick={() => setMatchDigit(d)}
                        className={`rounded-lg py-2.5 text-sm font-mono font-bold transition-colors border ${
                          matchDigit === d
                            ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Live digit preview */}
            {lastDigit !== null && (
              <div className="flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-3 border border-gray-700">
                <span className="text-xs text-gray-500 uppercase tracking-widest">Last digit</span>
                <span className="text-2xl font-mono font-bold text-orange-400">{lastDigit}</span>
                <span className={`text-xs ${lastDigit % 2 === 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {lastDigit % 2 === 0 ? "Even" : "Odd"}
                </span>
              </div>
            )}

            {/* Ticks */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">Ticks (duration)</label>
              <div className="grid grid-cols-2 gap-2">
                {TICK_DURATIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTickDuration(t)}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors border ${
                      tickDuration === t
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {t} ticks
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
                    <span className="text-orange-400 font-mono">
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
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
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
                className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-700 text-white text-sm font-mono focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Error */}
            {buyError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {buyError}
              </div>
            )}

            {/* Play button */}
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-orange-600 hover:bg-orange-500 focus-visible:ring-orange-500"
              onClick={placeBet}
              disabled={isNotReady || !proposal}
            >
              Play Now
            </Button>
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
    const modeLabel = mode === "even-odd"
      ? `Last digit is ${evenOddChoice === "DIGITEVEN" ? "even" : "odd"}`
      : `Last digit ${matchMode === "DIGITMATCH" ? "matches" : "differs from"} ${matchDigit}`;

    return (
      <div className="max-w-lg">
        <Card>
          <div className="flex flex-col items-center py-8 gap-5">
            <p className="text-sm text-orange-400 font-medium">{modeLabel}</p>

            {/* Ticks counter */}
            <div className="flex items-center gap-2">
              {Array.from({ length: tickDuration }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                    i < tickDuration - ticksLeft ? "bg-orange-400" : "bg-gray-700"
                  }`}
                />
              ))}
              <span className="text-xs text-gray-500 ml-2">{ticksLeft} ticks left</span>
            </div>

            {/* Tick feed */}
            <div className="w-full space-y-1.5">
              {tickFeed.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Spinner size="sm" />
                  <span className="text-xs text-gray-500">Waiting for ticks…</span>
                </div>
              )}
              {tickFeed.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-4 py-2 border ${
                    i === 0 ? "bg-gray-800 border-orange-500/30" : "bg-gray-900 border-gray-800"
                  }`}
                >
                  <span className="text-xs font-mono text-gray-400">{t.quote}</span>
                  <span
                    className={`text-lg font-mono font-bold ${
                      t.digit % 2 === 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {t.digit}
                  </span>
                  <span className="text-xs text-gray-600">
                    {t.digit % 2 === 0 ? "even" : "odd"}
                  </span>
                </div>
              ))}
            </div>
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
