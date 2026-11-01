import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { transcribeAudio, polishText, geminiConfigured } from "@/lib/voice";
import { getParticipant } from "@/lib/server-game";

// Voice team-chat finalize: the raw recording never goes to storage or other clients.
// Server-side: Groq STT -> Gemini polish -> edge-TTS synth -> PRIVATE bucket -> chat row
// referencing only the synthesized audio path. Playback uses short-lived signed URLs.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-participant-token");
  if (!token) return NextResponse.json({ error: "Missing participant token." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart/form-data required." }, { status: 400 });

  const roomId = String(form.get("roomId") ?? "");
  const teamId = String(form.get("teamId") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const durationRaw = Number(form.get("durationMs") ?? 0);
  const file = form.get("audio");

  if (!roomId || !teamId || !clientId) {
    return NextResponse.json({ error: "roomId, teamId and clientId are required." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "audio file is required." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Recording too large." }, { status: 413 });
  const durationMs = Number.isFinite(durationRaw) ? Math.min(Math.max(Math.round(durationRaw), 1), 120000) : null;

  const admin = getSupabaseAdmin();
  const participant = await getParticipant(admin, roomId, token);
  if (!participant) return NextResponse.json({ error: "Join the room first." }, { status: 403 });

  const { data: membership } = await admin
    .from("team_members")
    .select("team_id")
    .eq("participant_id", participant.id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "You are not on this team." }, { status: 403 });

  const { data: existing } = await admin
    .from("chat_messages")
    .select("id")
    .eq("room_id", roomId)
    .eq("client_message_id", clientId)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: (existing as { id: string }).id, deduplicated: true });

  let transcript: string;
  try {
    transcript = await transcribeAudio(file, file.name || "voice.webm");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TRANSCRIPTION_FAILED";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let polished = transcript;
  if (geminiConfigured()) {
    try {
      polished = await polishText(transcript);
    } catch {
      polished = transcript;
    }
  }

  const { synthesizeSpeech } = await import("@/lib/voice");
  let audio: Buffer;
  try {
    audio = await synthesizeSpeech(polished);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS_FAILED";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const path = `${roomId}/${clientId}.mp3`;
  const { error: uploadErr } = await admin.storage
    .from("voice-messages")
    .upload(path, new Uint8Array(audio), { contentType: "audio/mpeg", upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: message, error: insertErr } = await admin
    .from("chat_messages")
    .insert({
      room_id: roomId,
      participant_token: token,
      sender: participant.name,
      text: polished,
      team_id: teamId,
      message_type: "voice",
      transcript: polished,
      audio_storage_path: path,
      audio_duration_ms: durationMs,
      voice_status: "ready",
      client_message_id: clientId,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ message });
}
