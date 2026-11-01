import { NextRequest, NextResponse } from "next/server";
import { geminiConfigured, polishText } from "@/lib/voice";

export async function POST(req: NextRequest) {
  if (!geminiConfigured()) {
    return NextResponse.json({ error: "Polishing is not configured (missing GEMINI_API_KEY)." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "text is required." }, { status: 400 });

  try {
    const polished = await polishText(text);
    return NextResponse.json({ text: polished });
  } catch (e) {
    const message = e instanceof Error ? e.message : "POLISH_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
