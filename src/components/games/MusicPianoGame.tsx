"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Music, TrendingUp, TrendingDown, Zap, ChevronUp, ChevronDown } from "lucide-react";
import type { PianoCanvasHandle } from "./MusicPianoCanvas";

/* ─── Dynamic import ─────────────────────────────────────── */

const MusicPianoCanvas = dynamic(() => import("./MusicPianoCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#070b16" }}>
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading piano…
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
const TICK_OPTIONS   = [10, 15, 20] as const;
const STAKE_PRESETS  = [5, 10, 25, 50];
const NOTE_NAMES     = ["C4","D4","E4","G4","A4","C5","D5","E5","G5","A5","C6"];
const START_NOTE_IDX = 5;

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type Bet = "harmony" | "discord";

interface PianoResult {
  won: boolean;
  buyPrice: number;
  payout: number;
}

/* ─── Note indicator ─────────────────────────────────────── */

function NoteIndicator({ noteIdx }: { noteIdx: number }) {
  const totalNotes = NOTE_NAMES.length;
  const pct = (noteIdx / (totalNotes - 1)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.15em" }}>NOTE</span>
        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: "bold", color: "var(--accent)" }}>
          {NOTE_NAMES[noteIdx]}
        </span>
      </div>
      <div style={{ width: 120, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: `hsl(${200 - pct * 1.4},80%,60%)`,
          transition: "width 0.2s ease, background 0.2s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: "monospace", color: "var(--text-muted)" }}>
        <span>LOW</span><span>HIGH</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function MusicPianoGame() {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";

  const [symbol, setSymbol]         = useState("R_100");
  const [totalTicks, setTotalTicks] = useState<10 | 15 | 20>(15);
  const [stake, setStake]           = useState(10);
  const [bet, setBet]               = useState<Bet>("harmony");
  const [gameState, setGameState]   = useState<GameState>("idle");

  const [tickCount, setTickCount]   = useState(0);
  const [noteIdx, setNoteIdx]       = useState(START_NOTE_IDX);
  const [upTicks, setUpTicks]       = useState(0);
  const [downTicks, setDownTicks]   = useState(0);
  const [result, setResult]         = useState<PianoResult | null>(null);
  const [buyError, setBuyError]     = useState<string | null>(null);
  const [replayDone, setReplayDone] = useState(false);

  /* Refs */
  const gameStateRef  = useRef<GameState>("idle");
  const totalTicksRef = useRef(15);
  const stakeRef      = useRef(10);
  const betRef        = useRef<Bet>("harmony");
  const tickCountRef  = useRef(0);
  const noteIdxRef    = useRef(START_NOTE_IDX);
  const prevTickEpoch = useRef<number | null>(null);
  const prevQuoteRef  = useRef<number | null>(null);
  const contractIdRef = useRef<number | null>(null);
  const canvasRef     = useRef<PianoCanvasHandle>(null);
  const needsCanvasReset = useRef(false);

  const { tick, direction: tickDirection } = useTicks(symbol);

  useEffect(() => { gameStateRef.current = gameState; },   [gameState]);
  useEffect(() => { totalTicksRef.current = totalTicks; }, [totalTicks]);
  useEffect(() => { stakeRef.current = stake; },           [stake]);
  useEffect(() => { betRef.current = bet; },               [bet]);

  const onCanvasReady = useCallback((handle: PianoCanvasHandle | null) => {
    (canvasRef as React.MutableRefObject<PianoCanvasHandle | null>).current = handle;
    if (handle && needsCanvasReset.current) {
      needsCanvasReset.current = false;
      handle.reset();
    }
  }, []);

  /* ─── Buy contract ──────────────────────────────────── */

  const buyContract = useCallback((b: Bet, stakeAmt: number, sym: string, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = b === "harmony" ? "CALL" : "PUT";
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

  /* ─── Launch ────────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;
    setTickCount(0); setNoteIdx(START_NOTE_IDX);
    setUpTicks(0); setDownTicks(0);
    setResult(null); setBuyError(null); setReplayDone(false);
    tickCountRef.current  = 0;
    noteIdxRef.current    = START_NOTE_IDX;
    prevTickEpoch.current = null;
    prevQuoteRef.current  = null;
    contractIdRef.current = null;

    needsCanvasReset.current = true;
    setGameState("live");
    gameStateRef.current = "live";
    if (canvasRef.current) {
      canvasRef.current.reset();
      needsCanvasReset.current = false;
    }
    buyContract(bet, stake, symbol, totalTicks);
  };

  /* ─── Tick processing ───────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return;

    const delta = tick.quote - prevQ;
    const dir: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    // Update note index
    let ni = noteIdxRef.current;
    if      (dir === "up")   ni = Math.min(NOTE_NAMES.length - 1, ni + 1);
    else if (dir === "down") ni = Math.max(0, ni - 1);
    noteIdxRef.current = ni;
    setNoteIdx(ni);

    if (dir === "up") setUpTicks((p) => p + 1);
    else if (dir === "down") setDownTicks((p) => p + 1);

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    canvasRef.current?.triggerTick(dir);

    // End of round
    if (nextCount >= totalTicksRef.current) {
      const contractId = contractIdRef.current;
      setTimeout(() => {
        // Trigger melody replay
        canvasRef.current?.playMelodyReplay();
        setReplayDone(true);

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
          // Fallback: note position determines win
          const ni = noteIdxRef.current;
          const won = betRef.current === "harmony" ? ni > START_NOTE_IDX : ni < START_NOTE_IDX;
          const payout = won ? stakeRef.current * 1.85 : 0;
          canvasRef.current?.triggerEnd(won);
          setResult({ won, buyPrice: stakeRef.current, payout });
          setGameState("result");
          gameStateRef.current = "result";
        }
      }, 600);
    }
  }, [tick, authWs, authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ─────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle"); gameStateRef.current = "idle";
    setTickCount(0); setNoteIdx(START_NOTE_IDX);
    setUpTicks(0); setDownTicks(0);
    setResult(null); setBuyError(null); setReplayDone(false);
    prevTickEpoch.current = null; prevQuoteRef.current = null;
  };

  const canLaunch = authStatus === "connected";

  /* ─── Idle ──────────────────────────────────────────── */

  if (gameState === "idle") {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 520 }}>
        {/* Market */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>MARKET</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {GAME_MARKETS.map((m) => (
              <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                padding: "8px 6px", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${symbol === m.symbol ? "rgba(168,85,247,0.5)" : "var(--border)"}`,
                background: symbol === m.symbol ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                color: symbol === m.symbol ? "#a855f7" : "var(--text-secondary)",
                fontSize: 11, fontFamily: "monospace",
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
                border: `1px solid ${totalTicks === t ? "rgba(168,85,247,0.5)" : "var(--border)"}`,
                background: totalTicks === t ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                color: totalTicks === t ? "#a855f7" : "var(--text-secondary)",
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
                border: `1px solid ${stake === p ? "rgba(168,85,247,0.5)" : "var(--border)"}`,
                background: stake === p ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                color: stake === p ? "#a855f7" : "var(--text-secondary)",
                fontSize: 13, fontFamily: "monospace",
              }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Bet type */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>YOUR PREDICTION</span>
          <div className="flex gap-3">
            {(["harmony", "discord"] as Bet[]).map((b) => {
              const color = b === "harmony" ? "#22c55e" : "#ef4444";
              const sel = bet === b;
              return (
                <button key={b} onClick={() => setBet(b)} style={{
                  flex: 1, padding: "16px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  border: `2px solid ${sel ? `${color}90` : "rgba(255,255,255,0.06)"}`,
                  background: sel ? `${color}18` : "rgba(255,255,255,0.02)",
                  color: sel ? color : "var(--text-secondary)",
                  fontSize: 14, fontWeight: "bold", fontFamily: "monospace",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  boxShadow: sel ? `0 0 20px ${color}25` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {b === "harmony" ? <TrendingUp style={{ width: 18, height: 18 }} /> : <TrendingDown style={{ width: 18, height: 18 }} />}
                    {b === "harmony" ? "HARMONY" : "DISCORD"}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>
                    {b === "harmony"
                      ? "Price goes UP = you WIN"
                      : "Price goes DOWN = you WIN"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", lineHeight: 1.7 }}>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "#a855f7" }}>How it works:</strong>
          </div>
          <div>
            <span style={{ color: "#22c55e" }}>HARMONY</span> = you buy a <strong>CALL</strong> contract. If the price is <strong>higher</strong> at the end, you win.
          </div>
          <div>
            <span style={{ color: "#ef4444" }}>DISCORD</span> = you buy a <strong>PUT</strong> contract. If the price is <strong>lower</strong> at the end, you win.
          </div>
          <div style={{ marginTop: 6, color: "rgba(168,85,247,0.7)" }}>
            Each tick plays a note — UP ticks go higher, DOWN ticks go lower. The melody replays at the end!
          </div>
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
          border: "1px solid rgba(168,85,247,0.5)",
          background: canLaunch ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.02)",
          color: canLaunch ? "#a855f7" : "var(--text-muted)",
          fontSize: 14, fontWeight: "bold", fontFamily: "monospace", letterSpacing: "0.15em",
          opacity: canLaunch ? 1 : 0.45, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Music style={{ width: 16, height: 16 }} />
          COMPOSE THE MELODY
        </button>
      </div>
    );
  }

  /* ─── Live + Result ─────────────────────────────────────── */

  const progPct = (tickCount / totalTicks) * 100;
  const isWinning = bet === "harmony" ? upTicks > downTicks : downTicks > upTicks;
  const isTied = upTicks === downTicks;

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Canvas */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#070b16" }}>
        <MusicPianoCanvas ref={onCanvasReady} />
      </div>

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Top bar */}
        <div className="flex items-start justify-between" style={{ padding: "16px 20px" }}>
          {/* Left: progress + direction tracker */}
          <div className="flex flex-col gap-3">
            {gameState === "live" && (
              <>
                <div className="flex flex-col gap-2">
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
                    TICK {tickCount} / {totalTicks}
                  </span>
                  <div style={{ width: 140, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${progPct}%`, height: "100%", background: "#a855f7", transition: "width 0.3s ease", borderRadius: 2 }} />
                  </div>
                </div>
                {/* Live direction indicator */}
                <div style={{
                  padding: "6px 10px", borderRadius: 6,
                  background: "rgba(6,11,22,0.9)",
                  border: `1px solid ${isTied ? "rgba(255,255,255,0.1)" : isWinning ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`,
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 10, fontFamily: "monospace" }}>
                    <span style={{ color: "#22c55e" }}>UP {upTicks}</span>
                    <span style={{ color: "var(--text-muted)" }}>vs</span>
                    <span style={{ color: "#ef4444" }}>DOWN {downTicks}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                    color: isTied ? "var(--text-muted)" : isWinning ? "#22c55e" : "#ef4444",
                  }}>
                    {isTied ? "EVEN" : isWinning ? "WINNING" : "LOSING"}
                  </span>
                </div>
              </>
            )}
            {gameState === "result" && result && (
              <div style={{
                padding: "8px 14px", borderRadius: 8,
                background: result.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${result.won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                color: result.won ? "#22c55e" : "#ef4444",
                fontFamily: "monospace",
              }}>
                <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 4 }}>
                  {result.won ? "YOU WIN!" : "YOU LOSE"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {bet === "harmony"
                    ? `Price went ${upTicks > downTicks ? "UP" : "DOWN"} (${upTicks} up vs ${downTicks} down)`
                    : `Price went ${downTicks > upTicks ? "DOWN" : "UP"} (${downTicks} down vs ${upTicks} up)`}
                </div>
              </div>
            )}
          </div>

          {/* Centre: current note */}
          {gameState === "live" && (
            <div className="flex flex-col items-center gap-1">
              <NoteIndicator noteIdx={noteIdx} />
            </div>
          )}

          {/* Right: bet indicator */}
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(6,11,22,0.9)",
            border: `1px solid ${bet === "harmony" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            textAlign: "right",
          }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, letterSpacing: "0.2em", fontFamily: "monospace" }}>YOUR BET</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: bet === "harmony" ? "#22c55e" : "#ef4444" }}>
              {bet === "harmony" ? "HARMONY (UP)" : "DISCORD (DOWN)"}
            </div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)", marginTop: 2 }}>
              {bet === "harmony" ? "Win if price rises" : "Win if price falls"}
            </div>
          </div>
        </div>

        {/* Live tick price */}
        {gameState === "live" && tick && (
          <div style={{
            position: "absolute", top: 70, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 6,
            background: "rgba(6,11,22,0.85)",
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

        {/* Replay notice */}
        {replayDone && gameState === "result" && (
          <div className="absolute" style={{ top: 80, left: "50%", transform: "translateX(-50%)" }}>
            <div style={{ padding: "6px 16px", borderRadius: 6, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#a855f7", fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
              <Music style={{ display: "inline", width: 12, height: 12, marginRight: 6 }} />
              MELODY REPLAYING…
            </div>
          </div>
        )}

        {/* Result panel */}
        {gameState === "result" && result && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.92)" }}>
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

      {/* Launch overlay (shouldn't happen, but safety) */}
      {gameState === "live" && tickCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(7,11,22,0.85)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", fontFamily: "monospace", fontSize: 13 }}>
            <Zap style={{ display: "inline", width: 14, height: 14, marginRight: 6 }} />
            Waiting for first tick…
          </div>
        </div>
      )}
    </div>
  );
}
