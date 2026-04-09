"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { RiseFallGame } from "@/components/games/RiseFallGame";
import { DigitsGame } from "@/components/games/DigitsGame";
import { ChainReactionGame } from "@/components/games/ChainReactionGame";
import { BearVsBullGame } from "@/components/games/BearVsBullGame";
import { GameLobby } from "@/components/games/multiplayer/GameLobby";
import type { DuelConfig } from "@/components/games/multiplayer/GameLobby";
import { useAuth } from "@/context/AuthContext";
import { Lock, Gamepad2, Users, ChevronLeft } from "lucide-react";

/* ─── Game definitions ───────────────────────────────────── */

type SoloGameId = "rise-fall" | "digits" | "chain-reaction" | "bear-vs-bull";
type GroupGameId = "bear-vs-bull-duel" | "chain-race" | "market-battle";

interface SoloGame {
  id: SoloGameId;
  emoji: string;
  label: string;
  tagline: string;
  accent: string;
  new?: boolean;
}

interface GroupGame {
  id: GroupGameId;
  emoji: string;
  label: string;
  tagline: string;
  comingSoon: boolean;
}

const SOLO_GAMES: SoloGame[] = [
  {
    id: "rise-fall",
    emoji: "📈",
    label: "Rise or Fall",
    tagline: "Predict the direction",
    accent: "#22c55e",
  },
  {
    id: "digits",
    emoji: "🔢",
    label: "Guess the Digit",
    tagline: "Nail the last digit",
    accent: "#f97316",
  },
  {
    id: "chain-reaction",
    emoji: "⚡",
    label: "Chain Reaction",
    tagline: "10 ticks · 3 cells · Light them up",
    accent: "var(--accent)",
  },
  {
    id: "bear-vs-bull",
    emoji: "🥊",
    label: "Bear vs Bull",
    tagline: "3D fight driven by live market ticks",
    accent: "#a855f7",
    new: true,
  },
];

const GROUP_GAMES: GroupGame[] = [
  {
    id: "bear-vs-bull-duel",
    emoji: "⚔️",
    label: "Bear vs Bull Duel",
    tagline: "Challenge a friend · One bets Bull, one bets Bear",
    comingSoon: false,
  },
  {
    id: "chain-race",
    emoji: "🏁",
    label: "Chain Race",
    tagline: "Same 10 ticks · Highest payout wins",
    comingSoon: true,
  },
  {
    id: "market-battle",
    emoji: "🌍",
    label: "Market Battle",
    tagline: "5 players · 5 symbols · Best % return wins",
    comingSoon: true,
  },
];

/* ─── Game Card ──────────────────────────────────────────── */

function SoloGameCard({
  game,
  active,
  onClick,
}: {
  game: SoloGame;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "16px",
        borderRadius: 10,
        border: `1px solid ${active ? game.accent : "var(--border)"}`,
        background: active ? `${game.accent}12` : "rgba(255,255,255,0.02)",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        minWidth: 160,
      }}
    >
      {game.new && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 9,
            fontFamily: "monospace",
            background: "#a855f7",
            color: "#fff",
            padding: "1px 6px",
            borderRadius: 10,
            letterSpacing: "0.05em",
          }}
        >
          NEW
        </span>
      )}
      <div style={{ fontSize: 24, marginBottom: 8 }}>{game.emoji}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: "bold",
          color: active ? game.accent : "var(--text-primary)",
          marginBottom: 4,
          transition: "color 0.2s",
        }}
      >
        {game.label}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{game.tagline}</div>
    </button>
  );
}

function GroupGameCard({ game, onPlay }: { game: GroupGame; onPlay?: () => void }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)",
        position: "relative",
        minWidth: 200,
        opacity: game.comingSoon ? 0.6 : 1,
      }}
    >
      {game.comingSoon && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 9,
            fontFamily: "monospace",
            background: "rgba(255,255,255,0.08)",
            color: "var(--text-muted)",
            padding: "1px 6px",
            borderRadius: 10,
            letterSpacing: "0.05em",
          }}
        >
          SOON
        </span>
      )}
      <div style={{ fontSize: 24, marginBottom: 8 }}>{game.emoji}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: "bold",
          color: "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        {game.label}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {game.tagline}
      </div>
      {!game.comingSoon && (
        <button
          onClick={onPlay}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 6,
            border: "1px solid rgba(20,184,166,0.4)",
            background: "rgba(20,184,166,0.08)",
            color: "var(--accent)",
            fontSize: 11,
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            cursor: "pointer",
          }}
        >
          CREATE ROOM
        </button>
      )}
    </div>
  );
}

/* ─── Section Divider ────────────────────────────────────── */

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {icon}
      <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--text-secondary)", letterSpacing: "0.15em" }}>
        {title}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            background: "rgba(20,184,166,0.12)",
            color: "var(--accent)",
            padding: "1px 7px",
            borderRadius: 10,
            letterSpacing: "0.1em",
            border: "1px solid rgba(20,184,166,0.2)",
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function GamesPage() {
  const { isAuthenticated, login } = useAuth();
  const [activeSoloGame, setActiveSoloGame] = useState<SoloGameId | null>(null);
  const [activeGroupGame, setActiveGroupGame] = useState<GroupGameId | null>(null);
  const [duelFightConfig, setDuelFightConfig] = useState<DuelConfig | null>(null);

  // Auto-open duel join if URL contains ?duel=
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("duel=")) {
      setActiveGroupGame("bear-vs-bull-duel");
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="h-5 w-5" style={{ color: "var(--accent)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Trading Games</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Options trading simplified into games
          </p>
        </div>

        <div
          className="flex flex-col items-center justify-center rounded-xl py-20"
          style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}
        >
          <Lock className="h-10 w-10 mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Login Required</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, maxWidth: 320, textAlign: "center" }}>
            Connect your Deriv demo account to play. No real money at risk.
          </p>
          <Button variant="primary" onClick={login}>Login with Deriv</Button>
        </div>
      </DashboardLayout>
    );
  }

  /* Duel fight view */
  if (duelFightConfig) {
    return (
      <DashboardLayout>
        <button
          onClick={() => { setDuelFightConfig(null); setActiveGroupGame(null); }}
          className="flex items-center gap-2 mb-5"
          style={{ color: "var(--text-muted)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Games
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ color: "var(--accent)" }}>⚔️ Bear vs Bull Duel</span>
        </button>
        <BearVsBullGame duelConfig={duelFightConfig} />
      </DashboardLayout>
    );
  }

  /* Group game lobby */
  if (activeGroupGame === "bear-vs-bull-duel") {
    return (
      <DashboardLayout>
        <button
          onClick={() => setActiveGroupGame(null)}
          className="flex items-center gap-2 mb-5"
          style={{ color: "var(--text-muted)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Games
        </button>
        <GameLobby onStart={(config) => setDuelFightConfig(config)} />
      </DashboardLayout>
    );
  }

  /* Active solo game view */
  if (activeSoloGame) {
    const game = SOLO_GAMES.find((g) => g.id === activeSoloGame)!;
    return (
      <DashboardLayout>
        {/* Back nav */}
        <button
          onClick={() => setActiveSoloGame(null)}
          className="flex items-center gap-2 mb-5 transition-colors"
          style={{ color: "var(--text-muted)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Games
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ color: game.accent }}>{game.emoji} {game.label}</span>
        </button>

        {activeSoloGame === "rise-fall" && <RiseFallGame />}
        {activeSoloGame === "digits" && <DigitsGame />}
        {activeSoloGame === "chain-reaction" && <ChainReactionGame />}
        {activeSoloGame === "bear-vs-bull" && <BearVsBullGame />}
      </DashboardLayout>
    );
  }

  /* Game selection view */
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Trading Games</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Real Deriv options contracts · Simplified into game mechanics
        </p>
      </div>

      {/* ─── Solo Games ─────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeader
          icon={<Gamepad2 className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
          title="SOLO GAMES"
        />
        <div className="flex flex-wrap gap-3">
          {SOLO_GAMES.map((game) => (
            <SoloGameCard
              key={game.id}
              game={game}
              active={activeSoloGame === game.id}
              onClick={() => setActiveSoloGame(game.id)}
            />
          ))}
        </div>
      </div>

      {/* ─── Group Games ────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Users className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
          title="GROUP GAMES"
          badge="BETA"
        />
        <div className="flex flex-wrap gap-3">
          {GROUP_GAMES.map((game) => (
            <GroupGameCard
              key={game.id}
              game={game}
              onPlay={!game.comingSoon ? () => setActiveGroupGame(game.id) : undefined}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
