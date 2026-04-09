"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { ActiveSymbol } from "@/types/deriv";

/* ─── Config ──────────────────────────────────────────────── */

// Perspective factor: how flat the orbital plane appears (0 = flat line, 1 = circle)
const PERSP = 0.3;

const W = 540;
const H = 290;
const cx = W / 2;
const cy = H / 2;

const RINGS = [
  { radius: 55,  period: 8  },
  { radius: 90,  period: 12 },
  { radius: 125, period: 17 },
  { radius: 162, period: 22 },
  { radius: 198, period: 28 },
];

const RING_CAPACITY = [4, 5, 5, 5, 6];

const MARKET_STYLE: Record<string, { color: string; glow: string }> = {
  synthetic_index: { color: "#14b8a6", glow: "rgba(20,184,166,0.75)"  },
  forex:           { color: "#60a5fa", glow: "rgba(96,165,250,0.75)"  },
  indices:         { color: "#fb923c", glow: "rgba(251,146,60,0.75)"  },
  commodities:     { color: "#fbbf24", glow: "rgba(251,191,36,0.75)"  },
  cryptocurrency:  { color: "#a78bfa", glow: "rgba(167,139,250,0.75)" },
};

const MARKET_LABEL: Record<string, string> = {
  synthetic_index: "Syn",
  forex:           "Forex",
  indices:         "Idx",
  commodities:     "Com",
  cryptocurrency:  "Crypto",
};

/* ─── Deterministic star field ────────────────────────────── */

const STARS = (() => {
  let s = 137;
  const lcg = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
  return Array.from({ length: 80 }, () => ({
    x: lcg() * 100,
    y: lcg() * 100,
    r: lcg() < 0.65 ? 0.5 : 1,
    op: 0.15 + lcg() * 0.55,
  }));
})();

/* ─── Planet data ─────────────────────────────────────────── */

interface PlanetDef {
  symbol: string;
  name: string;
  market: string;
  orbitRadius: number;
  period: number;
  phase: number;
  size: number;
  color: string;
  glow: string;
}

function buildPlanets(symbols: ActiveSymbol[]): PlanetDef[] {
  const open = symbols
    .filter((s) => s.exchange_is_open === 1)
    .sort((a, b) => b.trade_count - a.trade_count);

  const total = Math.min(open.length, RING_CAPACITY.reduce((a, b) => a + b, 0));
  const selected = open.slice(0, total);
  if (!selected.length) return [];

  const maxTc = selected[0].trade_count;
  const minTc = selected[selected.length - 1].trade_count;
  const tcRange = maxTc - minTc || 1;

  const planets: PlanetDef[] = [];
  let idx = 0;

  for (let ring = 0; ring < RINGS.length; ring++) {
    const cap = RING_CAPACITY[ring];
    const { radius, period } = RINGS[ring];

    for (let j = 0; j < cap && idx < selected.length; j++, idx++) {
      const sym = selected[idx];
      const style = MARKET_STYLE[sym.market] ?? MARKET_STYLE.synthetic_index;
      const norm = (sym.trade_count - minTc) / tcRange;
      const size = 9 + norm * 17; // 9–26 px

      planets.push({
        symbol: sym.underlying_symbol,
        name: sym.underlying_symbol_name,
        market: sym.market,
        orbitRadius: radius,
        period,
        phase: (2 * Math.PI * j) / cap + ring * 0.4, // stagger rings slightly
        size,
        color: style.color,
        glow: style.glow,
      });
    }
  }

  return planets;
}

/* ─── Component ──────────────────────────────────────────── */

interface SpaceViewProps {
  symbols: ActiveSymbol[];
  onSelectSymbol: (symbol: string) => void;
}

export function SpaceView({ symbols, onSelectSymbol }: SpaceViewProps) {
  const planets = useMemo(() => buildPlanets(symbols), [symbols]);
  const [elapsed, setElapsed] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // Pause-aware animation refs
  const startRef = useRef<number | null>(null);
  const pauseOffsetRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  // Keep hoveredRef in sync (avoids stale closure in RAF)
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  useEffect(() => {
    const loop = (ts: number) => {
      if (!startRef.current) startRef.current = ts;

      if (hoveredRef.current !== null) {
        // Paused — record when pause started
        if (pauseStartRef.current === null) pauseStartRef.current = ts;
      } else {
        // Running — flush any accumulated pause duration
        if (pauseStartRef.current !== null) {
          pauseOffsetRef.current += ts - pauseStartRef.current;
          pauseStartRef.current = null;
        }
        const effective = (ts - startRef.current - pauseOffsetRef.current) / 1000;
        setElapsed(effective);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="animate-fade-in delay-400 relative select-none"
      style={{
        width: W,
        height: H,
        maxWidth: "100%",
        borderRadius: 14,
        background:
          "radial-gradient(ellipse at 45% 40%, #0e1c35 0%, #060c18 50%, #020508 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* ── Stars ─────────────────────────────────────────── */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: "50%",
            background: "white",
            opacity: s.op,
          }}
        />
      ))}

      {/* ── Orbit ellipses ────────────────────────────────── */}
      {RINGS.map(({ radius }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cx - radius,
            top: cy - radius * PERSP,
            width: radius * 2,
            height: radius * 2 * PERSP,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.07)",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Planets (behind sun, z < 2) ────────────────────── */}
      {planets.map((p) => {
        const angle = (2 * Math.PI * elapsed) / p.period + p.phase;
        const depth = Math.sin(angle); // -1 = back, +1 = front
        if (depth > 0) return null; // render front-layer planets separately

        const x = cx + Math.cos(angle) * p.orbitRadius;
        const y = cy + depth * p.orbitRadius * PERSP;
        const depthT = (depth + 1) / 2; // 0 (back) → 0.5 (equator)
        const scale = 0.68 + depthT * 0.22;
        const opacity = 0.45 + depthT * 0.4;
        const effectiveSize = p.size * scale;
        const isHov = hovered === p.symbol;

        return (
          <PlanetDot
            key={p.symbol}
            p={p}
            x={x}
            y={y}
            effectiveSize={effectiveSize}
            opacity={opacity}
            isHov={isHov}
            zIndex={1}
            onEnter={() => setHovered(p.symbol)}
            onLeave={() => setHovered(null)}
            onClick={() => onSelectSymbol(p.symbol)}
          />
        );
      })}

      {/* ── Sun ───────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: cx - 16,
          top: cy - 16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "radial-gradient(circle at 33% 33%, #99f6e4, #14b8a6 45%, #0d9488 80%)",
          boxShadow:
            "0 0 16px rgba(20,184,166,0.95), 0 0 40px rgba(20,184,166,0.45), 0 0 80px rgba(20,184,166,0.18)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* ── Planets (in front of sun, z = 3) ──────────────── */}
      {planets.map((p) => {
        const angle = (2 * Math.PI * elapsed) / p.period + p.phase;
        const depth = Math.sin(angle);
        if (depth <= 0) return null; // already rendered

        const x = cx + Math.cos(angle) * p.orbitRadius;
        const y = cy + depth * p.orbitRadius * PERSP;
        const depthT = (depth + 1) / 2; // 0.5 → 1
        const scale = 0.68 + depthT * 0.22;
        const opacity = 0.45 + depthT * 0.4;
        const effectiveSize = p.size * scale;
        const isHov = hovered === p.symbol;

        return (
          <PlanetDot
            key={p.symbol}
            p={p}
            x={x}
            y={y}
            effectiveSize={effectiveSize}
            opacity={opacity}
            isHov={isHov}
            zIndex={3}
            onEnter={() => setHovered(p.symbol)}
            onLeave={() => setHovered(null)}
            onClick={() => onSelectSymbol(p.symbol)}
          />
        );
      })}

      {/* ── Loading ───────────────────────────────────────── */}
      {planets.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}
          >
            Connecting to markets…
          </span>
        </div>
      )}

      {/* ── Pause badge ───────────────────────────────────── */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            fontSize: 9,
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.08em",
            pointerEvents: "none",
          }}
        >
          PAUSED
        </div>
      )}

      {/* ── Live badge ────────────────────────────────────── */}
      {!hovered && planets.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#34d399",
              display: "inline-block",
              boxShadow: "0 0 6px #34d399",
            }}
          />
          <span
            style={{ fontSize: 9, fontFamily: "monospace", color: "#34d399", letterSpacing: "0.08em" }}
          >
            LIVE
          </span>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        {Object.entries(MARKET_STYLE).map(([market, { color }]) => (
          <div key={market} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
              {MARKET_LABEL[market]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Planet dot sub-component ────────────────────────────── */

function PlanetDot({
  p, x, y, effectiveSize, opacity, isHov, zIndex, onEnter, onLeave, onClick,
}: {
  p: PlanetDef;
  x: number;
  y: number;
  effectiveSize: number;
  opacity: number;
  isHov: boolean;
  zIndex: number;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        position: "absolute",
        left: x - effectiveSize / 2,
        top: y - effectiveSize / 2,
        width: effectiveSize,
        height: effectiveSize,
        borderRadius: "50%",
        background: `radial-gradient(circle at 33% 33%, ${p.color}ff, ${p.color}99)`,
        boxShadow: isHov
          ? `0 0 12px ${p.glow}, 0 0 24px ${p.glow}`
          : `0 0 4px ${p.glow}`,
        opacity: isHov ? 1 : opacity,
        cursor: "pointer",
        zIndex: isHov ? 10 : zIndex,
        transition: "box-shadow 100ms, opacity 100ms",
      }}
    >
      {isHov && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 7px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(4,9,18,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 7,
            padding: "5px 10px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: p.color }}>
            {p.symbol}
          </p>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1, lineHeight: 1.4 }}>
            {p.name}
          </p>
          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
            Click to open chart
          </p>
        </div>
      )}
    </div>
  );
}
