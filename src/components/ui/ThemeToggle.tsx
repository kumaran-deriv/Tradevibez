"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  /** "pill" = floating pill with label (default), "icon" = compact icon-only button */
  variant?: "pill" | "icon";
}

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();

  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium border shadow-lg transition-all duration-200 hover:scale-105"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-strong)",
          color: "var(--text-secondary)",
        }}
      >
        {theme === "dark"
          ? <><Sun className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /><span>Light</span></>
          : <><Moon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /><span>Dark</span></>
        }
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="flex items-center justify-center w-8 h-8 rounded border transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {theme === "dark"
        ? <Sun className="h-3.5 w-3.5" />
        : <Moon className="h-3.5 w-3.5" />
      }
    </button>
  );
}
