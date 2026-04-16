"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { Tick } from "@/types/deriv";

export function useTicks(symbol: string | null) {
  const { ws, status } = useWs();
  const [tick, setTick] = useState<Tick | null>(null);
  const [prevQuote, setPrevQuote] = useState<number | null>(null);
  const subscriptionId = useRef<string | null>(null);

  const unsubscribe = useCallback(() => {
    if (subscriptionId.current && ws) {
      ws.forget(subscriptionId.current);
      subscriptionId.current = null;
    }
  }, [ws]);

  useEffect(() => {
    if (!ws || status !== "connected" || !symbol) return;

    // Clean up previous subscription
    unsubscribe();
    setTick(null);
    setPrevQuote(null);

    // Subscribe to ticks
    const unsub = ws.subscribe("tick", (data) => {
      const t = data.tick as Tick | undefined;
      if (t && t.symbol === symbol) {
        t.quote = Number(t.quote);
        setTick((prev) => {
          if (prev) setPrevQuote(prev.quote);
          return t;
        });

        // Capture subscription ID for cleanup
        const sub = data.subscription as { id: string } | undefined;
        if (sub) {
          subscriptionId.current = sub.id;
        }
      }
    });

    ws.send({ ticks: symbol, subscribe: 1 });

    return () => {
      unsub();
      unsubscribe();
    };
  }, [ws, status, symbol, unsubscribe]);

  // Direction: up, down, or null
  const direction =
    tick && prevQuote !== null
      ? tick.quote > prevQuote
        ? "up"
        : tick.quote < prevQuote
          ? "down"
          : null
      : null;

  return { tick, prevQuote, direction };
}
