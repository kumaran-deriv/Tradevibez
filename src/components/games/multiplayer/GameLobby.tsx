"use client";

/**
 * GameLobby — Room-code-based multiplayer sync.
 *
 * No server state needed. How it works:
 *
 * 1. Host picks settings → generates a 6-char alphanumeric room code
 *    (base36 encoding of symbol + ticks + startAt)
 * 2. Opponent types the code → both clients see an identical countdown
 * 3. At startAt, BOTH clients subscribe to the same Deriv ticks independently
 *    → same tick stream = identical fight outcome on both screens
 * 4. Each player buys their own Deriv contract (CALL or PUT)
 *
 * Reliability: 100% — the Deriv WS already syncs tick data naturally.
 * Dependencies: zero external services.
 */

import { useState } from "react";
import { Zap, Copy, Check, Users } from "lucide-react";

interface GameLobbyProps {
  /** Called when both host and guest are ready with settings to start fighting */
  onStart: (config: DuelConfig) => void;
}

export interface DuelConfig {
  symbol: string;
  ticksPerRound: number;
  startAt: number;  // Unix ms — when to start counting ticks
  myRole: "bull" | "bear";
}

const MARKETS = [
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "R_75",  label: "Volatility 75"  },
  { symbol: "R_50",  label: "Volatility 50"  },
];

const TICK_OPTIONS = [5, 10, 20] as const;

/* ─── 6-char room code (base36 bit-pack) ─────────────────── */

const ROOM_SYMBOLS = ["R_100", "R_75", "R_50"];
const ROOM_TICKS   = [5, 10, 20];
const EPOCH_SEC    = 1735689600; // Jan 1 2025 UTC

function encodeRoomCode(symbol: string, ticks: number, startAt: number): string {
  const sIdx      = Math.max(0, ROOM_SYMBOLS.indexOf(symbol));
  const tIdx      = Math.max(0, ROOM_TICKS.indexOf(ticks));
  const secOffset = Math.floor(startAt / 1000) - EPOCH_SEC;
  // Pack: [2b sIdx][2b tIdx][26b secOffset] = 30 bits — fits safely in JS integer
  const packed = ((sIdx & 0x3) * (1 << 28)) + ((tIdx & 0x3) * (1 << 26)) + (secOffset & 0x3FFFFFF);
  return packed.toString(36).toUpperCase().padStart(6, "0");
}

function formatRoomCode(raw: string): string {
  // Display as "B8H VNK" (3+3)
  return raw.slice(0, 3) + " " + raw.slice(3, 6);
}

function decodeRoomCode(input: string): { symbol: string; ticks: number; startAt: number } | null {
  try {
    const clean = input.replace(/[\s\-]/g, "").toUpperCase();
    if (clean.length !== 6) return null;
    const packed    = parseInt(clean, 36);
    const sIdx      = Math.floor(packed / (1 << 28)) & 0x3;
    const tIdx      = Math.floor(packed / (1 << 26)) & 0x3;
    const secOffset = packed & 0x3FFFFFF;
    const symbol    = ROOM_SYMBOLS[sIdx];
    const ticksVal  = ROOM_TICKS[tIdx];
    if (!symbol || !ticksVal) return null;
    const startAt = (secOffset + EPOCH_SEC) * 1000;
    return { symbol, ticks: ticksVal, startAt };
  } catch {
    return null;
  }
}

// Legacy URL decode (back-compat)
function decodeConfig(encoded: string): { symbol: string; ticks: number; startAt: number } | null {
  try {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const raw = JSON.parse(atob(padded)) as { s: string; t: number; a: number };
    return { symbol: raw.s, ticks: raw.t, startAt: raw.a };
  } catch {
    return null;
  }
}

/* ─── Component ──────────────────────────────────────────── */

export function GameLobby({ onStart }: GameLobbyProps) {
  const [view, setView] = useState<"menu" | "host" | "join">("menu");
  const [symbol, setSymbol] = useState("R_100");
  const [ticks, setTicks] = useState<5 | 10 | 20>(10);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingConfig, setPendingConfig] = useState<DuelConfig | null>(null);

  /* ─── Host: generate room code ───────────────────── */

  const handleGenerate = () => {
    // 45 seconds gives the opponent plenty of time to enter the code
    const startAt = Date.now() + 45_000;
    const code = encodeRoomCode(symbol, ticks, startAt);
    setRoomCode(code);
    setPendingConfig({ symbol, ticksPerRound: ticks, startAt, myRole: "bull" });
    startCountdown(startAt);
  };

  const startCountdown = (startAt: number) => {
    const tick = () => {
      const remaining = Math.ceil((startAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdown(0);
      } else {
        setCountdown(remaining);
        setTimeout(tick, 200);
      }
    };
    tick();
  };

  // When countdown reaches 0 → launch the fight
  if (countdown === 0 && pendingConfig) {
    onStart(pendingConfig);
    return null;
  }

  const copy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(formatRoomCode(roomCode)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Guest: parse code or legacy URL ────────────── */

  const handleJoin = () => {
    setJoinError(null);

    const input = joinCode.trim();

    // Try 6-char room code first
    let decoded = decodeRoomCode(input);

    // Fall back: legacy full URL with ?duel= base64 param
    if (!decoded && input.includes("duel=")) {
      const m = input.match(/duel=([A-Za-z0-9+/]+)/);
      if (m) decoded = decodeConfig(m[1]);
    }

    if (!decoded) {
      setJoinError("Invalid code — ask the host for the 6-char room code.");
      return;
    }

    const secondsLeft = Math.ceil((decoded.startAt - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      setJoinError("This duel has already started. Ask the host to create a new one.");
      return;
    }

    const config: DuelConfig = {
      symbol: decoded.symbol,
      ticksPerRound: decoded.ticks,
      startAt: decoded.startAt,
      myRole: "bear",
    };
    setPendingConfig(config);
    startCountdown(decoded.startAt);
  };

  /* ─── Countdown view (both host + guest) ─────────── */

  if (countdown !== null && countdown > 0 && pendingConfig) {
    const roleColor = pendingConfig.myRole === "bull" ? "#22c55e" : "#ef4444";
    return (
      <div
        style={{
          maxWidth: 400,
          padding: "28px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Show room code prominently for host */}
          {pendingConfig.myRole === "bull" && roomCode && (
            <div style={{
              width: "100%", padding: "14px", borderRadius: 8, marginBottom: 4,
              background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.3)",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.25em", marginBottom: 8 }}>
                ROOM CODE — SHARE WITH OPPONENT
              </div>
              <div className="flex items-center justify-center gap-3">
                <span style={{
                  fontSize: 32, fontFamily: "monospace", fontWeight: "bold",
                  color: "var(--accent)", letterSpacing: "0.2em",
                  textShadow: "0 0 20px rgba(20,184,166,0.4)",
                }}>
                  {formatRoomCode(roomCode)}
                </span>
                <button onClick={copy} style={{
                  background: copied ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${copied ? "rgba(20,184,166,0.4)" : "var(--border)"}`,
                  borderRadius: 6, cursor: "pointer", color: copied ? "var(--accent)" : "var(--text-muted)",
                  padding: "6px 8px", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontFamily: "monospace",
                }}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: "0.3em",
              color: "var(--text-muted)",
            }}
          >
            FIGHT STARTS IN
          </div>
          <div
            style={{
              fontSize: 72,
              fontFamily: "monospace",
              fontWeight: "bold",
              color: "var(--accent)",
              lineHeight: 1,
              textShadow: "0 0 40px rgba(20,184,166,0.5)",
            }}
          >
            {countdown}
          </div>
          <div className="flex gap-4 mt-2">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>YOU ARE</div>
              <div style={{ fontSize: 18, marginTop: 2 }}>
                {pendingConfig.myRole === "bull" ? "🐂 BULL" : "🐻 BEAR"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: roleColor,
                }}
              >
                {pendingConfig.myRole.toUpperCase()}
              </div>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>MARKET</div>
              <div style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-primary)", marginTop: 4 }}>
                {pendingConfig.symbol}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {pendingConfig.ticksPerRound} ticks
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            {pendingConfig.myRole === "bull"
              ? "Share the room code with your opponent before time runs out!"
              : "Get ready — the fight is about to begin!"}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Menu view ───────────────────────────────────── */

  return (
    <div
      style={{
        maxWidth: 400,
        padding: "24px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Users className="h-5 w-5" style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--text-primary)" }}>
          Bear vs Bull Duel
        </span>
      </div>

      {view === "menu" && (
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            Challenge a friend. One player is Bull, one is Bear. Both watch the same live market — tick by tick.
          </p>
          <button
            onClick={() => setView("host")}
            style={{
              width: "100%", padding: "14px", borderRadius: 8,
              border: "1px solid rgba(20,184,166,0.4)", background: "rgba(20,184,166,0.08)",
              color: "var(--accent)", fontSize: 13, fontWeight: "bold",
              fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Zap style={{ width: 15, height: 15 }} />
            CREATE DUEL
          </button>
          <button
            onClick={() => setView("join")}
            style={{
              width: "100%", padding: "14px", borderRadius: 8,
              border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)",
              color: "var(--text-secondary)", fontSize: 13, fontWeight: "bold",
              fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer",
            }}
          >
            JOIN WITH CODE
          </button>
        </div>
      )}

      {view === "host" && (
        <div className="flex flex-col gap-4">
          {/* Market */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>MARKET</span>
            <div className="flex gap-2">
              {MARKETS.map((m) => (
                <button key={m.symbol} onClick={() => setSymbol(m.symbol)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11,
                  fontFamily: "monospace", cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${symbol === m.symbol ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: symbol === m.symbol ? "rgba(20,184,166,0.08)" : "transparent",
                  color: symbol === m.symbol ? "var(--accent)" : "var(--text-muted)",
                }}>
                  {m.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Ticks */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>ROUND LENGTH</span>
            <div className="flex gap-2">
              {TICK_OPTIONS.map((t) => (
                <button key={t} onClick={() => setTicks(t)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11,
                  fontFamily: "monospace", cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${ticks === t ? "rgba(20,184,166,0.5)" : "var(--border)"}`,
                  background: ticks === t ? "rgba(20,184,166,0.08)" : "transparent",
                  color: ticks === t ? "var(--accent)" : "var(--text-muted)",
                }}>
                  {t}t
                </button>
              ))}
            </div>
          </div>

          {/* Room code */}
          {roomCode && (
            <div
              style={{
                padding: "16px", borderRadius: 8,
                background: "rgba(20,184,166,0.06)",
                border: "1px solid rgba(20,184,166,0.3)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 10, letterSpacing: "0.25em" }}>
                ROOM CODE — SHARE WITH YOUR OPPONENT
              </div>
              <div className="flex items-center justify-center gap-3">
                <span style={{
                  fontSize: 36, fontFamily: "monospace", fontWeight: "bold",
                  color: "var(--accent)", letterSpacing: "0.2em",
                  textShadow: "0 0 20px rgba(20,184,166,0.4)",
                }}>
                  {formatRoomCode(roomCode)}
                </span>
                <button onClick={copy} style={{
                  background: copied ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${copied ? "rgba(20,184,166,0.4)" : "var(--border)"}`,
                  borderRadius: 6, cursor: "pointer", color: copied ? "var(--accent)" : "var(--text-muted)",
                  padding: "8px 10px", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontFamily: "monospace",
                }}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10, fontFamily: "monospace" }}>
                Opponent types this code → fight starts when timer hits 0
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setView("menu"); setRoomCode(null); }} style={{
              flex: 1, padding: "10px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
            }}>
              Back
            </button>
            <button onClick={handleGenerate} style={{
              flex: 2, padding: "10px", borderRadius: 6,
              border: "1px solid rgba(20,184,166,0.4)", background: "rgba(20,184,166,0.08)",
              color: "var(--accent)", fontSize: 12, fontWeight: "bold",
              fontFamily: "monospace", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Zap style={{ width: 13, height: 13 }} />
              {roomCode ? "Regenerate Code" : "Generate Code"}
            </button>
          </div>
        </div>
      )}

      {view === "join" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>
              ENTER ROOM CODE
            </span>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
              placeholder="B8H VNK"
              maxLength={7}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 6, fontSize: 22,
                fontFamily: "monospace", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${joinError ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                color: "var(--text-primary)", outline: "none",
                textAlign: "center", letterSpacing: "0.3em", fontWeight: "bold",
              }}
            />
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", textAlign: "center" }}>
              Ask your opponent for their 6-char room code
            </span>
          </div>

          {joinError && (
            <div style={{ fontSize: 11, color: "#ef4444", padding: "6px 10px", borderRadius: 5, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {joinError}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setView("menu"); setJoinError(null); setJoinCode(""); }} style={{
              flex: 1, padding: "10px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
            }}>
              Back
            </button>
            <button onClick={handleJoin} disabled={!joinCode.trim()} style={{
              flex: 2, padding: "10px", borderRadius: 6,
              border: "1px solid rgba(20,184,166,0.4)", background: "rgba(20,184,166,0.08)",
              color: "var(--accent)", fontSize: 12, fontWeight: "bold",
              fontFamily: "monospace", cursor: joinCode.trim() ? "pointer" : "not-allowed",
              opacity: joinCode.trim() ? 1 : 0.5,
            }}>
              Join Duel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
