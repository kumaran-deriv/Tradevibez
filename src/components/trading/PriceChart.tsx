"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  BaselineSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import { useTickHistory, type Candle } from "@/hooks/useTickHistory";
import { useTicks } from "@/hooks/useTicks";
import { useTheme } from "@/context/ThemeContext";
import { CANDLE_GRANULARITIES } from "@/lib/constants";
import { Spinner } from "@/components/ui/Spinner";
import type { UTCTimestamp } from "lightweight-charts";

/* ─── Types ──────────────────────────────────────────────── */

export type ChartType = "candlestick" | "line" | "area" | "bar" | "baseline";

// Union of all series API types we use
type AnySeries =
  | ISeriesApi<"Candlestick">
  | ISeriesApi<"Line">
  | ISeriesApi<"Area">
  | ISeriesApi<"Bar">
  | ISeriesApi<"Baseline">;

interface PriceChartProps {
  symbol: string | null;
  chartType?: ChartType;
  height?: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

function isOhlcType(t: ChartType): t is "candlestick" | "bar" {
  return t === "candlestick" || t === "bar";
}

function getChartOpts(isDark: boolean) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: "transparent" as const },
      textColor: isDark ? "#6b7280" : "#64748b",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)" },
      horzLines: { color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)" },
    },
    crosshair: {
      vertLine: {
        color: isDark ? "#4b5563" : "#94a3b8",
        labelBackgroundColor: isDark ? "#1f2937" : "#e2e8f0",
      },
      horzLine: {
        color: isDark ? "#4b5563" : "#94a3b8",
        labelBackgroundColor: isDark ? "#1f2937" : "#e2e8f0",
      },
    },
    timeScale: {
      borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
    },
  };
}

/* ─── Component ──────────────────────────────────────────── */

export function PriceChart({ symbol, chartType = "candlestick", height }: PriceChartProps) {
  const [granularity, setGranularity] = useState(60);
  const { candles, loading } = useTickHistory(symbol, granularity);
  const { tick } = useTicks(symbol);
  const { theme } = useTheme();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<AnySeries | null>(null);

  /* ── Create chart instance (once) ────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      ...getChartOpts(theme === "dark"),
      autoSize: true,
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Update chart colors when theme changes ───────────────── */
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions(getChartOpts(theme === "dark"));
  }, [theme]);

  /* ── Recreate series + set data when chartType or candles change ── */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current as ISeriesApi<"Candlestick">);
      seriesRef.current = null;
    }

    // Build new series
    let series: AnySeries;

    if (chartType === "candlestick") {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
    } else if (chartType === "bar") {
      series = chart.addSeries(BarSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
      });
    } else if (chartType === "line") {
      series = chart.addSeries(LineSeries, {
        color: "#14b8a6",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
    } else if (chartType === "area") {
      series = chart.addSeries(AreaSeries, {
        lineColor: "#14b8a6",
        topColor: "rgba(20,184,166,0.28)",
        bottomColor: "rgba(20,184,166,0.02)",
        lineWidth: 2,
      });
    } else {
      // baseline — anchored to first candle's close
      const basePrice = candles[0]?.close ?? 0;
      series = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: basePrice },
        topLineColor: "#22c55e",
        topFillColor1: "rgba(34,197,94,0.18)",
        topFillColor2: "rgba(34,197,94,0.02)",
        bottomLineColor: "#ef4444",
        bottomFillColor1: "rgba(239,68,68,0.02)",
        bottomFillColor2: "rgba(239,68,68,0.18)",
      });
    }

    seriesRef.current = series;

    // Populate data immediately
    if (candles.length > 0) {
      if (isOhlcType(chartType)) {
        (series as ISeriesApi<"Candlestick">).setData(
          candles.map((c: Candle) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      } else {
        (series as ISeriesApi<"Line">).setData(
          candles.map((c: Candle) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }))
        );
      }
      chart.timeScale().fitContent();
    }
  }, [chartType, candles]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Live tick update ─────────────────────────────────────── */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !tick || candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];

    if (isOhlcType(chartType)) {
      (series as ISeriesApi<"Candlestick">).update({
        time: lastCandle.time as UTCTimestamp,
        open: lastCandle.open,
        high: Math.max(lastCandle.high, tick.quote),
        low: Math.min(lastCandle.low, tick.quote),
        close: tick.quote,
      });
    } else {
      (series as ISeriesApi<"Line">).update({
        time: lastCandle.time as UTCTimestamp,
        value: tick.quote,
      });
    }
  }, [tick, candles, chartType]);

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-full" style={height ? { height } : undefined}>
        <p className="text-sm text-gray-500">Select a symbol to view chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Granularity tabs */}
      <div className="flex items-center gap-1 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {CANDLE_GRANULARITIES.map((g) => (
          <button
            key={g.value}
            onClick={() => setGranularity(g.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              granularity === g.value
                ? "bg-gray-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/70 rounded">
            <Spinner size="lg" />
          </div>
        )}
        <div ref={chartContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
