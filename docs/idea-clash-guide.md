# Idea Clash — feature guide & file map

How every feature works, and what every file in the repo is for.
Companion docs: `docs/database-schema.md` (Shared Spark schema) and `docs/idea-clash-migration.md` (how to apply `0002_idea_clash.sql`).

---

## Part 1 — Features

### 1. Landing & room creation
`/` is a marketing landing with an animated hero. `/create` makes a room: the browser
generates a random 6-character code (unambiguous alphabet, 5 retry attempts on a rare
code collision), stores the creator's token in the room row's `host_token`, and
redirects everyone to `/room/<CODE>`. Joining is by code only — no accounts, no auth.

### 2. Lobby, readiness, team assignment
- Identity is a random UUID in `localStorage` ("campfire_token") sent as the
  `x-participant-token` header on every Supabase request and API call. Same token
  rejoining = same participant (name refresh); a new token with a taken name is
  rejected (`NAME_TAKEN`); the room enforces its capacity (default 6, `ROOM_FULL`).
- Every player sees live participant presence (Realtime on `participants`).
- Players toggle "I'm ready" (`set_ready` RPC writes `participants.is_ready`).
- The host's start button is enabled only with **exactly 2, 4 or 6 players, all ready**.
  `POST /api/game/start` re-verifies the host token, generates the round's challenge
  (AI, with a curated fallback), then calls the `start_game` RPC which — in one
  server-side transaction — creates teams **Blaze** and **Frost**, randomly splits
  players, inserts the challenge with a 900s submission deadline, and stamps
  `rooms.game_started_at`. New joins are locked once that clock exists.

### 3. The authoritative game clock (15 minutes, five phases)
`game_started_at` is written **once, server-side**. Phases are never stored — every
client and the server derive them from elapsed time:

| Phase | Window | What happens |
|---|---|---|
| Private ideas (ideation) | 0:00–3:00 | Each player drafts a private idea |
| Reveal | 3:00–4:00 | Ideas flip to team-visible, read-only |
| Team work | 4:00–7:00 | Scratch pages + proposal drafting |
| Plot twist | 7:00–12:00 | Twist banner appears; proposal reworked |
| Final pitch (submission) | 12:00–15:00 | Proposal finalized; locks at 15:00 |

- Clients correct for clock skew via `GET /api/time` + the offset in `lib/utils.ts`.
- `POST /api/game/tick` is the enforcer: when elapsed time crosses a boundary it calls
  the matching RPC (`reveal_ideas` at 180s, `apply_plot_twist` at 420s,
  `lock_proposals` + auto-judging at 900s). Every transition is idempotent, so any
  client (or a refresh) can safely trigger it.
- Refresh/reconnect never resets anything: state is re-read from the DB, the phase is
  recomputed, and missed transitions fire on the next tick.

### 4. Private ideas → team reveal
While the challenge status is `thinking`, each player's idea is owner-only (RLS:
insert/update require being the row owner, read requires the same). It autosaves to
`initial_ideas` through the anon client — RLS is the security boundary. When the tick
flips the challenge past `thinking`, RLS switches reads to team members (`shares_team_with`)
and update is no longer possible: the editor renders a read-only list of the team's ideas.

### 5. Team scratch pages
Shared team-private notes: `scratch_pages` rows are readable/writable only by teammates
(`is_team_member`), deletion restricted to the page creator. A keyed sub-editor autosaves
title + content ~800ms after typing stops.

### 6. Team chat with voice messages
- Text messages insert into `chat_messages` with the player's `team_id`; RLS scopes
  reads to teammates. Realtime INSERTs are filtered client-side by team.
- **Voice**: tap the mic to record (max 120s). `POST /api/voice/finalize` (multipart)
  runs the whole pipeline server-side: Groq Whisper STT → Gemini polish → edge-TTS
  synthesis → upload of the *synthesized* MP3 to the **private** `voice-messages` bucket
  → one chat row with `transcript`, `audio_storage_path`, `voice_status: ready` and a
  `client_message_id` UUID for dedupe. The raw recording is never stored or sent to
  other clients. Playback fetches a 60-second signed URL from `/api/voice/playback`
  (room participants only).
- Without `GROQ_API_KEY`/`GEMINI_API_KEY` the voice button reports an error instead of
  silently degrading.

### 7. The proposal
One shared proposal per team per challenge (`team_proposals`, unique on the pair),
stored as a JSON object with seven sections: Problem, Solution, How It Works, Target
Users, Impact, Plot Twist Response, The Pitch. The client never writes the table
directly — `POST /api/proposal` validates team membership, the game phase and the
15:00 lock, upserts the draft, stamps `last_edited_by`, and appends a
`proposal_revisions` row whenever content actually changed. After the lock the editor
freezes and the last server-saved draft stands.

### 8. Plot twist
At 7:00 the tick generates a twist (AI, canned fallback) and stamps it on the challenge
(`apply_plot_twist` — only ever once). Both teams get the amber banner from 7:00 until
the end; scoring's "Plot Twist" criterion (25 pts) rewards absorbing it.

### 9. AI judging & results
At 15:00 proposals lock (`lock_proposals`: stamps `submitted_at`/`locked_at`, flips the
challenge to `judging`) and judging runs: for each proposal, the AI returns JSON scored
against the rubric — Originality 20 / Feasibility 25 / Impact 20 / Plot Twist 25 /
Clarity 10 — which `finalize_judging` clamps to the maxima, computes the stored total,
and upserts idempotently (service-role only; clients have no write policy at all).
When every proposal has a result the challenge flips to `reveal` and results become
readable. `set_winning_team` picks the highest total, tie-breaking Plot Twist →
Feasibility, else a draw. `/room/<code>` renders the results page: both proposals,
per-criterion bars, strengths/improvements, explanation, winner/draw.

### 10. What retired
The Shared Spark loop (`RoomClient`, `ChallengePanel`, `Recap`, `Sidebar`,
`PhaseIndicator`, `Timer`, room-wide `ChatPanel`) is no longer rendered — the room runs
`IdeaClient`. The files stay as reusable pieces. The old APIs (`/api/ai/challenge`,
`/api/ai/explain`, `/api/voice/transcribe|polish|speak`) still work: the first two serve
fallbacks/reference, the voice three are the local "polish booth" pipeline the chat
finalize route composes from.

---

## Part 2 — File map

### Root
| File | Why it exists |
|---|---|
| `package.json` | Scripts (`dev`, `build`, `lint`), deps: Next 16, React 19, Supabase JS/SSR, msedge-tts, Tailwind 4, lucide-react |
| `next.config.ts` | Maps `CAMPFIRE_*`-prefixed env vars to the plain `NEXT_PUBLIC_*`/service-role names; Turbopack + Tailwind loader; cacheComponents |
| `tsconfig.json` | TS config, `@/*` path alias → `src/` |
| `eslint.config.mjs` | Flat ESLint config (next/core-web-vitals + TS rules) |
| `.env.example` | Documents every env var (see below) |
| `.gitignore` | Ignores `.next`, `node_modules`, `.env*` |
| `AGENTS.md` | Coding-agent instructions (Next.js version notice) |
| `README.md` | Project intro |
| `public/*.svg` | Static icons (mostly unused scaffolding) |

### `supabase/`
| File | Why it exists |
|---|---|
| `migrations/0001_init.sql` | Original Shared Spark schema: rooms, participants, chat, challenges, submissions, conclusions, sessions + RLS + token helpers |
| `migrations/0002_idea_clash.sql` | **The Idea Clash schema** (additive, idempotent): teams/members, proposals, judging rubric, initial_ideas, scratch_pages, game clock columns, server RPCs, RLS, voice bucket, realtime adds. See `docs/idea-clash-migration.md` before applying |

### `src/lib/` — shared logic
| File | Why it exists |
|---|---|
| `supabase-client.ts` | Browser Supabase client; creates/reads the participant token from localStorage and attaches it as `x-participant-token` on every request |
| `supabase-server.ts` | Service-role Supabase client for API routes (bypasses RLS — that's why every route re-checks permissions itself) |
| `game.ts` | The single source of truth for the schedule: phase bounds, 900s total, twist at 420s, rubric maxima, proposal sections, phase helpers |
| `server-game.ts` | Server-only helpers: room/challenge loading with elapsed/phase, participant auth, AI judging (JSON parse + clamp + retry), plot-twist generation, idempotent `runJudging` |
| `ai.ts` | OpenAI-compatible `callAI` used for challenges, twists and judging |
| `voice.ts` | Voice pipeline primitives: Groq Whisper STT, Gemini polish, edge-TTS synthesis |
| `types.ts` | All shared TS types (Room, Participant, Team, Challenge, InitialIdea, ScratchPage, TeamProposal, JudgingResult, ChatMessage, …) |
| `utils.ts` | `cn`, room-code generator, avatar colors, time formatting, server-clock offset (`serverNow`) |
| `activities.ts` | Activity/session labels and the curated fallback challenge pool used when AI is unconfigured |

### `src/app/` — routes & UI
| File | Why it exists |
|---|---|
| `layout.tsx` | Root layout, fonts, Navbar |
| `page.tsx` | Landing page |
| `globals.css` | Tailwind theme tokens (night/ember/cream/lilac palette, scroll-thin, etc.) |
| `create/page.tsx` | Room creation form (code generation, host_token, duration) |
| `room/[code]/page.tsx` | Room route — resolves the code and renders `IdeaClient` |
| `room/[code]/IdeaClient.tsx` | **The room orchestrator**: join/naming → lobby → game → results; owns all state, realtime subscriptions, heartbeat, the tick trigger, and every client-side action |
| `room/[code]/Lobby.tsx` | Pre-game screen: 2/4/6 rules, ready toggles, host start gating |
| `room/[code]/PhaseStepper.tsx` | Five-phase stepper + countdown, derived from `game_started_at` + server offset |
| `room/[code]/IdeaEditor.tsx` | Private idea autosave; flips to read-only team list at reveal |
| `room/[code]/ScratchPages.tsx` | Team page list + keyed autosave editor |
| `room/[code]/ProposalEditor.tsx` | Seven-section proposal editor with autosave and lock state |
| `room/[code]/TeamChat.tsx` | Team-scoped chat UI composing `VoiceMessage`/`VoicePlayback` |
| `room/[code]/VoiceMessage.tsx` | MediaRecorder button → `/api/voice/finalize`; signed-URL playback component |
| `room/[code]/PlotTwistBanner.tsx` | Amber twist banner shown to both teams from 7:00 |
| `room/[code]/Results.tsx` | Winner/draw reveal, rubric bars, explanations, both proposals |
| `room/[code]/RoomClient.tsx` | **Retired** Shared Spark orchestrator (kept for reference) |
| `room/[code]/ChatPanel.tsx` | **Retired** room-wide chat panel (pattern reused by TeamChat) |
| `room/[code]/ChallengePanel.tsx`, `Sidebar.tsx`, `Recap.tsx` | **Retired** Shared Spark pieces |
| `room/[code]/VoicePanel.tsx` | **Retired** local voice booth (record → polish → speak back to self) |

### `src/app/api/` — server routes
| Route | Why it exists |
|---|---|
| `time/route.ts` | Server timestamp for clock-skew correction |
| `game/start/route.ts` | Host-only start: verifies token/host, generates the challenge, calls `start_game` RPC |
| `game/tick/route.ts` | Phase-transition enforcer (reveal → twist → lock → judge), all idempotent |
| `proposal/route.ts` | Proposal draft save: membership + phase + lock validated server-side, revision appended |
| `judging/route.ts` | Manual/idempotent judging trigger returning rubric results |
| `voice/finalize/route.ts` | Voice-message pipeline (STT → polish → TTS → private upload → chat row, deduped) |
| `voice/playback/route.ts` | 60s signed URLs for stored voice audio (participants only) |
| `voice/transcribe/route.ts`, `voice/polish/route.ts`, `voice/speak/route.ts` | Standalone voice primitives (used by the retired VoicePanel; finalize composes the same libs) |
| `ai/challenge/route.ts`, `ai/explain/route.ts` | Shared Spark challenge/explanation endpoints (kept; the Idea Clash start route has its own prompt) |

### `src/components/` — shared UI
| File | Why it exists |
|---|---|
| `ui/Button.tsx`, `ui/Card.tsx`, `ui/Input.tsx` | Design-system primitives used everywhere |
| `ui/Avatar.tsx` | Deterministic colored initials avatar (used by Lobby) |
| `ui/Skeleton.tsx` | Loading placeholder |
| `ui/PhaseIndicator.tsx`, `ui/Timer.tsx` | **Retired** Shared Spark phase/timer UI (replaced by PhaseStepper) |
| `Navbar.tsx` | Top navigation on public pages |
| `landing/HeroScene.tsx` | Landing animation |

### `docs/`
| File | Why it exists |
|---|---|
| `database-schema.md` | Shared Spark (0001) schema reference |
| `idea-clash-migration.md` | How to apply `0002_idea_clash.sql` safely (dry-run steps) |
| `idea-clash-guide.md` | This document |

### `scripts/`
| File | Why it exists |
|---|---|
| `typecheck.cjs` | `tsc` via the compiler API writing a report file — a workaround for this sandbox swallowing shell output; safe to delete |

---

## Part 3 — Environment variables (all optional-graceful)

| Variable | Used by | Missing means |
|---|---|---|
| `CAMPFIRE_NEXT_PUBLIC_SUPABASE_URL` + `CAMPFIRE_NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `_PUBLISHABLE_KEY`) | Browser + server | App can't start meaningfully — no DB |
| `CAMPFIRE_SUPABASE_SERVICE_ROLE_KEY` | All API routes | Routes return 500 "Server Supabase is not configured" |
| `AI_API_KEY`, `AI_API_BASE`, `AI_MODEL` | challenge/twist/judging generation | Curated fallback challenges, canned twists, judging fails with `JUDGING_FAILED` |
| `GROQ_API_KEY` | Voice STT | Voice messages error out |
| `GEMINI_API_KEY` | Transcript polish | Voice still works, text unpolished |

`next.config.ts` re-maps the `CAMPFIRE_*` names; the unprefixed variants work as fallback.

## Part 4 — Trust model (the one-paragraph version)
The browser is untrusted. RLS is the first wall (ownership/team scoping in Postgres),
server RPCs are the second (`start_game`, `lock_proposals`, `finalize_judging` verify
host/service identity and game state), and API routes are the third (they re-verify the
participant token against the DB before acting). Scores, totals, deadlines and team
membership are never taken from the client; the game clock is a database timestamp.
