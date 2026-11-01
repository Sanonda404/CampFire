import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { aiConfigured, callAI } from "@/lib/ai";
import { PREDEFINED_CHALLENGES, FALLBACK_CHALLENGE, activityLabel } from "@/lib/activities";
import { CHALLENGE_GENERATE_PROMPT } from "@/lib/data";

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
          content: CHALLENGE_GENERATE_PROMPT,
        },
        {
          role: "user",
          content: `Activity type: ${activityLabel(room.activity_type)}. Room name: ${room.name}. ${
            room.description ? `Room description: ${room.description}.` : ""
          } Write one fresh challenge for the group.`,
        },
      ]);

      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const [qLine, cLine] = lines;

      const parsedQuestion = (qLine ?? "")
        .replace(/^question:\s*/i, "")
        .trim();

      const parsedContext = (cLine ?? "")
        .replace(/^context:\s*/i, "")
        .trim();

      if (
        parsedQuestion.length > 5 &&
        /^context:\s*/i.test(cLine ?? "") &&
        parsedContext.length > 0 &&
        lines.length === 2
      ) {
        question = parsedQuestion;
        context = parsedContext;
        aiGenerated = true;
      }
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
