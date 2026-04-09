"use client";

import { useEffect, useRef, useState } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { Balance } from "@/types/deriv";

export function useBalance(isAuthenticated: boolean) {
  const { authWs, authStatus } = useWs();
  const [balance, setBalance] = useState<Balance | null>(null);
  const subscriptionId = useRef<string | null>(null);

  useEffect(() => {
    if (!authWs || authStatus !== "connected" || !isAuthenticated) return;

    const unsub = authWs.subscribe("balance", (data) => {
      const b = data.balance as Balance | undefined;
      if (b) {
        setBalance(b);
      }
      const sub = data.subscription as { id: string } | undefined;
      if (sub) {
        subscriptionId.current = sub.id;
      }
    });

    authWs.send({ balance: 1, subscribe: 1 });

    return () => {
      unsub();
      if (subscriptionId.current && authWs) {
        authWs.forget(subscriptionId.current);
        subscriptionId.current = null;
      }
    };
  }, [authWs, authStatus, isAuthenticated]);

  return { balance };
}
