"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PriceChart } from "@/components/trading/PriceChart";
import { TradePanel } from "@/components/trading/TradePanel";
import { OpenPositions } from "@/components/trading/OpenPositions";
import { MarketSelector } from "@/components/trading/MarketSelector";
import { useAuth } from "@/context/AuthContext";
import { useActiveSymbols } from "@/hooks/useActiveSymbols";
import { useTicks } from "@/hooks/useTicks";
import { formatPrice } from "@/utils/formatters";
import { Lock, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";

const CHART_TYPES = [
  { label: "Candles", value: "candlestick" as const },
  { label: "Line", value: "line" as const },
  { label: "Area", value: "area" as const },
  { label: "Bars", value: "bar" as const },
];

function TradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, activeAccount, login } = useAuth();
  const { symbols } = useActiveSymbols();

  const urlSymbol = searchParams.get("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(urlSymbol || "R_100");
  const [showSymbolPanel, setShowSymbolPanel] = useState(false);
  const [chartType, setChartType] = useState<"candlestick" | "line" | "area" | "bar">("candlestick");

  const currency = activeAccount?.currency || "USD";

  const selectedMeta = useMemo(
    () => symbols.find((s) => s.underlying_symbol === selectedSymbol),
    [symbols, selectedSymbol]
  );

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    setShowSymbolPanel(false);
    router.replace(`/trade?symbol=${sym}`, { scroll: false });
  };

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: "calc(100vh - 160px)" }}
        >
          <div
            className="flex flex-col items-center gap-4 rounded-xl p-10 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxWidth: 400 }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}
            >
              <Lock className="h-6 w-6" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Login to Trade
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Connect your Deriv account to execute trades with live market pricing.
              </p>
            </div>
            <Button variant="primary" onClick={login} className="w-full">
              Login with Deriv
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noPadding>
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Symbol Header Bar */}
        <SymbolBar
          symbol={selectedSymbol}
          meta={selectedMeta}
          chartType={chartType}
          onChartType={setChartType}
          showSymbolPanel={showSymbolPanel}
          onToggleSymbolPanel={() => setShowSymbolPanel((v) => !v)}
        />

        {/* Main Area */}
        <div className="flex flex-1 min-h-0">
          {/* Symbol Panel (slide-in) */}
          {showSymbolPanel && (
            <div
              className="flex-shrink-0 flex flex-col overflow-hidden"
              style={{
                width: 256,
                borderRight: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  Markets
                </span>
                <button
                  onClick={() => setShowSymbolPanel(false)}
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <MarketSelector
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={handleSelectSymbol}
                />
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <PriceChart symbol={selectedSymbol} chartType={chartType} />
          </div>

          {/* Trade Panel */}
          <div
            className="flex-shrink-0 overflow-y-auto"
            style={{
              width: 320,
              borderLeft: "1px solid var(--border)",
              background: "var(--bg-card)",
            }}
          >
            <TradePanel symbol={selectedSymbol} currency={currency} />
          </div>
        </div>

        {/* Positions Strip */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg-card)",
            maxHeight: 220,
            overflow: "hidden",
          }}
        >
          <OpenPositions isAuthenticated={isAuthenticated} currency={currency} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function SymbolBar({
  symbol,
  meta,
  chartType,
  onChartType,
  showSymbolPanel,
  onToggleSymbolPanel,
}: {
  symbol: string;
  meta: { underlying_symbol_name: string; pip_size: number; exchange_is_open: 0 | 1 } | undefined;
  chartType: string;
  onChartType: (t: "candlestick" | "line" | "area" | "bar") => void;
  showSymbolPanel: boolean;
  onToggleSymbolPanel: () => void;
}) {
  const { tick, direction } = useTicks(symbol);
  const isOpen = meta?.exchange_is_open === 1;

  return (
    <div
      className="flex items-center gap-3 px-3 shrink-0"
      style={{
        height: 48,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
    >
      {/* Symbol toggle button */}
      <button
        onClick={onToggleSymbolPanel}
        className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
        style={{
          background: showSymbolPanel ? "var(--accent-glow)" : "transparent",
          color: showSymbolPanel ? "var(--accent)" : "var(--text-secondary)",
          border: `1px solid ${showSymbolPanel ? "var(--accent)" : "var(--border)"}`,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {showSymbolPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Markets
      </button>

      {/* Divider */}
      <div className="h-5 w-px" style={{ background: "var(--border)" }} />

      {/* Symbol name + code */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {meta?.underlying_symbol_name || symbol}
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          {symbol}
        </span>
        <span
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: isOpen ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            color: isOpen ? "#22c55e" : "#ef4444",
            border: `1px solid ${isOpen ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: isOpen ? "#22c55e" : "#ef4444" }}
          />
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>

      {/* Live price */}
      {tick && (
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono text-sm font-semibold tabular-nums transition-colors duration-200"
            style={{
              color:
                direction === "up" ? "#22c55e" : direction === "down" ? "#ef4444" : "var(--text-primary)",
            }}
          >
            {formatPrice(tick.quote, meta?.pip_size ?? 2)}
          </span>
          {direction === "up" && (
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
          )}
          {direction === "down" && (
            <TrendingUp
              className="h-3.5 w-3.5 scale-y-[-1]"
              style={{ color: "#ef4444", transform: "scaleY(-1)" }}
            />
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Chart type tabs */}
      <div className="flex items-center gap-0.5">
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => onChartType(ct.value)}
            className="px-2.5 py-1 text-xs transition-colors"
            style={{
              color: chartType === ct.value ? "var(--accent)" : "var(--text-muted)",
              borderBottom: `2px solid ${chartType === ct.value ? "var(--accent)" : "transparent"}`,
              fontWeight: chartType === ct.value ? 600 : 400,
            }}
          >
            {ct.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense>
      <TradeContent />
    </Suspense>
  );
}
