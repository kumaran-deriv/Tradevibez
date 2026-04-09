"use client";

import { useState } from "react";
import { Wallet, User, LogIn, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { formatCurrency } from "@/utils/formatters";

export function Header() {
  const { isAuthenticated, activeAccount, accounts, loading, login, logout, setActiveAccount } =
    useAuth();
  const { collapsed } = useSidebar();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <header
      className={`fixed top-0 ${collapsed ? "left-16" : "left-60"} right-0 z-30 flex h-16 items-center justify-between px-6 transition-[left] duration-200`}
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Left: Connection status */}
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: "#34d399" }}
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Live
        </span>
      </div>

      {/* Right: Theme toggle + Account section */}
      <div className="flex items-center gap-3">
        <ThemeToggle variant="icon" />
        {loading ? (
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-8 w-32 rounded-md" style={{ background: "var(--bg-hover)" }} />
            <div className="h-8 w-8 rounded-md" style={{ background: "var(--bg-hover)" }} />
          </div>
        ) : isAuthenticated && activeAccount ? (
          <>
            {/* Balance */}
            <div
              className="flex items-center gap-2 rounded-md px-3 py-1.5 border"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <Wallet className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
              <span
                className="text-sm font-mono font-medium tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
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
                className="flex items-center gap-1.5 rounded-md p-2 transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "")
                }
              >
                <User className="h-4 w-4" />
                <span className="text-xs font-mono">{activeAccount.account_id}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border p-2 shadow-xl"
                    style={{ background: "var(--bg-card)", borderColor: "var(--border-strong)" }}
                  >
                    {accounts.map((acc) => (
                      <button
                        key={acc.account_id}
                        onClick={() => {
                          setActiveAccount(acc);
                          setShowAccountMenu(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
                        style={
                          acc.account_id === activeAccount.account_id
                            ? { background: "var(--accent-glow)", color: "var(--accent)" }
                            : { color: "var(--text-secondary)" }
                        }
                        onMouseEnter={(e) => {
                          if (acc.account_id !== activeAccount.account_id) {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "var(--bg-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (acc.account_id !== activeAccount.account_id) {
                            (e.currentTarget as HTMLButtonElement).style.background = "";
                          }
                        }}
                      >
                        <div>
                          <p className="font-medium font-mono text-xs">{acc.account_id}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatCurrency(acc.balance, acc.currency)}
                          </p>
                        </div>
                        <Badge variant={acc.account_type === "demo" ? "info" : "profit"}>
                          {acc.account_type}
                        </Badge>
                      </button>
                    ))}

                    <div className="my-1.5 border-t" style={{ borderColor: "var(--border)" }} />
                    <button
                      onClick={() => {
                        logout();
                        setShowAccountMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
                      style={{ color: "#f87171" }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background =
                          "rgba(239,68,68,0.08)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "")
                      }
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
