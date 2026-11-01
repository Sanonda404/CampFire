"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ScratchPage } from "@/lib/types";

export function ScratchPages({
  pages,
  myParticipantId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  pages: ScratchPage[];
  myParticipantId: string | null;
  onCreate: () => Promise<string | null>;
  onUpdate: (id: string, patch: { title?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  return (
    <Card className="flex min-h-0 flex-col gap-4 rounded-2xl border border-line bg-surface/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Scratch pages</h2>
        <button
          type="button"
          onClick={() => void onCreate().then((id) => id && setSelectedId(id))}
          className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] uppercase tracking-widest text-muted transition-opacity hover:opacity-85 cursor-pointer"
          aria-label="New scratch page"
        >
          <Plus className="h-3 w-3" aria-hidden /> New
        </button>
      </div>

      {pages.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {pages.map((p) => (
            <li key={p.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={
                  "max-w-36 truncate rounded-l-lg px-2 py-1 text-xs cursor-pointer " +
                  (p.id === active?.id
                    ? "bg-ember/90 text-night"
                    : "border border-line bg-night-soft text-muted")
                }
              >
                {p.title || "Untitled"}
              </button>
              {p.created_by === myParticipantId && (
                <button
                  type="button"
                  onClick={() => {
                    if (p.id === active?.id) setSelectedId(null);
                    void onDelete(p.id);
                  }}
                  className="rounded-r-lg border border-l-0 border-line bg-night-soft px-1.5 py-1 text-muted transition-opacity hover:opacity-70 cursor-pointer"
                  aria-label={`Delete ${p.title || "untitled page"}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <PageEditor
          key={active.id}
          page={active}
          onUpdate={onUpdate}
        />
      ) : (
        <p className="text-xs text-muted/70">
          Create a scratch page to think out loud with your team.
        </p>
      )}
    </Card>
  );
}

function PageEditor({
  page,
  onUpdate,
}: {
  page: ScratchPage;
  onUpdate: (id: string, patch: { title?: string; content?: string }) => Promise<void>;
}) {
  const [titleDraft, setTitleDraft] = useState(page.title);
  const [contentDraft, setContentDraft] = useState(page.content);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef({ title: page.title, content: page.content });

  useEffect(() => {
    if (titleDraft === lastSavedRef.current.title && contentDraft === lastSavedRef.current.content) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await onUpdate(page.id, { title: titleDraft, content: contentDraft });
        lastSavedRef.current = { title: titleDraft, content: contentDraft };
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [titleDraft, contentDraft, page.id, onUpdate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        maxLength={80}
        placeholder="Page title"
        className="w-full rounded-xl border border-line bg-night-soft px-3 py-2 text-sm font-semibold text-cream placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-ember/60"
        aria-label="Scratch page title"
      />
      <textarea
        value={contentDraft}
        onChange={(e) => setContentDraft(e.target.value)}
        rows={10}
        maxLength={8000}
        placeholder="Notes, risks, half-formed thoughts — visible to your whole team."
        className="w-full flex-1 resize-none rounded-xl border border-line bg-night-soft p-3 text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-ember/60"
        aria-label="Scratch page content"
      />
      <p className="text-[10px] text-muted/70" aria-live="polite">
        {saving ? "Saving…" : "Autosaves — shared with your team"}
      </p>
    </div>
  );
}
