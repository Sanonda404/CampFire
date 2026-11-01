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
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<Record<string, { title: string; content: string }>>({});

  useEffect(() => {
    if (activeId && !pages.some((p) => p.id === activeId)) {
      setActiveId(pages[0]?.id ?? null);
    }
    if (!activeId && pages.length > 0) setActiveId(pages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  const active = pages.find((p) => p.id === activeId) ?? null;
  const [titleDraft, setTitleDraft] = useState(active?.title ?? "");
  const [contentDraft, setContentDraft] = useState(active?.content ?? "");

  useEffect(() => {
    setTitleDraft(active?.title ?? "");
    setContentDraft(active?.content ?? "");
    lastSavedRef.current[active?.id ?? ""] = { title: active?.title ?? "", content: active?.content ?? "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!active) return;
    const last = lastSavedRef.current[active.id];
    if (!last || (titleDraft === last.title && contentDraft === last.content)) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await onUpdate(active.id, { title: titleDraft, content: contentDraft });
        lastSavedRef.current[active.id] = { title: titleDraft, content: contentDraft };
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleDraft, contentDraft, activeId]);

  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Scratch pages</h2>
        <button
          type="button"
          onClick={() => void onCreate().then((id) => id && setActiveId(id))}
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
                onClick={() => setActiveId(p.id)}
                className={
                  "max-w-36 truncate rounded-l-lg px-2 py-1 text-xs cursor-pointer " +
                  (p.id === activeId
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
                    if (p.id === activeId) setActiveId(null);
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
            rows={8}
            maxLength={8000}
            placeholder="Notes, risks, half-formed thoughts — visible to your whole team."
            className="w-full flex-1 resize-none rounded-xl border border-line bg-night-soft p-3 text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-ember/60"
            aria-label="Scratch page content"
          />
          <p className="text-[10px] text-muted/70" aria-live="polite">
            {saving ? "Saving…" : "Autosaves — shared with your team"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted/70">
          Create a scratch page to think out loud with your team.
        </p>
      )}
    </Card>
  );
}
