import { NextRequest, NextResponse } from "next/server";
import { groqConfigured, transcribeAudio } from "@/lib/voice";

export async function POST(req: NextRequest) {
  if (!groqConfigured()) {
    return NextResponse.json({ error: "Speech-to-text is not configured (missing GROQ_API_KEY)." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required." }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(audio, "audio.webm");
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TRANSCRIBE_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
