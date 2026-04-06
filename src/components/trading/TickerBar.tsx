"use client";

import { useTicks } from "@/hooks/useTicks";
import { ArrowUp, ArrowDown } from "lucide-react";

interface TickerBarProps {
  symbols: string[];
}

export function TickerBar({ symbols }: TickerBarProps) {
  if (symbols.length === 0) return null;

  return (
    <div className="flex items-center gap-6 overflow-x-auto py-1">
      {symbols.map((symbol) => (
        <TickerItem key={symbol} symbol={symbol} />
      ))}
    </div>
  );
}

function TickerItem({ symbol }: { symbol: string }) {
  const { tick, direction } = useTicks(symbol);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-gray-500">{symbol}</span>
      <span
        className={`
          text-xs font-mono tabular-nums font-medium transition-colors duration-300
          ${direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-gray-300"}
        `}
      >
        {tick ? tick.quote.toFixed(2) : "—"}
      </span>
      {direction === "up" && <ArrowUp className="h-3 w-3 text-emerald-400" />}
      {direction === "down" && <ArrowDown className="h-3 w-3 text-red-400" />}
    </div>
  );
}
