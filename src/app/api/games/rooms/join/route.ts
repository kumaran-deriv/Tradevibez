import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, updateRoom, type RoomPlayer } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      code: string;
      playerId: string;
      playerName?: string;
    };

    const { code, playerId, playerName = "Player 2" } = body;

    if (!code || !playerId) {
      return NextResponse.json({ error: "code and playerId required" }, { status: 400 });
    }

    const room = await getRoomByCode(code.toUpperCase());
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.players.p2) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    if (room.players.p1?.id === playerId) {
      return NextResponse.json({ error: "Already in this room" }, { status: 400 });
    }

    const p2: RoomPlayer = {
      id: playerId,
      name: playerName,
      side: "bear", // P2 takes the opposite side by default
      stake: 10,
      ready: false,
    };

    room.players.p2 = p2;
    await updateRoom(room.id, room);

    return NextResponse.json({ roomId: room.id, room });
  } catch (err) {
    console.error("Join room error:", err);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
