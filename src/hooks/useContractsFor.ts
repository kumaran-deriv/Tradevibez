"use client";

import { useEffect, useState } from "react";
import { useWs } from "@/context/WebSocketContext";

export interface ContractType {
  contract_type: string;
  contract_category: string;
  contract_category_display: string;
  contract_display: string;
  sentiment: string;
  barrier_category: string;
  barriers: number;
  expiry_type: string;
  max_contract_duration: string;
  min_contract_duration: string;
}

export function useContractsFor(symbol: string | null) {
  const { ws, status } = useWs();
  const [contracts, setContracts] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ws || status !== "connected" || !symbol) return;

    setLoading(true);
    ws.send({ contracts_for: symbol }, (data) => {
      if (data.error) {
        setLoading(false);
        return;
      }
      const result = data.contracts_for as { available: ContractType[] } | undefined;
      if (result?.available) {
        setContracts(result.available);
      }
      setLoading(false);
    });
  }, [ws, status, symbol]);

  return { contracts, loading };
}
