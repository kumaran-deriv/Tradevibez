"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
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
      isPositive: stats.totalPnl >= 0,
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      isPositive: stats.winRate >= 50,
      icon: Target,
    },
    {
      label: "Total Trades",
      value: stats.totalTrades.toString(),
      isPositive: null,
      icon: BarChart3,
    },
    {
      label: "Avg Return",
      value: formatCurrency(stats.avgReturn, currency),
      isPositive: stats.avgReturn >= 0,
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const colorClass =
          item.isPositive === null
            ? "text-blue-400"
            : item.isPositive
              ? "text-emerald-400"
              : "text-red-400";

        return (
          <Card key={item.label} padding="sm">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
            <p className={`text-lg font-semibold font-mono tabular-nums ${colorClass}`}>
              {item.value}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
