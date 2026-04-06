"use client";

import { useState } from "react";
import { Wallet, User, LogIn, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/utils/formatters";

export function Header() {
  const { isAuthenticated, activeAccount, accounts, loading, login, logout, setActiveAccount } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <header className="fixed top-0 left-60 right-0 z-30 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm px-6">
      {/* Left: Connection status */}
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-gray-500">Live</span>
      </div>

      {/* Right: Account section */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-8 w-32 rounded-lg bg-gray-800" />
            <div className="h-8 w-8 rounded-lg bg-gray-800" />
          </div>
        ) : isAuthenticated && activeAccount ? (
          <>
            {/* Balance */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-800 px-3 py-1.5">
              <Wallet className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-mono font-medium text-white tabular-nums">
                {formatCurrency(activeAccount.balance, activeAccount.currency)}
              </span>
              <Badge variant={activeAccount.account_type === "demo" ? "info" : "profit"}>
                {activeAccount.account_type === "demo" ? "Demo" : "Real"}
              </Badge>
            </div>

            {/* Account Menu */}
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-1.5 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <User className="h-4 w-4" />
                <span className="text-xs">{activeAccount.account_id}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-gray-800 bg-gray-900 p-2 shadow-xl">
                    {/* Account list */}
                    {accounts.map((acc) => (
                      <button
                        key={acc.account_id}
                        onClick={() => {
                          setActiveAccount(acc);
                          setShowAccountMenu(false);
                        }}
                        className={`
                          flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors
                          ${acc.account_id === activeAccount.account_id
                            ? "bg-blue-600/10 text-blue-400"
                            : "text-gray-300 hover:bg-gray-800"
                          }
                        `}
                      >
                        <div>
                          <p className="font-medium">{acc.account_id}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(acc.balance, acc.currency)}
                          </p>
                        </div>
                        <Badge variant={acc.account_type === "demo" ? "info" : "profit"}>
                          {acc.account_type}
                        </Badge>
                      </button>
                    ))}

                    {/* Divider + Logout */}
                    <div className="my-1.5 border-t border-gray-800" />
                    <button
                      onClick={() => {
                        logout();
                        setShowAccountMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={login}>
            <LogIn className="h-4 w-4" />
            Login with Deriv
          </Button>
        )}
      </div>
    </header>
  );
}
