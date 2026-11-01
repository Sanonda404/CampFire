import { NextRequest, NextResponse } from "next/server";
import { getParticipant, loadRoomContext, runJudging } from "@/lib/server-game";

// Runs the AI judging (idempotent) once proposals are locked, then resolves the winner.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  const body = (await req.json().catch(() => null)) as { roomId?: string } | null;
  if (!body?.roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });

  const ctx = await loadRoomContext(body.roomId);
  if (!ctx) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const participant = await getParticipant(ctx.admin, ctx.room.id, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  const outcome = await runJudging(ctx);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error ?? "JUDGING_FAILED", results: outcome.results }, { status: 502 });
  }

  const fresh = await loadRoomContext(ctx.room.id);
  return NextResponse.json({
    results: outcome.results,
    room: fresh?.room ?? ctx.room,
    challenge: fresh?.challenge ?? ctx.challenge,
  });
}
