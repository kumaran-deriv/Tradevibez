"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DerivWebSocket } from "@/lib/deriv-ws";
import { useAuth } from "@/context/AuthContext";

type WsStatus = "connecting" | "connected" | "disconnected";

interface WebSocketContextValue {
  ws: DerivWebSocket | null;
  status: WsStatus;
  authWs: DerivWebSocket | null;
  authStatus: WsStatus;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  ws: null,
  status: "disconnected",
  authWs: null,
  authStatus: "disconnected",
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken, activeAccount } = useAuth();

  // Public WS
  const wsRef = useRef<DerivWebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>("disconnected");

  // Authenticated WS
  const authWsRef = useRef<DerivWebSocket | null>(null);
  const [authStatus, setAuthStatus] = useState<WsStatus>("disconnected");
  const otpFetchedFor = useRef<string | null>(null);

  // Public WS — always connected
  useEffect(() => {
    const ws = new DerivWebSocket();
    ws.onStatusChange = setStatus;
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, []);

  // Authenticated WS — connect when we have token + account
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !activeAccount) {
      // Tear down auth WS if we log out
      if (authWsRef.current) {
        authWsRef.current.destroy();
        authWsRef.current = null;
        setAuthStatus("disconnected");
        otpFetchedFor.current = null;
      }
      return;
    }

    const accountKey = `${activeAccount.account_id}:${accessToken}`;
    // Skip if already connected for this account
    if (otpFetchedFor.current === accountKey && authWsRef.current) return;

    // Clean up previous auth WS
    if (authWsRef.current) {
      authWsRef.current.destroy();
      authWsRef.current = null;
    }

    let cancelled = false;

    async function connectAuthWs() {
      try {
        setAuthStatus("connecting");

        // Fetch OTP from our API route
        const res = await fetch("/api/deriv/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: activeAccount!.account_id,
            access_token: accessToken,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          console.error("OTP fetch failed:", data.error?.message);
          setAuthStatus("disconnected");
          return;
        }

        if (cancelled) return;

        const wsUrl = data.url as string;
        otpFetchedFor.current = accountKey;

        const aws = new DerivWebSocket(wsUrl);
        aws.onStatusChange = setAuthStatus;
        aws.connect();
        authWsRef.current = aws;
      } catch (err) {
        console.error("Auth WS connection failed:", err);
        setAuthStatus("disconnected");
      }
    }

    connectAuthWs();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, activeAccount]);

  // Cleanup auth WS on unmount
  useEffect(() => {
    return () => {
      authWsRef.current?.destroy();
      authWsRef.current = null;
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        ws: wsRef.current,
        status,
        authWs: authWsRef.current,
        authStatus,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWs(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
