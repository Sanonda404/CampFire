const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const EDGE_TTS_VOICE = "en-US-AndrewMultilingualNeural";

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function transcribeAudio(file: Blob, filename: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_NOT_CONFIGURED");

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "json");

  const res = await fetch(GROQ_STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`GROQ_ERROR ${res.status}`);
  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim();
  if (!text) throw new Error("TRANSCRIPTION_EMPTY");
  return text;
}

const POLISH_SYSTEM = `You rewrite spoken transcripts for playback in the speaker's own conversation.
- Remove filler words (uh, umm, ahh, like, you know), stutters and false starts.
- Fix grammar while keeping the speaker's meaning and tone.
- Correct factual mistakes and misinformation; state the accurate fact plainly.
- Tighten rambling into a clear, brief version of the same thought.
- Keep it in the same language the speaker used.
- Plain prose only: no headings, no bullet lists, no quotes around the result, no commentary about the edits.`;

export async function polishText(text: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_NOT_CONFIGURED");

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: POLISH_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`GEMINI_ERROR ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const polished = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!polished) throw new Error("POLISH_EMPTY");
  return polished;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");

  const tts = new MsEdgeTTS();
  await tts.setMetadata(EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text.slice(0, 3000));

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) chunks.push(Buffer.from(chunk));
  const audio = Buffer.concat(chunks);
  if (audio.length === 0) throw new Error("TTS_EMPTY");
  return audio;
}
