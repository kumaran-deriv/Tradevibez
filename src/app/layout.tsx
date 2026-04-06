import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeTrader — Smart Trading Platform",
  description: "Real-time trading platform powered by Deriv API V2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WebSocketProvider>
          <AuthProvider>{children}</AuthProvider>
        </WebSocketProvider>
      </body>
    </html>
  );
}
