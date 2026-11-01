"use client";

import Link from "next/link";
import { Bot, Home, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RUBRIC, PROPOSAL_SECTIONS } from "@/lib/game";
import type { ProposalSectionKey } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { JudgingResult, Team, TeamProposal } from "@/lib/types";

type Sections = Partial<Record<ProposalSectionKey, string>>;

function parseSections(content: string): Sections {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Sections;
  } catch {
    // plain-text fallback
  }
  return content ? { pitch: content } : {};
}

export function Results({
  teams,
  proposals,
  results,
  winningTeamId,
}: {
  teams: Team[];
  proposals: TeamProposal[];
  results: JudgingResult[];
  winningTeamId: string | null;
}) {
  const draw = winningTeamId === null;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const ranked = [...results].sort(
    (a, b) => b.total_score - a.total_score || b.plot_twist_score - a.plot_twist_score
  );
  const topTotal = ranked[0]?.total_score ?? 0;
  const tied = ranked.filter((r) => r.total_score === topTotal);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ember">The verdict</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {draw && results.length > 0
            ? "It's a draw"
            : winningTeamId
              ? `Team ${teamById.get(winningTeamId)?.name ?? "?"} wins the clash`
              : "Judging complete"}
        </h1>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          Rubric-based AI judgment — Originality 20 · Feasibility 25 · Impact 20 · Plot Twist 25 · Clarity 10
        </p>
        {draw && results.length > 0 && tied.length > 1 && (
          <p className="text-xs text-muted/80">
            Tied on total, Plot Twist and Feasibility — both teams share the crown.
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const proposal = proposals.find((p) => p.team_id === team.id) ?? null;
          const result = results.find((r) => r.team_id === team.id) ?? null;
          const sections = parseSections(proposal?.content ?? "");
          const isWinner = winningTeamId === team.id;

          return (
            <Card
              key={team.id}
              className={cn("flex flex-col gap-3 p-4", isWinner && "border-ember/60 shadow-[0_0_24px_rgba(255,146,46,0.2)]")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                    aria-hidden
                  />
                  Team {team.name}
                </h2>
                {result && (
                  <span className="font-mono text-xl font-extrabold">
                    {result.total_score}
                    <span className="text-xs text-muted">/100</span>
                  </span>
                )}
              </div>

              {result ? (
                <>
                  <ul className="flex flex-col gap-1.5">
                    {RUBRIC.map((c) => {
                      const score =
                        c.key === "originality"
                          ? result.originality_score
                          : c.key === "feasibility"
                            ? result.feasibility_score
                            : c.key === "impact"
                              ? result.impact_score
                              : c.key === "plot_twist"
                                ? result.plot_twist_score
                                : result.clarity_score;
                      return (
                        <li key={c.key} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-muted">{c.label}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                            <span
                              className="block h-full rounded-full bg-ember"
                              style={{ width: `${(score / c.max) * 100}%` }}
                            />
                          </span>
                          <span className="w-10 text-right font-mono">
                            {score}/{c.max}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {result.strengths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-400">Strengths</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-cream/90">
                        {result.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.improvements.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Improve</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-cream/90">
                        {result.improvements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.judge_explanation && (
                    <p className="rounded-xl border border-lilac/40 bg-lilac/10 p-3 text-xs leading-relaxed">
                      {result.judge_explanation}
                    </p>
                  )}
                </>
              ) : (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Scale className="h-3.5 w-3.5" aria-hidden /> Judging pending…
                </p>
              )}

              <details className="mt-auto rounded-xl border border-line bg-night-soft p-3">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Read the proposal
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {PROPOSAL_SECTIONS.map((s) => (
                    <div key={s.key}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/80">{s.label}</p>
                      <p className="whitespace-pre-wrap text-xs text-cream/90">
                        {sections[s.key] || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center gap-3 pb-8">
        <Link href="/">
          <Button variant="secondary">
            <Home className="h-4 w-4" aria-hidden /> Back home
          </Button>
        </Link>
      </div>
    </div>
  );
}
