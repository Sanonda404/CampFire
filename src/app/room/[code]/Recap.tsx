"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, RotateCcw, Timer as TimerIcon, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { activityLabel } from "@/lib/activities";
import { formatSeconds } from "@/lib/utils";

export function Recap({
  room,
  durationSec,
  participantCount,
  challengesCompleted,
  finalAnswer,
  explanation,
}: {
  room: { name: string; code: string; activity_type: string };
  durationSec: number;
  participantCount: number;
  challengesCompleted: number;
  finalAnswer: string | null;
  explanation: string | null;
}) {
  const router = useRouter();

  return (
    <Card className="mx-auto flex w-full max-w-2xl flex-col gap-7 rounded-3xl border border-line bg-gradient-to-br from-surface to-night-soft p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-9">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ember">Session complete</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{room.name} — recap</h1>
        <p className="mt-1 text-sm text-muted">{activityLabel(room.activity_type)}</p>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-line bg-night/60 p-4">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted">
            <TimerIcon className="h-3 w-3" aria-hidden /> Focus
          </dt>
          <dd className="mt-1 font-mono text-lg font-bold">{formatSeconds(durationSec)}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-night/60 p-4">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted">
            <Users className="h-3 w-3" aria-hidden /> Friends
          </dt>
          <dd className="mt-1 font-mono text-lg font-bold">{participantCount}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-night/60 p-4">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted">
            <Sparkles className="h-3 w-3" aria-hidden /> Sparks
          </dt>
          <dd className="mt-1 font-mono text-lg font-bold">{challengesCompleted}</dd>
        </div>
      </dl>

      {finalAnswer && (
        <div className="rounded-xl border border-ember/40 bg-ember/10 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-ember">The room’s answer</p>
          <p className="mt-2 text-sm">{finalAnswer}</p>
        </div>
      )}
      {explanation && (
        <div className="rounded-xl border border-lilac/40 bg-lilac/10 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-lilac">What you figured out together</p>
          <p className="mt-2 text-sm leading-relaxed">{explanation}</p>
        </div>
      )}
      {!finalAnswer && !explanation && (
        <p className="text-sm text-muted">
          No shared conclusion was recorded this session — the fire remembers only what you gave it.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button variant="secondary">
            <Home className="h-4 w-4" aria-hidden /> Back home
          </Button>
        </Link>
        <Button
          onClick={() => {
            router.push(`/create?mode=create`);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Start another session
        </Button>
      </div>
    </Card>
  );
}
