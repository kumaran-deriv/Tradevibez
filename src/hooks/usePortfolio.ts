"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { OpenContract } from "@/types/deriv";

export function usePortfolio(isAuthenticated: boolean) {
  const { authWs, authStatus } = useWs();
  const [positions, setPositions] = useState<OpenContract[]>([]);
  const [loading, setLoading] = useState(false);
  const subscriptionIds = useRef<Set<string>>(new Set());

  const unsubscribeAll = useCallback(() => {
    if (authWs) {
      subscriptionIds.current.forEach((id) => authWs.forget(id));
      subscriptionIds.current.clear();
    }
  }, [authWs]);

  const refresh = useCallback(() => {
    if (!authWs || authStatus !== "connected" || !isAuthenticated) return;

    setLoading(true);
    unsubscribeAll();

    // Get portfolio list
    authWs.send({ portfolio: 1 }, (data) => {
      if (data.error) {
        setLoading(false);
        return;
      }

      const portfolio = data.portfolio as { contracts: Array<{ contract_id: number }> } | undefined;
      const contracts = portfolio?.contracts || [];

      if (contracts.length === 0) {
        setPositions([]);
        setLoading(false);
        return;
      }

      // Subscribe to each open contract for live updates
      contracts.forEach((c) => {
        authWs.send({
          proposal_open_contract: 1,
          contract_id: c.contract_id,
          subscribe: 1,
        });
      });

      setLoading(false);
    });
  }, [authWs, authStatus, isAuthenticated, unsubscribeAll]);

  useEffect(() => {
    if (!authWs || authStatus !== "connected" || !isAuthenticated) return;

    refresh();

    // Listen for open contract updates
    const unsub = authWs.subscribe("proposal_open_contract", (data) => {
      const contract = data.proposal_open_contract as OpenContract | undefined;
      if (!contract) return;

      const sub = data.subscription as { id: string } | undefined;
      if (sub) {
        subscriptionIds.current.add(sub.id);
      }

      setPositions((prev) => {
        // Remove sold/expired contracts
        if (contract.is_sold === 1 || contract.is_expired === 1) {
          return prev.filter((p) => p.contract_id !== contract.contract_id);
        }
        // Update existing or add new
        const idx = prev.findIndex((p) => p.contract_id === contract.contract_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = contract;
          return updated;
        }
        return [...prev, contract];
      });
    });

    // Listen for new transactions (buys) to trigger refresh
    const unsubTx = authWs.subscribe("transaction", (data) => {
      const tx = data.transaction as { action: string } | undefined;
      if (tx?.action === "buy") {
        refresh();
      }
    });

    // Subscribe to transactions
    authWs.send({ transaction: 1, subscribe: 1 });

    return () => {
      unsub();
      unsubTx();
      unsubscribeAll();
    };
  }, [authWs, authStatus, isAuthenticated, refresh, unsubscribeAll]);

  const sellContract = useCallback(
    (contractId: number, price: number): Promise<{ sold_for: number } | { error: string }> => {
      return new Promise((resolve) => {
        if (!authWs) {
          resolve({ error: "Not connected" });
          return;
        }
        authWs.send({ sell: contractId, price }, (data) => {
          if (data.error) {
            const err = data.error as { message: string };
            resolve({ error: err.message });
            return;
          }
          const sell = data.sell as { sold_for: number };
          resolve({ sold_for: sell.sold_for });
        });
      });
    },
    [authWs]
  );

  return { positions, loading, refresh, sellContract };
}
