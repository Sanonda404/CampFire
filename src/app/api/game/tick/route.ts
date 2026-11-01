import { NextRequest, NextResponse } from "next/server";
import { getParticipant, loadRoomContext, runJudging, generatePlotTwist } from "@/lib/server-game";

// Deterministic phase transitions, driven by the server-stored clock. Clients poll this
// (or call it when the UI clock crosses a boundary); every transition is idempotent.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  const body = (await req.json().catch(() => null)) as { roomId?: string } | null;
  if (!body?.roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });

  const ctx = await loadRoomContext(body.roomId);
  if (!ctx) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const participant = await getParticipant(ctx.admin, ctx.room.id, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  const { admin, room, challenge, elapsed } = ctx;
  if (!room.game_started_at || !challenge) {
    return NextResponse.json({ phase: "lobby", room, challenge });
  }

  const errors: string[] = [];

  if (elapsed >= 180 && challenge.status === "thinking") {
    const { error } = await admin.rpc("reveal_ideas", { p_room: room.id });
    if (error) errors.push(error.message);
  }

  if (elapsed >= 420 && challenge.plot_twist === null) {
    const twist = await generatePlotTwist(challenge.question);
    const { error } = await admin.rpc("apply_plot_twist", { p_room: room.id, p_twist: twist });
    if (error) errors.push(error.message);
  }

  if (elapsed >= 900 && !challenge.submissions_locked_at) {
    const { error } = await admin.rpc("lock_proposals", { p_room: room.id });
    if (error) {
      errors.push(error.message);
    } else {
      const fresh = await loadRoomContext(room.id);
      if (fresh) {
        const outcome = await runJudging(fresh);
        if (!outcome.ok && outcome.error) errors.push(outcome.error);
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  const fresh = await loadRoomContext(room.id);
  return NextResponse.json({
    phase: fresh?.phase ?? ctx.phase,
    room: fresh?.room ?? room,
    challenge: fresh?.challenge ?? challenge,
  });
}
