"use client";

import { Crown, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

const VALID_COUNTS = [2, 4, 6];

export function Lobby({
  room,
  participants,
  myToken,
  isHost,
  starting,
  error,
  onToggleReady,
  onStart,
}: {
  room: { name: string; code: string; max_participants: number };
  participants: Participant[];
  myToken: string;
  isHost: boolean;
  starting: boolean;
  error: string | null;
  onToggleReady: (ready: boolean) => void;
  onStart: () => void;
}) {
  const count = participants.length;
  const allReady = count > 0 && participants.every((p) => p.is_ready);
  const countOk = VALID_COUNTS.includes(count);
  const me = participants.find((p) => p.token === myToken);
  const canStart = isHost && countOk && allReady;

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col gap-5 p-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ember">Idea Clash</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{room.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted">Room {room.code}</p>
      </div>

      <div className="rounded-xl border border-line bg-night-soft p-3 text-center text-sm">
        <span className={cn("font-mono text-xl font-bold", countOk ? "text-cream" : "text-amber-300")}>
          {count}
        </span>
        <span className="text-muted"> / {room.max_participants} players — </span>
        {countOk ? (
          <span className="text-cream">ready to clash</span>
        ) : (
          <span className="text-amber-300">teams work with 2, 4 or 6 players</span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-night-soft px-3 py-2"
          >
            <Avatar name={p.name} token={p.token} />
            <span className="flex-1 truncate text-sm font-semibold">
              {p.name}
              {p.token === myToken && <span className="ml-1 text-xs text-muted">(you)</span>}
            </span>
            {p.is_host && (
              <Crown className="h-4 w-4 shrink-0 text-ember" aria-label="Host" aria-hidden />
            )}
            {p.is_ready ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-teal-400">
                <Check className="h-3 w-3" aria-hidden /> Ready
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-muted/70">Waiting</span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant={me?.is_ready ? "secondary" : "primary"}
          onClick={() => onToggleReady(!me?.is_ready)}
        >
          {me?.is_ready ? "Stand down" : "I'm ready"}
        </Button>
        {isHost && (
          <Button onClick={onStart} disabled={!canStart || starting} aria-live="polite">
            <Play className="h-4 w-4" aria-hidden />
            {starting ? "Starting…" : !countOk ? "Need 2, 4 or 6 players" : !allReady ? "Waiting for everyone to ready up" : "Start the clash"}
          </Button>
        )}
      </div>
    </Card>
  );
}
