-- Idea Clash (0002) — additive, idempotent evolution of the Campfire schema.
-- Safe to run whether the live database has the ORIGINAL 0001_init.sql (Shared Spark)
-- or an edited 0001 that already carries partial Idea Clash tables. Every statement is
-- guarded (if not exists / drop if exists) so re-running is a no-op.
--
-- Game loop (fixed schedule, phases derived from rooms.game_started_at):
--   0:00-3:00  ideation    (private ideas, owner-only)
--   3:00-4:00  reveal      (ideas flip to team-visible, read-only)
--   4:00-7:00  team_work   (scratch pages + proposal drafting)
--   7:00-12:00 plot_twist  (plot_twist_at_seconds = 420)
--   12:00-15:00 submission (proposals lock at 900s)
--   then judging -> reveal (results)
--
-- Apply with review; never assume it has run. See docs/idea-clash-migration.md.

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Teams and membership (missing on the original 0001)
-- ============================================================

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

-- ============================================================
-- 2. Rooms: capacity 6, game clock, plot twist at 420s
-- ============================================================

alter table public.rooms
  add column if not exists max_participants integer not null default 6,
  add column if not exists game_started_at timestamptz,
  add column if not exists plot_twist_at_seconds integer not null default 420,
  add column if not exists reveal_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 0002 references teams, so add winning_team_id only after teams exists.
alter table public.rooms
  add column if not exists winning_team_id uuid references public.teams(id) on delete set null;

-- The edited 0001 shipped default 120; the spec pins the twist at 07:00.
alter table public.rooms alter column plot_twist_at_seconds set default 420;
update public.rooms set plot_twist_at_seconds = 420 where plot_twist_at_seconds = 120;

alter table public.rooms drop constraint if exists rooms_max_participants_check;
alter table public.rooms
  add constraint rooms_max_participants_check
  check (max_participants between 2 and 6);

alter table public.rooms drop constraint if exists rooms_plot_twist_at_check;
alter table public.rooms
  add constraint rooms_plot_twist_at_check
  check (plot_twist_at_seconds >= 0 and plot_twist_at_seconds < duration_sec);

-- Union of legacy Shared Spark states and the Idea Clash loop, so neither schema's rows violate.
alter table public.rooms drop constraint if exists rooms_state_check;
alter table public.rooms
  add constraint rooms_state_check
  check (state in (
    'waiting','team_assignment','brainstorming','plot_twist','submission','judging','reveal','complete',
    'focusing','challenge_thinking','challenge_sharing','discussion','group_answer'
  ));

-- ============================================================
-- 3. Participants: readiness + heartbeat column parity
-- ============================================================

alter table public.participants
  add column if not exists is_ready boolean not null default false,
  add column if not exists is_connected boolean not null default true;

-- ============================================================
-- 4. Challenges: scenario + plot twist + judging timestamps
-- ============================================================

alter table public.challenges
  add column if not exists plot_twist text,
  add column if not exists plot_twist_at timestamptz,
  add column if not exists brainstorming_started_at timestamptz,
  add column if not exists submission_deadline timestamptz,
  add column if not exists submissions_locked_at timestamptz,
  add column if not exists judging_started_at timestamptz,
  add column if not exists judging_completed_at timestamptz;

alter table public.challenges drop constraint if exists challenges_status_check;
alter table public.challenges
  add constraint challenges_status_check
  check (status in ('thinking','sharing','plot_twist','submission','judging','reveal','agreed','completed'));

-- ============================================================
-- 5. Team proposals + revisions (one proposal per team per challenge)
-- ============================================================

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

create table if not exists public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.team_proposals(id) on delete cascade,
  editor_participant_id uuid references public.participants(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. Judging results — spec rubric:
--    Originality 20 / Feasibility 25 / Impact 20 / Plot Twist 25 / Clarity 10
--    (replaces the off-spec 30/25/20/15/10 columns from the edited 0001)
-- ============================================================

create table if not exists public.judging_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  plot_twist_addressed boolean not null default false,
  judge_explanation text not null default '',
  model_name text,
  created_at timestamptz not null default now(),
  unique (challenge_id, team_id)
);

alter table public.judging_results
  add column if not exists originality_score integer not null default 0,
  add column if not exists feasibility_score integer not null default 0,
  add column if not exists impact_score integer not null default 0,
  add column if not exists plot_twist_score integer not null default 0,
  add column if not exists clarity_score integer not null default 0;

-- Drop the off-spec columns (and their generated total) when migrating the edited 0001.
alter table public.judging_results drop column if exists total_score;
alter table public.judging_results drop column if exists problem_solving_score;
alter table public.judging_results drop column if exists creativity_score;
alter table public.judging_results drop column if exists user_impact_score;

-- Named constraints, re-added idempotently with the spec maxima.
alter table public.judging_results drop constraint if exists judging_results_originality_score_check;
alter table public.judging_results
  add constraint judging_results_originality_score_check check (originality_score between 0 and 20);
alter table public.judging_results drop constraint if exists judging_results_feasibility_score_check;
alter table public.judging_results
  add constraint judging_results_feasibility_score_check check (feasibility_score between 0 and 25);
alter table public.judging_results drop constraint if exists judging_results_impact_score_check;
alter table public.judging_results
  add constraint judging_results_impact_score_check check (impact_score between 0 and 20);
alter table public.judging_results drop constraint if exists judging_results_plot_twist_score_check;
alter table public.judging_results
  add constraint judging_results_plot_twist_score_check check (plot_twist_score between 0 and 25);
alter table public.judging_results drop constraint if exists judging_results_clarity_score_check;
alter table public.judging_results
  add constraint judging_results_clarity_score_check check (clarity_score between 0 and 10);

-- Deterministic total, computed by the database — never trusted from the client.
alter table public.judging_results
  add column if not exists total_score integer generated always as
    (originality_score + feasibility_score + impact_score + plot_twist_score + clarity_score) stored;

-- ============================================================
-- 7. Initial ideas (Phase 1, owner-private) and scratch pages (team-private)
-- ============================================================

create table if not exists public.initial_ideas (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, participant_id)
);

create table if not exists public.scratch_pages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_by uuid references public.participants(id) on delete set null,
  updated_by uuid references public.participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 8. Team chat columns (missing on the original 0001)
-- ============================================================

alter table public.chat_messages
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists message_type text not null default 'text',
  add column if not exists transcript text,
  add column if not exists audio_storage_path text,
  add column if not exists audio_duration_ms integer,
  add column if not exists voice_status text not null default 'not_applicable',
  add column if not exists client_message_id uuid;

alter table public.chat_messages drop constraint if exists chat_messages_type_check;
alter table public.chat_messages
  add constraint chat_messages_type_check check (message_type in ('text','voice'));

alter table public.chat_messages drop constraint if exists chat_messages_voice_status_check;
alter table public.chat_messages
  add constraint chat_messages_voice_status_check
  check (voice_status in ('not_applicable','uploading','transcribing','generating','ready','failed'));

alter table public.chat_messages drop constraint if exists chat_messages_audio_duration_check;
alter table public.chat_messages
  add constraint chat_messages_audio_duration_check
  check (audio_duration_ms is null or audio_duration_ms between 1 and 120000);

create unique index if not exists idx_chat_client_message_id
  on public.chat_messages (room_id, client_message_id)
  where client_message_id is not null;

-- ============================================================
-- 9. RLS helpers
-- ============================================================

create or replace function public.requester_token()
returns text language sql stable as $$
  select nullif(current_setting('request.headers', true)::json->>'x-participant-token', '')
$$;

create or replace function public.is_service()
returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'service_role'
$$;

create or replace function public.is_participant(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.participants
    where room_id = p_room and token = public.requester_token()
  )
$$;

create or replace function public.is_host(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.participants
    where room_id = p_room and token = public.requester_token() and is_host
  )
$$;

create or replace function public.my_participant_id(p_room uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.participants
  where room_id = p_room and token = public.requester_token()
$$;

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members tm
    join public.participants p on p.id = tm.participant_id
    where tm.team_id = p_team
      and p.token = public.requester_token()
  )
$$;

create or replace function public.shares_team_with(p_participant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    join public.participants p on p.id = a.participant_id
    where b.participant_id = p_participant
      and p.token = public.requester_token()
  )
$$;

create or replace function public.team_belongs_to_room(p_team uuid, p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team and t.room_id = p_room
  )
$$;

-- Phase of the game, derived ONLY from the server-stored game_started_at (authoritative clock).
create or replace function public.room_phase(p_room uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v public.rooms;
  e int;
begin
  select * into v from public.rooms where id = p_room;
  if not found or v.game_started_at is null then
    return 'lobby';
  end if;
  e := extract(epoch from (now() - v.game_started_at))::int;
  if e < 180 then return 'ideation';
  elsif e < 240 then return 'reveal';
  elsif e < 420 then return 'team_work';
  elsif e < 720 then return 'plot_twist';
  elsif e < 900 then return 'submission';
  else return 'judging';
  end if;
end;
$$;

-- ============================================================
-- 10. RLS for the new tables
-- ============================================================

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_proposals enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.judging_results enable row level security;
alter table public.initial_ideas enable row level security;
alter table public.scratch_pages enable row level security;

drop policy if exists "teams readable by room participants" on public.teams;
create policy "teams readable by room participants" on public.teams
  for select using (public.is_participant(room_id));

drop policy if exists "team members readable by room participants" on public.team_members;
create policy "team members readable by room participants" on public.team_members
  for select using (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and public.is_participant(t.room_id)
    )
  );

-- Proposals: private to the owning team until reveal; locked proposals are immutable.
drop policy if exists "team proposals readable by own team or after reveal" on public.team_proposals;
create policy "team proposals readable by own team or after reveal" on public.team_proposals
  for select using (
    public.is_team_member(team_id)
    or exists (
      select 1 from public.challenges c
      where c.id = team_proposals.challenge_id
        and c.status in ('reveal','agreed','completed')
    )
  );

drop policy if exists "team members can create proposals" on public.team_proposals;
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

drop policy if exists "team members can edit unlocked proposals" on public.team_proposals;
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

drop policy if exists "proposal revisions readable by team or after reveal" on public.proposal_revisions;
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

drop policy if exists "team members can add proposal revisions" on public.proposal_revisions;
create policy "team members can add proposal revisions" on public.proposal_revisions
  for insert with check (
    editor_participant_id is not null
    and exists (
      select 1 from public.team_proposals p
      where p.id = proposal_id and public.is_team_member(p.team_id)
        and p.submitted_at is null and p.locked_at is null
    )
  );

-- Judging: reads after reveal only; writes are service-role only (no client policy at all).
drop policy if exists "judging results visible after reveal" on public.judging_results;
create policy "judging results visible after reveal" on public.judging_results
  for select using (
    exists (
      select 1 from public.challenges c
      where c.id = judging_results.challenge_id and c.status in ('reveal','agreed','completed')
    )
  );

-- Initial ideas: owner-only while the challenge is 'thinking'; team-readable (read-only) after.
drop policy if exists "initial ideas owner insert while private" on public.initial_ideas;
create policy "initial ideas owner insert while private" on public.initial_ideas
  for insert with check (
    participant_id = public.my_participant_id(room_id)
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.status = 'thinking'
    )
  );

drop policy if exists "initial ideas owner or team read" on public.initial_ideas;
create policy "initial ideas owner or team read" on public.initial_ideas
  for select using (
    participant_id = public.my_participant_id(room_id)
    or shares_team_with(participant_id)
  );

drop policy if exists "initial ideas owner update while private" on public.initial_ideas;
create policy "initial ideas owner update while private" on public.initial_ideas
  for update using (
    participant_id = public.my_participant_id(room_id)
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.status = 'thinking'
    )
  )
  with check (
    participant_id = public.my_participant_id(room_id)
  );

-- Scratch pages: team-private notebooks, every teammate may read/write.
drop policy if exists "scratch pages team read" on public.scratch_pages;
create policy "scratch pages team read" on public.scratch_pages
  for select using (public.is_team_member(team_id));

drop policy if exists "scratch pages team insert" on public.scratch_pages;
create policy "scratch pages team insert" on public.scratch_pages
  for insert with check (
    public.is_team_member(team_id)
    and created_by = public.my_participant_id(room_id)
  );

drop policy if exists "scratch pages team update" on public.scratch_pages;
create policy "scratch pages team update" on public.scratch_pages
  for update using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

drop policy if exists "scratch pages creator delete" on public.scratch_pages;
create policy "scratch pages creator delete" on public.scratch_pages
  for delete using (created_by = public.my_participant_id(room_id));

-- Team chat: replaces the room-wide policies from the original 0001.
drop policy if exists "chat readable" on public.chat_messages;
drop policy if exists "chat insertable" on public.chat_messages;
drop policy if exists "team chat readable" on public.chat_messages;
drop policy if exists "team chat insertable" on public.chat_messages;

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

-- ============================================================
-- 11. Server RPCs — the room loop is enforced here, never client-side
-- ============================================================

-- Rejoin-safe join: same token rejoins freely; new joins are blocked once the clock runs.
create or replace function public.join_room(p_code text, p_name text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_participant public.participants;
  v_count int;
begin
  select * into v_room from public.rooms where lower(code) = lower(p_code);
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select * into v_participant from public.participants
    where room_id = v_room.id and token = p_token;

  if found then
    update public.participants set last_seen_at = now(), is_connected = true, name = p_name
      where id = v_participant.id
      returning * into v_participant;
  else
    if v_room.game_started_at is not null then
      raise exception 'GAME_IN_PROGRESS';
    end if;

    select count(*) into v_count from public.participants where room_id = v_room.id;
    if v_count >= v_room.max_participants then
      raise exception 'ROOM_FULL';
    end if;

    if exists (select 1 from public.participants where room_id = v_room.id and name = p_name) then
      raise exception 'NAME_TAKEN';
    end if;

    insert into public.participants (room_id, token, name, is_host)
      values (v_room.id, p_token, p_name, false)
      returning * into v_participant;
  end if;

  return json_build_object('room', to_jsonb(v_room), 'participant', to_jsonb(v_participant));
end;
$$;

create or replace function public.heartbeat(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update public.participants set last_seen_at = now(), is_connected = true
  where room_id = p_room and token = public.requester_token()
$$;

-- Readiness toggle (participant's own row).
create or replace function public.set_ready(p_room uuid, p_ready boolean)
returns void language sql security definer set search_path = public as $$
  update public.participants set is_ready = p_ready
  where room_id = p_room and token = public.requester_token()
$$;

-- Host or service only. Starts the clock, creates two teams with a random split,
-- and opens the round's challenge with the full 900s submission deadline.
create or replace function public.start_game(p_room uuid, p_question text, p_context text default null)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_count int;
  v_blaze uuid;
  v_frost uuid;
  v_challenge public.challenges;
begin
  if not (public.is_host(p_room) or public.is_service()) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.game_started_at is not null then
    raise exception 'ALREADY_STARTED';
  end if;

  select count(*) into v_count from public.participants where room_id = p_room;
  if v_count not in (2,4,6) then
    raise exception 'PARTICIPANT_COUNT %', v_count;
  end if;

  if exists (select 1 from public.participants where room_id = p_room and not is_ready) then
    raise exception 'NOT_ALL_READY';
  end if;

  insert into public.teams (room_id, name, color)
    values (p_room, 'Blaze', '#f97316')
    returning id into v_blaze;
  insert into public.teams (room_id, name, color)
    values (p_room, 'Frost', '#38bdf8')
    returning id into v_frost;

  with shuffled as (
    select id, row_number() over (order by random()) as rn
    from public.participants
    where room_id = p_room
  )
  insert into public.team_members (team_id, participant_id)
    select case when rn % 2 = 1 then v_blaze else v_frost end, id
    from shuffled;

  insert into public.challenges (room_id, question, context, status, brainstorming_started_at, submission_deadline)
    values (p_room, p_question, coalesce(p_context, ''), 'thinking', now(), now() + interval '900 seconds')
    returning * into v_challenge;

  update public.rooms
    set game_started_at = now(),
        state = 'brainstorming',
        current_challenge_id = v_challenge.id,
        plot_twist_at_seconds = 420,
        winning_team_id = null
    where id = p_room
    returning * into v_room;

  return v_room;
end;
$$;

-- Ideas flip from owner-private to team-visible (and read-only) at 03:00.
create or replace function public.reveal_ideas(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  if not (public.is_host(p_room) or public.is_service()) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.challenges
    set status = 'sharing'
    where id = v_room.current_challenge_id and status = 'thinking';

  update public.rooms set state = 'brainstorming' where id = p_room and state = 'waiting';
end;
$$;

-- Plot Twist: stamped on the challenge at 07:00 (twist text is supplied by the server).
create or replace function public.apply_plot_twist(p_room uuid, p_twist text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  if not (public.is_host(p_room) or public.is_service()) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.challenges
    set plot_twist = p_twist,
        plot_twist_at = now(),
        status = 'plot_twist'
    where id = v_room.current_challenge_id and plot_twist is null;

  update public.rooms set state = 'plot_twist' where id = p_room;
end;
$$;

-- Proposals lock at 15:00. Content is untouched — the last server-saved draft stands.
create or replace function public.lock_proposals(p_room uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_locked int;
begin
  if not (public.is_host(p_room) or public.is_service()) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.team_proposals
    set submitted_at = coalesce(submitted_at, now()),
        locked_at = now()
    where challenge_id = v_room.current_challenge_id
      and locked_at is null;

  get diagnostics v_locked = row_count;

  update public.challenges
    set submissions_locked_at = now(),
        judging_started_at = now(),
        status = 'judging'
    where id = v_room.current_challenge_id and status not in ('judging','reveal','completed');

  update public.rooms set state = 'judging' where id = p_room;

  return v_locked;
end;
$$;

-- Judging write. Service-role only; clamps scores to the rubric maxima; idempotent.
-- When every proposal for the challenge has a result, the challenge flips to 'reveal'.
create or replace function public.finalize_judging(
  p_challenge uuid,
  p_team uuid,
  p_originality int,
  p_feasibility int,
  p_impact int,
  p_plot_twist int,
  p_clarity int,
  p_strengths jsonb default '[]'::jsonb,
  p_improvements jsonb default '[]'::jsonb,
  p_plot_twist_addressed boolean default false,
  p_explanation text default '',
  p_model text default null
)
returns public.judging_results language plpgsql security definer set search_path = public as $$
declare
  v_result public.judging_results;
begin
  if not public.is_service() then
    raise exception 'SERVICE_ONLY';
  end if;

  insert into public.judging_results as j
    (challenge_id, team_id,
     originality_score, feasibility_score, impact_score, plot_twist_score, clarity_score,
     strengths, improvements, plot_twist_addressed, judge_explanation, model_name)
  values
    (p_challenge, p_team,
     least(greatest(coalesce(p_originality, 0), 0), 20),
     least(greatest(coalesce(p_feasibility, 0), 0), 25),
     least(greatest(coalesce(p_impact, 0), 0), 20),
     least(greatest(coalesce(p_plot_twist, 0), 0), 25),
     least(greatest(coalesce(p_clarity, 0), 0), 10),
     p_strengths, p_improvements, p_plot_twist_addressed, p_explanation, p_model)
  on conflict (challenge_id, team_id) do update
    set originality_score = excluded.originality_score,
        feasibility_score = excluded.feasibility_score,
        impact_score = excluded.impact_score,
        plot_twist_score = excluded.plot_twist_score,
        clarity_score = excluded.clarity_score,
        strengths = excluded.strengths,
        improvements = excluded.improvements,
        plot_twist_addressed = excluded.plot_twist_addressed,
        judge_explanation = excluded.judge_explanation,
        model_name = excluded.model_name
  returning * into v_result;

  if not exists (
    select 1 from public.team_proposals p
    where p.challenge_id = p_challenge
      and not exists (
        select 1 from public.judging_results j
        where j.challenge_id = p.challenge_id and j.team_id = p.team_id
      )
  ) then
    update public.challenges
      set status = 'reveal', judging_completed_at = now()
      where id = p_challenge and status <> 'completed';
    update public.rooms
      set state = 'reveal', reveal_at = now()
      where id = (select room_id from public.challenges where id = p_challenge)
        and state <> 'complete';
  end if;

  return v_result;
end;
$$;

-- Winner: highest total; tie-break Plot Twist, then Feasibility, else a draw (null).
create or replace function public.set_winning_team(p_challenge uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_room_id uuid;
  v_top record;
  v_other record;
begin
  if not public.is_service() then
    raise exception 'SERVICE_ONLY';
  end if;

  select room_id into v_room_id from public.challenges where id = p_challenge;
  if v_room_id is null then
    raise exception 'CHALLENGE_NOT_FOUND';
  end if;

  select * into v_top
  from public.judging_results
  where challenge_id = p_challenge
  order by total_score desc, plot_twist_score desc, feasibility_score desc
  limit 1;

  if not found then
    return null;
  end if;

  select * into v_other
  from public.judging_results
  where challenge_id = p_challenge
    and (total_score, plot_twist_score, feasibility_score) <>
        (v_top.total_score, v_top.plot_twist_score, v_top.feasibility_score)
  order by total_score desc, plot_twist_score desc, feasibility_score desc
  limit 1;

  if found
    and v_other.total_score = v_top.total_score
    and v_other.plot_twist_score = v_top.plot_twist_score
    and v_other.feasibility_score = v_top.feasibility_score then
    update public.rooms set winning_team_id = null, state = 'complete', completed_at = now()
      where id = v_room_id;
    return null;
  end if;

  update public.rooms set winning_team_id = v_top.team_id, state = 'complete', completed_at = now()
    where id = v_room_id;
  return v_top.team_id;
end;
$$;

-- Legacy Shared Spark transition RPC, redefined for the Idea Clash states.
create or replace function public.advance_room_state(p_room uuid, p_next text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  if not (public.is_host(p_room) or public.is_service()) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if not exists (
    select 1 from (values
      ('waiting','team_assignment'),
      ('team_assignment','brainstorming'),
      ('brainstorming','plot_twist'),
      ('plot_twist','submission'),
      ('submission','judging'),
      ('judging','reveal'),
      ('reveal','complete'),
      ('complete','waiting')
    ) as t(cur, nxt)
    where t.cur = v_room.state and t.nxt = p_next
  ) then
    raise exception 'INVALID_TRANSITION % -> %', v_room.state, p_next;
  end if;

  update public.rooms set state = p_next where id = p_room
    returning * into v_room;
  return v_room;
end;
$$;

-- ============================================================
-- 12. Voice storage: one PRIVATE bucket; playback via short-lived signed URLs
--     issued by the server. Uploads happen server-side too, so no client
--     storage policies are granted here.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', false)
on conflict (id) do nothing;

-- ============================================================
-- 13. Indexes
-- ============================================================

create index if not exists idx_teams_room on public.teams (room_id);
create index if not exists idx_team_members_participant on public.team_members (participant_id);
create index if not exists idx_team_proposals_challenge on public.team_proposals (challenge_id);
create index if not exists idx_proposal_revisions_proposal_time on public.proposal_revisions (proposal_id, created_at);
create index if not exists idx_judging_results_challenge on public.judging_results (challenge_id);
create index if not exists idx_initial_ideas_challenge on public.initial_ideas (challenge_id);
create index if not exists idx_scratch_pages_team on public.scratch_pages (team_id, created_at);
create index if not exists idx_chat_team_time on public.chat_messages (team_id, created_at);
create index if not exists idx_challenges_deadline on public.challenges (submission_deadline);
create index if not exists idx_chat_room_time on public.chat_messages (room_id, created_at);
create index if not exists idx_participants_room on public.participants (room_id);
create index if not exists idx_challenges_room on public.challenges (room_id, created_at);

-- ============================================================
-- 14. Realtime publication adds, guarded against duplicates
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'public.rooms','public.participants','public.chat_messages','public.challenges',
    'public.teams','public.team_members','public.team_proposals','public.judging_results',
    'public.initial_ideas','public.scratch_pages'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname || '.' || tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %s', t);
    end if;
  end loop;
end;
$$;
