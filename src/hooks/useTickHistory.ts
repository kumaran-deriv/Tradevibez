"use client";

import { useEffect, useState } from "react";
import { useWs } from "@/context/WebSocketContext";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useTickHistory(
  symbol: string | null,
  granularity: number = 60,
  count: number = 200
) {
  const { ws, status } = useWs();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws || status !== "connected" || !symbol) return;

    setLoading(true);
    setError(null);

    ws.send(
      {
        ticks_history: symbol,
        adjust_start_time: 1,
        count,
        end: "latest",
        start: 1,
        style: "candles",
        granularity,
      },
      (data) => {
        if (data.error) {
          const err = data.error as { message: string };
          setError(err.message);
          setLoading(false);
          return;
        }

        const ohlc = data.candles as Array<{
          epoch: number;
          open: number;
          high: number;
          low: number;
          close: number;
        }>;

        if (ohlc) {
          setCandles(
            ohlc.map((c) => ({
              time: c.epoch,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        }
        setLoading(false);
      }
    );
  }, [ws, status, symbol, granularity, count]);

  return { candles, loading, error };
}
