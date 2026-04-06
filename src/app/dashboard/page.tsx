"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { MarketSelector } from "@/components/trading/MarketSelector";
import { PriceChart } from "@/components/trading/PriceChart";
import { TickerBar } from "@/components/trading/TickerBar";
import { useWs } from "@/context/WebSocketContext";
import { useActiveSymbols } from "@/hooks/useActiveSymbols";
import { Activity, TrendingUp, Clock, Wifi, WifiOff } from "lucide-react";

const DEFAULT_TICKER_SYMBOLS = ["R_100", "R_50", "R_75", "R_25", "1HZ100V"];

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>("R_100");
  const { status } = useWs();
  const { symbols } = useActiveSymbols();

  const stats = useMemo(() => {
    const openCount = symbols.filter((s) => s.exchange_is_open === 1).length;
    const marketCount = new Set(symbols.map((s) => s.market)).size;
    return { openCount, totalCount: symbols.length, marketCount };
  }, [symbols]);

  const selectedName = useMemo(() => {
    const found = symbols.find((s) => s.underlying_symbol === selectedSymbol);
    return found?.underlying_symbol_name || selectedSymbol || "Select a symbol";
  }, [symbols, selectedSymbol]);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Markets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time market data and trading opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-400" />
          )}
          <span className={`text-xs ${status === "connected" ? "text-emerald-400" : "text-red-400"}`}>
            {status === "connected" ? "Live" : status === "connecting" ? "Connecting..." : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-800 p-2">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Markets Open</p>
              <p className="text-lg font-semibold text-white font-mono tabular-nums">
                {stats.openCount > 0 ? stats.openCount : "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-800 p-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Symbols</p>
              <p className="text-lg font-semibold text-white font-mono tabular-nums">
                {stats.totalCount > 0 ? stats.totalCount : "—"}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-800 p-2">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Market Groups</p>
              <p className="text-lg font-semibold text-white font-mono tabular-nums">
                {stats.marketCount > 0 ? stats.marketCount : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart — spans 2 columns */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader title={selectedName} />
            <PriceChart symbol={selectedSymbol} height={480} />
          </Card>
        </div>

        {/* Symbol List */}
        <div>
          <Card className="h-[536px] flex flex-col">
            <CardHeader title="Symbols" />
            <div className="flex-1 overflow-hidden">
              <MarketSelector
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="mt-6">
        <Card padding="sm">
          <TickerBar symbols={DEFAULT_TICKER_SYMBOLS} />
        </Card>
      </div>
    </DashboardLayout>
  );
}
