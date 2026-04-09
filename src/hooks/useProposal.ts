"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWs } from "@/context/WebSocketContext";
import type { Proposal } from "@/types/deriv";

interface ProposalParams {
  amount: number;
  basis: "stake" | "payout";
  contractType: string;
  currency: string;
  duration: number;
  durationUnit: string;
  symbol: string;
  barrier?: string;
}

export function useProposal(params: ProposalParams | null) {
  const { authWs: ws, authStatus: status } = useWs();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const subscriptionId = useRef<string | null>(null);
  const activeReqId = useRef<number | null>(null);

  const unsubscribe = useCallback(() => {
    if (subscriptionId.current && ws) {
      ws.forget(subscriptionId.current);
      subscriptionId.current = null;
    }
    activeReqId.current = null;
  }, [ws]);

  useEffect(() => {
    if (!ws || status !== "connected" || !params) {
      setProposal(null);
      return;
    }

    // Clean up previous subscription before starting new one
    unsubscribe();
    setLoading(true);
    setError(null);

    const message: Record<string, unknown> = {
      proposal: 1,
      amount: params.amount,
      basis: params.basis,
      contract_type: params.contractType,
      currency: params.currency,
      duration: params.duration,
      duration_unit: params.durationUnit,
      underlying_symbol: params.symbol,
      subscribe: 1,
    };

    if (params.barrier) {
      message.barrier = params.barrier;
    }

    // Use req_id based handler so multiple proposal hooks don't interfere
    const reqId = ws.send(message, (data) => {
      if (data.error) {
        const err = data.error as { message: string };
        setError(err.message);
        setProposal(null);
        setLoading(false);
        return;
      }
      const p = data.proposal as Proposal | undefined;
      if (p) {
        setProposal(p);
        setLoading(false);
      }
      const sub = data.subscription as { id: string } | undefined;
      if (sub) {
        subscriptionId.current = sub.id;
      }
    });

    activeReqId.current = reqId;

    // For subscription updates (after initial response), listen by msg_type
    // but filter by our subscription ID
    const unsub = ws.subscribe("proposal", (data) => {
      const sub = data.subscription as { id: string } | undefined;
      if (sub && subscriptionId.current && sub.id === subscriptionId.current) {
        const p = data.proposal as Proposal | undefined;
        if (p) {
          setProposal(p);
          setLoading(false);
        }
      }
    });

    return () => {
      unsub();
      unsubscribe();
    };
  }, [
    ws,
    status,
    params?.amount,
    params?.basis,
    params?.contractType,
    params?.currency,
    params?.duration,
    params?.durationUnit,
    params?.symbol,
    params?.barrier,
    unsubscribe,
  ]);

  return { proposal, error, loading };
}
