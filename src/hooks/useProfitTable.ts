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
            setTransactions((prev) =>
              append ? [...prev, ...result.transactions] : result.transactions
            );
            offsetRef.current = offset + result.transactions.length;
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
