"use client";

import { useState, useEffect, useRef } from "react";
import { PriceChart } from "@/components/trading/PriceChart";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/utils/formatters";
import { Zap } from "lucide-react";
import type { Tick } from "@/types/deriv";

/* ─── Constants ──────────────────────────────────────────── */

const GAME_MARKETS = [
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "R_75",  label: "Volatility 75"  },
  { symbol: "R_50",  label: "Volatility 50"  },
  { symbol: "R_10",  label: "Volatility 10"  },
];

const STAKE_PRESETS = [5, 10, 25, 50];
const MAX_TICKS = 10;

// Multiplier by hit count (index = hits, capped at 3)
const MULTIPLIERS = [0, 2, 5, 15];

/* ─── Helpers ────────────────────────────────────────────── */

function getLastDigit(tick: Tick): number {
  const str = tick.quote.toString().replace(".", "");
  return parseInt(str[str.length - 1], 10);
}

function getMultiplier(hits: number): number {
  return MULTIPLIERS[Math.min(hits, MULTIPLIERS.length - 1)];
}

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";

interface CellResult {
  digit: number;
  hits: number;
  stakePortion: number;
  payout: number;
}

/* ─── Component ──────────────────────────────────────────── */

export function ChainReactionGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";

  const [symbol, setSymbol] = useState("R_100");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [stake, setStake] = useState(10);

  // Live state
  const [tickCount, setTickCount] = useState(0);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [hitCounts, setHitCounts] = useState<Record<number, number>>({});
  const [flashingCell, setFlashingCell] = useState<number | null>(null);

  // Result state
  const [cellResults, setCellResults] = useState<CellResult[]>([]);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Refs to avoid stale closures in tick effect
  const gameStateRef = useRef<GameState>("idle");
  const selectedCellsRef = useRef<number[]>([]);
  const hitCountsRef = useRef<Record<number, number>>({});
  const tickCountRef = useRef(0);
  const stakeRef = useRef(10);
  const prevTickEpoch = useRef<number | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tick, direction } = useTicks(symbol);

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { selectedCellsRef.current = selectedCells; }, [selectedCells]);
  useEffect(() => { hitCountsRef.current = hitCounts; }, [hitCounts]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);

  /* ─── Cell selection ─────────────────────────────────── */

  const toggleCell = (digit: number) => {
    if (gameState !== "idle") return;
    setSelectedCells((prev) => {
      if (prev.includes(digit)) return prev.filter((d) => d !== digit);
      if (prev.length >= 3) return [...prev.slice(1), digit]; // drop oldest
      return [...prev, digit];
    });
  };

  /* ─── Launch ─────────────────────────────────────────── */

  const handleLaunch = () => {
    if (selectedCells.length !== 3 || !authWs || authStatus !== "connected") return;

    // Reset all tracking state
    setBuyError(null);
    const freshHits: Record<number, number> = {};
    setHitCounts(freshHits);
    hitCountsRef.current = freshHits;
    setTickCount(0);
    tickCountRef.current = 0;
    setCurrentDigit(null);
    prevTickEpoch.current = null;
    setCellResults([]);

    // Snapshot current values for closure
    const cells = [...selectedCells];
    const stakeAmount = stake;
    selectedCellsRef.current = cells;
    stakeRef.current = stakeAmount;

    setGameState("live");
    gameStateRef.current = "live";

    // Buy one DIGITMATCH contract per selected cell
    const stakePer = parseFloat((stakeAmount / 3).toFixed(2));
    cells.forEach((digit) => {
      const reqMsg: Record<string, unknown> = {
        proposal: 1,
        amount: stakePer,
        basis: "stake",
        contract_type: "DIGITMATCH",
        currency,
        duration: MAX_TICKS,
        duration_unit: "t",
        underlying_symbol: symbol,
        barrier: String(digit),
      };

      authWs.send(reqMsg, (propData) => {
        if (propData.error) {
          const err = propData.error as { message: string };
          setBuyError(err.message);
          return;
        }
        const prop = propData.proposal as { id: string; ask_price: number } | undefined;
        if (!prop?.id) return;

        authWs.send({ buy: prop.id, price: prop.ask_price }, (buyData) => {
          if (buyData.error) {
            const err = buyData.error as { message: string };
            setBuyError(err.message);
          }
          // Contract bought — game tracks result via tick count
        });
      });
    });
  };

  /* ─── Tick processing ────────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick) return;
    // Deduplicate ticks by epoch
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const digit = getLastDigit(tick);
    setCurrentDigit(digit);

    const cells = selectedCellsRef.current;
    if (cells.includes(digit)) {
      setHitCounts((prev) => {
        const next = { ...prev, [digit]: (prev[digit] ?? 0) + 1 };
        hitCountsRef.current = next;
        return next;
      });
    } else {
      // Flash non-chosen cell
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      setFlashingCell(digit);
      flashTimeout.current = setTimeout(() => setFlashingCell(null), 300);
    }

    const next = tickCountRef.current + 1;
    tickCountRef.current = next;
    setTickCount(next);

    if (next >= MAX_TICKS) {
      // Settle after last animation
      setTimeout(() => {
        const sp = stakeRef.current / 3;
        const results: CellResult[] = selectedCellsRef.current.map((d) => {
          const hits = hitCountsRef.current[d] ?? 0;
          const mult = getMultiplier(hits);
          return {
            digit: d,
            hits,
            stakePortion: sp,
            payout: hits === 0 ? 0 : parseFloat((sp * mult).toFixed(2)),
          };
        });
        setCellResults(results);
        setGameState("result");
        gameStateRef.current = "result";
      }, 700);
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ──────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle");
    gameStateRef.current = "idle";
    setSelectedCells([]);
    setTickCount(0);
    setCurrentDigit(null);
    setHitCounts({});
    hitCountsRef.current = {};
    setCellResults([]);
    setBuyError(null);
    prevTickEpoch.current = null;
  };

  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
  }, []);

  /* ─── Derived ────────────────────────────────────────── */

  const totalBuy = stake;
  const totalPayout = cellResults.reduce((s, r) => s + r.payout, 0);
  const gameWon = totalPayout > totalBuy;

  const displayPrice = tick
    ? tick.quote.toString()
    : "—";

  /* ─── Cell visual ────────────────────────────────────── */

  function getCellStyle(digit: number): React.CSSProperties {
    const isSelected = selectedCells.includes(digit) || selectedCellsRef.current.includes(digit);
    const hits = hitCounts[digit] ?? 0;
    const isFlashing = flashingCell === digit;

    if (isFlashing && !isSelected) {
      return {
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "rgba(255,255,255,0.8)",
        transform: "scale(1.05)",
        boxShadow: "none",
      };
    }

    if (!isSelected) {
      return {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        color: "rgba(255,255,255,0.25)",
        transform: "scale(1)",
        boxShadow: "none",
        cursor: gameState === "idle" ? "pointer" : "default",
      };
    }

    // Selected cell — scale with hits
    if (hits >= 3) {
      return {
        background: "rgba(20,184,166,0.45)",
        border: "2px solid #ffffff",
        color: "#ffffff",
        transform: "scale(1.15)",
        boxShadow: "0 0 24px rgba(20,184,166,0.9), 0 0 50px rgba(20,184,166,0.4)",
      };
    }
    if (hits === 2) {
      return {
        background: "rgba(20,184,166,0.28)",
        border: "1px solid rgba(20,184,166,0.9)",
        color: "var(--accent)",
        transform: "scale(1.08)",
        boxShadow: "0 0 14px rgba(20,184,166,0.6)",
      };
    }
    if (hits === 1) {
      return {
        background: "rgba(20,184,166,0.14)",
        border: "1px solid rgba(20,184,166,0.6)",
        color: "var(--accent)",
        transform: "scale(1.04)",
        boxShadow: "0 0 8px rgba(20,184,166,0.35)",
      };
    }
    // Selected, 0 hits
    return {
      background: "rgba(20,184,166,0.07)",
      border: "1px solid rgba(20,184,166,0.4)",
      color: "var(--accent)",
      transform: "scale(1)",
      boxShadow: "none",
      cursor: gameState === "idle" ? "pointer" : "default",
    };
  }

  /* ─── Render ─────────────────────────────────────────── */

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ minHeight: "calc(100vh - 220px)" }}
    >
      {/* Background chart */}
      <div
        className="absolute inset-0"
        style={{ filter: "blur(1.5px)", transform: "scale(1.03)" }}
      >
        <PriceChart symbol={symbol} chartType="line" />
      </div>

      {/* Dark overlay — lighter during live for more chart visibility */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            gameState === "live"
              ? "rgba(8,13,24,0.78)"
              : "rgba(8,13,24,0.89)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center h-full py-8 px-6 gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Zap
            className="h-4 w-4"
            style={{ color: "var(--accent)" }}
          />
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              letterSpacing: "0.28em",
              fontFamily: "monospace",
            }}
          >
            CHAIN REACTION
          </span>
          <span style={{ color: "var(--border)" }}>·</span>

          {/* Symbol selector — idle only */}
          {gameState === "idle" ? (
            <div className="flex gap-1.5">
              {GAME_MARKETS.map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => setSymbol(m.symbol)}
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: `1px solid ${symbol === m.symbol ? "rgba(20,184,166,0.6)" : "var(--border)"}`,
                    background: symbol === m.symbol ? "rgba(20,184,166,0.08)" : "transparent",
                    color: symbol === m.symbol ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {m.symbol}
                </button>
              ))}
            </div>
          ) : (
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {symbol}
            </span>
          )}
        </div>

        {/* Live: tick counter + big digit reveal */}
        {gameState === "live" && (
          <div className="flex flex-col items-center gap-1">
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: 10,
                letterSpacing: "0.3em",
                fontFamily: "monospace",
              }}
            >
              TICK {tickCount} / {MAX_TICKS}
            </span>
            <div
              key={tickCount}
              className="animate-in fade-in slide-in-from-top-6 duration-150"
              style={{
                fontSize: 88,
                fontFamily: "monospace",
                fontWeight: "bold",
                lineHeight: 1,
                color:
                  currentDigit !== null &&
                  (selectedCells.includes(currentDigit) || selectedCellsRef.current.includes(currentDigit))
                    ? "var(--accent)"
                    : "rgba(255,255,255,0.88)",
                textShadow:
                  currentDigit !== null &&
                  (selectedCells.includes(currentDigit) || selectedCellsRef.current.includes(currentDigit))
                    ? "0 0 40px rgba(20,184,166,0.8)"
                    : "none",
                transition: "text-shadow 0.2s",
              }}
            >
              {currentDigit ?? "·"}
            </div>
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color:
                  direction === "up"
                    ? "#22c55e"
                    : direction === "down"
                    ? "#ef4444"
                    : "var(--text-muted)",
              }}
            >
              {displayPrice}
            </span>
          </div>
        )}

        {/* Idle tagline */}
        {gameState === "idle" && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Select 3 cells · 10 ticks · Light them up
          </p>
        )}

        {/* Digit grid */}
        {gameState !== "result" && (
          <div className="flex flex-col gap-3">
            {[[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]].map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-3">
                {row.map((digit) => {
                  const cellStyle = getCellStyle(digit);
                  const hits = hitCounts[digit] ?? 0;
                  const isSelected =
                    selectedCells.includes(digit) ||
                    (gameState !== "idle" && selectedCellsRef.current.includes(digit));
                  const mult = isSelected ? getMultiplier(hits) : 0;

                  return (
                    <div
                      key={digit}
                      onClick={() => toggleCell(digit)}
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        userSelect: "none",
                        transition: "all 0.2s ease",
                        ...cellStyle,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 30,
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          lineHeight: 1,
                        }}
                      >
                        {digit}
                      </span>

                      {/* Badge: selected+live shows multiplier, selected+idle shows checkmark */}
                      {isSelected && gameState === "live" && (
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "monospace",
                            letterSpacing: "0.04em",
                            color: hits > 0 ? "var(--accent)" : "var(--text-muted)",
                          }}
                        >
                          {hits > 0 ? `×${mult}` : "·"}
                        </span>
                      )}
                      {isSelected && gameState === "idle" && (
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "monospace",
                            color: "var(--accent)",
                            opacity: 0.8,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Idle: stake + multiplier legend + launch */}
        {gameState === "idle" && (
          <div
            className="flex flex-col items-center gap-4"
            style={{ width: "100%", maxWidth: 400 }}
          >
            {/* Stake selector */}
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center">
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    fontFamily: "monospace",
                  }}
                >
                  STAKE ({currency})
                </span>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                >
                  {formatCurrency(stake / 3, currency)} per cell
                </span>
              </div>
              <div className="flex gap-2">
                {STAKE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setStake(p)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 6,
                      border: `1px solid ${
                        stake === p
                          ? "rgba(20,184,166,0.5)"
                          : "var(--border)"
                      }`,
                      background:
                        stake === p
                          ? "rgba(20,184,166,0.08)"
                          : "rgba(255,255,255,0.03)",
                      color:
                        stake === p ? "var(--accent)" : "var(--text-secondary)",
                      fontSize: 13,
                      fontFamily: "monospace",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiplier legend */}
            <div className="flex items-center gap-5">
              {[
                { hits: 1, label: "1 hit", mult: "×2" },
                { hits: 2, label: "2 hits", mult: "×5" },
                { hits: 3, label: "3 hits", mult: "×15" },
              ].map(({ hits, label, mult }) => (
                <div key={hits} className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: `rgba(20,184,166,${hits * 0.1 + 0.05})`,
                      border: `1px solid rgba(20,184,166,${hits * 0.25 + 0.1})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      fontFamily: "monospace",
                      color: "var(--accent)",
                      fontWeight: "bold",
                    }}
                  >
                    {hits}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {label} = {mult}
                  </span>
                </div>
              ))}
            </div>

            {/* Error */}
            {buyError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#ef4444",
                  fontSize: 12,
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {buyError}
              </div>
            )}

            {/* Auth warning */}
            {authStatus !== "connected" && (
              <div
                style={{
                  background: "rgba(234,179,8,0.08)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  color: "#eab308",
                  fontSize: 11,
                  fontFamily: "monospace",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                Connecting to trading server…
              </div>
            )}

            {/* Launch button */}
            <button
              onClick={handleLaunch}
              disabled={
                selectedCells.length !== 3 || authStatus !== "connected"
              }
              style={{
                width: "100%",
                padding: "15px 0",
                borderRadius: 8,
                border: `1px solid ${
                  selectedCells.length === 3
                    ? "rgba(20,184,166,0.5)"
                    : "var(--border)"
                }`,
                background:
                  selectedCells.length === 3
                    ? "rgba(20,184,166,0.10)"
                    : "rgba(255,255,255,0.02)",
                color:
                  selectedCells.length === 3
                    ? "var(--accent)"
                    : "var(--text-muted)",
                fontSize: 13,
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "0.18em",
                cursor:
                  selectedCells.length === 3 && authStatus === "connected"
                    ? "pointer"
                    : "not-allowed",
                opacity:
                  selectedCells.length !== 3 || authStatus !== "connected"
                    ? 0.45
                    : 1,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Zap style={{ width: 15, height: 15 }} />
              {selectedCells.length === 3
                ? `LAUNCH · CELLS ${[...selectedCells]
                    .sort((a, b) => a - b)
                    .join(", ")}`
                : `SELECT ${3 - selectedCells.length} MORE CELL${
                    3 - selectedCells.length !== 1 ? "S" : ""
                  }`}
            </button>
          </div>
        )}

        {/* Result */}
        {gameState === "result" && cellResults.length > 0 && (
          <div
            className="flex flex-col items-center gap-5 w-full animate-in fade-in zoom-in-95 duration-300"
            style={{ maxWidth: 480 }}
          >
            {/* Per-cell breakdown */}
            <div className="flex gap-3 justify-center w-full">
              {cellResults.map((r) => {
                const isWin = r.payout > 0;
                const profit = r.payout - r.stakePortion;
                return (
                  <div
                    key={r.digit}
                    style={{
                      flex: 1,
                      padding: "16px 12px",
                      borderRadius: 8,
                      background: isWin
                        ? "rgba(20,184,166,0.08)"
                        : "rgba(239,68,68,0.06)",
                      border: `1px solid ${
                        isWin
                          ? "rgba(20,184,166,0.25)"
                          : "rgba(239,68,68,0.2)"
                      }`,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 32,
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        color: isWin ? "var(--accent)" : "var(--text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {r.digit}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                        marginBottom: 8,
                      }}
                    >
                      {r.hits} hit{r.hits !== 1 ? "s" : ""}
                    </div>
                    {isWin ? (
                      <>
                        <div
                          style={{
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "var(--accent)",
                            fontWeight: "bold",
                          }}
                        >
                          +{formatCurrency(profit, currency)}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                            marginTop: 2,
                          }}
                        >
                          ×{getMultiplier(r.hits)}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          fontSize: 13,
                          fontFamily: "monospace",
                          color: "#ef4444",
                        }}
                      >
                        −{formatCurrency(r.stakePortion, currency)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total summary */}
            <GameResult
              won={gameWon}
              buyPrice={totalBuy}
              payout={totalPayout}
              currency={currency}
              onPlayAgain={resetGame}
            />
          </div>
        )}
      </div>
    </div>
  );
}
