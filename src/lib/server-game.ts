import { getSupabaseAdmin } from "@/lib/supabase-server";
import { callAI } from "@/lib/ai";
import { gameElapsed, phaseAt, RUBRIC, GAME_SECONDS, PLOT_TWIST_AT } from "@/lib/game";
import type { Challenge, JudgingResult, Room, TeamProposal } from "@/lib/types";

export interface RoomContext {
  admin: ReturnType<typeof getSupabaseAdmin>;
  room: Room;
  challenge: Challenge | null;
  elapsed: number;
  phase: string;
}

export async function loadRoomContext(roomId: string): Promise<RoomContext | null> {
  const admin = getSupabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return null;

  let challenge: Challenge | null = null;
  if (room.current_challenge_id) {
    const { data } = await admin.from("challenges").select("*").eq("id", room.current_challenge_id).maybeSingle();
    challenge = (data as Challenge) ?? null;
  }

  const elapsed = gameElapsed(room.game_started_at, Date.now());
  return {
    admin,
    room: room as Room,
    challenge,
    elapsed,
    phase: room.game_started_at ? phaseAt(elapsed) : "lobby",
  };
}

export async function getParticipant(admin: ReturnType<typeof getSupabaseAdmin>, roomId: string, token: string | null) {
  if (!token) return null;
  const { data } = await admin
    .from("participants")
    .select("*")
    .eq("room_id", roomId)
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
}

function clampScore(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(Math.max(n, 0), max);
}

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const JUDGE_SYSTEM = `You are a strict but fair hackathon judge for a two-team idea clash.
Score ONE proposal against the rubric. Respond with ONLY a JSON object, no prose:
{"originality": <0-20>, "feasibility": <0-25>, "impact": <0-20>, "plot_twist": <0-25>, "clarity": <0-10>, "strengths": ["..."], "improvements": ["..."], "plot_twist_addressed": <bool>, "explanation": "<2-3 sentences>"}
- plot_twist rewards how well the proposal absorbs the mid-game plot twist.
- clarity rewards the writing of the final pitch.
- strengths and improvements: 2-3 short strings each.`;

export async function judgeProposal(
  question: string,
  plotTwist: string | null,
  proposalContent: string
): Promise<Record<string, unknown> | null> {
  const prompt = [
    `Challenge: ${question}`,
    plotTwist ? `Plot twist (announced mid-game): ${plotTwist}` : "No plot twist was issued.",
    `Proposal:\n${proposalContent.slice(0, 6000)}`,
    "Return the JSON verdict now.",
  ].join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callAI([
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: prompt },
      ]);
      const parsed = parseJsonBlock(text);
      if (parsed) return parsed;
    } catch {
      // retry once
    }
  }
  return null;
}

export interface JudgingOutcome {
  ok: boolean;
  results: JudgingResult[];
  error?: string;
}

// Idempotent: skips proposals that already have results, then resolves the winner
// with the tie-break Plot Twist -> Feasibility -> draw (done by set_winning_team).
export async function runJudging(ctx: RoomContext): Promise<JudgingOutcome> {
  const { admin, room, challenge } = ctx;
  if (!challenge || !challenge.submissions_locked_at) {
    return { ok: false, results: [], error: "PROPOSALS_NOT_LOCKED" };
  }
  if (challenge.status === "reveal" || challenge.status === "completed") {
    const { data: existing } = await admin
      .from("judging_results")
      .select("*")
      .eq("challenge_id", challenge.id);
    return { ok: true, results: (existing ?? []) as JudgingResult[] };
  }

  const { data: proposals } = await admin
    .from("team_proposals")
    .select("*")
    .eq("challenge_id", challenge.id);
  const list = (proposals ?? []) as TeamProposal[];
  if (list.length === 0) {
    return { ok: false, results: [], error: "NO_PROPOSALS" };
  }

  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const results: JudgingResult[] = [];

  for (const p of list) {
    const { data: existingResult } = await admin
      .from("judging_results")
      .select("*")
      .eq("challenge_id", challenge.id)
      .eq("team_id", p.team_id)
      .maybeSingle();
    if (existingResult) {
      results.push(existingResult as JudgingResult);
      continue;
    }

    const verdict = aiJudgeConfigured()
      ? await judgeProposal(challenge.question, challenge.plot_twist, p.content)
      : null;
    if (!verdict) {
      return { ok: false, results, error: "JUDGING_FAILED" };
    }

    const { data: saved, error } = await admin.rpc("finalize_judging", {
      p_challenge: challenge.id,
      p_team: p.team_id,
      p_originality: clampScore(verdict.originality, RUBRIC[0].max),
      p_feasibility: clampScore(verdict.feasibility, RUBRIC[1].max),
      p_impact: clampScore(verdict.impact, RUBRIC[2].max),
      p_plot_twist: clampScore(verdict.plot_twist, RUBRIC[3].max),
      p_clarity: clampScore(verdict.clarity, RUBRIC[4].max),
      p_strengths: Array.isArray(verdict.strengths) ? verdict.strengths : [],
      p_improvements: Array.isArray(verdict.improvements) ? verdict.improvements : [],
      p_plot_twist_addressed: Boolean(verdict.plot_twist_addressed),
      p_explanation: typeof verdict.explanation === "string" ? verdict.explanation : "",
      p_model: model,
    });
    if (error || !saved) {
      return { ok: false, results, error: error?.message ?? "FINALIZE_FAILED" };
    }
    results.push(saved as JudgingResult);
  }

  await admin.rpc("set_winning_team", { p_challenge: challenge.id });
  return { ok: true, results };
}

export function aiJudgeConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export const FALLBACK_PLOT_TWISTS = [
  "Regulators just banned the core data you planned to collect. Rework the idea around data users already own.",
  "A well-funded competitor launches a near-identical product tomorrow. Find the wedge they cannot copy.",
  "Your target users lose 50% of their income overnight. Who needs this now, and what must change?",
  "The technology cost of one key component drops 100x. Rebuild the idea around what that unlocks.",
];

export function fallbackPlotTwist(): string {
  return FALLBACK_PLOT_TWISTS[Math.floor(Math.random() * FALLBACK_PLOT_TWISTS.length)];
}

export const TWIST_SYSTEM = `You invent plot twists for an idea clash game.
Given a challenge, write ONE sudden constraint or upheaval the teams must absorb mid-game.
Reply with the twist only: 1-2 sentences, under 220 characters, no preamble, no quotes.`;

export async function generatePlotTwist(question: string): Promise<string> {
  try {
    const text = await callAI([
      { role: "system", content: TWIST_SYSTEM },
      { role: "user", content: `Challenge: ${question}` },
    ]);
    const twist = text.replace(/^["'\s]+|["'\s]+$/g, "");
    if (twist.length >= 20) return twist.slice(0, 300);
  } catch {
    // fall through to canned twist
  }
  return fallbackPlotTwist();
}

export { GAME_SECONDS, PLOT_TWIST_AT };
