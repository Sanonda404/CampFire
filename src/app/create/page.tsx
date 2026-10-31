"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flame, KeyRound, Plus, Check, Copy } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { getSupabase, getParticipantToken } from "@/lib/supabase-client";
import { ACTIVITY_TYPES, SESSION_TYPES } from "@/lib/activities";
import { generateRoomCode } from "@/lib/utils";
import type { Room } from "@/lib/types";

function CreateJoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [activity, setActivity] = useState("focus");
  const [sessionType, setSessionType] = useState("pomodoro");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("mode") === "join") setMode("join");
  }, [params]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem("campfire_name") ?? "");
  }, []);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Tell the room your name (2+ characters).";
    if (roomName.trim().length < 3) errs.roomName = "Give the room a name (3+ characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const supabase = getSupabase();
      const token = getParticipantToken();
      localStorage.setItem("campfire_name", name.trim());

      let room: Room | null = null;
      const minutes = SESSION_TYPES.find((s) => s.key === sessionType)?.minutes ?? 25;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const { data, error } = await supabase
          .from("rooms")
          .insert({
            code,
            name: roomName.trim(),
            activity_type: activity,
            session_type: sessionType,
            description: description.trim(),
            host_token: token,
            duration_sec: minutes * 60,
          })
          .select()
          .single();
        if (!error) {
          room = data as Room;
          break;
        }
        if (!String(error.message).includes("duplicate")) {
          setErrors({ form: `Could not create the room: ${error.message}` });
          setBusy(false);
          return;
        }
      }

      if (!room) {
        setErrors({ form: "Could not allocate a room code. Try again." });
        setBusy(false);
        return;
      }

      const { error: pErr } = await supabase.from("participants").insert({
        room_id: room.id,
        token,
        name: name.trim(),
        is_host: true,
      });
      if (pErr) {
        setErrors({ form: `Room created but joining failed: ${pErr.message}` });
        setBusy(false);
        return;
      }
      router.push(`/room/${room.code}`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Tell the room your name (2+ characters).";
    if (joinCode.trim().length < 4) errs.code = "Enter the 6-character room code.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const supabase = getSupabase();
      localStorage.setItem("campfire_name", name.trim());
      const token = getParticipantToken();

      const { data: room, error } = await supabase
        .from("rooms")
        .select("id, code")
        .ilike("code", joinCode.trim())
        .maybeSingle();
      if (error) {
        setErrors({ form: error.message });
        setBusy(false);
        return;
      }
      if (!room) {
        setErrors({ code: "No campfire burning with that code — check it and try again." });
        setBusy(false);
        return;
      }

      const { error: joinErr } = await supabase.rpc("join_room", {
        p_code: joinCode.trim(),
        p_name: name.trim(),
        p_token: token,
      });
      if (joinErr) {
        setErrors({ form: joinErr.message });
        setBusy(false);
        return;
      }
      router.push(`/room/${(room as { code: string }).code}`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  }

  const inviteLink =
    typeof window !== "undefined" && joinCode.trim()
      ? `${window.location.origin}/room/${joinCode.trim().toUpperCase()}`
      : "";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto grid w-full max-w-4xl flex-1 gap-6 px-5 py-12 md:grid-cols-2">
        <Card>
          <button
            className={`mb-4 flex w-full items-center gap-2 text-left text-lg font-bold cursor-pointer ${mode === "create" ? "text-cream" : "text-muted"}`}
            onClick={() => setMode("create")}
            aria-expanded={mode === "create"}
          >
            <Plus className="h-5 w-5 text-ember" aria-hidden /> Start a new room
          </button>
          {mode === "create" ? (
            <form onSubmit={createRoom} className="flex flex-col gap-4" noValidate>
              <div>
                <Label htmlFor="your-name">Your name</Label>
                <Input id="your-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada" maxLength={30} />
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <Label htmlFor="room-name">Room name</Label>
                <Input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Midnight Manuscripts" maxLength={50} />
                <FieldError>{errors.roomName}</FieldError>
              </div>
              <div>
                <Label htmlFor="activity">Activity type</Label>
                <Select id="activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
                  {ACTIVITY_TYPES.map((a) => (
                    <option key={a.key} value={a.key}>{a.label} — {a.blurb}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="session">Session length</Label>
                <Select id="session" value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                  {SESSION_TYPES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you working on?" maxLength={200} />
              </div>
              <FieldError>{errors.form}</FieldError>
              <Button type="submit" disabled={busy} size="lg">
                {busy ? "Lighting the fire…" : "Create room"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted">
              Open a fresh campfire, pick the activity and length, and share the code with your circle.
            </p>
          )}
        </Card>

        <Card>
          <button
            className={`mb-4 flex w-full items-center gap-2 text-left text-lg font-bold cursor-pointer ${mode === "join" ? "text-cream" : "text-muted"}`}
            onClick={() => setMode("join")}
            aria-expanded={mode === "join"}
          >
            <KeyRound className="h-5 w-5 text-lilac" aria-hidden /> Join with a code
          </button>
          {mode === "join" ? (
            <form onSubmit={joinRoom} className="flex flex-col gap-4" noValidate>
              <div>
                <Label htmlFor="join-name">Your name</Label>
                <Input id="join-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grace" maxLength={30} />
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <Label htmlFor="join-code">Room code or invite link</Label>
                <Input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9/]/g, "");
                    const codePart = cleaned.split("/").pop() ?? "";
                    setJoinCode(codePart.toUpperCase());
                  }}
                  placeholder="e.g. K7M2XQ"
                  maxLength={24}
                  className="font-mono tracking-widest uppercase"
                  autoComplete="off"
                />
                <FieldError>{errors.code}</FieldError>
              </div>
              {inviteLink && (
                <div className="flex items-center gap-2 rounded-xl border border-line bg-night-soft px-3 py-2">
                  <span className="truncate text-xs text-muted">{inviteLink}</span>
                  <button
                    type="button"
                    className="ml-auto shrink-0 text-muted hover:text-cream cursor-pointer"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label="Copy invite link"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <FieldError>{errors.form}</FieldError>
              <Button type="submit" variant="secondary" disabled={busy} size="lg">
                {busy ? "Finding the fire…" : "Join room"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted">
              Got a code from a friend? Paste it here and pull up a log.
            </p>
          )}
        </Card>
      </main>
      <footer className="py-6 text-center text-xs text-muted/70">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-cream">
          <Flame className="h-3.5 w-3.5 text-ember" aria-hidden /> Back to camp
        </Link>
      </footer>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-muted">Loading…</div>}>
      <CreateJoinInner />
    </Suspense>
  );
}
