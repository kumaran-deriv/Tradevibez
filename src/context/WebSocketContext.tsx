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

type WsStatus = "connecting" | "connected" | "disconnected";

interface WebSocketContextValue {
  ws: DerivWebSocket | null;
  status: WsStatus;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  ws: null,
  status: "disconnected",
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<DerivWebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>("disconnected");

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

  return (
    <WebSocketContext.Provider value={{ ws: wsRef.current, status }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWs(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
