"use client";

import Link from "next/link";
import { Copy, Check, DoorOpen, Flame, Activity, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { activityLabel } from "@/lib/activities";
import type { Participant, Room } from "@/lib/types";

export function Sidebar({
  room,
  participants,
  myToken,
  onLeave,
}: {
  room: Room;
  participants: Participant[];
  myToken: string;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const mark = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(mark);
      clearInterval(id);
    };
  }, []);

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <aside className="relative flex w-full shrink-0 flex-col gap-5 border-b border-line bg-night-soft/90 p-4 sm:p-5 md:sticky md:top-0 md:h-screen md:w-72 md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
      <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ember/25 bg-ember/10"><Flame className="h-5 w-5 text-ember" aria-hidden /></span><span className="text-base">Campfire<span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">workspace</span></span>
      </Link>

      <div>
        <h1 className="text-xl font-extrabold leading-snug tracking-tight">{room.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Activity className="h-3.5 w-3.5 text-lilac" aria-hidden />
          {activityLabel(room.activity_type)} · {Math.round(room.duration_sec / 60)} min
        </p>
        {room.description && <p className="mt-2 text-xs leading-relaxed text-muted">{room.description}</p>}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 shadow-sm">
        <span className="font-mono text-sm font-bold tracking-[0.2em] text-ember">{room.code}</span>
        <button
          onClick={copyInvite}
          className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-cream cursor-pointer"
          aria-label="Copy invite link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Invite"}
        </button>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden /> Around the fire ({participants.length})
        </p>
        <ul className="scroll-thin -mr-1 flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
          {participants.map((p) => {
            const online = now > 0 && now - new Date(p.last_seen_at).getTime() < 70_000;
            return (
              <li key={p.id} className="flex items-center gap-2.5 text-sm">
                <Avatar token={p.token} name={p.name} online={online} isHost={p.is_host} size="sm" />
                <span className={p.token === myToken ? "font-semibold text-cream" : "text-muted"}>
                  {p.name}
                  {p.token === myToken && <span className="ml-1 text-[10px] text-lilac">(you)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Button variant="ghost" size="sm" onClick={onLeave} className="mt-auto self-start">
        <DoorOpen className="h-4 w-4" aria-hidden /> Leave the fire
      </Button>
    </aside>
  );
}
