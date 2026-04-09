/**
 * Room store — in-memory implementation.
 * Used by the room-based API routes (legacy path).
 * For the active multiplayer flow, the app uses URL-based epoch sync instead
 * (see GameLobby) — no server state required.
 */

export interface RoomPlayer {
  id: string;
  name: string;
  side: "bull" | "bear";
  stake: number;
  ready: boolean;
}

export type RoomStatus = "waiting" | "both_ready" | "live" | "complete";

export interface GameRoom {
  id: string;
  code: string;
  symbol: string;
  ticksPerRound: number;
  status: RoomStatus;
  players: {
    p1: RoomPlayer | null;
    p2: RoomPlayer | null;
  };
  startAt: number | null;
  createdAt: number;
}

/* ─── In-memory store ─────────────────────────────────────── */

const rooms = new Map<string, GameRoom>();
const codeIndex = new Map<string, string>(); // code → roomId

export async function createRoom(room: GameRoom): Promise<void> {
  rooms.set(room.id, room);
  codeIndex.set(room.code, room.id);
}

export async function getRoom(roomId: string): Promise<GameRoom | null> {
  return rooms.get(roomId) ?? null;
}

export async function getRoomByCode(code: string): Promise<GameRoom | null> {
  const roomId = codeIndex.get(code.toUpperCase());
  if (!roomId) return null;
  return rooms.get(roomId) ?? null;
}

export async function updateRoom(roomId: string, updates: Partial<GameRoom>): Promise<GameRoom | null> {
  const existing = rooms.get(roomId);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  rooms.set(roomId, updated);
  return updated;
}
