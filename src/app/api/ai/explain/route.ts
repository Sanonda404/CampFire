import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { aiConfigured, callAI } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  if (!token) return NextResponse.json({ error: "Missing participant token." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { challengeId?: string } | null;
  if (!body?.challengeId)
    return NextResponse.json({ error: "challengeId is required." }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: challenge } = await admin
    .from("challenges")
    .select("*")
    .eq("id", body.challengeId)
    .maybeSingle();
  if (!challenge) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });

  const { data: participants } = await admin
    .from("participants")
    .select("token, name")
    .eq("room_id", challenge.room_id);
  const nameByToken = new Map((participants ?? []).map((p) => [p.token, p.name]));

  const { data: submissions } = await admin
    .from("submissions")
    .select("participant_token, answer, reasoning")
    .eq("challenge_id", challenge.id);

  const { data: conclusion } = await admin
    .from("conclusions")
    .select("final_answer")
    .eq("challenge_id", challenge.id)
    .maybeSingle();

  let explanation =
    "Here is where the group landed: the individual answers above each held a piece of the picture, and the shared conclusion pulled them into one direction. Sit with what surprised you — that's usually where the next spark hides.";

  if (aiConfigured()) {
    try {
      const answersBlock = (submissions ?? [])
        .map(
          (s, i) =>
            `${i + 1}. ${nameByToken.get(s.participant_token) ?? "Someone"}: "${s.answer}"${
              s.reasoning ? ` (because: ${s.reasoning})` : ""
            }`
        )
        .join("\n");

      const text = await callAI([
        {
          role: "system",
          content:
            "You facilitate reflection for small co-working groups. Given a challenge question, individual anonymous-ish answers and the group's shared conclusion, write a warm, specific 3-5 sentence explanation of what the group figured out together, one pattern you noticed across answers, and one pointed suggestion for what to explore next. Plain prose, no headings, no bullet lists.",
        },
        {
          role: "user",
          content: `Challenge: ${challenge.question}\n\nIndividual answers:\n${
            answersBlock || "(no individual answers were recorded)"
          }\n\nGroup conclusion: ${conclusion?.final_answer ?? "(none recorded)"}`,
        },
      ]);
      explanation = text;
    } catch {
      // keep fallback explanation
    }
  }

  const { error } = await admin
    .from("conclusions")
    .update({ ai_explanation: explanation })
    .eq("challenge_id", challenge.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ explanation });
}
