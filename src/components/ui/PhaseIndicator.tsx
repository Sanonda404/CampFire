import { cn } from "@/lib/utils";
import { PHASES, type RoomState } from "@/lib/types";

export function PhaseIndicator({ state }: { state: RoomState }) {
  const idx = PHASES.findIndex((p) => p.key === state);
  return (
    <ol className="flex items-center gap-1.5 flex-wrap" aria-label="Session phase">
      {PHASES.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={p.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors",
                active && "bg-ember text-night",
                done && "text-lilac",
                !active && !done && "text-muted/60"
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-night" : done ? "bg-lilac" : "bg-muted/40"
                )}
              />
              {p.label}
            </span>
            {i < PHASES.length - 1 && <span className="text-muted/40 text-[10px]">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
