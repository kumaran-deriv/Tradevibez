"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { ProfitTransaction } from "@/types/deriv";

const PAGE_SIZE = 50;

export function useProfitTable(isAuthenticated: boolean) {
  const { authWs, authStatus } = useWs();
  const [transactions, setTransactions] = useState<ProfitTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(
    (offset: number, append: boolean) => {
      if (!authWs || authStatus !== "connected" || !isAuthenticated) return;

      setLoading(true);
      setError(null);

      authWs.send(
        {
          profit_table: 1,
          description: 1,
          limit: PAGE_SIZE,
          offset,
          sort: "DESC",
        },
        (data) => {
          setLoading(false);

          if (data.error) {
            const err = data.error as { message: string };
            setError(err.message);
            return;
          }

          const result = data.profit_table as {
            count: number;
            transactions: ProfitTransaction[];
          } | undefined;

          if (result) {
            setTotalCount(result.count);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txs = result.transactions.map((raw: any) => {
              const buyPrice = Number(raw.buy_price ?? 0);
              const sellPrice = Number(raw.sell_price ?? 0);
              const payout = Number(raw.payout ?? 0);
              const effectiveSell = sellPrice || payout;
              return {
                contract_id: Number(raw.contract_id ?? 0),
                buy_price: buyPrice,
                sell_price: effectiveSell,
                profit_loss: effectiveSell - buyPrice,
                longcode: String(raw.longcode ?? ""),
                shortcode: String(raw.shortcode ?? raw.contract_type ?? ""),
                purchase_time: Number(raw.purchase_time ?? 0),
                sell_time: Number(raw.sell_time ?? 0),
                transaction_id: Number(raw.transaction_id ?? 0),
              };
            });
            setTransactions((prev) =>
              append ? [...prev, ...txs] : txs
            );
            offsetRef.current = offset + txs.length;
          }
        }
      );
    },
    [authWs, authStatus, isAuthenticated]
  );

  // Initial fetch
  useEffect(() => {
    if (!authWs || authStatus !== "connected" || !isAuthenticated) return;
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [authWs, authStatus, isAuthenticated, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || transactions.length >= totalCount) return;
    fetchPage(offsetRef.current, true);
  }, [loading, transactions.length, totalCount, fetchPage]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    setTransactions([]);
    fetchPage(0, false);
  }, [fetchPage]);

  const hasMore = transactions.length < totalCount;

  return { transactions, totalCount, loading, error, loadMore, refresh, hasMore };
}
