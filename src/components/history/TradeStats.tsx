"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/utils/formatters";
import { TrendingUp, TrendingDown, BarChart3, Target, DollarSign } from "lucide-react";
import type { ProfitTransaction } from "@/types/deriv";

interface TradeStatsProps {
  transactions: ProfitTransaction[];
  currency: string;
}

export function TradeStats({ transactions, currency }: TradeStatsProps) {
  const stats = useMemo(() => {
    if (transactions.length === 0) {
      return { totalPnl: 0, winRate: 0, totalTrades: 0, avgReturn: 0 };
    }

    const wins = transactions.filter((t) => t.profit_loss > 0).length;
    const totalPnl = transactions.reduce((sum, t) => sum + t.profit_loss, 0);

    return {
      totalPnl,
      winRate: (wins / transactions.length) * 100,
      totalTrades: transactions.length,
      avgReturn: totalPnl / transactions.length,
    };
  }, [transactions]);

  const items = [
    {
      label: "Total P&L",
      value: formatCurrency(stats.totalPnl, currency),
      color: stats.totalPnl >= 0 ? "#22c55e" : "#ef4444",
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      color: stats.winRate >= 50 ? "#22c55e" : "#f59e0b",
      icon: Target,
    },
    {
      label: "Total Trades",
      value: stats.totalTrades.toString(),
      color: "#3b82f6",
      icon: BarChart3,
    },
    {
      label: "Avg Return",
      value: formatCurrency(stats.avgReturn, currency),
      color: stats.avgReturn >= 0 ? "#14b8a6" : "#ef4444",
      icon: DollarSign,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            style={{
              position: "relative",
              borderRadius: 14,
              border: `1px solid ${item.color}20`,
              borderLeft: `3px solid ${item.color}`,
              background: `linear-gradient(135deg, ${item.color}0a 0%, transparent 60%)`,
              padding: "16px 18px",
              overflow: "hidden",
            }}
          >
            {/* Subtle radial glow */}
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${item.color}15 0%, transparent 70%)`,
                filter: "blur(12px)",
                pointerEvents: "none",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icon
                style={{
                  width: 16,
                  height: 16,
                  color: item.color,
                  filter: `drop-shadow(0 0 6px ${item.color}60)`,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </span>
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "monospace",
                color: item.color,
                letterSpacing: "-0.02em",
                textShadow: `0 0 20px ${item.color}30`,
              }}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
