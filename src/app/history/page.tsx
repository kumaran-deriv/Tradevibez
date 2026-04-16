"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TradeStats } from "@/components/history/TradeStats";
import { TradeHistoryTable } from "@/components/history/TradeHistoryTable";
import { useProfitTable } from "@/hooks/useProfitTable";
import { useAuth } from "@/context/AuthContext";
import { Lock, BarChart3 } from "lucide-react";

export default function HistoryPage() {
  const { isAuthenticated, activeAccount, login } = useAuth();
  const currency = activeAccount?.currency || "USD";
  const { transactions, loading, error, loadMore, refresh, hasMore } =
    useProfitTable(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <BarChart3 style={{ width: 22, height: 22, color: "var(--accent)", filter: "drop-shadow(0 0 8px rgba(20,184,166,0.5))" }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Trade History</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, paddingLeft: 32 }}>
            Performance analytics &middot; Powered by your Deriv trades
          </p>
        </div>
        <Card className="flex flex-col items-center justify-center py-20">
          <Lock className="h-12 w-12 text-gray-700 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Login Required</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm text-center">
            Connect your Deriv account to view your trade history and analytics.
          </p>
          <Button variant="primary" onClick={login}>Login with Deriv</Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <BarChart3 style={{ width: 22, height: 22, color: "var(--accent)", filter: "drop-shadow(0 0 8px rgba(20,184,166,0.5))" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Trade History</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, paddingLeft: 32 }}>
          Performance analytics &middot; Powered by your Deriv trades
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            padding: "12px 16px",
            fontSize: 13,
            color: "#ef4444",
            fontFamily: "monospace",
          }}
        >
          {error}
        </div>
      )}

      {/* KPI Summary */}
      <div style={{ marginBottom: 16 }}>
        <TradeStats transactions={transactions} currency={currency} />
      </div>

      {/* Trade History Table */}
      <TradeHistoryTable
        transactions={transactions}
        loading={loading}
        hasMore={hasMore}
        currency={currency}
        onLoadMore={loadMore}
        onRefresh={refresh}
      />
    </DashboardLayout>
  );
}
