"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TradeStats } from "@/components/history/TradeStats";
import { TradeHistoryTable } from "@/components/history/TradeHistoryTable";
import { useProfitTable } from "@/hooks/useProfitTable";
import { useAuth } from "@/context/AuthContext";
import { Lock } from "lucide-react";

export default function HistoryPage() {
  const { isAuthenticated, activeAccount, login } = useAuth();
  const currency = activeAccount?.currency || "USD";
  const { transactions, loading, error, loadMore, refresh, hasMore } =
    useProfitTable(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Trade History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review past trades and track your performance
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Trade History</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review past trades and track your performance
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPI Summary */}
      <div className="mb-4">
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
