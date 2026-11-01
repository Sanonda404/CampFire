"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { VoiceMessage, VoicePlayback } from "./VoiceMessage";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export function TeamChat({
  roomId,
  teamId,
  teamName,
  messages,
  myToken,
  onSendText,
  onRefresh,
}: {
  roomId: string;
  teamId: string;
  teamName: string;
  messages: ChatMessage[];
  myToken: string;
  onSendText: (text: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>("");

  useEffect(() => {
    clientIdRef.current = crypto.randomUUID();
  }, [teamId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const t = text.trim();
      if (!t || sending) return;
      setSending(true);
      setText("");
      try {
        await onSendText(t);
      } finally {
        setSending(false);
      }
    },
    [text, sending, onSendText]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Team ${teamName} chat`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Team {teamName} chat
      </h2>
      <div className="scroll-thin flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-night-soft/70 p-3">
        {messages.length === 0 && (
          <p className="my-auto text-center text-xs text-muted/70">
            Only your team sees this channel. Text or voice — go.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("max-w-[85%]", m.participant_token === myToken && "self-end text-right")}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted/80">
              {m.participant_token === myToken ? "You" : m.sender}
              {m.message_type === "voice" && " · voice"}
            </p>
            <div
              className={cn(
                "mt-0.5 inline-block max-w-full rounded-2xl px-3 py-1.5 text-sm",
                m.participant_token === myToken
                  ? "bg-ember/90 text-night"
                  : "bg-surface border border-line text-cream"
              )}
            >
              {m.message_type === "voice" && m.audio_storage_path ? (
                <span className="flex flex-col items-start">
                  <VoicePlayback roomId={roomId} path={m.audio_storage_path} />
                  {m.transcript && <span className="mt-1 text-xs italic">{m.transcript}</span>}
                </span>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <form onSubmit={send} className="flex flex-1 gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message team ${teamName}…`}
            maxLength={500}
            aria-label="Team chat message"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="shrink-0 rounded-xl bg-ember px-4 text-night transition-opacity hover:opacity-85 disabled:opacity-40 cursor-pointer"
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </form>
        <VoiceMessage
          roomId={roomId}
          teamId={teamId}
          clientId={clientIdRef.current}
          onSent={onRefresh}
        />
      </div>
    </section>
  );
}
