"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import { useTickHistory, type Candle } from "@/hooks/useTickHistory";
import { useTicks } from "@/hooks/useTicks";
import { CANDLE_GRANULARITIES } from "@/lib/constants";
import { Spinner } from "@/components/ui/Spinner";

interface PriceChartProps {
  symbol: string | null;
  height?: number;
}

export function PriceChart({ symbol, height = 480 }: PriceChartProps) {
  const [granularity, setGranularity] = useState(60);
  const { candles, loading } = useTickHistory(symbol, granularity);
  const { tick } = useTicks(symbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: {
        vertLine: { color: "#4b5563", labelBackgroundColor: "#374151" },
        horzLine: { color: "#4b5563", labelBackgroundColor: "#374151" },
      },
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#1f2937",
      },
      width: chartContainerRef.current.clientWidth,
      height: height - 48,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Update candle data
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const data = candles.map((c: Candle) => ({
      time: c.time as import("lightweight-charts").UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Update last candle with live tick
  useEffect(() => {
    if (!seriesRef.current || !tick || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];
    seriesRef.current.update({
      time: lastCandle.time as import("lightweight-charts").UTCTimestamp,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, tick.quote),
      low: Math.min(lastCandle.low, tick.quote),
      close: tick.quote,
    });
  }, [tick, candles]);

  if (!symbol) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">Select a symbol to view chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Granularity Tabs */}
      <div className="flex items-center gap-1 mb-2">
        {CANDLE_GRANULARITIES.map((g) => (
          <button
            key={g.value}
            onClick={() => setGranularity(g.value)}
            className={`
              rounded px-2 py-1 text-xs font-medium transition-colors
              ${granularity === g.value
                ? "bg-blue-600/10 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
              }
            `}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80">
            <Spinner size="lg" />
          </div>
        )}
        <div ref={chartContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
