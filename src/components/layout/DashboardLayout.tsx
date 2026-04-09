"use client";

import { type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

interface DashboardLayoutProps {
  children: ReactNode;
  noPadding?: boolean;
}

function DashboardLayoutInner({ children, noPadding }: DashboardLayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar />
      <Header />
      <main
        className={`${collapsed ? "ml-16" : "ml-60"} pt-16 transition-[margin-left] duration-200`}
      >
        {noPadding ? children : <div className="p-6">{children}</div>}
      </main>
    </div>
  );
}

export function DashboardLayout({ children, noPadding = false }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner noPadding={noPadding}>{children}</DashboardLayoutInner>
    </SidebarProvider>
  );
}
