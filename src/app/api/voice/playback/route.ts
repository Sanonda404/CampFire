import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getParticipant } from "@/lib/server-game";

// Short-lived signed URLs for voice playback; only room participants may obtain one.
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const roomId = path.split("/")[0];
  if (!roomId) return NextResponse.json({ error: "Invalid path." }, { status: 400 });

  const participant = await getParticipant(admin, roomId, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  const { data, error } = await admin.storage
    .from("voice-messages")
    .createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "SIGN_FAILED" }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
