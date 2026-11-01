"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceMode = "normal" | "polished";
type Stage = "idle" | "recording" | "transcribing" | "polishing" | "speaking";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  recording: "Listening… tap the mic to finish.",
  transcribing: "Transcribing your voice…",
  polishing: "Polishing what you said…",
  speaking: "Playing it back…",
};

export function VoicePanel() {
  const [mode, setMode] = useState<VoiceMode>("normal");
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cleanupStream();
      audioRef.current?.pause();
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    },
    [cleanupStream]
  );

  const playAudio = useCallback((blob: Blob) => {
    audioRef.current?.pause();
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audioRef.current = el;
    el.onended = () => {
      setStage("idle");
      URL.revokeObjectURL(url);
    };
    el.onerror = () => setStage("idle");
    void el.play().catch(() => setStage("idle"));
  }, []);

  const speak = useCallback(
    async (text: string) => {
      setStage("speaking");
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not generate the voice.");
      }
      playAudio(await res.blob());
    },
    [playAudio]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript(null);
    setSpoken(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1000) {
          setStage("idle");
          setError("That was too quiet to catch — try again.");
          return;
        }
        try {
          setStage("transcribing");
          const form = new FormData();
          form.append("audio", blob, "audio.webm");
          const tRes = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const tData = (await tRes.json().catch(() => ({}))) as { text?: string; error?: string };
          if (!tRes.ok || !tData.text) throw new Error(tData.error ?? "Could not hear what you said.");
          setTranscript(tData.text);

          let finalText = tData.text;
          if (mode === "polished") {
            setStage("polishing");
            const pRes = await fetch("/api/voice/polish", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: tData.text }),
            });
            const pData = (await pRes.json().catch(() => ({}))) as { text?: string; error?: string };
            if (!pRes.ok || !pData.text) throw new Error(pData.error ?? "Could not polish what you said.");
            finalText = pData.text;
            setSpoken(finalText);
          }

          await speak(finalText);
        } catch (e) {
          setStage("idle");
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      };

      recorder.start();
      setStage("recording");
    } catch {
      setError("Microphone access is needed for voice mode.");
      setStage("idle");
    }
  }, [mode, speak, cleanupStream]);

  const busy = stage !== "idle" && stage !== "recording";
  const recording = stage === "recording";

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-line bg-night-soft/60 p-4"
      aria-label="Voice mode"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Voice</h2>
        <div
          role="radiogroup"
          aria-label="Voice mode"
          className="flex rounded-xl border border-line bg-night p-0.5"
        >
          {(["normal", "polished"] as VoiceMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={busy || recording}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50",
                mode === m ? "bg-ember text-night" : "text-muted hover:text-cream"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        {mode === "normal"
          ? "Say it, hear it back in a clear AI voice — exactly your words."
          : "Say it messy — fillers removed, facts checked, tightened, then voiced."}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40",
            recording
              ? "bg-red-500 text-white animate-pulse"
              : "bg-ember text-night hover:opacity-85 cursor-pointer"
          )}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1 text-sm">
          {stage !== "idle" && <p className="text-muted">{STAGE_LABEL[stage]}</p>}
          {stage === "idle" && !error && <p className="text-muted">Tap the mic and speak.</p>}
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>

      {transcript && (
        <p className="text-xs text-muted">
          You said: <span className="text-cream">{transcript}</span>
        </p>
      )}
      {spoken && mode === "polished" && (
        <p className="text-xs text-muted">
          Polished: <span className="text-cream">{spoken}</span>
        </p>
      )}
    </section>
  );
}
