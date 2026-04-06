"use client";

import {
  DERIV_WS_PUBLIC,
  WS_PING_INTERVAL,
  WS_RECONNECT_BASE,
  WS_RECONNECT_MAX,
} from "@/lib/constants";

type MessageHandler = (data: Record<string, unknown>) => void;

export class DerivWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reqId = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = WS_RECONNECT_BASE;
  private handlers = new Map<number, MessageHandler>();
  private typeHandlers = new Map<string, Set<MessageHandler>>();
  private isDestroyed = false;
  private _onStatusChange: ((status: "connecting" | "connected" | "disconnected") => void) | null = null;

  constructor(url: string = DERIV_WS_PUBLIC) {
    this.url = url;
  }

  set onStatusChange(cb: ((status: "connecting" | "connected" | "disconnected") => void) | null) {
    this._onStatusChange = cb;
  }

  connect(): void {
    if (this.isDestroyed) return;
    this.cleanup();
    this._onStatusChange?.("connecting");

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = WS_RECONNECT_BASE;
      this._onStatusChange?.("connected");
      this.startPing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as Record<string, unknown>;

      // Route to req_id handler
      const reqId = data.req_id as number | undefined;
      if (reqId !== undefined && this.handlers.has(reqId)) {
        this.handlers.get(reqId)!(data);
      }

      // Route to msg_type handlers
      const msgType = data.msg_type as string | undefined;
      if (msgType && this.typeHandlers.has(msgType)) {
        for (const handler of this.typeHandlers.get(msgType)!) {
          handler(data);
        }
      }
    };

    this.ws.onclose = () => {
      this._onStatusChange?.("disconnected");
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send<T = unknown>(message: Record<string, unknown>, handler?: MessageHandler): number {
    const id = ++this.reqId;
    const payload = { ...message, req_id: id };

    if (handler) {
      this.handlers.set(id, handler);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }

    return id;
  }

  subscribe(msgType: string, handler: MessageHandler): () => void {
    if (!this.typeHandlers.has(msgType)) {
      this.typeHandlers.set(msgType, new Set());
    }
    this.typeHandlers.get(msgType)!.add(handler);

    return () => {
      this.typeHandlers.get(msgType)?.delete(handler);
    };
  }

  forget(subscriptionId: string): void {
    this.send({ forget: subscriptionId });
  }

  forgetAll(types: string[]): void {
    this.send({ forget_all: types });
  }

  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.handlers.clear();
    this.typeHandlers.clear();
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ ping: 1 });
    }, WS_PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX);
  }

  private cleanup(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
