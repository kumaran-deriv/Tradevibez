import { NextRequest, NextResponse } from "next/server";
import { createRoom, type GameRoom, type RoomPlayer } from "@/lib/redis";
import { randomBytes } from "crypto";

function generateRoomId(): string {
  return randomBytes(6).toString("hex");
}

function generateCode(): string {
  // 4 uppercase alphanumeric, easy to type
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      playerId: string;
      playerName?: string;
      symbol?: string;
      ticksPerRound?: number;
    };

    const { playerId, playerName = "Player 1", symbol = "R_100", ticksPerRound = 10 } = body;

    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }

    const p1: RoomPlayer = {
      id: playerId,
      name: playerName,
      side: "bull",
      stake: 10,
      ready: false,
    };

    const room: GameRoom = {
      id: generateRoomId(),
      code: generateCode(),
      symbol,
      ticksPerRound,
      status: "waiting",
      players: { p1, p2: null },
      startAt: null,
      createdAt: Date.now(),
    };

    await createRoom(room);

    return NextResponse.json({ roomId: room.id, code: room.code });
  } catch (err) {
    console.error("Create room error:", err);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
