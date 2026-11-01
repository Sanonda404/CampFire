import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "text is required." }, { status: 400 });

  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
