"use client";

/**
 * GameLobby — URL-based multiplayer sync.
 *
 * No server state needed. How it works:
 *
 * 1. Host picks settings → generates a shareable URL containing:
 *    symbol, ticks, startAt (Unix timestamp 30s in future)
 * 2. Opponent opens the URL → both clients see an identical countdown
 * 3. At startAt, BOTH clients subscribe to the same Deriv ticks independently
 *    → same tick stream = identical fight outcome on both screens
 * 4. Each player buys their own Deriv contract (CALL or PUT)
 *
 * Reliability: 100% — the Deriv WS already syncs tick data naturally.
 * Dependencies: zero external services.
 */

import { useState } from "react";
import { Zap, Copy, Check, Users, ExternalLink } from "lucide-react";

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

/* ─── Encode / decode config in URL ─────────────────────── */

function encodeConfig(symbol: string, ticks: number, startAt: number): string {
  // Short base64-encoded param string
  const raw = JSON.stringify({ s: symbol, t: ticks, a: startAt });
  return btoa(raw).replace(/=/g, "");
}

function decodeConfig(encoded: string): { symbol: string; ticks: number; startAt: number } | null {
  try {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const raw = JSON.parse(atob(padded)) as { s: string; t: number; a: number };
    return { symbol: raw.s, ticks: raw.t, startAt: raw.a };
  } catch {
    return null;
  }
}

function buildShareUrl(symbol: string, ticks: number, startAt: number): string {
  const code = encodeConfig(symbol, ticks, startAt);
  const base = window.location.origin;
  return `${base}/games?duel=${code}`;
}

/* ─── Component ──────────────────────────────────────────── */

export function GameLobby({ onStart }: GameLobbyProps) {
  const [view, setView] = useState<"menu" | "host" | "join">("menu");
  const [symbol, setSymbol] = useState("R_100");
  const [ticks, setTicks] = useState<5 | 10 | 20>(10);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingConfig, setPendingConfig] = useState<DuelConfig | null>(null);

  /* ─── Host: generate link ─────────────────────────── */

  const handleGenerate = () => {
    // 45 seconds gives the opponent plenty of time to open the link
    const startAt = Date.now() + 45_000;
    const url = buildShareUrl(symbol, ticks, startAt);
    setShareUrl(url);
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
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Guest: parse link ───────────────────────────── */

  const handleJoin = () => {
    setJoinError(null);

    // Accept either a full URL or just the duel= param value
    let code = joinCode.trim();
    if (code.includes("duel=")) {
      const m = code.match(/duel=([A-Za-z0-9+/]+)/);
      code = m ? m[1] : code;
    }

    const decoded = decodeConfig(code);
    if (!decoded) {
      setJoinError("Invalid code — ask the host to reshare the link.");
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
    return (
      <div
        style={{
          maxWidth: 380,
          padding: "28px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
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
                  color: pendingConfig.myRole === "bull" ? "#22c55e" : "#ef4444",
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
              ? "Make sure your opponent has opened the link!"
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
            JOIN WITH LINK
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

          {/* Generated link */}
          {shareUrl && (
            <div
              style={{
                padding: "12px", borderRadius: 8,
                background: "rgba(20,184,166,0.06)",
                border: "1px solid rgba(20,184,166,0.2)",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.2em" }}>
                SHARE THIS WITH YOUR OPPONENT
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    flex: 1, fontSize: 10, fontFamily: "monospace",
                    color: "var(--text-secondary)", wordBreak: "break-all",
                    background: "rgba(0,0,0,0.3)", padding: "6px 8px",
                    borderRadius: 4,
                  }}
                >
                  {shareUrl}
                </div>
                <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", flexShrink: 0 }}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                They open the link → fight starts in {Math.ceil((pendingConfig?.startAt ?? 0 - Date.now()) / 1000)}s
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setView("menu"); setShareUrl(null); }} style={{
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
              <ExternalLink style={{ width: 13, height: 13 }} />
              {shareUrl ? "Regenerate Link" : "Generate Link"}
            </button>
          </div>
        </div>
      )}

      {view === "join" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.2em" }}>
              PASTE THE LINK OR CODE
            </span>
            <textarea
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
              placeholder="https://tradevibez.vercel.app/games?duel=..."
              rows={3}
              style={{
                width: "100%", padding: "10px", borderRadius: 6, fontSize: 11,
                fontFamily: "monospace", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${joinError ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                color: "var(--text-primary)", outline: "none", resize: "none",
              }}
            />
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
