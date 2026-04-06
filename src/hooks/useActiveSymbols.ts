"use client";

import { useEffect, useState } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { ActiveSymbol } from "@/types/deriv";

export function useActiveSymbols() {
  const { ws, status } = useWs();
  const [symbols, setSymbols] = useState<ActiveSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws || status !== "connected") return;

    setLoading(true);
    setError(null);

    ws.send({ active_symbols: "brief" }, (data) => {
      if (data.error) {
        const err = data.error as { message: string };
        setError(err.message);
        setLoading(false);
        return;
      }
      setSymbols(data.active_symbols as ActiveSymbol[]);
      setLoading(false);
    });
  }, [ws, status]);

  return { symbols, loading, error };
}
