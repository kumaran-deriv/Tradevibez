"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  History,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { useSidebar } from "@/context/SidebarContext";

const iconMap = {
  LayoutDashboard,
  TrendingUp,
  History,
  Gamepad2,
} as const;

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center gap-2 px-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Zap className="h-5 w-5 shrink-0" style={{ color: "var(--accent)" }} />
        {!collapsed && (
          <span className="font-display text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            TradeVibez
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                collapsed ? "justify-center" : ""
              }`}
              style={
                isActive
                  ? { background: "var(--accent-glow)", color: "var(--accent)" }
                  : { color: "var(--text-secondary)" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-hover)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center rounded-md p-2 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
