"use client";

import Link from "next/link";
import { Zap, TrendingUp, BarChart3, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

const features = [
  {
    icon: TrendingUp,
    title: "Real-Time Trading",
    description: "Execute trades with live market data streaming via WebSocket",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description: "Track your performance with profit/loss dashboards and win rate metrics",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "AI-powered risk meter evaluates every trade before you commit",
  },
];

export default function LandingPage() {
  const { isAuthenticated, login, error } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-bold text-white tracking-tight">VibeTrader</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Explore Markets
            </Button>
          </Link>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Button variant="primary" size="sm" onClick={login}>
              Login with Deriv
            </Button>
          )}
        </div>
      </nav>

      {/* Auth Error */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 border border-blue-500/20 px-4 py-1.5 mb-6">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-blue-400">
              Powered by Deriv API V2
            </span>
          </div>

          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            Trade Smarter with{" "}
            <span className="text-blue-400">Real-Time Edge</span>
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-lg mx-auto">
            Live market data, instant trade execution, and AI-powered insights
            — all in one clean dashboard.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button variant="primary" size="lg">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {!isAuthenticated && (
              <Button variant="outline" size="lg" onClick={login}>
                Login to Trade
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left"
            >
              <feature.icon className="h-8 w-8 text-blue-400 mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-600">
          VibeTrader — Built with AI for the Deriv API Competition 2026
        </p>
      </footer>
    </div>
  );
}
