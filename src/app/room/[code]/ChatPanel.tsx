"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn, formatSeconds } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export function ChatPanel({
  messages,
  myToken,
  onSend,
}: {
  messages: ChatMessage[];
  myToken: string;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mark = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(mark);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(t);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Room chat">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Firelight chatter</h2>
      <div className="flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-night-soft/70 p-3">
        {messages.length === 0 && (
          <p className="my-auto text-center text-xs text-muted/70">
            No messages yet — say hello when you arrive.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%]", m.participant_token === myToken && "self-end text-right")}>
            <p className="text-[10px] uppercase tracking-wider text-muted/80">
              {m.participant_token === myToken ? "You" : m.sender} ·{" "}
              {now > 0 ? formatSeconds((now - new Date(m.created_at).getTime()) / 1000) : "just"}{" "}
              ago
            </p>
            <p
              className={cn(
                "mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-sm",
                m.participant_token === myToken
                  ? "bg-ember/90 text-night"
                  : "bg-surface border border-line text-cream"
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add to the conversation…"
          maxLength={500}
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="shrink-0 rounded-xl bg-ember px-4 text-night transition-opacity hover:opacity-85 disabled:opacity-40 cursor-pointer"
          aria-label="Send message"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
