import { NextRequest, NextResponse } from "next/server";
import { getParticipant, loadRoomContext } from "@/lib/server-game";
import { GAME_SECONDS } from "@/lib/game";

// Server-side proposal save. The client never writes team_proposals directly:
// membership, phase and the 15:00 lock are all enforced here against the server clock.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  if (!token) return NextResponse.json({ error: "Missing participant token." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { roomId?: string; content?: unknown } | null;
  if (!body?.roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  if (typeof body.content !== "string" && body.content !== null && typeof body.content !== "object") {
    return NextResponse.json({ error: "content must be a string or a section object." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content : JSON.stringify(body.content ?? {});
  if (content.length > 20000) return NextResponse.json({ error: "Proposal too long." }, { status: 413 });

  const ctx = await loadRoomContext(body.roomId);
  if (!ctx) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const participant = await getParticipant(ctx.admin, ctx.room.id, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  if (!ctx.room.game_started_at || !ctx.challenge) {
    return NextResponse.json({ error: "Game has not started." }, { status: 409 });
  }
  if (ctx.elapsed >= GAME_SECONDS) {
    return NextResponse.json({ error: "SUBMISSION_CLOSED" }, { status: 409 });
  }

  const { data: membership } = await ctx.admin
    .from("team_members")
    .select("team_id")
    .eq("participant_id", participant.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not on a team." }, { status: 403 });

  const { data: existing } = await ctx.admin
    .from("team_proposals")
    .select("*")
    .eq("challenge_id", ctx.challenge.id)
    .eq("team_id", membership.team_id)
    .maybeSingle();

  if (existing && (existing.submitted_at || existing.locked_at)) {
    return NextResponse.json({ error: "PROPOSAL_LOCKED" }, { status: 409 });
  }

  const { data: proposal, error } = await ctx.admin
    .from("team_proposals")
    .upsert(
      {
        challenge_id: ctx.challenge.id,
        team_id: membership.team_id,
        content,
        last_edited_by: participant.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "challenge_id,team_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!existing || existing.content !== content) {
    await ctx.admin.from("proposal_revisions").insert({
      proposal_id: (proposal as { id: string }).id,
      editor_participant_id: participant.id,
      content,
    });
  }

  return NextResponse.json({ proposal });
}
