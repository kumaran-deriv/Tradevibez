"use client";

import { useState, useMemo, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useContractsFor } from "@/hooks/useContractsFor";
import { useProposal } from "@/hooks/useProposal";
import { useWs } from "@/context/WebSocketContext";
import { formatCurrency } from "@/utils/formatters";
import { ArrowUp, ArrowDown, AlertCircle, CheckCircle } from "lucide-react";

interface TradePanelProps {
  symbol: string | null;
  currency: string;
  onTradeExecuted?: () => void;
}

const DURATION_UNITS = [
  { label: "T", value: "t", title: "Ticks" },
  { label: "S", value: "s", title: "Seconds" },
  { label: "M", value: "m", title: "Minutes" },
  { label: "H", value: "h", title: "Hours" },
];

const CONTRACT_PAIRS = [
  { label: "Rise / Fall", buy: "CALL", sell: "PUT", buyLabel: "Rise", sellLabel: "Fall", needsBarrier: false },
  { label: "Higher / Lower", buy: "HIGHER", sell: "LOWER", buyLabel: "Higher", sellLabel: "Lower", needsBarrier: true },
  { label: "Even / Odd", buy: "DIGITEVEN", sell: "DIGITODD", buyLabel: "Even", sellLabel: "Odd", needsBarrier: false },
  { label: "Touch / No Touch", buy: "ONETOUCH", sell: "NOTOUCH", buyLabel: "Touch", sellLabel: "No Touch", needsBarrier: true },
];

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];
const BARRIER_PRESETS = ["+0.1", "+0.5", "+1.0", "-0.1"];

export function TradePanel({ symbol, currency, onTradeExecuted }: TradePanelProps) {
  const { authWs, authStatus } = useWs();
  const { contracts } = useContractsFor(symbol);

  const [selectedPair, setSelectedPair] = useState(CONTRACT_PAIRS[0]);
  const [amount, setAmount] = useState(10);
  const [basis, setBasis] = useState<"stake" | "payout">("stake");
  const [duration, setDuration] = useState(5);
  const [durationUnit, setDurationUnit] = useState("m");
  const [barrier, setBarrier] = useState("+0.1");
  const [buying, setBuying] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const availablePairs = useMemo(() => {
    if (contracts.length === 0) return CONTRACT_PAIRS;
    const availableTypes = new Set(contracts.map((c) => c.contract_type));
    return CONTRACT_PAIRS.filter(
      (pair) => availableTypes.has(pair.buy) || availableTypes.has(pair.sell)
    );
  }, [contracts]);

  const buyParams = useMemo(() => {
    if (!symbol) return null;
    return {
      amount,
      basis,
      contractType: selectedPair.buy,
      currency,
      duration,
      durationUnit,
      symbol,
      ...(selectedPair.needsBarrier ? { barrier } : {}),
    };
  }, [symbol, amount, basis, selectedPair.buy, selectedPair.needsBarrier, currency, duration, durationUnit, barrier]);

  const sellParams = useMemo(() => {
    if (!symbol) return null;
    return {
      amount,
      basis,
      contractType: selectedPair.sell,
      currency,
      duration,
      durationUnit,
      symbol,
      ...(selectedPair.needsBarrier ? { barrier } : {}),
    };
  }, [symbol, amount, basis, selectedPair.sell, selectedPair.needsBarrier, currency, duration, durationUnit, barrier]);

  const { proposal: buyProposal, error: buyError, loading: buyLoading } = useProposal(buyParams);
  const { proposal: sellProposal, error: sellError, loading: sellLoading } = useProposal(sellParams);

  const executeTrade = useCallback(
    (proposalId: string, price: number) => {
      if (!authWs || authStatus !== "connected" || buying) return;
      setBuying(true);
      setTradeResult(null);
      authWs.send({ buy: proposalId, price }, (data) => {
        setBuying(false);
        if (data.error) {
          const err = data.error as { message: string };
          setTradeResult({ type: "error", message: err.message });
          return;
        }
        const buy = data.buy as { buy_price: number; contract_id: number };
        setTradeResult({
          type: "success",
          message: `Contract #${buy.contract_id} @ ${formatCurrency(buy.buy_price, currency)}`,
        });
        onTradeExecuted?.();
        setTimeout(() => setTradeResult(null), 5000);
      });
    },
    [authWs, authStatus, buying, currency, onTradeExecuted]
  );

  const authNotReady = authStatus !== "connected";

  if (!symbol) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select a symbol to trade
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ color: "var(--text-primary)" }}>
      {/* Panel Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Trade
          </span>
          {authNotReady && (
            <div className="flex items-center gap-1.5">
              <Spinner size="sm" />
              <span className="text-[10px]" style={{ color: "#f59e0b" }}>
                Connecting...
              </span>
            </div>
          )}
          {!authNotReady && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium"
              style={{ color: "#22c55e" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Contract Type */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
            Contract Type
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {availablePairs.map((pair) => {
              const active = selectedPair.label === pair.label;
              return (
                <button
                  key={pair.label}
                  onClick={() => setSelectedPair(pair)}
                  className="rounded px-2 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? "var(--accent-glow)" : "var(--bg-base)",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {pair.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
            Duration
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded px-2 py-1.5 text-sm font-mono focus:outline-none"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex flex-1 gap-1">
              {DURATION_UNITS.map((u) => {
                const active = durationUnit === u.value;
                return (
                  <button
                    key={u.value}
                    title={u.title}
                    onClick={() => setDurationUnit(u.value)}
                    className="flex-1 rounded py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: active ? "var(--accent-glow)" : "var(--bg-base)",
                      color: active ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {u.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Barrier */}
        {selectedPair.needsBarrier && (
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              Barrier (offset)
            </p>
            <input
              type="text"
              value={barrier}
              onChange={(e) => setBarrier(e.target.value)}
              placeholder="+0.1"
              className="w-full rounded px-3 py-1.5 text-sm font-mono focus:outline-none mb-2"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex gap-1">
              {BARRIER_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBarrier(v)}
                  className="flex-1 rounded py-1 text-xs font-mono transition-colors"
                  style={{
                    background: barrier === v ? "var(--accent-glow)" : "var(--bg-base)",
                    color: barrier === v ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${barrier === v ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Amount ({currency})
            </p>
            <div className="flex gap-0.5">
              {(["stake", "payout"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBasis(b)}
                  className="rounded px-2 py-0.5 text-[10px] capitalize transition-colors"
                  style={{
                    background: basis === b ? "var(--accent-glow)" : "transparent",
                    color: basis === b ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${basis === b ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full rounded px-3 py-2 text-sm font-mono focus:outline-none"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex gap-1 mt-2">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className="flex-1 rounded py-1 text-xs font-mono transition-colors"
                style={{
                  background: amount === v ? "var(--bg-elevated)" : "var(--bg-base)",
                  color: amount === v ? "var(--text-primary)" : "var(--text-muted)",
                  border: `1px solid ${amount === v ? "var(--border-subtle)" : "var(--border)"}`,
                }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Buy / Sell */}
        <div className="px-4 py-3 space-y-2">
          {/* Buy side */}
          <ProposalCard
            side="buy"
            label={selectedPair.buyLabel}
            contractType={selectedPair.buy}
            proposal={buyProposal}
            error={buyError}
            loading={buyLoading || buying}
            disabled={!buyProposal || buying || authNotReady}
            currency={currency}
            onExecute={() => buyProposal && executeTrade(buyProposal.id, buyProposal.ask_price)}
          />

          {/* Sell side */}
          <ProposalCard
            side="sell"
            label={selectedPair.sellLabel}
            contractType={selectedPair.sell}
            proposal={sellProposal}
            error={sellError}
            loading={sellLoading || buying}
            disabled={!sellProposal || buying || authNotReady}
            currency={currency}
            onExecute={() => sellProposal && executeTrade(sellProposal.id, sellProposal.ask_price)}
          />
        </div>

        {/* Result toast */}
        {tradeResult && (
          <div
            className="mx-4 mb-4 rounded p-3 flex items-start gap-2 text-xs"
            style={{
              background: tradeResult.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${tradeResult.type === "success" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: tradeResult.type === "success" ? "#22c55e" : "#ef4444",
            }}
          >
            {tradeResult.type === "success" ? (
              <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            )}
            {tradeResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  side,
  label,
  contractType,
  proposal,
  error,
  loading,
  disabled,
  currency,
  onExecute,
}: {
  side: "buy" | "sell";
  label: string;
  contractType: string;
  proposal: { id: string; ask_price: number; payout: number } | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  currency: string;
  onExecute: () => void;
}) {
  const isUp = side === "buy";
  const accentColor = isUp ? "#22c55e" : "#ef4444";
  const bgColor = isUp ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)";
  const borderColor = isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const btnBg = isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
  const btnHoverBg = isUp ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)";

  const pct =
    proposal && proposal.ask_price > 0
      ? (((proposal.payout - proposal.ask_price) / proposal.ask_price) * 100).toFixed(0)
      : null;

  return (
    <div
      className="rounded p-3"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isUp ? (
            <ArrowUp className="h-3.5 w-3.5" style={{ color: accentColor }} />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" style={{ color: accentColor }} />
          )}
          <span className="text-xs font-semibold" style={{ color: accentColor }}>
            {label}
          </span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {contractType}
          </span>
        </div>
        {loading && !proposal && <Spinner size="sm" />}
        {proposal && (
          <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(proposal.ask_price, currency)}
          </span>
        )}
      </div>

      {/* Payout row */}
      {proposal && pct && (
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Payout: {formatCurrency(proposal.payout, currency)}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: accentColor }}
          >
            +{pct}%
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] mb-2 flex items-start gap-1" style={{ color: "#ef4444" }}>
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {/* Execute button */}
      <button
        onClick={onExecute}
        disabled={disabled}
        className="w-full rounded py-2 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: disabled ? "var(--bg-base)" : btnBg,
          color: disabled ? "var(--text-muted)" : accentColor,
          border: `1px solid ${disabled ? "var(--border)" : borderColor}`,
        }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = btnHoverBg;
        }}
        onMouseLeave={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = btnBg;
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1.5">
            <Spinner size="sm" />
            Placing...
          </span>
        ) : (
          `Buy ${label}`
        )}
      </button>
    </div>
  );
}
