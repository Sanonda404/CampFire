"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { Lobby } from "./Lobby";
import { PhaseStepper } from "./PhaseStepper";
import { PlotTwistBanner } from "./PlotTwistBanner";
import { IdeaEditor } from "./IdeaEditor";
import { ScratchPages } from "./ScratchPages";
import { ProposalEditor } from "./ProposalEditor";
import { TeamChat } from "./TeamChat";
import { Results } from "./Results";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldError, Input } from "@/components/ui/Input";
import { getSupabase, getParticipantToken } from "@/lib/supabase-client";
import { setServerOffset, serverNow } from "@/lib/utils";
import { nextBoundary, phaseAt, gameElapsed } from "@/lib/game";
import type {
  Challenge,
  ChatMessage,
  InitialIdea,
  JudgingResult,
  Participant,
  Room,
  ScratchPage,
  Team,
  TeamMember,
  TeamProposal,
} from "@/lib/types";

type Screen = "joining" | "naming" | "ready" | "missing";

export function IdeaClient({ code }: { code: string }) {
  const token = getParticipantToken();
  const supabaseRef = useRef<ReturnType<typeof getSupabase> | null>(null);

  const [screen, setScreen] = useState<Screen>("joining");
  const [nameDraft, setNameDraft] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ideas, setIdeas] = useState<InitialIdea[]>([]);
  const [pages, setPages] = useState<ScratchPage[]>([]);
  const [proposal, setProposal] = useState<TeamProposal | null>(null);
  const [allProposals, setAllProposals] = useState<TeamProposal[]>([]);
  const [results, setResults] = useState<JudgingResult[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const roomIdRef = useRef<string | null>(null);
  const lastBoundaryRef = useRef<number | null>(null);

  const applyRoom = useCallback((r: Room | null) => {
    if (r) roomIdRef.current = r.id;
    setRoom(r);
  }, []);

  // ---------- join ----------
  const join = useCallback(
    async (name: string) => {
      const supabase = getSupabase();
      supabaseRef.current = supabase;
      localStorage.setItem("campfire_name", name);
      const { data: roomRow } = await supabase.from("rooms").select("*").ilike("code", code).maybeSingle();
      if (!roomRow) {
        setScreen("missing");
        return;
      }
      const { data, error: joinErr } = await supabase.rpc("join_room", {
        p_code: code,
        p_name: name,
        p_token: token,
      });
      if (joinErr || !data) {
        setJoinError(joinErr?.message ?? "JOIN_FAILED");
        setScreen("missing");
        return;
      }
      const joined = data as { room: Room; participant: Participant };
      applyRoom(joined.room);
      setMyParticipantId(joined.participant.id);
      setScreen("ready");
    },
    [code, token, applyRoom]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = localStorage.getItem("campfire_name");
      if (saved) void join(saved);
      else setScreen("naming");
    }, 0);
    return () => clearTimeout(t);
  }, [join]);

  useEffect(() => {
    fetch("/api/time")
      .then((r) => r.json())
      .then((d: { now: number }) => setServerOffset(d.now))
      .catch(() => {});
    const id = setInterval(() => setNowMs(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---------- loaders ----------
  const supabaseOf = useCallback(() => supabaseRef.current ?? getSupabase(), []);

  const loadAll = useCallback(async () => {
    const supabase = supabaseOf();
    const roomId = roomIdRef.current;
    if (!roomId) return;

    const [roomRes, partsRes, teamsRes, msgsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("participants").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("teams").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at").limit(200),
    ]);

    if (roomRes.data) applyRoom(roomRes.data as Room);
    setParticipants((partsRes.data ?? []) as Participant[]);
    const teamList = (teamsRes.data ?? []) as Team[];
    setTeams(teamList);
    setMessages((msgsRes.data ?? []) as ChatMessage[]);

    const room = roomRes.data as Room | null;
    if (teamList.length > 0) {
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("*")
        .in("team_id", teamList.map((t) => t.id));
      setMembers((memberRows ?? []) as TeamMember[]);
    } else {
      setMembers([]);
    }

    if (room?.current_challenge_id) {
      const cid = room.current_challenge_id;
      const [chRes, ideaRes, pageRes, propRes, judgeRes] = await Promise.all([
        supabase.from("challenges").select("*").eq("id", cid).maybeSingle(),
        supabase.from("initial_ideas").select("*").eq("challenge_id", cid),
        supabase.from("scratch_pages").select("*").eq("challenge_id", cid).order("created_at"),
        supabase.from("team_proposals").select("*").eq("challenge_id", cid),
        supabase.from("judging_results").select("*").eq("challenge_id", cid),
      ]);
      setChallenge((chRes.data as Challenge) ?? null);
      setIdeas((ideaRes.data ?? []) as InitialIdea[]);
      setPages((pageRes.data ?? []) as ScratchPage[]);
      setProposal(((propRes.data ?? []) as TeamProposal[])[0] ?? null);
      setAllProposals((propRes.data ?? []) as TeamProposal[]);
      setResults((judgeRes.data ?? []) as JudgingResult[]);
    } else {
      setChallenge(null);
      setIdeas([]);
      setPages([]);
      setProposal(null);
      setAllProposals([]);
      setResults([]);
    }
  }, [applyRoom, supabaseOf]);

  useEffect(() => {
    if (screen !== "ready") return;
    void loadAll();
  }, [screen, loadAll]);

  // ---------- realtime ----------
  useEffect(() => {
    if (screen !== "ready" || !room) return;
    const supabase = supabaseOf();
    const roomId = room.id;
    const cid = room.current_challenge_id;

    const channel = supabase
      .channel(`clash-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => applyRoom((payload.new as Room) ?? null)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        () => {
          void supabase.from("participants").select("*").eq("room_id", roomId).order("created_at")
            .then(({ data }) => setParticipants((data ?? []) as Participant[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `room_id=eq.${roomId}` },
        () => void loadAll()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          const myTeam = members.find((mm) => mm.participant_id === myParticipantId);
          if (!m.team_id || (myTeam && m.team_id === myTeam.team_id)) {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Challenge;
          setChallenge((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : row));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "initial_ideas", filter: `room_id=eq.${roomId}` },
        () => {
          if (!cid) return;
          void supabase.from("initial_ideas").select("*").eq("challenge_id", cid)
            .then(({ data }) => setIdeas((data ?? []) as InitialIdea[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scratch_pages", filter: `room_id=eq.${roomId}` },
        () => {
          if (!cid) return;
          void supabase.from("scratch_pages").select("*").eq("challenge_id", cid).order("created_at")
            .then(({ data }) => setPages((data ?? []) as ScratchPage[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_proposals", filter: `room_id=eq.${roomId}` },
        () => {
          if (!cid) return;
          void supabase.from("team_proposals").select("*").eq("challenge_id", cid)
            .then(({ data }) => {
              const list = (data ?? []) as TeamProposal[];
              setAllProposals(list);
              setProposal(list[0] ?? null);
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judging_results", filter: `room_id=eq.${roomId}` },
        () => {
          if (!cid) return;
          void supabase.from("judging_results").select("*").eq("challenge_id", cid)
            .then(({ data }) => setResults((data ?? []) as JudgingResult[]));
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void supabase.channel(`clash-${roomId}`).subscribe();
        }
      });

    const resync = () => {
      if (document.visibilityState !== "visible") return;
      void loadAll();
      const ch = supabase.getChannels().find((c) => c.topic === `clash-${roomId}`);
      if (ch && ch.state !== "joined") void ch.subscribe();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, room?.id, myParticipantId, loadAll, applyRoom, supabaseOf]);

  // ---------- heartbeat ----------
  useEffect(() => {
    if (screen !== "ready" || !room) return;
    const supabase = supabaseOf();
    const beat = () => void supabase.rpc("heartbeat", { p_room: room.id });
    beat();
    const id = setInterval(beat, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, room?.id, supabaseOf]);

  // ---------- authoritative tick ----------
  useEffect(() => {
    if (screen !== "ready" || !room?.game_started_at) return;
    if (room.state === "complete") return;

    const elapsed = gameElapsed(room.game_started_at, serverNow());
    const boundary = nextBoundary(elapsed)?.at ?? null;
    const crossed = boundary !== null && lastBoundaryRef.current !== null && boundary !== lastBoundaryRef.current;
    lastBoundaryRef.current = boundary;
    if (!crossed && elapsed < 180) return;

    void fetch("/api/game/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-participant-token": token },
      body: JSON.stringify({ roomId: room.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { room?: Room; challenge?: Challenge } | null) => {
        if (d?.room) applyRoom(d.room);
        if (d?.challenge) setChallenge(d.challenge);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, screen, room?.game_started_at, room?.state, token, applyRoom]);

  // ---------- actions ----------
  const toggleReady = useCallback(
    async (ready: boolean) => {
      if (!room) return;
      const { error } = await supabaseOf().rpc("set_ready", { p_room: room.id, p_ready: ready });
      if (error) setStartError(error.message);
    },
    [room, supabaseOf]
  );

  const startGame = useCallback(async () => {
    if (!room) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-participant-token": token },
        body: JSON.stringify({ roomCode: room.code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setStartError(data.error ?? "START_FAILED");
    } finally {
      setStarting(false);
    }
  }, [room, token]);

  const myTeam = teams.find((t) => t.id === members.find((m) => m.participant_id === myParticipantId)?.team_id) ?? null;
  const phase = room?.game_started_at ? phaseAt(gameElapsed(room.game_started_at, serverNow())) : "lobby";
  const gameLocked =
    !!challenge && ["judging", "reveal", "agreed", "completed"].includes(challenge.status);
  const showResults =
    !!challenge && (gameLocked || room?.state === "complete" || room?.winning_team_id !== null);

  const saveIdea = useCallback(
    async (content: string) => {
      if (!room || !challenge || !myParticipantId) return;
      const { error } = await supabaseOf().from("initial_ideas").upsert(
        {
          room_id: room.id,
          challenge_id: challenge.id,
          participant_id: myParticipantId,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "challenge_id,participant_id" }
      );
      if (error) setStartError(error.message);
    },
    [room, challenge, myParticipantId, supabaseOf]
  );

  const createPage = useCallback(async () => {
    if (!room || !challenge || !myTeam || !myParticipantId) return null;
    const { data, error } = await supabaseOf()
      .from("scratch_pages")
      .insert({
        room_id: room.id,
        challenge_id: challenge.id,
        team_id: myTeam.id,
        created_by: myParticipantId,
        updated_by: myParticipantId,
      })
      .select("id")
      .single();
    if (error) {
      setStartError(error.message);
      return null;
    }
    return (data as { id: string }).id;
  }, [room, challenge, myTeam, myParticipantId, supabaseOf]);

  const updatePage = useCallback(
    async (id: string, patch: { title?: string; content?: string }) => {
      const { error } = await supabaseOf()
        .from("scratch_pages")
        .update({ ...patch, updated_by: myParticipantId, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) setStartError(error.message);
    },
    [myParticipantId, supabaseOf]
  );

  const deletePage = useCallback(
    async (id: string) => {
      await supabaseOf().from("scratch_pages").delete().eq("id", id);
      setPages((prev) => prev.filter((p) => p.id !== id));
    },
    [supabaseOf]
  );

  const saveProposal = useCallback(
    async (content: string) => {
      if (!room) return;
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-participant-token": token },
        body: JSON.stringify({ roomId: room.id, content }),
      });
      const data = (await res.json().catch(() => ({}))) as { proposal?: TeamProposal; error?: string };
      if (!res.ok) {
        if (data.error === "PROPOSAL_LOCKED" || data.error === "SUBMISSION_CLOSED") return;
        setStartError(data.error ?? "SAVE_FAILED");
        return;
      }
      if (data.proposal) setProposal(data.proposal);
    },
    [room, token]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!room || !myTeam) return;
      await supabaseOf().from("chat_messages").insert({
        room_id: room.id,
        participant_token: token,
        sender: participants.find((p) => p.token === token)?.name ?? "?",
        text,
        team_id: myTeam.id,
        message_type: "text",
        voice_status: "not_applicable",
      });
    },
    [room, myTeam, participants, token, supabaseOf]
  );

  // ---------- screens ----------
  if (screen === "joining") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="animate-pulse text-sm text-muted">Finding the fire…</p>
      </main>
    );
  }

  if (screen === "missing" || !room) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
          <Flame className="h-8 w-8 text-ember" aria-hidden />
          <p className="text-sm text-muted">
            {joinError ? `Could not join: ${joinError}` : `No room found for code ${code}.`}
          </p>
          <a href="/create">
            <Button variant="secondary">Light a new fire</Button>
          </a>
        </Card>
      </main>
    );
  }

  if (screen === "naming") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Card className="flex w-full max-w-sm flex-col gap-4 p-8">
          <h1 className="text-center text-lg font-bold">Join Idea Clash</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = nameDraft.trim();
              if (n) void join(n);
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Your name</span>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="What should the room call you?"
                maxLength={24}
                autoFocus
              />
            </label>
            {joinError && <FieldError>{joinError}</FieldError>}
            <Button type="submit" disabled={!nameDraft.trim()}>
              Join room {code}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  if (!room.game_started_at || phase === "lobby") {
    const isHost = participants.find((p) => p.token === token)?.is_host ?? false;
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Lobby
          room={room}
          participants={participants}
          myToken={token}
          isHost={isHost}
          starting={starting}
          error={startError}
          onToggleReady={(ready) => void toggleReady(ready)}
          onStart={() => void startGame()}
        />
      </main>
    );
  }

  if (showResults) {
    return (
      <main className="min-h-dvh p-6">
        <Results
          teams={teams}
          proposals={allProposals}
          results={results}
          winningTeamId={room.winning_team_id}
        />
      </main>
    );
  }

  const myTeamProposal = proposal;
  const teamIdeas = ideas.filter((i) =>
    myTeam
      ? members.some((m) => m.team_id === myTeam.id && m.participant_id === i.participant_id)
      : i.participant_id === myParticipantId
  );
  const teamMessages = messages.filter((m) => myTeam && m.team_id === myTeam.team_id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 p-4 pb-10">
      <header className="flex flex-col gap-3 rounded-2xl border border-line bg-night-soft/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-sm font-bold">{room.name}</h1>
          <span className="font-mono text-xs text-muted">{room.code}</span>
        </div>
        <PhaseStepper gameStartedAt={room.game_started_at} serverNowMs={nowMs || serverNow()} />
        {challenge && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">The challenge</p>
            <p className="text-sm font-semibold">{challenge.question}</p>
          </div>
        )}
        {(phase === "plot_twist" || phase === "submission") && (
          <PlotTwistBanner twist={challenge?.plot_twist ?? null} />
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-4">
          <IdeaEditor
            challengeStatus={challenge?.status ?? "thinking"}
            myIdea={ideas.find((i) => i.participant_id === myParticipantId) ?? null}
            teamIdeas={teamIdeas}
            participants={participants}
            myParticipantId={myParticipantId}
            onSave={saveIdea}
          />
          {myTeam && (
            <ScratchPages
              pages={pages.filter((p) => p.team_id === myTeam.id)}
              myParticipantId={myParticipantId}
              onCreate={createPage}
              onUpdate={updatePage}
              onDelete={deletePage}
            />
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          {myTeam ? (
            <TeamChat
              roomId={room.id}
              teamId={myTeam.id}
              teamName={myTeam.name}
              messages={teamMessages}
              myToken={token}
              onSendText={sendText}
              onRefresh={() => void loadAll()}
            />
          ) : (
            <Card className="p-4 text-sm text-muted">Teams are being assigned…</Card>
          )}
          <ProposalEditor
            proposal={myTeamProposal}
            locked={gameLocked}
            onSave={saveProposal}
          />
        </div>
      </div>
    </main>
  );
}
