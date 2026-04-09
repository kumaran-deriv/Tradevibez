"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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

function parseContractType(shortcode: string): string {
  // shortcode format: "CALL_R_100_..." or "PUT_1HZ100V_..."
  const parts = shortcode.split("_");
  return parts[0] || shortcode;
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
    <Card>
      <CardHeader
        title={`Trade History (${transactions.length})`}
        action={
          <button
            onClick={onRefresh}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Refresh history"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading && transactions.length === 0 ? "animate-spin" : ""}`} />
          </button>
        }
      />

      {transactions.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <History className="h-8 w-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">No completed trades yet</p>
          <p className="text-xs text-gray-600 mt-1">Your trade history will appear here</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left py-2 pr-4 font-medium">Date</th>
                  <th className="text-left py-2 pr-4 font-medium">Type</th>
                  <th className="text-right py-2 pr-4 font-medium">Buy</th>
                  <th className="text-right py-2 pr-4 font-medium">Sell</th>
                  <th className="text-right py-2 font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isProfit = tx.profit_loss > 0;
                  const contractType = parseContractType(tx.shortcode);

                  return (
                    <tr
                      key={tx.transaction_id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-xs text-gray-400">
                        {formatDateTime(tx.sell_time)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={isProfit ? "profit" : "loss"}>
                          {contractType}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-gray-300">
                        {formatCurrency(tx.buy_price, currency)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-gray-300">
                        {formatCurrency(tx.sell_price, currency)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono font-semibold tabular-nums ${
                          isProfit ? "text-emerald-400" : tx.profit_loss < 0 ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        {formatPnl(tx.profit_loss)}
                      </td>
                    </tr>
                  );
                })}
                {loading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b border-gray-800/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-2.5 pr-4">
                          <div className="h-4 bg-gray-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                loading={loading}
                onClick={onLoadMore}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
