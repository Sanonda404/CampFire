-- Campfire / Idea Clash schema upgrade
-- Apply AFTER 0001_init.sql. Review the project code and Supabase policies before production use.
-- Voice recordings should be stored in a PRIVATE Supabase Storage bucket; save only the object path here.

create extension if not exists "pgcrypto";

-- 1. Adapt rooms to the Idea Clash game loop.
alter table public.rooms
  add column if not exists max_participants integer not null default 6,
  add column if not exists plot_twist_at_seconds integer not null default 120,
  add column if not exists reveal_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.rooms
  drop constraint if exists rooms_state_check;

alter table public.rooms
  add constraint rooms_state_check
  check (state in ('waiting','team_assignment','brainstorming','plot_twist','submission','judging','reveal','complete'));

alter table public.rooms
  add constraint rooms_max_participants_check
  check (max_participants between 2 and 12);

alter table public.rooms
  add constraint rooms_plot_twist_at_check
  check (plot_twist_at_seconds >= 0 and plot_twist_at_seconds < duration_sec);

-- Keep the old room state transition RPC in mind: advance_room_state() from 0001
-- must be updated in application code (or replaced by a new RPC) to use the new states.

-- 2. Anonymous participants and team membership.
alter table public.participants
  add column if not exists is_connected boolean not null default true;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (room_id, name),
  unique (id, room_id)
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, participant_id),
  unique (participant_id)
);

-- 3. Extend challenges into the round's scenario and Plot Twist.
alter table public.challenges
  add column if not exists plot_twist text,
  add column if not exists plot_twist_at timestamptz,
  add column if not exists brainstorming_started_at timestamptz,
  add column if not exists submission_deadline timestamptz,
  add column if not exists submissions_locked_at timestamptz,
  add column if not exists judging_started_at timestamptz,
  add column if not exists judging_completed_at timestamptz;

alter table public.challenges
  drop constraint if exists challenges_status_check;

alter table public.challenges
  add constraint challenges_status_check
  check (status in ('thinking','sharing','plot_twist','submission','judging','reveal','agreed','completed'));

-- 4. One shared proposal per team per challenge.
create table if not exists public.team_proposals (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  content text not null default '',
  submitted_at timestamptz,
  locked_at timestamptz,
  last_edited_by uuid references public.participants(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (challenge_id, team_id)
);

-- Optional edit history allows the final submitted version to be audited.
create table if not exists public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.team_proposals(id) on delete cascade,
  editor_participant_id uuid references public.participants(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 5. Structured AI judging results, one per team proposal.
create table if not exists public.judging_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  problem_solving_score integer not null check (problem_solving_score between 0 and 30),
  creativity_score integer not null check (creativity_score between 0 and 25),
  feasibility_score integer not null check (feasibility_score between 0 and 20),
  user_impact_score integer not null check (user_impact_score between 0 and 15),
  clarity_score integer not null check (clarity_score between 0 and 10),
  total_score integer generated always as
    (problem_solving_score + creativity_score + feasibility_score + user_impact_score + clarity_score) stored,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  plot_twist_addressed boolean not null default false,
  judge_explanation text not null default '',
  model_name text,
  created_at timestamptz not null default now(),
  unique (challenge_id, team_id)
);

alter table public.rooms
  add column if not exists winning_team_id uuid references public.teams(id) on delete set null;

-- 6. Text and synthetic-voice messages in team chat.
alter table public.chat_messages
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists message_type text not null default 'text',
  add column if not exists transcript text,
  add column if not exists audio_storage_path text,
  add column if not exists audio_duration_ms integer,
  add column if not exists voice_status text not null default 'not_applicable',
  add column if not exists client_message_id uuid;

alter table public.chat_messages
  add constraint chat_messages_type_check
  check (message_type in ('text','voice'));

alter table public.chat_messages
  add constraint chat_messages_voice_status_check
  check (voice_status in ('not_applicable','uploading','transcribing','generating','ready','failed'));

alter table public.chat_messages
  add constraint chat_messages_audio_duration_check
  check (audio_duration_ms is null or audio_duration_ms between 1 and 120000);

create unique index if not exists idx_chat_client_message_id
  on public.chat_messages (room_id, client_message_id)
  where client_message_id is not null;

-- Voice messages should only be visible when ready. Store a private Storage object path,
-- not a public URL. The server should authorize playback and issue short-lived signed URLs.
-- Never store or expose the original recording as the playable message; store the synthesized
-- audio output in audio_storage_path after speech-to-text and TTS processing.

-- 7. Helper functions used by RLS.
create or replace function public.is_team_member(p_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members tm
    join public.participants p on p.id = tm.participant_id
    where tm.team_id = p_team
      and p.token = public.requester_token()
  )
$$;

create or replace function public.team_belongs_to_room(p_team uuid, p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team and t.room_id = p_room
  )
$$;

-- 8. Enable RLS on all new tables.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_proposals enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.judging_results enable row level security;

-- Replace the original permissive chat policies. Team chat is readable only by members
-- of that team. Legacy rows without team_id remain readable by room participants.
drop policy if exists "chat readable" on public.chat_messages;
drop policy if exists "chat insertable" on public.chat_messages;

create policy "team chat readable" on public.chat_messages
for select using (
  (team_id is not null and public.is_team_member(team_id))
  or
  (team_id is null and public.is_participant(room_id))
);

create policy "team chat insertable" on public.chat_messages
for insert with check (
  public.is_participant(room_id)
  and (
    (message_type = 'text' and voice_status = 'not_applicable')
    or
    (message_type = 'voice' and voice_status in ('uploading','transcribing','generating','ready'))
  )
  and (
    (team_id is not null and public.team_belongs_to_room(team_id, room_id) and public.is_team_member(team_id))
    or
    (team_id is null)
  )
);

-- Team membership and teams can be read by room participants.
create policy "teams readable by room participants" on public.teams
for select using (public.is_participant(room_id));

create policy "team members readable by room participants" on public.team_members
for select using (
  exists (
    select 1 from public.teams t
    where t.id = team_members.team_id and public.is_participant(t.room_id)
  )
);

-- Proposal content is private to the owning team until the challenge is revealed.
create policy "team proposals readable by own team or after reveal" on public.team_proposals
for select using (
  public.is_team_member(team_id)
  or exists (
    select 1 from public.challenges c
    where c.id = team_proposals.challenge_id
      and c.status in ('reveal','agreed','completed')
  )
);

create policy "team members can create proposals" on public.team_proposals
for insert with check (
  public.is_team_member(team_id)
  and exists (
    select 1 from public.challenges c
    join public.rooms r on r.id = c.room_id
    where c.id = challenge_id
      and c.status in ('thinking','sharing','plot_twist','submission')
      and r.state in ('brainstorming','plot_twist','submission')
      and (c.submission_deadline is null or now() <= c.submission_deadline)
  )
);

create policy "team members can edit unlocked proposals" on public.team_proposals
for update using (
  public.is_team_member(team_id)
  and submitted_at is null
  and locked_at is null
)
with check (
  public.is_team_member(team_id)
  and submitted_at is null
  and locked_at is null
  and exists (
    select 1 from public.challenges c
    join public.rooms r on r.id = c.room_id
    where c.id = challenge_id
      and c.status in ('thinking','sharing','plot_twist','submission')
      and r.state in ('brainstorming','plot_twist','submission')
      and (c.submission_deadline is null or now() <= c.submission_deadline)
  )
);

create policy "proposal revisions readable by team or after reveal" on public.proposal_revisions
for select using (
  exists (
    select 1 from public.team_proposals p
    where p.id = proposal_id
      and (
        public.is_team_member(p.team_id)
        or exists (
          select 1 from public.challenges c
          where c.id = p.challenge_id and c.status in ('reveal','agreed','completed')
        )
      )
  )
);

create policy "team members can add proposal revisions" on public.proposal_revisions
for insert with check (
  editor_participant_id is not null
  and exists (
    select 1 from public.team_proposals p
    where p.id = proposal_id and public.is_team_member(p.team_id)
      and p.submitted_at is null and p.locked_at is null
  )
);

create policy "judging results visible after reveal" on public.judging_results
for select using (
  exists (
    select 1 from public.challenges c
    where c.id = challenge_id and c.status in ('reveal','agreed','completed')
  )
);

-- Judging results should be written by trusted server-side code using the service role
-- or a dedicated SECURITY DEFINER judging RPC, not directly by clients.

-- 9. Helpful indexes.
create index if not exists idx_teams_room on public.teams (room_id);
create index if not exists idx_team_members_participant on public.team_members (participant_id);
create index if not exists idx_team_proposals_challenge on public.team_proposals (challenge_id);
create index if not exists idx_proposal_revisions_proposal_time on public.proposal_revisions (proposal_id, created_at);
create index if not exists idx_judging_results_challenge on public.judging_results (challenge_id);
create index if not exists idx_chat_team_time on public.chat_messages (team_id, created_at);
create index if not exists idx_challenges_deadline on public.challenges (submission_deadline);

-- 10. Add new tables to Supabase Realtime.
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.team_proposals;
alter publication supabase_realtime add table public.judging_results;

-- NOTE: PostgreSQL policies are not a substitute for server-side deadline enforcement.
-- For production, route team assignment, proposal submission/locking, judging, and voice
-- processing through authenticated server endpoints/RPCs. Do not trust client-supplied
-- participant IDs, team IDs, scores, transcripts, or audio paths.
