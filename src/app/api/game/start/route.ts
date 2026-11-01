import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { aiConfigured, callAI } from "@/lib/ai";
import { getParticipant, loadRoomContext } from "@/lib/server-game";
import { PREDEFINED_CHALLENGES, FALLBACK_CHALLENGE } from "@/lib/activities";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  if (!token) return NextResponse.json({ error: "Missing participant token." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { roomCode?: string } | null;
  if (!body?.roomCode) return NextResponse.json({ error: "roomCode is required." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").ilike("code", body.roomCode).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const participant = await getParticipant(admin, room.id, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });
  if (!participant.is_host) return NextResponse.json({ error: "Only the host can start." }, { status: 403 });

  const ctx = await loadRoomContext(room.id);
  if (!ctx) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  let question = "";
  let context = "";
  let aiGenerated = false;

  if (aiConfigured()) {
    try {
      const text = await callAI([
        {
          role: "system",
          content:
            "You write scenarios for an idea clash: two teams get the same problem and compete on the best pitch. Reply in exactly two lines: first line is the challenge question (max 140 chars), second line starts with 'Context: ' and gives one sentence of framing (max 140 chars). No other text.",
        },
        {
          role: "user",
          content: `Room name: ${room.name}. ${room.description ? `Room description: ${room.description}.` : ""} Write one fresh challenge.`,
        },
      ]);
      const [qLine, cLine] = text.split("\n").filter(Boolean);
      question = (qLine ?? "").replace(/^question:\s*/i, "").trim();
      context = (cLine ?? "").replace(/^context:\s*/i, "").trim();
      aiGenerated = question.length > 5;
    } catch {
      aiGenerated = false;
    }
  }

  if (!aiGenerated) {
    const pool = PREDEFINED_CHALLENGES[room.activity_type] ?? [];
    const fallback = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : FALLBACK_CHALLENGE;
    question = fallback.question;
    context = fallback.context;
  }

  const { data: started, error } = await admin.rpc("start_game", {
    p_room: room.id,
    p_question: question,
    p_context: context,
  });

  if (error) {
    const msg = error.message || "";
    const status = msg.startsWith("PARTICIPANT_COUNT") || msg === "NOT_ALL_READY" ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ room: started, aiGenerated });
}
