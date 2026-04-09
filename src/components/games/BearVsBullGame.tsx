"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { GameResult } from "@/components/games/GameResult";
import { useTicks } from "@/hooks/useTicks";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { CanvasHandle, TickEvent } from "./BearVsBullCanvas";
import type { DuelConfig } from "@/components/games/multiplayer/GameLobby";

/* ─── Dynamic import (SSR disabled for Three.js) ────────── */

const BearVsBullCanvas = dynamic(() => import("./BearVsBullCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "#080d18" }}
    >
      <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
        Loading arena…
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

const TICK_OPTIONS = [5, 10, 20] as const;
const STAKE_PRESETS = [5, 10, 25, 50];

/* ─── Damage calculation ─────────────────────────────────── */

function getDamage(
  consecutiveCount: number,
  delta: number,
  totalTicks: number
): number {
  const base = (100 * 0.6) / totalTicks;
  const sizeMult = Math.abs(delta) > 0.8 ? 1.4 : Math.abs(delta) > 0.2 ? 1.0 : 0.8;
  const comboMult = consecutiveCount >= 5 ? 2.2 : consecutiveCount >= 3 ? 1.5 : 1.0;
  return Math.max(1, Math.round(base * sizeMult * comboMult));
}

/* ─── Types ──────────────────────────────────────────────── */

type GameState = "idle" | "live" | "result";
type Side = "bull" | "bear";

interface FightResult {
  bullHP: number;
  bearHP: number;
  winner: Side;
  playerWon: boolean;
  buyPrice: number;
  payout: number;
}

/* ─── HP Bar ─────────────────────────────────────────────── */

function HpBar({ hp, maxHp = 100, color, label, align }: {
  hp: number;
  maxHp?: number;
  color: string;
  label: string;
  align: "left" | "right";
}) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const barColor = pct > 50 ? color : pct > 25 ? "#eab308" : "#ef4444";

  return (
    <div
      className="flex flex-col gap-1"
      style={{ minWidth: 160, alignItems: align === "left" ? "flex-start" : "flex-end" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color }}>
          {Math.max(0, hp)}HP
        </span>
      </div>
      <div
        style={{
          width: 160,
          height: 8,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 4,
          overflow: "hidden",
          ...(align === "right" ? { direction: "rtl" } : {}),
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            borderRadius: 4,
            transition: "width 0.3s ease, background 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Hit announcement ───────────────────────────────────── */

function HitAnnouncement({ text, color }: { text: string; color: string }) {
  return (
    <div
      className="animate-in zoom-in-75 duration-200"
      style={{
        fontSize: 20,
        fontWeight: "bold",
        fontFamily: "monospace",
        color,
        textShadow: `0 0 20px ${color}`,
        letterSpacing: "0.1em",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export function BearVsBullGame({ duelConfig }: { duelConfig?: DuelConfig } = {}) {
  const { authWs, authStatus } = useWs();
  const { activeAccount } = useAuth();
  const currency = activeAccount?.currency ?? "USD";

  const [symbol, setSymbol] = useState(duelConfig?.symbol ?? "R_100");
  const [totalTicks, setTotalTicks] = useState<5 | 10 | 20>(
    (duelConfig?.ticksPerRound as 5 | 10 | 20 | undefined) ?? 10
  );
  const [stake, setStake] = useState(10);
  const [playerSide, setPlayerSide] = useState<Side>(duelConfig?.myRole ?? "bull");
  const [gameState, setGameState] = useState<GameState>("idle");

  // Live state
  const [bullHP, setBullHP] = useState(100);
  const [bearHP, setBearHP] = useState(100);
  const [tickCount, setTickCount] = useState(0);
  const [announcement, setAnnouncement] = useState<{ text: string; color: string } | null>(null);
  const [result, setResult] = useState<FightResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Refs
  const gameStateRef = useRef<GameState>("idle");
  const bullHPRef = useRef(100);
  const bearHPRef = useRef(100);
  const tickCountRef = useRef(0);
  const prevTickEpoch = useRef<number | null>(null);
  const prevQuoteRef = useRef<number | null>(null);
  const consecutiveDir = useRef<"up" | "down" | null>(null);
  const consecutiveCount = useRef(0);
  const totalTicksRef = useRef(10);
  const stakeRef = useRef(10);
  const playerSideRef = useRef<Side>("bull");
  const canvasRef = useRef<CanvasHandle>(null);
  const announcementTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tick, direction } = useTicks(symbol);

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { totalTicksRef.current = totalTicks; }, [totalTicks]);
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { playerSideRef.current = playerSide; }, [playerSide]);

  /* ─── Show announcement ──────────────────────────────── */

  const showAnnouncement = useCallback((text: string, color: string) => {
    if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
    setAnnouncement({ text, color });
    announcementTimeout.current = setTimeout(() => setAnnouncement(null), 1500);
  }, []);

  /* ─── Buy contract ───────────────────────────────────── */

  const buyContract = useCallback((side: Side, stakeAmt: number, sym: string, ticks: number) => {
    if (!authWs || authStatus !== "connected") return;
    const contractType = side === "bull" ? "CALL" : "PUT";

    authWs.send({
      proposal: 1,
      amount: stakeAmt,
      basis: "stake",
      contract_type: contractType,
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
        }
        // Contract bought — fight plays out via tick stream
      });
    });
  }, [authWs, authStatus, currency]);

  /* ─── Launch ─────────────────────────────────────────── */

  const handleLaunch = () => {
    if (authStatus !== "connected") return;

    // Reset
    setBullHP(100);
    setBearHP(100);
    bullHPRef.current = 100;
    bearHPRef.current = 100;
    setTickCount(0);
    tickCountRef.current = 0;
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    consecutiveDir.current = null;
    consecutiveCount.current = 0;
    setBuyError(null);
    setAnnouncement(null);

    setGameState("live");
    gameStateRef.current = "live";

    buyContract(playerSide, stake, symbol, totalTicks);
  };

  /* ─── Tick processing ────────────────────────────────── */

  useEffect(() => {
    if (gameStateRef.current !== "live" || !tick) return;
    if (tick.epoch === prevTickEpoch.current) return;
    prevTickEpoch.current = tick.epoch;

    const prevQ = prevQuoteRef.current;
    prevQuoteRef.current = tick.quote;
    if (prevQ === null) return; // First tick — no delta yet

    const delta = tick.quote - prevQ;
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    // Update combo state
    if (dir !== "flat") {
      if (dir === consecutiveDir.current) {
        consecutiveCount.current += 1;
      } else {
        consecutiveDir.current = dir;
        consecutiveCount.current = 1;
      }
    }

    const count = consecutiveCount.current;
    const isCombo = count >= 3;
    const isCritical = Math.abs(delta) > 0.8;

    // Calculate damage
    const attacker: Side | null = dir === "up" ? "bull" : dir === "down" ? "bear" : null;
    let damage = 0;
    if (attacker) {
      damage = getDamage(count, delta, totalTicksRef.current);
    }

    // Update HP
    if (attacker === "bull") {
      const newHP = Math.max(0, bearHPRef.current - damage);
      bearHPRef.current = newHP;
      setBearHP(newHP);
    } else if (attacker === "bear") {
      const newHP = Math.max(0, bullHPRef.current - damage);
      bullHPRef.current = newHP;
      setBullHP(newHP);
    }

    // Trigger canvas animation
    if (canvasRef.current && attacker) {
      const impactPoint: [number, number, number] =
        attacker === "bull" ? [1.5, 1.2, 0] : [-1.5, 1.2, 0];

      const tickEvent: TickEvent = {
        direction: dir,
        attacker,
        damage,
        isCombo,
        isCritical,
        impactPoint,
      };
      canvasRef.current.triggerTick(tickEvent);
    }

    // Announcements
    if (isCritical && attacker) {
      showAnnouncement("⚡ CRITICAL HIT!", attacker === "bull" ? "#22c55e" : "#ef4444");
    } else if (count === 3 && attacker) {
      showAnnouncement("💥 COMBO x3!", attacker === "bull" ? "#22c55e" : "#ef4444");
    } else if (count === 5 && attacker) {
      showAnnouncement("🔥 POWER COMBO!", attacker === "bull" ? "#22c55e" : "#ef4444");
    }

    const nextCount = tickCountRef.current + 1;
    tickCountRef.current = nextCount;
    setTickCount(nextCount);

    // Check for early KO or end of round
    const bullKO = bullHPRef.current <= 0;
    const bearKO = bearHPRef.current <= 0;
    const roundOver = nextCount >= totalTicksRef.current || bullKO || bearKO;

    if (roundOver) {
      const winner: Side =
        bullKO ? "bear" :
        bearKO ? "bull" :
        bullHPRef.current >= bearHPRef.current ? "bull" : "bear";

      setTimeout(() => {
        canvasRef.current?.triggerKO(winner === "bull" ? "bear" : "bull");
        setTimeout(() => {
          canvasRef.current?.triggerVictory(winner);
          const fightResult: FightResult = {
            bullHP: bullHPRef.current,
            bearHP: bearHPRef.current,
            winner,
            playerWon: winner === playerSideRef.current,
            buyPrice: stakeRef.current,
            payout: winner === playerSideRef.current ? stakeRef.current * 1.85 : 0,
          };
          setResult(fightResult);
          setGameState("result");
          gameStateRef.current = "result";
        }, 1500);
      }, 400);
    }
  }, [tick, showAnnouncement]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Reset ──────────────────────────────────────────── */

  const resetGame = () => {
    setGameState("idle");
    gameStateRef.current = "idle";
    setBullHP(100);
    setBearHP(100);
    setTickCount(0);
    setResult(null);
    setBuyError(null);
    setAnnouncement(null);
    prevTickEpoch.current = null;
    prevQuoteRef.current = null;
    consecutiveDir.current = null;
    consecutiveCount.current = 0;
  };

  useEffect(() => () => {
    if (announcementTimeout.current) clearTimeout(announcementTimeout.current);
  }, []);

  const displayPrice = tick ? tick.quote.toString() : "—";
  const canLaunch = authStatus === "connected";

  /* ─── Idle (Duel mode) ──────────────────────────────────── */

  if (gameState === "idle" && duelConfig) {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 480 }}>
        {/* Locked settings summary */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid rgba(20,184,166,0.25)",
            background: "rgba(20,184,166,0.04)",
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: 4 }}>YOU ARE</div>
            <div style={{ fontSize: 22 }}>{duelConfig.myRole === "bull" ? "🐂" : "🐻"}</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: duelConfig.myRole === "bull" ? "#22c55e" : "#ef4444" }}>
              {duelConfig.myRole.toUpperCase()}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          <div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: 4 }}>MARKET</div>
            <div style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-primary)" }}>{duelConfig.symbol}</div>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          <div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em", marginBottom: 4 }}>ROUND</div>
            <div style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-primary)" }}>{duelConfig.ticksPerRound} ticks</div>
          </div>
        </div>

        {/* Stake */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            YOUR STAKE ({currency})
          </span>
          <div className="flex gap-2">
            {STAKE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setStake(p)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 6,
                  border: `1px solid ${stake === p ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: stake === p ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                  color: stake === p ? "var(--accent)" : "var(--text-secondary)",
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

        {buyError && (
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>
            {buyError}
          </div>
        )}

        {!canLaunch && (
          <div style={{ color: "#eab308", fontSize: 11, fontFamily: "monospace" }}>
            Connecting to trading server…
          </div>
        )}

        <button
          onClick={handleLaunch}
          disabled={!canLaunch}
          style={{
            padding: "16px 0",
            borderRadius: 8,
            border: "1px solid rgba(20,184,166,0.5)",
            background: canLaunch ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.02)",
            color: canLaunch ? "var(--accent)" : "var(--text-muted)",
            fontSize: 14,
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "0.15em",
            cursor: canLaunch ? "pointer" : "not-allowed",
            opacity: canLaunch ? 1 : 0.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          <Zap style={{ width: 16, height: 16 }} />
          FIGHT!
        </button>
      </div>
    );
  }

  /* ─── Idle (Solo mode) ───────────────────────────────────── */

  if (gameState === "idle") {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 520 }}>
        {/* Symbol */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            MARKET
          </span>
          <div className="flex gap-2">
            {GAME_MARKETS.map((m) => (
              <button
                key={m.symbol}
                onClick={() => setSymbol(m.symbol)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: `1px solid ${symbol === m.symbol ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: symbol === m.symbol ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                  color: symbol === m.symbol ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 12,
                  fontFamily: "monospace",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Round length */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            ROUND LENGTH
          </span>
          <div className="flex gap-2">
            {TICK_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTotalTicks(t)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 6,
                  border: `1px solid ${totalTicks === t ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: totalTicks === t ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                  color: totalTicks === t ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontFamily: "monospace",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {t} ticks
              </button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            STAKE ({currency})
          </span>
          <div className="flex gap-2">
            {STAKE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setStake(p)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 6,
                  border: `1px solid ${stake === p ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: stake === p ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                  color: stake === p ? "var(--accent)" : "var(--text-secondary)",
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

        {/* Side selection */}
        <div className="flex flex-col gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            YOUR SIDE
          </span>
          <div className="flex gap-3">
            <button
              onClick={() => setPlayerSide("bull")}
              style={{
                flex: 1,
                padding: "16px 0",
                borderRadius: 8,
                border: `1px solid ${playerSide === "bull" ? "rgba(34,197,94,0.5)" : "var(--border)"}`,
                background: playerSide === "bull" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.02)",
                color: playerSide === "bull" ? "#22c55e" : "var(--text-secondary)",
                fontSize: 15,
                fontWeight: "bold",
                fontFamily: "monospace",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <TrendingUp style={{ width: 18, height: 18 }} />
              🐂 BULL
            </button>
            <button
              onClick={() => setPlayerSide("bear")}
              style={{
                flex: 1,
                padding: "16px 0",
                borderRadius: 8,
                border: `1px solid ${playerSide === "bear" ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
                background: playerSide === "bear" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.02)",
                color: playerSide === "bear" ? "#ef4444" : "var(--text-secondary)",
                fontSize: 15,
                fontWeight: "bold",
                fontFamily: "monospace",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <TrendingDown style={{ width: 18, height: 18 }} />
              🐻 BEAR
            </button>
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          {playerSide === "bull"
            ? "🐂 Bull wins if price trends UP across the round — buys a CALL contract"
            : "🐻 Bear wins if price trends DOWN across the round — buys a PUT contract"}
        </div>

        {/* Error */}
        {buyError && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444",
              fontSize: 12,
            }}
          >
            {buyError}
          </div>
        )}

        {/* Launch */}
        {!canLaunch && (
          <div style={{ color: "#eab308", fontSize: 11, fontFamily: "monospace" }}>
            Connecting to trading server…
          </div>
        )}

        <button
          onClick={handleLaunch}
          disabled={!canLaunch}
          style={{
            padding: "16px 0",
            borderRadius: 8,
            border: "1px solid rgba(20,184,166,0.5)",
            background: canLaunch ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.02)",
            color: canLaunch ? "var(--accent)" : "var(--text-muted)",
            fontSize: 14,
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "0.15em",
            cursor: canLaunch ? "pointer" : "not-allowed",
            opacity: canLaunch ? 1 : 0.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          <Zap style={{ width: 16, height: 16 }} />
          FIGHT!
        </button>
      </div>
    );
  }

  /* ─── Live + Result: full arena view ────────────────────── */

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ minHeight: "calc(100vh - 220px)" }}
    >
      {/* 3D Canvas fills entire container */}
      <div className="absolute inset-0">
        <BearVsBullCanvas ref={canvasRef} />
      </div>

      {/* HUD overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Top HUD: HP bars + tick counter */}
        <div
          className="flex items-start justify-between"
          style={{ padding: "16px 20px" }}
        >
          <HpBar hp={bullHP} color="#22c55e" label="🐂 BULL" align="left" />

          {/* Center: tick counter + direction */}
          <div className="flex flex-col items-center gap-1">
            {gameState === "live" && (
              <>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--text-muted)",
                    letterSpacing: "0.2em",
                  }}
                >
                  TICK {tickCount} / {totalTicks}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "monospace",
                    color:
                      direction === "up" ? "#22c55e"
                      : direction === "down" ? "#ef4444"
                      : "var(--text-muted)",
                  }}
                >
                  {displayPrice}
                </span>
                {direction && (
                  <span style={{ fontSize: 16 }}>
                    {direction === "up" ? "↑" : "↓"}
                  </span>
                )}
              </>
            )}
            {gameState === "result" && result && (
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: result.playerWon
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(239,68,68,0.15)",
                  border: `1px solid ${result.playerWon ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                  color: result.playerWon ? "#22c55e" : "#ef4444",
                  fontSize: 16,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                }}
              >
                {result.playerWon ? "YOU WIN!" : "YOU LOSE"}
              </div>
            )}
          </div>

          <HpBar hp={bearHP} color="#ef4444" label="🐻 BEAR" align="right" />
        </div>

        {/* Center announcement */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ paddingTop: "80px" }}
        >
          {announcement && (
            <HitAnnouncement text={announcement.text} color={announcement.color} />
          )}
        </div>

        {/* Bottom: result card */}
        {gameState === "result" && result && (
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center pointer-events-auto"
            style={{ padding: "16px 20px", background: "rgba(8,13,24,0.9)" }}
          >
            <div className="flex items-center gap-8 mb-4">
              {/* Per-side HP remaining */}
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  BULL HP REMAINING
                </span>
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#22c55e" }}>
                  {Math.max(0, result.bullHP)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 18, fontWeight: "bold", color: result.playerWon ? "#22c55e" : "#ef4444" }}>
                  {result.winner === "bull" ? "🐂 BULL" : "🐻 BEAR"} WINS
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  You bet on {playerSide === "bull" ? "🐂 BULL" : "🐻 BEAR"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                  BEAR HP REMAINING
                </span>
                <span style={{ fontSize: 20, fontFamily: "monospace", fontWeight: "bold", color: "#ef4444" }}>
                  {Math.max(0, result.bearHP)}
                </span>
              </div>
            </div>

            <GameResult
              won={result.playerWon}
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
