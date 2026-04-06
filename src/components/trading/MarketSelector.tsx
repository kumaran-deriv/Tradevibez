"use client";

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { MARKET_GROUPS } from "@/lib/constants";
import { useActiveSymbols } from "@/hooks/useActiveSymbols";
import { useTicks } from "@/hooks/useTicks";
import { formatPrice } from "@/utils/formatters";
import type { ActiveSymbol } from "@/types/deriv";

interface MarketSelectorProps {
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
}

export function MarketSelector({ selectedSymbol, onSelectSymbol }: MarketSelectorProps) {
  const { symbols, loading } = useActiveSymbols();
  const [activeMarket, setActiveMarket] = useState<string>(MARKET_GROUPS[0].key);

  const filteredSymbols = useMemo(() => {
    return symbols
      .filter((s) => s.market === activeMarket && s.exchange_is_open === 1)
      .sort((a, b) => a.underlying_symbol_name.localeCompare(b.underlying_symbol_name));
  }, [symbols, activeMarket]);

  return (
    <div className="flex h-full flex-col">
      {/* Market Tabs */}
      <div className="flex gap-1 border-b border-gray-800 px-1 pb-2 mb-2 overflow-x-auto">
        {MARKET_GROUPS.map((group) => (
          <button
            key={group.key}
            onClick={() => setActiveMarket(group.key)}
            className={`
              shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors
              ${activeMarket === group.key
                ? "bg-blue-600/10 text-blue-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }
            `}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* Symbol List */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2.5 animate-pulse">
              <div className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-gray-700" />
                <div className="h-2.5 w-16 rounded bg-gray-800" />
              </div>
              <div className="h-4 w-16 rounded bg-gray-700" />
            </div>
          ))
        ) : filteredSymbols.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-gray-600">No symbols available</p>
          </div>
        ) : (
          filteredSymbols.map((symbol) => (
            <SymbolRow
              key={symbol.underlying_symbol}
              symbol={symbol}
              isSelected={selectedSymbol === symbol.underlying_symbol}
              onSelect={onSelectSymbol}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SymbolRow({
  symbol,
  isSelected,
  onSelect,
}: {
  symbol: ActiveSymbol;
  isSelected: boolean;
  onSelect: (s: string) => void;
}) {
  const { tick, direction } = useTicks(symbol.underlying_symbol);

  return (
    <button
      onClick={() => onSelect(symbol.underlying_symbol)}
      className={`
        flex w-full items-center justify-between rounded-lg px-3 py-2.5
        text-left transition-colors duration-150
        ${isSelected
          ? "bg-blue-600/10 border border-blue-500/20"
          : "hover:bg-gray-800/70 border border-transparent"
        }
      `}
    >
      <div>
        <p className="text-sm font-medium text-white">
          {symbol.underlying_symbol_name}
        </p>
        <p className="text-xs text-gray-500">{symbol.underlying_symbol}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`
            text-sm font-mono tabular-nums font-medium transition-colors duration-300
            ${direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-gray-300"}
          `}
        >
          {tick ? formatPrice(tick.quote, symbol.pip_size) : "—"}
        </span>
        {direction === "up" && <ArrowUp className="h-3 w-3 text-emerald-400" />}
        {direction === "down" && <ArrowDown className="h-3 w-3 text-red-400" />}
      </div>
    </button>
  );
}
