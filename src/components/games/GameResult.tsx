"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/utils/formatters";

interface GameResultProps {
  won: boolean;
  buyPrice: number;
  payout: number;
  currency: string;
  onPlayAgain: () => void;
}

export function GameResult({ won, buyPrice, payout, currency, onPlayAgain }: GameResultProps) {
  const profit = won ? payout - buyPrice : -buyPrice;
  const profitPct = won ? ((payout / buyPrice - 1) * 100).toFixed(0) : "100";

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5 animate-in fade-in zoom-in-95 duration-300">
      {/* Emoji */}
      <div className="text-6xl select-none" role="img" aria-label={won ? "Win" : "Loss"}>
        {won ? "🎉" : "💡"}
      </div>

      {/* Headline */}
      <div className="text-center">
        <h3
          className={`text-2xl font-bold mb-1 ${won ? "text-emerald-400" : "text-red-400"}`}
        >
          {won ? "You Won!" : "Not this time"}
        </h3>
        <p className="text-sm text-gray-500">
          {won ? "Great prediction — keep the streak going." : "Market went the other way. Every round sharpens your read."}
        </p>
      </div>

      {/* P&L card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-8 py-5 text-center min-w-[180px]">
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Result</p>
        <p
          className={`text-3xl font-mono font-bold ${won ? "text-emerald-400" : "text-red-400"}`}
        >
          {profit >= 0 ? "+" : ""}{formatCurrency(profit, currency)}
        </p>
        {won && (
          <p className="text-xs text-gray-500 mt-1">
            Staked {formatCurrency(buyPrice, currency)} · {profitPct}% return
          </p>
        )}
      </div>

      {/* Action */}
      <Button variant="primary" size="lg" onClick={onPlayAgain}>
        Play Again
      </Button>
    </div>
  );
}
