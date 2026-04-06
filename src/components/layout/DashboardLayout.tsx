"use client";

import { type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <Header />

      <main className="ml-60 pt-16 transition-[margin-left] duration-200">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
