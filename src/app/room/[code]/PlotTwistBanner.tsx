"use client";

import { Zap } from "lucide-react";

export function PlotTwistBanner({ twist }: { twist: string | null }) {
  if (!twist) return null;
  return (
    <aside
      className="rounded-2xl border border-amber-300/50 bg-amber-300/10 p-4"
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
        <Zap className="h-4 w-4" aria-hidden /> Plot Twist — both teams, adjust now
      </p>
      <p className="mt-2 text-sm leading-relaxed text-cream">{twist}</p>
    </aside>
  );
}
