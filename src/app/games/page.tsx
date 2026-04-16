"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { BearVsBullGame } from "@/components/games/BearVsBullGame";
import { MeteorBlasterGame } from "@/components/games/MeteorBlasterGame";
import { GrandPrixGame } from "@/components/games/GrandPrixGame";
import { HexColorFillerGame } from "@/components/games/HexColorFillerGame";
import { MusicPianoGame } from "@/components/games/MusicPianoGame";
import { VaultHeistGame } from "@/components/games/VaultHeistGame";
import { PenaltyShootoutGame } from "@/components/games/PenaltyShootoutGame";
import { TidalSurgeGame } from "@/components/games/TidalSurgeGame";
import { DigitOracleGame } from "@/components/games/DigitOracleGame";
import { TickPlinkoGame } from "@/components/games/TickPlinkoGame";
import { GameLobby } from "@/components/games/multiplayer/GameLobby";
import type { DuelConfig } from "@/components/games/multiplayer/GameLobby";
import { useAuth } from "@/context/AuthContext";
import {
  Lock, Gamepad2, Users, ChevronLeft,
  Swords, Crosshair, Palette, Music,
  Waves, Sparkles as SparklesIcon, Target, Flag, Globe, CircleDot,
  Flame,
  type LucideIcon,
} from "lucide-react";

/* ─── Game definitions ───────────────────────────────────── */

type SoloGameId = "vault-heist" | "penalty-shootout" | "tidal-surge" | "digit-oracle" | "bear-vs-bull" | "meteor-blaster" | "grand-prix" | "hex-color-filler" | "music-piano" | "tick-plinko";
type GroupGameId = "bear-vs-bull-duel" | "chain-race" | "market-battle" | "tick-boxing";

interface SoloGame {
  id: SoloGameId;
  icon: LucideIcon;
  label: string;
  tagline: string;
  accent: string;
  new?: boolean;
}

interface GroupGame {
  id: GroupGameId;
  icon: LucideIcon;
  label: string;
  tagline: string;
  accent: string;
  comingSoon: boolean;
}

const SOLO_GAMES: SoloGame[] = [
  {
    id: "bear-vs-bull",
    icon: Swords,
    label: "Bear vs Bull",
    tagline: "3D arena fight driven by live market ticks",
    accent: "#a855f7",
    new: true,
  },
  {
    id: "vault-heist",
    icon: Lock,
    label: "Vault Heist",
    tagline: "Crack the vault with perfect predictions",
    accent: "#d4a017",
    new: true,
  },
  {
    id: "tick-plinko",
    icon: CircleDot,
    label: "Tick Plinko",
    tagline: "Drop a ball · Ticks choose the path · Hit the multiplier",
    accent: "#14b8a6",
    new: true,
  },
  {
    id: "penalty-shootout",
    icon: Target,
    label: "Penalty Shootout",
    tagline: "5 kicks · Predict odd or even · Score goals",
    accent: "#22c55e",
    new: true,
  },
  {
    id: "hex-color-filler",
    icon: Palette,
    label: "Hex Color Filler",
    tagline: "Ticks paint the honeycomb · Most color wins",
    accent: "#22c55e",
    new: true,
  },
  {
    id: "music-piano",
    icon: Music,
    label: "Market Melody",
    tagline: "Ticks compose a melody · Bet HARMONY or DISCORD",
    accent: "#a855f7",
    new: true,
  },
  {
    id: "tidal-surge",
    icon: Waves,
    label: "Tidal Surge",
    tagline: "Ride the market waves · Predict the tide",
    accent: "#06b6d4",
    new: true,
  },
  {
    id: "digit-oracle",
    icon: SparklesIcon,
    label: "Digit Oracle",
    tagline: "The crystal ball reveals the last digit",
    accent: "#a855f7",
    new: true,
  },
  {
    id: "grand-prix",
    icon: Flag,
    label: "Grand Prix",
    tagline: "Pick your car · Ticks power the race",
    accent: "#f97316",
    new: true,
  },
  {
    id: "meteor-blaster",
    icon: Crosshair,
    label: "Pressure Blaster",
    tagline: "Crash/Boom pressure chamber — will it detonate?",
    accent: "#ef4444",
    new: true,
  },
];

const GROUP_GAMES: GroupGame[] = [
  {
    id: "bear-vs-bull-duel",
    icon: Swords,
    label: "Bear vs Bull Duel",
    tagline: "Challenge a friend · One bets Bull, one bets Bear",
    accent: "#ef4444",
    comingSoon: false,
  },
  {
    id: "chain-race",
    icon: Flag,
    label: "Chain Race",
    tagline: "Same 10 ticks · Highest payout wins",
    accent: "#14b8a6",
    comingSoon: true,
  },
  {
    id: "market-battle",
    icon: Globe,
    label: "Market Battle",
    tagline: "5 players · 5 symbols · Best % return wins",
    accent: "#3b82f6",
    comingSoon: true,
  },
  {
    id: "tick-boxing",
    icon: Flame,
    label: "Tick Boxing",
    tagline: "Trade punches round by round · Ticks decide the knockout",
    accent: "#f43f5e",
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
  const Icon = game.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: `1px solid ${active ? game.accent + "90" : game.accent + "25"}`,
        background: "rgba(255,255,255,0.02)",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.25s ease",
        position: "relative",
        overflow: "hidden",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = game.accent + "70";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 30px ${game.accent}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active ? game.accent + "90" : game.accent + "25";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Gradient icon area */}
      <div
        style={{
          height: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: `linear-gradient(135deg, ${game.accent}28 0%, ${game.accent}08 100%)`,
        }}
      >
        {/* Radial glow behind icon */}
        <div
          style={{
            position: "absolute",
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${game.accent}30 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
        <Icon
          style={{
            width: 42,
            height: 42,
            color: "#ffffff",
            filter: `drop-shadow(0 0 12px ${game.accent}90)`,
            position: "relative",
            zIndex: 1,
          }}
          strokeWidth={1.8}
        />
        {/* NEW badge */}
        {game.new && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 9,
              fontFamily: "monospace",
              background: game.accent,
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 10,
              letterSpacing: "0.08em",
              fontWeight: "bold",
            }}
          >
            NEW
          </span>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: "bold",
            color: active ? game.accent : "var(--text-primary)",
            marginBottom: 5,
            transition: "color 0.2s",
          }}
        >
          {game.label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.4,
          }}
        >
          {game.tagline}
        </div>
      </div>
    </button>
  );
}

function GroupGameCard({ game, onPlay }: { game: GroupGame; onPlay?: () => void }) {
  const Icon = game.icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: `1px solid ${game.accent}25`,
        background: "rgba(255,255,255,0.02)",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        opacity: game.comingSoon ? 0.55 : 1,
        transition: "all 0.25s ease",
      }}
    >
      {/* Gradient icon area */}
      <div
        style={{
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: `linear-gradient(135deg, ${game.accent}20 0%, ${game.accent}06 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${game.accent}25 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
        <Icon
          style={{
            width: 36,
            height: 36,
            color: "#ffffff",
            filter: `drop-shadow(0 0 10px ${game.accent}80)`,
            position: "relative",
            zIndex: 1,
          }}
          strokeWidth={1.8}
        />
        {game.comingSoon ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 9,
              fontFamily: "monospace",
              background: "rgba(255,255,255,0.1)",
              color: "var(--text-muted)",
              padding: "2px 8px",
              borderRadius: 10,
              letterSpacing: "0.08em",
            }}
          >
            SOON
          </span>
        ) : (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 9,
              fontFamily: "monospace",
              background: "rgba(20,184,166,0.15)",
              color: "var(--accent)",
              padding: "2px 8px",
              borderRadius: 10,
              letterSpacing: "0.08em",
              border: "1px solid rgba(20,184,166,0.25)",
            }}
          >
            BETA
          </span>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: "12px 16px 16px" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: "bold",
            color: "var(--text-primary)",
            marginBottom: 5,
          }}
        >
          {game.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          {game.tagline}
        </div>
        {!game.comingSoon && (
          <button
            onClick={onPlay}
            style={{
              width: "100%",
              padding: "9px 0",
              borderRadius: 8,
              border: `1px solid ${game.accent}50`,
              background: `${game.accent}12`,
              color: game.accent,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: "bold",
              letterSpacing: "0.12em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            CREATE ROOM
          </button>
        )}
      </div>
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
          <span style={{ color: "var(--border)" }}>&middot;</span>
          <Swords className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
          <span style={{ color: "#ef4444" }}>Bear vs Bull Duel</span>
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
    const GameIcon = game.icon;
    return (
      <DashboardLayout>
        <button
          onClick={() => setActiveSoloGame(null)}
          className="flex items-center gap-2 mb-5 transition-colors"
          style={{ color: "var(--text-muted)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Games
          <span style={{ color: "var(--border)" }}>&middot;</span>
          <GameIcon className="h-3.5 w-3.5" style={{ color: game.accent }} />
          <span style={{ color: game.accent }}>{game.label}</span>
        </button>

        {activeSoloGame === "bear-vs-bull" && <BearVsBullGame />}
        {activeSoloGame === "meteor-blaster" && <MeteorBlasterGame />}
        {activeSoloGame === "grand-prix" && <GrandPrixGame />}
        {activeSoloGame === "hex-color-filler" && <HexColorFillerGame />}
        {activeSoloGame === "music-piano" && <MusicPianoGame />}
        {activeSoloGame === "vault-heist" && <VaultHeistGame />}
        {activeSoloGame === "penalty-shootout" && <PenaltyShootoutGame />}
        {activeSoloGame === "tidal-surge" && <TidalSurgeGame />}
        {activeSoloGame === "digit-oracle" && <DigitOracleGame />}
        {activeSoloGame === "tick-plinko" && <TickPlinkoGame />}
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
          Real Deriv options contracts &middot; Simplified into game mechanics
        </p>
      </div>

      {/* ─── Solo Games ─────────────────────────────────── */}
      <div className="mb-10">
        <SectionHeader
          icon={<Gamepad2 className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
          title="SOLO GAMES"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
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
