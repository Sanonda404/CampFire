# Campfire Database Schema

Reference for the Supabase (Postgres) schema. Source of truth: `supabase/migrations/0001_init.sql`.

## Tables

### rooms

One row per session room.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | `gen_random_uuid()` |
| code | text NOT NULL UNIQUE | 6-char join code |
| name | text NOT NULL | display name |
| activity_type | text NOT NULL | `focus`, `study`, `writing`, `brainstorm`, `debugging` |
| session_type | text NOT NULL | `quick`, `pomodoro`, `deep` |
| description | text | optional |
| host_token | text NOT NULL | participant token of the host |
| state | text NOT NULL | `waiting` → `focusing` → `challenge_thinking` → `challenge_sharing` → `reveal` → `discussion` → `group_answer` → `complete` |
| current_challenge_id | uuid | active Shared Spark, if any |
| started_at | timestamptz | timer start (null when paused/reset) |
| duration_sec | int | timer length (default 1500) |
| paused_accumulated | int | seconds accumulated while paused |
| is_paused | boolean | default true |
| created_at | timestamptz | default now() |

### participants

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| room_id | uuid NOT NULL FK → rooms | cascade delete |
| token | text NOT NULL | browser participant token (unique per room) |
| name | text NOT NULL | unique per room |
| is_host | boolean | default false |
| last_seen_at | timestamptz | heartbeat; online = < 70s old |
| created_at | timestamptz | |

Constraints: UNIQUE (room_id, token), UNIQUE (room_id, name).

### chat_messages

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| room_id | uuid NOT NULL FK → rooms | |
| participant_token | text NOT NULL | |
| sender | text NOT NULL | display name |
| text | text NOT NULL | |
| created_at | timestamptz | |

### challenges

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| room_id | uuid NOT NULL FK → rooms | |
| question | text NOT NULL | |
| context | text | guidance line |
| status | text NOT NULL | `thinking`, `sharing`, `reveal`, `agreed`, `completed` |
| ai_generated | boolean | false when from the predefined pool |
| created_at | timestamptz | |

### submissions

One answer per participant per challenge.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| challenge_id | uuid NOT NULL FK → challenges | |
| participant_token | text NOT NULL | |
| answer | text NOT NULL | |
| reasoning | text | optional |
| created_at | timestamptz | |

Constraints: UNIQUE (challenge_id, participant_token) — enforces one answer each.

### conclusions

One group answer per challenge.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| challenge_id | uuid NOT NULL UNIQUE FK → challenges | |
| participant_token | text NOT NULL | who recorded it |
| final_answer | text NOT NULL | |
| ai_explanation | text | filled by /api/ai/explain |
| created_at | timestamptz | |

### sessions

Recap persisted when a host completes a session.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| room_id | uuid NOT NULL FK → rooms | |
| summary | text | last challenge question |
| duration_sec | int | focused seconds |
| participant_count | int | |
| challenges_completed | int | |
| created_at | timestamptz | |

## Functions (RPC)

Security-definer, so host checks cannot be bypassed client-side.

| Function | Purpose |
| --- | --- |
| `join_room(p_code, p_name, p_token)` | Validates the room code, inserts or refreshes the participant; raises `ROOM_NOT_FOUND` |
| `advance_room_state(p_room, p_next)` | Host-only transition along the state machine; raises `NOT_HOST` / `INVALID_TRANSITION`. On `reveal` it flips the challenge to reveal (unlocking submissions for everyone at once); on `complete` it marks the challenge completed |
| `update_timer(p_room, p_action, p_duration)` | Host-only; actions `start`, `pause`, `resume`, `reset` |
| `set_challenge(p_room, p_challenge)` | Host-only; sets current_challenge_id |
| `heartbeat(p_room)` | Refreshes caller's last_seen_at |
| `is_participant(p_room)` / `is_host(p_room)` | Helpers used by policies; identify caller by the `x-participant-token` header |
| `requester_token()` | Reads the `x-participant-token` request header |

## Row Level Security

RLS is enabled on every table. The caller is identified by a browser-generated
token sent as the `x-participant-token` header.

Open to anyone with the link (multiplayer visibility): SELECT on all tables,
INSERT on rooms / participants / chat_messages / sessions.

Restricted:

- **participants UPDATE** — only your own row (`token = requester_token()`).
- **submissions INSERT** — only your own token, only while the room is in
  `challenge_thinking`/`challenge_sharing`; the UNIQUE constraint blocks duplicates.
- **submissions UPDATE** — only your own row.
- **submissions SELECT** — your own rows, or any row once the challenge status is
  `reveal`/`agreed`/`completed`. This is what guarantees no answer is visible
  to any client before the host triggers reveal.
- **conclusions INSERT** — any participant, only while the room is in
  `group_answer`; UNIQUE per challenge records the single group answer.
- Room mutations (state, timer, challenge pointer) are only possible through the
  RPCs above — no direct UPDATE policy exists on rooms.

## Realtime

`supabase_realtime` publication includes: rooms, participants, chat_messages,
challenges, submissions, conclusions. Clients subscribe per room (and per
challenge for submissions/conclusions).

## Indexes

- `chat_messages (room_id, created_at)`
- `participants (room_id)`
- `submissions (challenge_id)`
- `challenges (room_id, created_at)`

## Applying

Run the migration in the Supabase SQL editor or CLI:

```bash
supabase db push   # or paste supabase/migrations/0001_init.sql into the SQL editor
```

Connection settings live in `.env` (see `.env.example`); Supabase variables use
the `CAMPFIRE_` prefix (mapped in `next.config.ts`).
