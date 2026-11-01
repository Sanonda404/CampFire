"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";
import { ChallengePanel } from "./ChallengePanel";
import { Recap } from "./Recap";
import { PhaseIndicator } from "@/components/ui/PhaseIndicator";
import { Timer } from "@/components/ui/Timer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input } from "@/components/ui/Input";
import { getSupabase, getParticipantToken } from "@/lib/supabase-client";
import { setServerOffset, remainingSeconds } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  Challenge,
  ChatMessage,
  Conclusion,
  Participant,
  Room,
  Submission,
} from "@/lib/types";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const token = getParticipantToken();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [conclusion, setConclusion] = useState<Conclusion | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [phase, setPhase] = useState<"joining" | "naming" | "ready" | "missing">("joining");
  const [error, setError] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [challengesCompleted, setChallengesCompleted] = useState(0);
  const challengeIdRef = useRef<string | null>(null);
  const explainedRef = useRef<string | null>(null);

  const maybeExplain = useCallback(async (challengeId: string) => {
    if (explainedRef.current === challengeId) return;
    explainedRef.current = challengeId;
    setExplanationLoading(true);
    try {
      await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-participant-token": token },
        body: JSON.stringify({ challengeId }),
      });
    } finally {
      setExplanationLoading(false);
    }
  }, [token]);

  const applyRoom = useCallback(
    (r: Room | null) => {
      setRoom(r);
      if (r && r.state === "complete" && r.current_challenge_id) {
        void maybeExplain(r.current_challenge_id);
      }
    },
    [maybeExplain]
  );

  const join = useCallback(
    async (name: string) => {
      const supabase = getSupabase();
      localStorage.setItem("campfire_name", name);
      setMyName(name);
      const { data: roomRow } = await supabase.from("rooms").select("*").ilike("code", code).maybeSingle();
      if (!roomRow) {
        setPhase("missing");
        return;
      }
      const { error: joinErr } = await supabase.rpc("join_room", {
        p_code: code,
        p_name: name,
        p_token: token,
      });
      if (joinErr) {
        setError(joinErr.message);
        setPhase("missing");
        return;
      }
      applyRoom(roomRow as Room);
      setPhase("ready");
    },
    [code, token, applyRoom]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = localStorage.getItem("campfire_name");
      if (saved) {
        void join(saved);
      } else {
        setPhase("naming");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [join]);

  useEffect(() => {
    fetch("/api/time")
      .then((r) => r.json())
      .then((d: { now: number }) => setServerOffset(d.now))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !room) return;
    const supabase = getSupabase();
    const roomId = room.id;

    const loadAll = async () => {
      const [roomRes, parts, msgs, chs] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("participants").select("*").eq("room_id", roomId).order("created_at"),
        supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at").limit(200),
        supabase.from("challenges").select("*").eq("room_id", roomId).order("created_at"),
      ]);
      if (roomRes.data) applyRoom(roomRes.data as Room);
      setParticipants((parts.data ?? []) as Participant[]);
      setMessages((msgs.data ?? []) as ChatMessage[]);
      const chsList = (chs.data ?? []) as Challenge[];
      const current = chsList.find((c) => c.id === room.current_challenge_id) ?? chsList[chsList.length - 1] ?? null;
      setChallenge(current);
      challengeIdRef.current = current?.id ?? null;
      if (current) {
        const [subs, conc] = await Promise.all([
          supabase.from("submissions").select("*").eq("challenge_id", current.id).order("created_at"),
          supabase.from("conclusions").select("*").eq("challenge_id", current.id).maybeSingle(),
        ]);
        setSubmissions((subs.data ?? []) as Submission[]);
        setConclusion((conc.data ?? null) as Conclusion | null);
      }
    };
    void loadAll();

    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => applyRoom((payload.new as Room) ?? null)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        () => {
          void supabase
            .from("participants")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at")
            .then(({ data }) => setParticipants((data ?? []) as Participant[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Challenge;
          setChallenge((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void supabase.channel(`room-${roomId}`).subscribe();
        }
      });

    const resync = () => {
      if (document.visibilityState !== "visible") return;
      void loadAll();
      const ch = supabase.getChannels().find((c) => c.topic === `room-${roomId}`);
      if (ch && ch.state !== "joined") void ch.subscribe();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);

    return () => {
      void supabase.removeChannel(roomChannel);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, room?.id]);

  useEffect(() => {
    if (phase !== "ready" || !room || !challenge) return;
    if (challengeIdRef.current === challenge.id) return;
    challengeIdRef.current = challenge.id;
    const supabase = getSupabase();

    const subChannel = supabase
      .channel(`subs-${challenge.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `challenge_id=eq.${challenge.id}` },
        () => {
          void supabase
            .from("submissions")
            .select("*")
            .eq("challenge_id", challenge.id)
            .order("created_at")
            .then(({ data }) => setSubmissions((data ?? []) as Submission[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conclusions", filter: `challenge_id=eq.${challenge.id}` },
        () => {
          void supabase
            .from("conclusions")
            .select("*")
            .eq("challenge_id", challenge.id)
            .maybeSingle()
            .then(({ data }) => setConclusion((data ?? null) as Conclusion | null));
        }
      )
      .subscribe();

    void supabase
      .from("submissions")
      .select("*")
      .eq("challenge_id", challenge.id)
      .order("created_at")
      .then(({ data }) => setSubmissions((data ?? []) as Submission[]));
    void supabase
      .from("conclusions")
      .select("*")
      .eq("challenge_id", challenge.id)
      .maybeSingle()
      .then(({ data }) => setConclusion((data ?? null) as Conclusion | null));

    return () => {
      void supabase.removeChannel(subChannel);
    };
  }, [phase, room, challenge]);

  useEffect(() => {
    if (!room || room.state !== "complete") return;
    void getSupabase()
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .then(({ count }) => setChallengesCompleted(count ?? 0));
  }, [room?.state, room?.id]);

  useEffect(() => {
    if (phase !== "ready" || !room) return;
    const supabase = getSupabase();
    const beat = () => void supabase.rpc("heartbeat", { p_room: room.id });
    beat();
    const id = setInterval(beat, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, room]);

  if (phase === "joining") {
    return (
      <div className="flex min-h-screen items-center justify-center p-5">
        <Card className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-9 w-full" />
            <p className="text-xs text-muted">Finding the fire…</p>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "naming") {
    return (
      <CenterCard>
        <Flame className="mx-auto h-7 w-7 text-ember" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">Join {code}</h1>
        <p className="mt-1 text-sm text-muted">What should the room call you?</p>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameDraft.trim().length >= 2) void join(nameDraft.trim());
          }}
        >
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" maxLength={30} autoFocus />
          <Button type="submit" disabled={nameDraft.trim().length < 2}>
            Pull up a log
          </Button>
        </form>
      </CenterCard>
    );
  }

  if (phase === "missing" || !room) {
    return (
      <CenterCard>
        <Flame className="mx-auto h-7 w-7 text-muted" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">No fire with code {code}</h1>
        <p className="mt-1 text-sm text-muted">{error ?? "Check the code with whoever lit it."}</p>
        <Button className="mt-5" onClick={() => router.push("/create?mode=join")}>
          Try another code
        </Button>
      </CenterCard>
    );
  }

  const isHost = room.host_token === token;
  const supabase = () => getSupabase();

  async function advance(next: string) {
    const { error: e } = await supabase().rpc("advance_room_state", {
      p_room: room!.id,
      p_next: next,
    });
    if (e) setError(e.message);
    if (next === "complete") {
      const [{ count: challengesDone }, elapsed] = await Promise.all([
        supabase().from("challenges").select("id", { count: "exact", head: true }).eq("room_id", room!.id),
        Promise.resolve(Math.max(0, room!.duration_sec - remainingSeconds(room!))),
      ]);
      await supabase().from("sessions").insert({
        room_id: room!.id,
        duration_sec: Math.round(elapsed),
        participant_count: participants.length,
        challenges_completed: challengesDone ?? 0,
        summary: challenge?.question ?? "",
      });
    }
  }

  async function timerAction(action: string) {
    const { error: e } = await supabase().rpc("update_timer", {
      p_room: room!.id,
      p_action: action,
      p_duration: action === "start" ? room!.duration_sec : null,
    });
    if (e) setError(e.message);
  }

  async function launchSpark() {
    const res = await fetch("/api/ai/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-participant-token": token },
      body: JSON.stringify({ roomId: room!.id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not kindle a spark.");
      return;
    }
    await advance("challenge_thinking");
  }

  async function submitAnswer(answer: string, reasoning: string) {
    if (!challenge) return;
    const { error: e } = await supabase()
      .from("submissions")
      .insert({ challenge_id: challenge.id, participant_token: token, answer, reasoning });
    if (e) setError(e.code === "23505" ? "You already sealed an answer for this spark." : e.message);
  }

  async function submitGroupAnswer(answer: string) {
    if (!challenge) return;
    const { error: e } = await supabase()
      .from("conclusions")
      .insert({ challenge_id: challenge.id, participant_token: token, final_answer: answer });
    if (e) setError(e.code === "23505" ? "The group answer is already recorded." : e.message);
  }

  async function sendChat(text: string) {
    const { data: me } = await supabase()
      .from("participants")
      .select("name")
      .eq("room_id", room!.id)
      .eq("token", token)
      .maybeSingle();
    const { error: e } = await supabase()
      .from("chat_messages")
      .insert({ room_id: room!.id, participant_token: token, sender: myName ?? (me as { name: string } | null)?.name ?? "Someone", text });
    if (e) setError(e.message);
  }

  const lastChallenge = challenge;
  const recapReady = room.state === "complete";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        room={room}
        participants={participants}
        myToken={token}
        onLeave={() => router.push("/")}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PhaseIndicator state={room.state} />
          {isHost && (room.state === "focusing" || (room.started_at && !recapReady)) && (
            <div className="flex gap-2">
              {room.state === "focusing" && (
                <Button size="sm" onClick={() => timerAction("start")}>
                  Start focus
                </Button>
              )}
              {room.started_at && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => timerAction(room.is_paused ? "resume" : "pause")}>
                    {room.is_paused ? "Resume" : "Pause"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => timerAction("reset")}>
                    Reset
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {!recapReady && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-night-soft/60 py-8">
            <Timer room={room} />
            <p className="text-xs text-muted">
              {room.state === "waiting"
                ? "Waiting for the host to start the focus timer."
                : room.is_paused
                  ? "Paused — perfect moment for a Shared Spark."
                  : "Everyone sees the same clock, straight from the server."}
            </p>
          </div>
        )}

        {recapReady ? (
          <Recap
            room={room}
            durationSec={Math.max(0, room.duration_sec - remainingSeconds(room))}
            participantCount={participants.length}
            challengesCompleted={challengesCompleted}
            finalAnswer={conclusion?.final_answer ?? null}
            explanation={conclusion?.ai_explanation ?? null}
          />
        ) : (
          <>
            <ChallengePanel
              room={room}
              challenge={lastChallenge}
              submissions={submissions}
              conclusion={conclusion}
              participants={participants}
              myToken={token}
              isHost={isHost}
              explanationLoading={explanationLoading}
              onLaunchSpark={launchSpark}
              onSubmitAnswer={submitAnswer}
              onSubmitGroupAnswer={submitGroupAnswer}
              onAdvance={advance}
            />
            <ChatPanel messages={messages} myToken={token} onSend={sendChat} />
          </>
        )}

        <FieldError>{error}</FieldError>
      </main>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-sm text-center">{children}</Card>
    </div>
  );
}
