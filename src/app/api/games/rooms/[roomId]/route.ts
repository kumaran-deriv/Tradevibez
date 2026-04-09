import { NextRequest, NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/redis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    return NextResponse.json(room);
  } catch (err) {
    console.error("Get room error:", err);
    return NextResponse.json({ error: "Failed to get room" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await req.json() as {
      playerId: string;
      ready?: boolean;
      side?: "bull" | "bear";
      stake?: number;
    };

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const isP1 = room.players.p1?.id === body.playerId;
    const isP2 = room.players.p2?.id === body.playerId;

    if (!isP1 && !isP2) {
      return NextResponse.json({ error: "Player not in room" }, { status: 403 });
    }

    const playerKey = isP1 ? "p1" : "p2";
    const player = room.players[playerKey];
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 400 });

    if (body.ready !== undefined) player.ready = body.ready;
    if (body.side !== undefined) player.side = body.side;
    if (body.stake !== undefined) player.stake = body.stake;

    // Check if both ready
    if (room.players.p1?.ready && room.players.p2?.ready) {
      room.status = "both_ready";
      room.startAt = Date.now() + 3000; // 3-second countdown
    } else if (room.status === "both_ready") {
      room.status = "waiting";
    }

    await updateRoom(room.id, room);
    return NextResponse.json(room);
  } catch (err) {
    console.error("Patch room error:", err);
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
  }
}
