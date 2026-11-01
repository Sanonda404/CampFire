"use client";

import { useState } from "react";
import { Sparkles, Lock, Unlock, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Label, Textarea } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import type { Challenge, Conclusion, Participant, Room, Submission } from "@/lib/types";

interface Props {
  room: Room;
  challenge: Challenge | null;
  submissions: Submission[];
  conclusion: Conclusion | null;
  participants: Participant[];
  myToken: string;
  isHost: boolean;
  explanationLoading: boolean;
  onLaunchSpark: () => Promise<void>;
  onSubmitAnswer: (answer: string, reasoning: string) => Promise<void>;
  onSubmitGroupAnswer: (answer: string) => Promise<void>;
  onAdvance: (next: string) => Promise<void>;
}

export function ChallengePanel(p: Props) {
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [groupAnswer, setGroupAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameByToken = new Map(p.participants.map((x) => [x.token, x.name]));
  const mySubmission = p.submissions.find((s) => s.participant_token === p.myToken);
  const revealed = p.challenge && ["reveal", "agreed", "completed"].includes(p.challenge.status);

  async function wrap(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (p.room.state === "focusing" || p.room.state === "waiting") {
    return (
      <Card className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface to-night-soft px-5 py-12 text-center shadow-sm sm:px-8">
        <Sparkles className="h-7 w-7 text-ember" aria-hidden />
        <h2 className="text-lg font-bold">Shared Spark</h2>
            <p className="max-w-sm text-sm text-muted">
              {p.room.state === "waiting"
                ? "Start the focus timer to begin the session. When it pauses, the room’s Shared Spark drops."
            : "When the timer pauses, the host can drop a Shared Spark — one challenge for the whole room, answered separately, revealed together."}
        </p>
        {p.isHost && p.room.state === "focusing" && (
          <Button onClick={() => wrap(p.onLaunchSpark)} disabled={busy}>
            {busy ? "Kindling…" : "Launch a Shared Spark"}
          </Button>
        )}
        {!p.isHost && p.room.state === "focusing" && (
          <p className="text-xs text-muted/70">Waiting for the host to launch one…</p>
        )}
        <FieldError>{error}</FieldError>
      </Card>
    );
  }

  if (!p.challenge) {
    return (
      <Card className="py-10 text-center text-sm text-muted">Warming up the spark…</Card>
    );
  }

  return (
    <Card className="flex flex-col gap-6 rounded-3xl border border-line bg-surface/70 p-5 shadow-sm sm:p-7">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ember">
          <Sparkles className="h-4 w-4" aria-hidden /> Shared Spark
          {p.challenge.ai_generated ? (
            <span className="text-muted/70 normal-case">· AI-kindled</span>
          ) : (
            <span className="text-muted/70 normal-case">· from the campfire deck (AI unavailable)</span>
          )}
        </p>
        <h2 className="mt-3 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">{p.challenge.question}</h2>
        {p.challenge.context && <p className="mt-1.5 text-sm text-muted">{p.challenge.context}</p>}
      </div>

      {(p.room.state === "challenge_thinking" || p.room.state === "challenge_sharing") && (
        <div className="flex flex-col gap-4">
          {mySubmission ? (
            <div className="flex items-center gap-3 rounded-2xl border border-lilac/20 bg-lilac/5 px-4 py-4 text-sm leading-relaxed text-muted">
              <Lock className="h-4 w-4 text-lilac" aria-hidden />
              Your answer is sealed. It stays hidden until the host reveals everyone’s at once.
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="answer">Your answer</Label>
                <Textarea id="answer" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={500} placeholder="One clear answer…" />
              </div>
              <div>
                <Label htmlFor="reasoning">Why (optional)</Label>
                <Textarea id="reasoning" rows={2} value={reasoning} onChange={(e) => setReasoning(e.target.value)} maxLength={500} placeholder="Your reasoning, briefly…" />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  disabled={busy || !answer.trim()}
                  onClick={() =>
                    wrap(async () => {
                      await p.onSubmitAnswer(answer.trim(), reasoning.trim());
                      setAnswer("");
                      setReasoning("");
                    })
                  }
                >
                  {busy ? "Sealing…" : "Seal my answer"}
                </Button>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Lock className="h-3 w-3" aria-hidden /> hidden until reveal
                </span>
              </div>
            </>
          )}
          {p.room.state === "challenge_sharing" && (
            <p className="text-xs text-muted">
              Sharing is open — {p.submissions.length} of {p.participants.length} answers sealed so far.
            </p>
          )}
          {p.isHost && p.room.state === "challenge_thinking" && (
            <Button variant="secondary" onClick={() => wrap(() => p.onAdvance("challenge_sharing"))} disabled={busy} className="self-start">
              Open sharing
            </Button>
          )}
        </div>
      )}

      {revealed && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-lilac">
            <Unlock className="h-4 w-4" aria-hidden /> All answers revealed
          </p>
          {p.submissions.length === 0 && (
            <p className="text-sm text-muted">              Nobody sealed an answer this time.</p>
          )}
          <ul className="scroll-thin -mr-1 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {p.submissions.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-2xl border border-line bg-night-soft/80 p-4 transition-colors hover:border-line/80">
                <Avatar token={s.participant_token} name={nameByToken.get(s.participant_token) ?? "?"} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{nameByToken.get(s.participant_token) ?? "Someone"}</p>
                  <p className="text-sm text-cream">{s.answer}</p>
                  {s.reasoning && <p className="mt-1 text-xs text-muted">{s.reasoning}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.room.state === "reveal" && (
        <div>
          {p.isHost ? (
            <Button onClick={() => wrap(() => p.onAdvance("discussion"))} disabled={busy}>
              Open discussion
            </Button>
          ) : (
            <p className="text-xs text-muted">Discuss! The host will open the group answer next.</p>
          )}
        </div>
      )}

      {p.room.state === "discussion" && (
        <div>
          {p.isHost ? (
            <Button onClick={() => wrap(() => p.onAdvance("group_answer"))} disabled={busy}>
              Move to group answer
            </Button>
          ) : (
            <p className="text-xs text-muted">Talk it through — group answer is next.</p>
          )}
        </div>
      )}

      {p.room.state === "group_answer" && (
        <div className="flex flex-col gap-3">
          {p.conclusion ? (
            <div className="rounded-2xl border border-ember/30 bg-ember/[0.07] p-5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ember">
                <Users className="h-3.5 w-3.5" aria-hidden /> The room’s answer
              </p>
              <p className="mt-2 text-sm">{p.conclusion.final_answer}</p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="group">One answer for the whole room</Label>
                <Textarea id="group" rows={3} value={groupAnswer} onChange={(e) => setGroupAnswer(e.target.value)} maxLength={500} placeholder="Agree on it together, then seal it…" />
              </div>
              <Button
                disabled={busy || !groupAnswer.trim()}
                onClick={() =>
                  wrap(async () => {
                    await p.onSubmitGroupAnswer(groupAnswer.trim());
                    setGroupAnswer("");
                  })
                }
                className="self-start"
              >
                {busy ? "Recording…" : "Record the group answer"}
              </Button>
            </>
          )}
          {p.isHost && (
            <Button variant="secondary" onClick={() => wrap(() => p.onAdvance("complete"))} disabled={busy || !p.conclusion} className="self-start">
              Complete the session
            </Button>
          )}
          {p.isHost && !p.conclusion && (
            <p className="text-xs text-muted">The room needs a shared answer before you can complete.</p>
          )}
        </div>
      )}

      {p.conclusion?.ai_explanation && (
        <div className="rounded-xl border border-lilac/40 bg-lilac/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-lilac">
            {p.explanationLoading ? "Spark is thinking…" : "What the room figured out"}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{p.conclusion.ai_explanation}</p>
        </div>
      )}

      <FieldError>{error}</FieldError>
    </Card>
  );
}
