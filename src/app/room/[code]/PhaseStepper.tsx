"use client";

import { cn } from "@/lib/utils";
import { GAME_SECONDS, PHASE_DURATIONS, nextBoundary, phaseAt } from "@/lib/game";
import { formatSeconds } from "@/lib/utils";

const STEPS: { key: keyof typeof PHASE_DURATIONS; label: string }[] = [
  { key: "ideation", label: "Private Ideas" },
  { key: "reveal", label: "Reveal" },
  { key: "team_work", label: "Team Work" },
  { key: "plot_twist", label: "Plot Twist" },
  { key: "submission", label: "Final Pitch" },
];

export function PhaseStepper({
  gameStartedAt,
  serverNowMs,
}: {
  gameStartedAt: string | null;
  serverNowMs: number;
}) {
  const elapsed = gameStartedAt ? (serverNowMs - new Date(gameStartedAt).getTime()) / 1000 : 0;
  const phase = gameStartedAt ? phaseAt(elapsed) : "lobby";
  const stepIndex = STEPS.findIndex((s) => s.key === phase);
  const boundary = nextBoundary(elapsed);
  const remaining = boundary ? boundary.at - elapsed : Math.max(0, GAME_SECONDS - elapsed);
  const twistDone = elapsed >= 420;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Game phases">
        {STEPS.map((s, i) => {
          const done = stepIndex > i || (twistDone && s.key === "plot_twist" && stepIndex > i);
          const active = stepIndex === i;
          return (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest",
                  active && "bg-ember text-night",
                  !active && done && "border border-line bg-surface text-muted",
                  !active && !done && "border border-line text-muted/60"
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="text-muted/40">→</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3">
        <span className="font-mono text-2xl font-bold tabular-nums" aria-live="polite">
          {formatSeconds(Math.max(0, remaining))}
        </span>
        <span className="text-xs text-muted">
          {boundary ? `until ${STEPS.find((s) => s.key === boundary.phase)?.label ?? boundary.phase}` : "judging…"}
        </span>
        <span className="ml-auto font-mono text-xs text-muted/70">
          {formatSeconds(Math.min(elapsed, GAME_SECONDS))} / {formatSeconds(GAME_SECONDS)}
        </span>
      </div>
    </div>
  );
}
