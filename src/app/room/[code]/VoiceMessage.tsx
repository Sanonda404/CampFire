"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "idle" | "recording" | "sending" | "error";

// Team-chat voice message: records locally, finalizes server-side
// (STT -> polish -> TTS -> private bucket) and posts one chat row.
export function VoiceMessage({
  roomId,
  teamId,
  onSent,
}: {
  roomId: string;
  teamId: string;
  onSent: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void send(blob);
      };

      recorder.start();
      setStage("recording");
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        if (Date.now() - startedAtRef.current >= 120_000) stop();
      }, 250);
    } catch {
      setError("Microphone unavailable.");
      setStage("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  const send = useCallback(
    async (blob: Blob) => {
      setStage("sending");
      const durationMs = Math.max(1, Date.now() - startedAtRef.current);
      try {
        const form = new FormData();
        form.append("roomId", roomId);
        form.append("teamId", teamIdRef.current);
        form.append("clientId", clientId);
        form.append("durationMs", String(durationMs));
        form.append("audio", blob, "voice.webm");
        const res = await fetch("/api/voice/finalize", {
          method: "POST",
          headers: { "x-participant-token": localStorage.getItem("campfire_token") ?? "" },
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "VOICE_FAILED");
        }
        setStage("idle");
        setClientId(crypto.randomUUID());
        onSent();
      } catch (e) {
        setError(e instanceof Error ? e.message : "VOICE_FAILED");
        setStage("error");
      }
    },
    [roomId, clientId, onSent]
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={stage === "recording" ? stop : start}
        disabled={stage === "sending"}
        className={cn(
          "shrink-0 rounded-xl px-3 py-2 transition-opacity hover:opacity-85 disabled:opacity-40 cursor-pointer",
          stage === "recording" ? "bg-rose-400 text-night" : "bg-ember text-night"
        )}
        aria-label={stage === "recording" ? "Stop recording and send" : "Record a voice message"}
      >
        {stage === "recording" ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
      </button>
      {stage === "recording" && (
        <span className="font-mono text-[10px] text-rose-300">{seconds}s — tap to send</span>
      )}
      {stage === "sending" && <span className="text-[10px] text-muted">Processing voice…</span>}
      {stage === "error" && <span className="text-[10px] text-rose-300">{error}</span>}
    </div>
  );
}

export function VoicePlayback({ roomId, path }: { roomId: string; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    if (url) {
      void audioRef.current?.play();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/playback?path=${encodeURIComponent(path)}`, {
        headers: { "x-participant-token": localStorage.getItem("campfire_token") ?? "" },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "PLAYBACK_FAILED");
      setUrl(data.url);
      const el = audioRef.current;
      if (el) {
        el.src = data.url;
        void el.play().catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "PLAYBACK_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="mt-1 flex items-center gap-2">
      <button
        type="button"
        onClick={() => void play()}
        disabled={busy}
        className="rounded-lg border border-line bg-night-soft px-2 py-1 text-xs text-cream transition-opacity hover:opacity-85 disabled:opacity-40 cursor-pointer"
        aria-label="Play voice message"
      >
        {busy ? "…" : "▶ Play"}
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
      <audio ref={audioRef} hidden preload="none" />
    </span>
  );
}
