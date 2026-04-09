"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameRoom } from "@/lib/redis";

export type { GameRoom };

export function useGameRoom(roomId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const es = new EventSource(`/api/games/rooms/${roomId}/stream`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as GameRoom & { error?: string };
        if (data.error) {
          setError(data.error);
          es.close();
        } else {
          setRoom(data);
          setError(null);
        }
      } catch {
        setError("parse_error");
      }
    };

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [roomId]);

  return { room, connected, error };
}

/* ─── Room actions ───────────────────────────────────────── */

export function useRoomActions() {
  const createRoom = useCallback(async (params: {
    playerId: string;
    playerName?: string;
    symbol?: string;
    ticksPerRound?: number;
  }) => {
    const res = await fetch("/api/games/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    return res.json() as Promise<{ roomId: string; code: string }>;
  }, []);

  const joinRoom = useCallback(async (params: {
    code: string;
    playerId: string;
    playerName?: string;
  }) => {
    const res = await fetch("/api/games/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    return res.json() as Promise<{ roomId: string; room: GameRoom }>;
  }, []);

  const updatePlayer = useCallback(async (params: {
    roomId: string;
    playerId: string;
    ready?: boolean;
    side?: "bull" | "bear";
    stake?: number;
  }) => {
    const { roomId, ...body } = params;
    const res = await fetch(`/api/games/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    return res.json() as Promise<GameRoom>;
  }, []);

  return { createRoom, joinRoom, updatePlayer };
}
