"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatSeconds } from "@/lib/utils";
import { IDEAS_REVEAL_AT } from "@/lib/game";
import type { Challenge, InitialIdea, Participant } from "@/lib/types";

export function IdeaEditor({
  challengeStatus,
  myIdea,
  teamIdeas,
  participants,
  myParticipantId,
  onSave,
}: {
  challengeStatus: Challenge["status"];
  myIdea: InitialIdea | null;
  teamIdeas: InitialIdea[];
  participants: Participant[];
  myParticipantId: string | null;
  onSave: (content: string) => Promise<void>;
}) {
  const private_ = challengeStatus === "thinking";
  const [draft, setDraft] = useState(myIdea?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const lastSavedRef = useRef(myIdea?.content ?? "");

  useEffect(() => {
    setDraft(myIdea?.content ?? "");
    lastSavedRef.current = myIdea?.content ?? "";
  }, [myIdea?.id]);

  useEffect(() => {
    if (!private_) return;
    if (draft === lastSavedRef.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave(draft);
        lastSavedRef.current = draft;
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } finally {
        setSaving(false);
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, private_]);

  const nameOf = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.name ?? "Teammate";

  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          {private_ ? "Your private idea" : "Team ideas — revealed"}
        </h2>
        {private_ && (
          <span className="text-[10px] text-muted/70">
            goes live to your team at {formatSeconds(IDEAS_REVEAL_AT)}
          </span>
        )}
      </div>

      {private_ ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Sketch your opening idea. Nobody else can see this until the reveal…"
            className="w-full flex-1 resize-none rounded-xl border border-line bg-night-soft p-3 text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-ember/60"
            aria-label="Your private idea"
          />
          <p className="text-[10px] text-muted/70" aria-live="polite">
            {saving ? "Saving…" : saved ? "Saved" : "Autosaves as you type"}
          </p>
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {teamIdeas.length === 0 && (
            <li className="text-xs text-muted/70">No ideas were saved before the reveal.</li>
          )}
          {teamIdeas.map((idea) => (
            <li key={idea.id} className="rounded-xl border border-line bg-night-soft p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {idea.participant_id === myParticipantId ? "You" : nameOf(idea.participant_id)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{idea.content || "(blank)"}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
