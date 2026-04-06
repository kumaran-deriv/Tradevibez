"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { Activity, Lock } from "lucide-react";

export default function TradePage() {
  const { isAuthenticated, login } = useAuth();

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Trade</h1>
        <p className="text-sm text-gray-500 mt-1">
          Execute trades with real-time pricing
        </p>
      </div>

      {!isAuthenticated ? (
        <Card className="flex flex-col items-center justify-center py-20">
          <Lock className="h-12 w-12 text-gray-700 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Login Required</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm text-center">
            Connect your Deriv account to start trading with live market execution.
          </p>
          <Button variant="primary" onClick={login}>Login with Deriv</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-[520px] flex flex-col">
              <CardHeader title="Price Chart" />
              <div className="flex-1 flex items-center justify-center">
                <Activity className="h-12 w-12 text-gray-700" />
              </div>
            </Card>
          </div>
          <div>
            <Card className="h-[520px]">
              <CardHeader title="Trade Panel" />
              <p className="text-sm text-gray-500">Coming in Slice 4</p>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
