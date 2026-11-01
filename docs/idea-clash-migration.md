# Idea Clash migration — 0002_idea_clash.sql

## What it is
An additive, idempotent migration that turns the Shared Spark schema into Idea Clash:

- **Rooms**: capacity capped at 6 (`rooms_max_participants_check`), server-authoritative
  `game_started_at`, `plot_twist_at_seconds` default fixed to **420** (7:00), new state set
  (legacy values still allowed so old rows don't violate the check).
- **Participants**: `is_ready` for lobby gating; rejoin-safe identity via the existing token.
- **New tables**: `initial_ideas` (owner-only until the 3:00 reveal, team-readable and
  read-only after), `scratch_pages` (team-private), plus `teams`, `team_members`,
  `team_proposals`, `proposal_revisions` if they don't exist yet.
- **Judging**: spec rubric — Originality 20 / Feasibility 25 / Impact 20 / Plot Twist 25 /
  Clarity 10 — with a database-computed stored total. The off-spec 30/25/20/15/10 columns
  from the edited `0001` are dropped.
- **RLS**: owner-only initial ideas pre-reveal; team-only scratch pages and team chat;
  opposing proposals hidden until reveal; locked proposals immutable; judging writes are
  service-role only (no client policy at all).
- **RPCs** (server-enforced, never client-trusted): `start_game` (host-only, exactly
  2/4/6 participants, everyone ready, random two-team split), `reveal_ideas`,
  `apply_plot_twist`, `lock_proposals` (15:00, preserves the last saved draft),
  `finalize_judging` (service-only, clamps scores, idempotent), `set_winning_team`
  (tie-break: Plot Twist → Feasibility → draw), `set_ready`, `join_room` (blocks new
  joins once the clock runs), `room_phase` (phase derived from `game_started_at`).
- **Voice**: one private `voice-messages` storage bucket. Raw recordings are never stored;
  the server stores only synthesized audio and clients play it via short-lived signed URLs.

## How to apply (dry-run first)
1. **Never assume it ran.** Check the live database first:
   ```sql
   select tablename from pg_tables
   where schemaname = 'public'
     and tablename in ('teams','initial_ideas','scratch_pages','judging_results');
   ```
2. Run it in the Supabase SQL editor inside a transaction to preview:
   `begin;` + file contents, then inspect, then `commit;` (or `rollback;` to dry-run).
3. It is safe whether the live `0001_init.sql` is the original or the edited Idea Clash
   variant — every statement is guarded (`if not exists` / `drop if exists`), and re-running
   the whole file is a no-op.
4. Nothing in this repo claims the migration is applied; after applying, record it in the
   team notes.

## After applying
- Realtime publication adds are guarded, so rooms/participants/chat plus the new tables
  broadcast without duplicate-publication errors.
- The room UI (`src/app/room/[code]/IdeaClient.tsx`) drives phase transitions by calling
  `/api/game/tick`, which performs each transition exactly once via the RPCs above.
- Game schedule (fixed, from `src/lib/game.ts`): ideation 0–3:00 → reveal 3:00–4:00 →
  team work 4:00–7:00 → plot twist 7:00–12:00 → submission 12:00–15:00 → judging → reveal.
