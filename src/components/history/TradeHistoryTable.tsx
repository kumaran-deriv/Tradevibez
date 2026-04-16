"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime, formatPnl } from "@/utils/formatters";
import { History, RefreshCw } from "lucide-react";
import type { ProfitTransaction } from "@/types/deriv";

interface TradeHistoryTableProps {
  transactions: ProfitTransaction[];
  loading: boolean;
  hasMore: boolean;
  currency: string;
  onLoadMore: () => void;
  onRefresh: () => void;
}

const CONTRACT_LABELS: Record<string, string> = {
  CALL: "Rise",
  PUT: "Fall",
  DIGITODD: "Odd",
  DIGITEVEN: "Even",
  DIGITMATCH: "Match",
  DIGITDIFF: "Differs",
  DIGITOVER: "Over",
  DIGITUNDER: "Under",
  ASIANU: "Asian Up",
  ASIAND: "Asian Down",
  NOTOUCH: "No Touch",
  ONETOUCH: "One Touch",
  UPORDOWN: "Up or Down",
  EXPIRYRANGEE: "Ends Between",
  EXPIRYMISSE: "Ends Outside",
};

function parseContractType(shortcode: string): { label: string; raw: string } {
  const raw = shortcode.split("_")[0] || shortcode;
  return { label: CONTRACT_LABELS[raw] || raw, raw };
}

export function TradeHistoryTable({
  transactions,
  loading,
  hasMore,
  currency,
  onLoadMore,
  onRefresh,
}: TradeHistoryTableProps) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(20,184,166,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <History style={{ width: 16, height: 16, color: "var(--accent)", filter: "drop-shadow(0 0 6px rgba(20,184,166,0.5))" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
            Trade History
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              background: "var(--accent-glow)",
              color: "var(--accent)",
              padding: "2px 8px",
              borderRadius: 10,
              border: "1px solid rgba(20,184,166,0.2)",
              letterSpacing: "0.08em",
            }}
          >
            {transactions.length}
          </span>
        </div>
        <button
          onClick={onRefresh}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
          }}
        >
          <RefreshCw
            style={{
              width: 13,
              height: 13,
              animation: loading && transactions.length === 0 ? "spin 1s linear infinite" : undefined,
            }}
          />
        </button>
      </div>

      {transactions.length === 0 && !loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 0",
          }}
        >
          <History style={{ width: 36, height: 36, color: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>No completed trades yet</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Your trade history will appear here</div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Date", "Contract", "Buy", "Sell", "P&L"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i < 2 ? "left" : "right",
                        padding: "10px 20px",
                        fontSize: 10,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.01)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isProfit = tx.profit_loss > 0;
                  const isLoss = tx.profit_loss < 0;
                  const { label, raw } = parseContractType(tx.shortcode);
                  const rowAccent = isProfit ? "#22c55e" : isLoss ? "#ef4444" : "transparent";

                  return (
                    <tr
                      key={tx.transaction_id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        transition: "background 0.15s",
                        borderLeft: `3px solid ${rowAccent}60`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "12px 20px", color: "var(--text-secondary)", fontSize: 12, fontFamily: "monospace" }}>
                        {formatDateTime(tx.sell_time)}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontFamily: "monospace",
                            fontWeight: 600,
                            background: isProfit ? "rgba(34,197,94,0.08)" : isLoss ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                            color: isProfit ? "#22c55e" : isLoss ? "#ef4444" : "var(--text-secondary)",
                            border: `1px solid ${isProfit ? "rgba(34,197,94,0.15)" : isLoss ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}`,
                          }}
                        >
                          {label}
                          <span style={{ fontSize: 9, opacity: 0.5 }}>{raw !== label ? raw : ""}</span>
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(tx.buy_price, currency)}
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "monospace", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(tx.sell_price, currency)}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: isProfit ? "#22c55e" : isLoss ? "#ef4444" : "var(--text-muted)",
                          textShadow: (isProfit || isLoss) ? `0 0 12px ${rowAccent}30` : undefined,
                        }}
                      >
                        {formatPnl(tx.profit_loss)}
                      </td>
                    </tr>
                  );
                })}
                {loading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} style={{ padding: "12px 20px" }}>
                          <div
                            style={{
                              height: 16,
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.04)",
                              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ padding: "14px 20px", display: "flex", justifyContent: "center", borderTop: "1px solid var(--border)" }}>
              <Button variant="ghost" size="sm" loading={loading} onClick={onLoadMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
