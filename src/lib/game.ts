export const PHASE_DURATIONS = {
  ideation: 180,
  reveal: 60,
  team_work: 180,
  plot_twist: 300,
  submission: 180,
} as const;

export const GAME_SECONDS =
  PHASE_DURATIONS.ideation +
  PHASE_DURATIONS.reveal +
  PHASE_DURATIONS.team_work +
  PHASE_DURATIONS.plot_twist +
  PHASE_DURATIONS.submission;

export const PLOT_TWIST_AT = 420;
export const IDEAS_REVEAL_AT = PHASE_DURATIONS.ideation;
export const PROPOSAL_LOCK_AT = GAME_SECONDS;

export type GamePhase =
  | "lobby"
  | "ideation"
  | "reveal"
  | "team_work"
  | "plot_twist"
  | "submission"
  | "judging"
  | "results";

const PHASE_BOUNDS: { phase: GamePhase; start: number; end: number }[] = [
  { phase: "ideation", start: 0, end: 180 },
  { phase: "reveal", start: 180, end: 240 },
  { phase: "team_work", start: 240, end: 420 },
  { phase: "plot_twist", start: 420, end: 720 },
  { phase: "submission", start: 720, end: 900 },
];

export function phaseAt(elapsedSec: number): GamePhase {
  const s = Math.max(0, Math.floor(elapsedSec));
  for (const b of PHASE_BOUNDS) {
    if (s >= b.start && s < b.end) return b.phase;
  }
  return "results";
}

export function phaseEndsAt(phase: GamePhase): number | null {
  const b = PHASE_BOUNDS.find((x) => x.phase === phase);
  return b ? b.end : null;
}

export function gameElapsed(gameStartedAt: string | null, nowMs: number): number {
  if (!gameStartedAt) return 0;
  return (nowMs - new Date(gameStartedAt).getTime()) / 1000;
}

export function nextBoundary(elapsedSec: number): { at: number; phase: GamePhase } | null {
  const s = Math.max(0, Math.floor(elapsedSec));
  for (const b of PHASE_BOUNDS) {
    if (s < b.start) return { at: b.start, phase: b.phase };
    if (s < b.end) return { at: b.end, phase: phaseAt(b.end) };
  }
  return null;
}

export const RUBRIC = [
  { key: "originality", label: "Originality", max: 20 },
  { key: "feasibility", label: "Feasibility", max: 25 },
  { key: "impact", label: "Impact", max: 20 },
  { key: "plot_twist", label: "Plot Twist", max: 25 },
  { key: "clarity", label: "Clarity", max: 10 },
] as const;

export const PROPOSAL_SECTIONS = [
  { key: "problem", label: "The Problem", placeholder: "What pain does this solve, and for whom?" },
  { key: "solution", label: "The Solution", placeholder: "The core idea in one crisp paragraph." },
  { key: "how", label: "How It Works", placeholder: "The mechanics — what would actually get built." },
  { key: "users", label: "Target Users", placeholder: "Who uses it first, and how it spreads." },
  { key: "impact", label: "Impact", placeholder: "Why this matters — the change it creates." },
  { key: "twist", label: "Plot Twist Response", placeholder: "How the twist reshapes the idea." },
  { key: "pitch", label: "The Pitch", placeholder: "The one paragraph you'd say out loud to judges." },
] as const;

export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]["key"];
