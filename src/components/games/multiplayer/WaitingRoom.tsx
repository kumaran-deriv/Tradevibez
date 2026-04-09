"use client";

import { useState, useEffect } from "react";
import { useGameRoom, useRoomActions } from "@/hooks/useGameRoom";
import { BearVsBullGame } from "@/components/games/BearVsBullGame";
import { ChevronLeft, Wifi, WifiOff } from "lucide-react";

interface WaitingRoomProps {
  roomId: string;
  playerId: string;
  onBack: () => void;
}

export function WaitingRoom({ roomId, playerId, onBack }: WaitingRoomProps) {
  const { room, connected, error } = useGameRoom(roomId);
  const { updatePlayer } = useRoomActions();
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [updating, setUpdating] = useState(false);

  const myPlayer = room?.players.p1?.id === playerId
    ? room.players.p1
    : room?.players.p2?.id === playerId
    ? room.players.p2
    : null;

  const opponent = room?.players.p1?.id === playerId
    ? room.players.p2
    : room?.players.p1;

  // Start countdown when both_ready
  useEffect(() => {
    if (room?.status !== "both_ready" || !room.startAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((room.startAt! - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setGameStarted(true);
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [room?.status, room?.startAt]);

  const handleReady = async () => {
    setUpdating(true);
    try {
      await updatePlayer({ roomId, playerId, ready: !isReady });
      setIsReady(!isReady);
    } finally {
      setUpdating(false);
    }
  };

  if (gameStarted && room) {
    return <BearVsBullGame />;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 mb-5"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: 0 }}
      >
        <ChevronLeft className="h-4 w-4" />
        Leave room
      </button>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-4">
        {connected
          ? <Wifi className="h-3 w-3" style={{ color: "#22c55e" }} />
          : <WifiOff className="h-3 w-3" style={{ color: "#ef4444" }} />
        }
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
          {connected ? "Connected" : "Reconnecting…"}
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 16 }}>
          {error === "room_not_found" ? "Room not found or expired." : `Error: ${error}`}
        </div>
      )}

      {/* Room code */}
      {room && (
        <div
          style={{
            padding: "16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.02)",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.2em" }}>
            ROOM CODE
          </div>
          <div style={{ fontSize: 28, fontFamily: "monospace", fontWeight: "bold", color: "var(--accent)", letterSpacing: "0.3em" }}>
            {room.code}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Share this code with your opponent
          </div>
        </div>
      )}

      {/* Players */}
      {room && (
        <div className="flex gap-3 mb-5">
          {(["p1", "p2"] as const).map((key) => {
            const player = room.players[key];
            const isMe = player?.id === playerId;
            return (
              <div
                key={key}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: `1px solid ${isMe ? "rgba(20,184,166,0.3)" : "var(--border)"}`,
                  background: isMe ? "rgba(20,184,166,0.05)" : "rgba(255,255,255,0.02)",
                  textAlign: "center",
                }}
              >
                {player ? (
                  <>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>
                      {player.side === "bull" ? "🐂" : "🐻"}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--text-primary)" }}>
                      {player.name} {isMe && "(You)"}
                    </div>
                    <div style={{ fontSize: 10, color: player.side === "bull" ? "#22c55e" : "#ef4444", fontFamily: "monospace", marginTop: 2 }}>
                      {player.side.toUpperCase()}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 9,
                        fontFamily: "monospace",
                        color: player.ready ? "#22c55e" : "var(--text-muted)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {player.ready ? "✓ READY" : "WAITING…"}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Waiting for player…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && countdown > 0 && (
        <div
          className="flex items-center justify-center mb-4"
          style={{
            padding: "16px",
            borderRadius: 8,
            background: "rgba(20,184,166,0.08)",
            border: "1px solid rgba(20,184,166,0.25)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", textAlign: "center", letterSpacing: "0.2em", marginBottom: 4 }}>
              FIGHT STARTS IN
            </div>
            <div style={{ fontSize: 48, fontFamily: "monospace", fontWeight: "bold", color: "var(--accent)", textAlign: "center" }}>
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* Ready button */}
      {room && myPlayer && room.status !== "both_ready" && (
        <button
          onClick={handleReady}
          disabled={updating || !opponent}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 8,
            border: `1px solid ${isReady ? "rgba(34,197,94,0.4)" : "rgba(20,184,166,0.4)"}`,
            background: isReady ? "rgba(34,197,94,0.1)" : "rgba(20,184,166,0.08)",
            color: isReady ? "#22c55e" : "var(--accent)",
            fontSize: 13,
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            cursor: (updating || !opponent) ? "not-allowed" : "pointer",
            opacity: !opponent ? 0.4 : 1,
            transition: "all 0.2s",
          }}
        >
          {!opponent
            ? "Waiting for opponent…"
            : isReady
            ? "✓ READY (click to unready)"
            : "READY UP"}
        </button>
      )}

      {/* Game settings */}
      {room && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          {room.symbol} · {room.ticksPerRound} ticks
        </div>
      )}
    </div>
  );
}
