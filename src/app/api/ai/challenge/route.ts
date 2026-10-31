import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { aiConfigured, callAI } from "@/lib/ai";
import { PREDEFINED_CHALLENGES, FALLBACK_CHALLENGE, activityLabel } from "@/lib/activities";

function pickPredefined(activity: string) {
  const pool = PREDEFINED_CHALLENGES[activity] ?? [];
  if (pool.length === 0) return FALLBACK_CHALLENGE;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  if (!token) return NextResponse.json({ error: "Missing participant token." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { roomId?: string } | null;
  if (!body?.roomId) return NextResponse.json({ error: "roomId is required." }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: room } = await admin.from("rooms").select("*").eq("id", body.roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const { data: participant } = await admin
    .from("participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("token", token)
    .maybeSingle();
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  let question = "";
  let context = "";
  let aiGenerated = false;

  if (aiConfigured()) {
    try {
      const text = await callAI([
        {
          role: "system",
          content:
            "You write short, thoughtful group challenges for a co-working session. Reply in exactly two lines: first line is the challenge question (max 140 chars), second line starts with 'Context: ' and gives one sentence of guidance (max 120 chars). No other text.",
        },
        {
          role: "user",
          content: `Activity type: ${activityLabel(room.activity_type)}. Room name: ${room.name}. ${
            room.description ? `Room description: ${room.description}.` : ""
          } Write one fresh challenge for the group.`,
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
    const fallback = pickPredefined(room.activity_type);
    question = fallback.question;
    context = fallback.context;
  }

  const { data: challenge, error } = await admin
    .from("challenges")
    .insert({ room_id: room.id, question, context, status: "thinking", ai_generated: aiGenerated })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("rooms").update({ current_challenge_id: challenge.id }).eq("id", room.id);

  return NextResponse.json({ challenge });
}
