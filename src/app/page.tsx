"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  TrendingUp,
  BarChart3,
  Shield,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Gamepad2,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useActiveSymbols } from "@/hooks/useActiveSymbols";
import { SpaceView } from "@/components/landing/SpaceView";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Sun, Moon } from "lucide-react";

/* ─── Static data ────────────────────────────────────────── */

const TICKER_ITEMS = [
  { symbol: "BTC/USD",  price: "67,432.10", delta: "+2.34%",  up: true  },
  { symbol: "ETH/USD",  price: "3,521.40",  delta: "+1.82%",  up: true  },
  { symbol: "EUR/USD",  price: "1.0842",    delta: "-0.12%",  up: false },
  { symbol: "GBP/USD",  price: "1.2671",    delta: "+0.08%",  up: true  },
  { symbol: "XAU/USD",  price: "2,314.50",  delta: "+0.55%",  up: true  },
  { symbol: "OIL/USD",  price: "83.21",     delta: "-0.43%",  up: false },
  { symbol: "USD/JPY",  price: "151.34",    delta: "+0.21%",  up: true  },
  { symbol: "ADA/USD",  price: "0.4521",    delta: "-1.07%",  up: false },
  { symbol: "SOL/USD",  price: "142.88",    delta: "+3.11%",  up: true  },
  { symbol: "NAS100",   price: "17,832.0",  delta: "+0.74%",  up: true  },
];


const FEATURES = [
  {
    icon: TrendingUp,
    title: "Real-Time Execution",
    description:
      "Sub-second trade execution via persistent WebSocket. Live tick data across forex, crypto, and commodities.",
    iconBg: "rgba(20,184,166,0.12)",
    iconColor: "#14b8a6",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description:
      "P&L dashboards, win rate tracking, drawdown curves, and full trade history with CSV export.",
    iconBg: "rgba(129,140,248,0.12)",
    iconColor: "#818cf8",
  },
  {
    icon: Shield,
    title: "Risk Awareness",
    description:
      "Track exposure across open positions in real time. P&L updates live so you always know where you stand before the next move.",
    iconBg: "rgba(251,146,60,0.12)",
    iconColor: "#fb923c",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect Your Account",
    desc: "Authenticate via Deriv OAuth PKCE. Demo or live account — same interface, zero configuration.",
  },
  {
    n: "02",
    title: "Analyse the Market",
    desc: "Live TradingView charts, real-time tick feeds, and AI risk scoring on every instrument.",
  },
  {
    n: "03",
    title: "Execute & Track",
    desc: "One-click trade execution. Positions, P&L, and history update in real time after every fill.",
  },
];

const GAMES_PREVIEW = [
  {
    emoji: "📈",
    name: "Rise or Fall",
    tagline: "Predict direction. Win up to 95%.",
    accentColor: "#14b8a6",
    glowClass: "game-card-glow-teal",
  },
  {
    emoji: "🔢",
    name: "Guess the Digit",
    tagline: "Nail the last digit. Quick-fire rounds.",
    accentColor: "#fb923c",
    glowClass: "game-card-glow-orange",
  },
];

/* ─── Floating theme toggle ──────────────────────────────── */

function FloatingThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium border shadow-lg transition-all duration-200 hover:scale-105"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-strong)",
        color: "var(--text-secondary)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {theme === "dark"
        ? <><Sun className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /><span>Light</span></>
        : <><Moon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /><span>Dark</span></>
      }
    </button>
  );
}

/* ─── Navbar ─────────────────────────────────────────────── */

function NavBar({ isAuthenticated, login }: { isAuthenticated: boolean; login: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-40 h-14 flex items-center transition-all duration-300 glass-nav"
      style={{ borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent" }}
    >
      <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)" }}
          >
            <Zap className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
          </div>
          <span className="font-display text-sm font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
            TradeVibez
          </span>
        </div>

        {/* Centre links */}
        <div className="hidden md:flex items-center gap-7">
          {[["#features", "Features"], ["#games", "Games"], ["#how-it-works", "How it works"]].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              {label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="text-xs font-medium transition-colors duration-150"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Markets
          </Link>
        </div>

        {/* Right CTA */}
        <div>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn-gradient inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white"
            >
              Dashboard <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              onClick={login}
              className="btn-gradient inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}


/* ─── Ticker strip ───────────────────────────────────────── */

function TickerStrip() {
  return (
    <div
      className="ticker-wrap overflow-hidden w-full py-3"
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="ticker-track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 px-8 shrink-0">
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>{item.symbol}</span>
            <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{item.price}</span>
            <span className="text-xs font-mono" style={{ color: item.up ? "var(--profit)" : "var(--loss)" }}>
              {item.up ? "▲" : "▼"} {item.delta}
            </span>
            <span className="text-xs" style={{ color: "var(--border-strong)" }}>|</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature grid ───────────────────────────────────────── */

function FeatureGrid() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px w-6" style={{ background: "var(--accent)" }} />
        <span className="text-xs font-mono tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>
          Platform
        </span>
      </div>
      <h2 className="font-display text-3xl font-bold mb-12" style={{ color: "var(--text-primary)" }}>
        Everything you need to trade smart.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="card-glow rounded-2xl p-7 animate-fade-up flex flex-col gap-5"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              animationDelay: `${i * 100}ms`,
              transition: "border-color 200ms, box-shadow 200ms, transform 200ms",
            }}
          >
            {/* Icon in tinted square */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: f.iconBg }}
            >
              <f.icon className="h-5 w-5" style={{ color: f.iconColor }} />
            </div>

            <div>
              <h3 className="font-display text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {f.description}
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium mt-auto transition-colors duration-150"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Explore <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Games teaser ───────────────────────────────────────── */

function GamesTeaserSection({ isAuthenticated, login }: { isAuthenticated: boolean; login: () => void }) {
  return (
    <section
      id="games"
      className="max-w-7xl mx-auto px-6 py-24"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left — copy */}
        <div>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-6"
            style={{
              background: "rgba(251,146,60,0.1)",
              border: "1px solid rgba(251,146,60,0.25)",
              color: "#fb923c",
            }}
          >
            <Sparkles className="h-3 w-3" />
            New · Exclusive Feature
          </div>

          <h2 className="font-display text-4xl font-black tracking-tight mb-5 leading-[1.1]" style={{ color: "var(--text-primary)" }}>
            Options trading,{" "}
            <span className="gradient-text-warm">gamified.</span>
          </h2>

          <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
            Two intuitive games built on real Deriv options contracts. No charts to decode,
            no jargon to learn — just predict and win. Perfect for beginners,{" "}
            <span style={{ color: "var(--text-primary)" }}>surprisingly deep for pros.</span>
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            {isAuthenticated ? (
              <Link
                href="/games"
                className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white"
              >
                Play Now <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={login}
                className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white"
              >
                Play Free Demo <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <Link
              href="/games"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              See the games <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right — game cards */}
        <div className="grid grid-cols-2 gap-5">
          {GAMES_PREVIEW.map((game) => (
            <Link
              key={game.name}
              href="/games"
              className={`${game.glowClass} rounded-2xl p-6 flex flex-col gap-4 group`}
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${game.accentColor}33`,
                transition: "border-color 200ms, box-shadow 200ms, transform 200ms",
              }}
            >
              {/* Emoji in tinted circle */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: `${game.accentColor}18` }}
              >
                {game.emoji}
              </div>

              <div>
                <h3 className="font-display text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {game.name}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {game.tagline}
                </p>
              </div>

              <span
                className="inline-flex items-center gap-1 text-xs font-medium mt-auto"
                style={{ color: game.accentColor }}
              >
                Play <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ───────────────────────────────────────── */

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="max-w-7xl mx-auto px-6 py-24"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px w-6" style={{ background: "var(--accent)" }} />
        <span className="text-xs font-mono tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>
          How It Works
        </span>
      </div>
      <h2 className="font-display text-3xl font-bold mb-14" style={{ color: "var(--text-primary)" }}>
        Three steps to your first trade.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
        <div
          className="hidden md:block absolute top-6 left-[16.67%] right-[16.67%] h-px"
          style={{ borderTop: "1px dashed var(--border-strong)" }}
        />
        {STEPS.map((s, i) => (
          <div key={s.n} className={`animate-fade-up delay-${(i + 1) * 100}`}>
            <span className="font-display block text-5xl font-black mb-5" style={{ color: "var(--accent)", opacity: 0.8 }}>
              {s.n}
            </span>
            <h3 className="font-display text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA band ───────────────────────────────────────────── */

function CTABand({ isAuthenticated, login }: { isAuthenticated: boolean; login: () => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 80% at 50% 100%, var(--accent-glow-lg), transparent)" }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 text-center">
        {/* Pill label */}
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-6"
          style={{
            background: "rgba(20,184,166,0.08)",
            border: "1px solid rgba(20,184,166,0.2)",
            color: "var(--accent)",
          }}
        >
          <span className="animate-pulse-teal h-1.5 w-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
          Demo Accounts Welcome
        </div>

        <h2 className="font-display text-4xl font-black tracking-tight mb-4" style={{ color: "var(--text-primary)" }}>
          Ready to trade with{" "}
          <span className="gradient-text">an edge?</span>
        </h2>
        <p className="text-base mb-10 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
          Connect your Deriv account in seconds. Start with demo — no real money at risk.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="btn-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                Open Dashboard
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl border transition-all duration-150"
                style={{
                  borderColor: "rgba(168,85,247,0.4)",
                  background: "rgba(168,85,247,0.08)",
                  color: "#a855f7",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.08)"; }}
              >
                <Gamepad2 className="h-4 w-4" />
                Try a Game
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={login}
                className="btn-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl text-white"
              >
                Connect Deriv Account <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl border transition-all duration-150"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              >
                View Markets
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function LandingPage() {
  const { isAuthenticated, login, error } = useAuth();
  const { symbols } = useActiveSymbols();
  const userProfile = useUserProfile();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <NavBar isAuthenticated={isAuthenticated} login={login} />

      {error && (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-6">
          <div
            className="max-w-md w-full mt-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}
          >
            {error}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">
        {/* ── Hero ── */}
        <section className="max-w-7xl mx-auto px-6 pt-32 pb-16 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            {/* Pill eyebrow */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-7 animate-fade-in"
              style={
                isAuthenticated
                  ? { background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }
                  : { background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "var(--accent)" }
              }
            >
              <span
                className="animate-pulse-teal h-1.5 w-1.5 rounded-full inline-block"
                style={{ background: isAuthenticated ? "#34d399" : "var(--accent)" }}
              />
              {isAuthenticated ? "Connected · Demo Account Live" : "Deriv API V2 · Real-Time Execution"}
            </div>

            {/* Headline */}
            <h1
              className="font-display text-6xl lg:text-7xl font-black tracking-[-0.02em] leading-[1.05] mb-6 animate-fade-up delay-100"
              style={{ color: "var(--text-primary)" }}
            >
              {isAuthenticated ? (
                <>
                  Welcome back
                  {userProfile?.displayName ? "," : "."}{" "}
                  <br />
                  {userProfile?.displayName && (
                    <><span className="gradient-text">{userProfile.displayName}.</span><br /></>
                  )}
                  <span style={{ color: "var(--text-primary)" }}>
                    Ready to trade.
                  </span>
                </>
              ) : (
                <>
                  Trade faster.{" "}
                  <br />
                  Risk smarter.{" "}
                  <br />
                  <span className="gradient-text">Win bigger.</span>
                </>
              )}
            </h1>

            <p
              className="text-lg leading-relaxed mb-10 max-w-md animate-fade-up delay-200"
              style={{ color: "var(--text-secondary)" }}
            >
              {isAuthenticated
                ? "Your portfolio is live. Jump into the dashboard to trade, or try our gamified options for a quick round."
                : "Professional-grade trading built on Deriv API V2. Live charts, real-time execution, and deep analytics — all in one dashboard."}
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4 flex-wrap mb-12 animate-fade-up delay-300">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="btn-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl text-white"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Open Dashboard
                  </Link>
                  <Link
                    href="/games"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border transition-all duration-150"
                    style={{
                      borderColor: "rgba(168,85,247,0.4)",
                      background: "rgba(168,85,247,0.08)",
                      color: "#a855f7",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.15)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.08)"; }}
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Play Games
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={login}
                    className="btn-gradient inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl text-white"
                  >
                    Start Trading <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                  >
                    Explore Markets <ChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>

            {/* Micro-stats — pill chips */}
            <div className="flex items-center gap-3 flex-wrap animate-fade-up delay-400">
              {[
                ["50+", "Markets"],
                ["< 1s", "Execution"],
                ["PKCE", "Auth"],
              ].map(([val, label]) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  <span className="font-semibold font-mono" style={{ color: "var(--text-secondary)" }}>{val}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live space view */}
          <div className="flex justify-center lg:justify-end">
            <SpaceView
              symbols={symbols}
              onSelectSymbol={(sym) => router.push(`/dashboard?symbol=${sym}`)}
            />
          </div>
        </section>

        {/* ── Ticker strip ── */}
        <TickerStrip />

        {/* ── Features ── */}
        <FeatureGrid />

        {/* ── Games Teaser ── */}
        <GamesTeaserSection isAuthenticated={isAuthenticated} login={login} />

        {/* ── How it works ── */}
        <HowItWorks />

        {/* ── CTA ── */}
        <CTABand isAuthenticated={isAuthenticated} login={login} />
      </main>

      {/* Footer */}
      <footer className="px-6 py-6" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center"
              style={{ background: "rgba(20,184,166,0.12)" }}
            >
              <Zap className="h-3 w-3" style={{ color: "var(--accent)" }} />
            </div>
            <span className="font-display text-xs font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
              TradeVibez
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Built for the Deriv API Competition 2026
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            © 2026 TradeVibez
          </p>
        </div>
      </footer>

      <FloatingThemeToggle />
    </div>
  );
}
