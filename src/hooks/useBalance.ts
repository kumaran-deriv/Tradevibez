"use client";

import { useEffect, useRef, useState } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { Balance } from "@/types/deriv";

export function useBalance(isAuthenticated: boolean) {
  const { ws, status } = useWs();
  const [balance, setBalance] = useState<Balance | null>(null);
  const subscriptionId = useRef<string | null>(null);

  useEffect(() => {
    // Balance requires authenticated WS — for now we use public WS
    // and this hook will be functional once we add authenticated WS in Slice 4
    // Placeholder: balance comes from account fetch in AuthContext
    if (!ws || status !== "connected" || !isAuthenticated) return;

    const unsub = ws.subscribe("balance", (data) => {
      const b = data.balance as Balance | undefined;
      if (b) {
        setBalance(b);
      }
      const sub = data.subscription as { id: string } | undefined;
      if (sub) {
        subscriptionId.current = sub.id;
      }
    });

    ws.send({ balance: 1, subscribe: 1 });

    return () => {
      unsub();
      if (subscriptionId.current && ws) {
        ws.forget(subscriptionId.current);
        subscriptionId.current = null;
      }
    };
  }, [ws, status, isAuthenticated]);

  return { balance };
}
