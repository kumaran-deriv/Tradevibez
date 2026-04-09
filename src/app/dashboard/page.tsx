"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PriceChart, type ChartType } from "@/components/trading/PriceChart";
import { useWs } from "@/context/WebSocketContext";
import { useAuth } from "@/context/AuthContext";
import { useActiveSymbols } from "@/hooks/useActiveSymbols";
import { useTicks } from "@/hooks/useTicks";
import { MARKET_GROUPS } from "@/lib/constants";
import { formatPrice } from "@/utils/formatters";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Lock,
  X,
  LogIn,
} from "lucide-react";
import type { ActiveSymbol } from "@/types/deriv";

/* ─── Chart type config ───────────────────────────────────── */

const CHART_TYPES: { key: ChartType; label: string }[] = [
  { key: "candlestick", label: "Candle" },
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
  { key: "bar", label: "Bar" },
  { key: "baseline", label: "Baseline" },
];

const MARKET_LABELS: Record<string, string> = {
  synthetic_index: "Syn",
  forex: "Forex",
  indices: "Idx",
  commodities: "Com",
  cryptocurrency: "Crypto",
};

/* ─── Login Banner ────────────────────────────────────────── */

function LoginBanner({ onDismiss, onLogin }: { onDismiss: () => void; onLogin: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 40,
        background: "rgba(20,184,166,0.06)",
        borderBottom: "1px solid rgba(20,184,166,0.18)",
      }}
    >
      <div className="flex items-center gap-2">
        <Lock className="h-3 w-3 shrink-0" style={{ color: "var(--accent)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          You are viewing live market data as a guest.
        </span>
        <button
          onClick={onLogin}
          className="text-xs font-semibold transition-opacity hover:opacity-80 flex items-center gap-1"
          style={{ color: "var(--accent)" }}
        >
          <LogIn className="h-3 w-3" />
          Login to Trade
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="rounded p-0.5 transition-colors hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── Symbol row ──────────────────────────────────────────── */

function SymbolRow({
  symbol,
  selected,
  onSelect,
}: {
  symbol: ActiveSymbol;
  selected: boolean;
  onSelect: () => void;
}) {
  const { tick, direction } = useTicks(symbol.underlying_symbol);
  const price = tick ? formatPrice(tick.quote, symbol.pip_size) : "—";
  const isOpen = symbol.exchange_is_open === 1;

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors relative"
      style={
        selected
          ? {
              borderLeft: "2px solid var(--accent)",
              background: "var(--accent-glow)",
              paddingLeft: 10,
            }
          : {
              borderLeft: "2px solid transparent",
              paddingLeft: 10,
            }
      }
      onMouseEnter={(e) => {
        if (!selected)
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "";
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: isOpen ? "#34d399" : "#f87171" }}
        />
        <div className="min-w-0">
          <p
            className="text-xs font-medium truncate leading-snug"
            style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
          >
            {symbol.underlying_symbol_name}
          </p>
          <p className="text-[10px] font-mono leading-snug" style={{ color: "var(--text-muted)" }}>
            {symbol.underlying_symbol}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-2">
        {direction === "up" && <TrendingUp className="h-3 w-3" style={{ color: "#34d399" }} />}
        {direction === "down" && (
          <TrendingDown className="h-3 w-3" style={{ color: "var(--loss)" }} />
        )}
        <span
          className="text-[11px] font-mono tabular-nums"
          style={{
            color:
              direction === "up"
                ? "#34d399"
                : direction === "down"
                  ? "var(--loss)"
                  : "var(--text-secondary)",
          }}
        >
          {price}
        </span>
      </div>
    </button>
  );
}

/* ─── Page ────────────────────────────────────────────────── */

function DashboardContent() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") ?? "R_100";
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [search, setSearch] = useState("");
  const [activeMarket, setActiveMarket] = useState<string>("synthetic_index");
  const [showBanner, setShowBanner] = useState(true);

  const { status } = useWs();
  const { isAuthenticated, login } = useAuth();
  const { symbols } = useActiveSymbols();

  // Auto-hide banner when user logs in
  useEffect(() => {
    if (isAuthenticated) setShowBanner(false);
  }, [isAuthenticated]);

  // Header bar: live price for selected symbol
  const { tick: selectedTick, direction: selectedDir } = useTicks(selectedSymbol);
  const selectedMeta = useMemo(
    () => symbols.find((s) => s.underlying_symbol === selectedSymbol),
    [symbols, selectedSymbol]
  );
  const selectedPrice = selectedTick
    ? formatPrice(selectedTick.quote, selectedMeta?.pip_size ?? 2)
    : "—";
  const isSelectedOpen = selectedMeta?.exchange_is_open === 1;

  // Filtered symbol list
  const filteredSymbols = useMemo(() => {
    const q = search.toLowerCase();
    return symbols.filter(
      (s) =>
        s.market === activeMarket &&
        (!q ||
          s.underlying_symbol_name.toLowerCase().includes(q) ||
          s.underlying_symbol.toLowerCase().includes(q))
    );
  }, [symbols, activeMarket, search]);

  // Open count for header
  const openCount = useMemo(
    () => symbols.filter((s) => s.market === activeMarket && s.exchange_is_open === 1).length,
    [symbols, activeMarket]
  );

  return (
    <DashboardLayout noPadding>
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* Login Banner */}
        {showBanner && !isAuthenticated && (
          <LoginBanner onDismiss={() => setShowBanner(false)} onLogin={login} />
        )}

        {/* Two-panel */}
        <div className="flex flex-1 min-h-0">
          {/* ── Symbol Panel ────────────────────────────── */}
          <div
            className="flex flex-col shrink-0 border-r"
            style={{ width: 256, background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                Markets
              </span>
              {openCount > 0 && (
                <div className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "#34d399" }}
                  />
                  <span
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: "#34d399" }}
                  >
                    {openCount} open
                  </span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded py-1.5 pl-7 pr-2 text-[11px] border focus:outline-none transition-colors"
                  style={{
                    background: "var(--bg-input)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            </div>

            {/* Market filter tabs */}
            <div
              className="flex items-center gap-0 border-b overflow-x-auto"
              style={{ borderColor: "var(--border)" }}
            >
              {MARKET_GROUPS.map((g) => {
                const isActive = activeMarket === g.key;
                return (
                  <button
                    key={g.key}
                    onClick={() => setActiveMarket(g.key)}
                    className="px-2.5 py-2 text-[10px] font-medium whitespace-nowrap transition-colors relative shrink-0"
                    style={
                      isActive
                        ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" }
                        : { color: "var(--text-muted)", borderBottom: "2px solid transparent" }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    }}
                  >
                    {MARKET_LABELS[g.key] ?? g.label}
                  </button>
                );
              })}
            </div>

            {/* Symbol list */}
            <div className="flex-1 overflow-y-auto">
              {filteredSymbols.length === 0 ? (
                <p
                  className="text-center text-[11px] mt-8 px-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  {symbols.length === 0 ? "Loading symbols…" : "No results"}
                </p>
              ) : (
                filteredSymbols.map((sym) => (
                  <SymbolRow
                    key={sym.underlying_symbol}
                    symbol={sym}
                    selected={sym.underlying_symbol === selectedSymbol}
                    onSelect={() => setSelectedSymbol(sym.underlying_symbol)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Chart Panel ─────────────────────────────── */}
          <div
            className="flex flex-col flex-1 min-w-0"
            style={{ background: "var(--bg-base)" }}
          >
            {/* Chart header */}
            <div
              className="flex items-center justify-between px-4 border-b shrink-0"
              style={{
                height: 48,
                borderColor: "var(--border)",
                background: "var(--bg-card)",
              }}
            >
              {/* Symbol info */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedMeta?.underlying_symbol_name ?? selectedSymbol}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {selectedSymbol}
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                    style={
                      isSelectedOpen
                        ? { background: "rgba(52,211,153,0.1)", color: "#34d399" }
                        : { background: "rgba(248,113,113,0.1)", color: "#f87171" }
                    }
                  >
                    {isSelectedOpen ? "Open" : "Closed"}
                  </span>
                </div>

                {/* Divider */}
                <span
                  className="h-4 w-px"
                  style={{ background: "var(--border-strong)" }}
                />

                {/* Live price */}
                <div className="flex items-center gap-1">
                  <span
                    className="text-base font-mono font-semibold tabular-nums"
                    style={{
                      color:
                        selectedDir === "up"
                          ? "#34d399"
                          : selectedDir === "down"
                            ? "var(--loss)"
                            : "var(--text-primary)",
                    }}
                  >
                    {selectedPrice}
                  </span>
                  {selectedDir === "up" && (
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: "#34d399" }} />
                  )}
                  {selectedDir === "down" && (
                    <TrendingDown className="h-3.5 w-3.5" style={{ color: "var(--loss)" }} />
                  )}
                </div>
              </div>

              {/* Chart type tabs + WS status */}
              <div className="flex items-center gap-4">
                {/* Chart type — text underline style */}
                <div className="flex items-center gap-0">
                  {CHART_TYPES.map((ct) => {
                    const isActive = chartType === ct.key;
                    return (
                      <button
                        key={ct.key}
                        onClick={() => setChartType(ct.key)}
                        className="px-2.5 py-1 text-[11px] font-medium transition-colors relative"
                        style={
                          isActive
                            ? {
                                color: "var(--accent)",
                                borderBottom: "2px solid var(--accent)",
                              }
                            : {
                                color: "var(--text-muted)",
                                borderBottom: "2px solid transparent",
                              }
                        }
                        onMouseEnter={(e) => {
                          if (!isActive)
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "var(--text-secondary)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive)
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "var(--text-muted)";
                        }}
                      >
                        {ct.label}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <span className="h-4 w-px" style={{ background: "var(--border-strong)" }} />

                {/* WS status */}
                <div className="flex items-center gap-1.5">
                  {status === "connected" ? (
                    <Wifi className="h-3 w-3" style={{ color: "#34d399" }} />
                  ) : (
                    <WifiOff className="h-3 w-3" style={{ color: "var(--loss)" }} />
                  )}
                  <span
                    className="text-[10px] font-mono"
                    style={{
                      color: status === "connected" ? "#34d399" : "var(--loss)",
                    }}
                  >
                    {status === "connected" ? "LIVE" : "OFFLINE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Chart fills the rest */}
            <div className="flex-1 min-h-0">
              <PriceChart symbol={selectedSymbol} chartType={chartType} />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
