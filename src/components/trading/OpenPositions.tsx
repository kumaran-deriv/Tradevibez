"use client";

import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { RefreshCw, TrendingUp, TrendingDown, X } from "lucide-react";
import type { OpenContract } from "@/types/deriv";

interface OpenPositionsProps {
  isAuthenticated: boolean;
  currency: string;
}

export function OpenPositions({ isAuthenticated, currency }: OpenPositionsProps) {
  const { positions, loading, refresh, sellContract } = usePortfolio(isAuthenticated);

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* Strip header */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Open Positions
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold"
          style={{
            background: positions.length > 0 ? "var(--accent-glow)" : "var(--bg-base)",
            color: positions.length > 0 ? "var(--accent)" : "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          {positions.length}
        </span>
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="rounded p-1 transition-colors"
          style={{ color: "var(--text-muted)" }}
          aria-label="Refresh positions"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {positions.length === 0 ? (
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ color: "var(--text-muted)" }}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-xs">No open positions — execute a trade to see it here</span>
        </div>
      ) : (
        /* Horizontal scrollable row of position cards */
        <div className="flex gap-2 overflow-x-auto px-4 py-2" style={{ scrollbarWidth: "thin" }}>
          {positions.map((position) => (
            <PositionCard
              key={position.contract_id}
              position={position}
              currency={currency}
              onSell={sellContract}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PositionCard({
  position,
  currency,
  onSell,
}: {
  position: OpenContract;
  currency: string;
  onSell: (contractId: number, price: number) => Promise<{ sold_for: number } | { error: string }>;
}) {
  const [selling, setSelling] = useState(false);
  const isProfit = position.profit >= 0;
  const profitColor = isProfit ? "#22c55e" : "#ef4444";

  const handleSell = async () => {
    if (selling || position.is_valid_to_sell !== 1) return;
    setSelling(true);
    await onSell(position.contract_id, position.bid_price);
    setSelling(false);
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1.5 rounded p-3"
      style={{
        minWidth: 200,
        background: "var(--bg-base)",
        border: `1px solid ${isProfit ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
      }}
    >
      {/* Top row: type badge + symbol + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase"
            style={{
              background: isProfit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: profitColor,
              border: `1px solid ${isProfit ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}
          >
            {position.contract_type}
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {position.underlying_symbol}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {formatDateTime(position.date_start)}
        </span>
      </div>

      {/* Price row */}
      <div className="flex items-center gap-3 text-xs">
        <div>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Buy</p>
          <p className="font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(position.buy_price, currency)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Current</p>
          <p className="font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(position.bid_price, currency)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>P&L</p>
          <p
            className="font-mono font-semibold tabular-nums flex items-center gap-0.5"
            style={{ color: profitColor }}
          >
            {isProfit ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {isProfit ? "+" : ""}{formatCurrency(position.profit, currency)}
          </p>
        </div>
      </div>

      {/* Sell button */}
      {position.is_valid_to_sell === 1 && (
        <button
          onClick={handleSell}
          disabled={selling}
          className="flex items-center justify-center gap-1 rounded py-1 text-[10px] font-semibold transition-colors disabled:opacity-40"
          style={{
            background: "rgba(239,68,68,0.08)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <X className="h-2.5 w-2.5" />
          Sell {formatCurrency(position.bid_price, currency)}
        </button>
      )}
    </div>
  );
}
