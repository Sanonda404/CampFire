"use client";

import { useEffect, useState } from "react";
import { cn, formatSeconds, remainingSeconds } from "@/lib/utils";
import type { Room } from "@/lib/types";

export function Timer({
  room,
  className,
  compact = false,
}: {
  room: Pick<Room, "started_at" | "duration_sec" | "paused_accumulated" | "is_paused">;
  className?: string;
  compact?: boolean;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (room.is_paused) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [room.is_paused, room.started_at]);

  const remaining = remainingSeconds(room);
  const pct = Math.max(0, Math.min(100, (remaining / room.duration_sec) * 100));
  const low = remaining < 300;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "font-mono font-bold tabular-nums tracking-tight",
            compact ? "text-2xl" : "text-5xl",
            low ? "text-rose-300" : "text-cream"
          )}
          role="timer"
          aria-label={`Time remaining ${formatSeconds(remaining)}`}
        >
          {formatSeconds(remaining)}
        </span>
        {room.is_paused && (
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Paused</span>
        )}
      </div>
      {!compact && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", low ? "bg-rose-400" : "bg-ember")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
