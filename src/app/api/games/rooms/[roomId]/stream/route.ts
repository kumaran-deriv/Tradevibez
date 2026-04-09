import { getRoom } from "@/lib/redis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const poll = async () => {
        if (closed) return;
        try {
          const room = await getRoom(roomId);

          if (!room) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "room_not_found" })}\n\n`)
            );
            closed = true;
            controller.close();
            return;
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(room)}\n\n`)
          );

          if (room.status === "complete") {
            closed = true;
            controller.close();
            return;
          }

          // Poll again in 1 second
          setTimeout(poll, 1000);
        } catch {
          if (!closed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "poll_failed" })}\n\n`)
            );
            closed = true;
            controller.close();
          }
        }
      };

      // Initial send + start polling
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
