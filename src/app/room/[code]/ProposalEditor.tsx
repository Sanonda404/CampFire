"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PROPOSAL_SECTIONS } from "@/lib/game";
import type { ProposalSectionKey } from "@/lib/game";
import type { TeamProposal } from "@/lib/types";

type Sections = Partial<Record<ProposalSectionKey, string>>;

function parseSections(content: string): Sections {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Sections;
    }
  } catch {
    // legacy plain-text draft
  }
  return content ? { pitch: content } : {};
}

export function ProposalEditor({
  proposal,
  locked,
  onSave,
}: {
  proposal: TeamProposal | null;
  locked: boolean;
  onSave: (content: string) => Promise<void>;
}) {
  const [sections, setSections] = useState<Sections>(parseSections(proposal?.content ?? ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const lastSavedRef = useRef(proposal?.content ?? "");

  useEffect(() => {
    const next = parseSections(proposal?.content ?? "");
    if ((proposal?.content ?? "") !== lastSavedRef.current) {
      setSections(next);
      lastSavedRef.current = proposal?.content ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);

  useEffect(() => {
    if (locked) return;
    const serialized = JSON.stringify(sections);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave(serialized);
        lastSavedRef.current = serialized;
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, locked]);

  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Team proposal</h2>
        {locked ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
            <Lock className="h-3 w-3" aria-hidden /> Locked
          </span>
        ) : (
          <span className="text-[10px] text-muted/70" aria-live="polite">
            {saving ? "Saving…" : saved ? "Saved" : "Autosaves every keystroke pause"}
          </span>
        )}
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {PROPOSAL_SECTIONS.map((s) => (
          <label key={s.key} className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{s.label}</span>
            <textarea
              value={sections[s.key] ?? ""}
              onChange={(e) => setSections((prev) => ({ ...prev, [s.key]: e.target.value }))}
              disabled={locked}
              rows={s.key === "pitch" ? 4 : 2}
              maxLength={2500}
              placeholder={s.placeholder}
              className="w-full resize-none rounded-xl border border-line bg-night-soft p-2.5 text-sm text-cream placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-ember/60 disabled:opacity-70"
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
