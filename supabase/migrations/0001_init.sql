-- Campfire initial schema
create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  activity_type text not null default 'general',
  session_type text not null default 'focus',
  description text default '',
  host_token text not null,
  state text not null default 'waiting'
    check (state in ('waiting','focusing','challenge_thinking','challenge_sharing','reveal','discussion','group_answer','complete')),
  current_challenge_id uuid,
  started_at timestamptz,
  duration_sec int not null default 1500,
  paused_accumulated int not null default 0,
  is_paused boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token text not null,
  name text not null,
  is_host boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, token),
  unique (room_id, name)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_token text not null,
  sender text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question text not null,
  context text default '',
  status text not null default 'thinking'
    check (status in ('thinking','sharing','reveal','agreed','completed')),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  participant_token text not null,
  answer text not null,
  reasoning text default '',
  created_at timestamptz not null default now(),
  unique (challenge_id, participant_token)
);

create table if not exists public.conclusions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.challenges(id) on delete cascade,
  participant_token text not null,
  final_answer text not null,
  ai_explanation text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  summary text default '',
  duration_sec int not null default 0,
  participant_count int not null default 0,
  challenges_completed int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;
alter table public.conclusions enable row level security;
alter table public.sessions enable row level security;

-- helper: token of the requester, passed by the client as a custom header
create or replace function public.requester_token()
returns text language sql stable as $$
  select nullif(current_setting('request.headers', true)::json->>'x-participant-token', '')
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

-- reads are open to anyone holding the room link (join is by code)
create policy "rooms readable" on public.rooms for select using (true);
create policy "rooms insertable" on public.rooms for insert with check (true);
create policy "participants readable" on public.participants for select using (true);
create policy "participants insertable" on public.participants for insert with check (true);
create policy "chat readable" on public.chat_messages for select using (true);
create policy "chat insertable" on public.chat_messages for insert with check (true);
create policy "challenges readable" on public.challenges for select using (true);
create policy "submissions readable" on public.submissions for select using (
  participant_token = public.requester_token()
  or exists (
    select 1 from public.challenges c
    where c.id = submissions.challenge_id and c.status in ('reveal','agreed','completed')
  )
);
create policy "conclusions readable" on public.conclusions for select using (true);
create policy "sessions readable" on public.sessions for select using (true);
create policy "sessions insertable" on public.sessions for insert with check (true);

-- participants update their own heartbeat / name
create policy "participants self update" on public.participants for update
  using (token = public.requester_token()) with check (token = public.requester_token());

-- submissions: one per participant, only their own, only while challenge is open
create policy "submissions own insert" on public.submissions for insert with check (
  participant_token = public.requester_token()
  and exists (
    select 1 from public.challenges c
    join public.rooms r on r.id = c.room_id
    where c.id = challenge_id
      and c.status in ('thinking','sharing')
      and r.state in ('challenge_thinking','challenge_sharing')
      and public.is_participant(r.id)
  )
);
create policy "submissions own update" on public.submissions for update
  using (participant_token = public.requester_token())
  with check (participant_token = public.requester_token());

-- conclusions: any participant may record the group answer, only once per challenge
create policy "conclusions insert" on public.conclusions for insert with check (
  participant_token = public.requester_token()
  and exists (
    select 1 from public.challenges c
    join public.rooms r on r.id = c.room_id
    where c.id = challenge_id and r.state = 'group_answer' and public.is_participant(r.id)
  )
);

-- room mutations go through RPCs so the host check cannot be bypassed client-side
create or replace function public.join_room(p_code text, p_name text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
  v_participant public.participants;
begin
  select * into v_room from public.rooms where lower(code) = lower(p_code);
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select * into v_participant from public.participants
    where room_id = v_room.id and token = p_token;

  if found then
    update public.participants set last_seen_at = now(), name = p_name
      where id = v_participant.id
      returning * into v_participant;
  else
    insert into public.participants (room_id, token, name, is_host)
      values (v_room.id, p_token, p_name, false)
      returning * into v_participant;
  end if;

  return json_build_object('room', to_jsonb(v_room), 'participant', to_jsonb(v_participant));
end;
$$;

create or replace function public.advance_room_state(p_room uuid, p_next text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  if not public.is_host(p_room) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if not exists (
    select 1 from (values
      ('waiting','focusing'),
      ('focusing','challenge_thinking'),
      ('challenge_thinking','challenge_sharing'),
      ('challenge_sharing','reveal'),
      ('reveal','discussion'),
      ('discussion','group_answer'),
      ('group_answer','complete'),
      ('complete','waiting')
    ) as t(cur, nxt)
    where t.cur = v_room.state and t.nxt = p_next
  ) then
    raise exception 'INVALID_TRANSITION % -> %', v_room.state, p_next;
  end if;

  -- reveal moment: unlock the challenge results for everyone at once
  if p_next = 'reveal' and v_room.current_challenge_id is not null then
    update public.challenges set status = 'reveal' where id = v_room.current_challenge_id;
  end if;

  if p_next = 'challenge_thinking' then
    update public.rooms set is_paused = true, started_at = null, paused_accumulated = 0
      where id = p_room;
  end if;

  if p_next = 'complete' and v_room.current_challenge_id is not null then
    update public.challenges set status = 'completed' where id = v_room.current_challenge_id;
  end if;

  update public.rooms set state = p_next where id = p_room
    returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.update_timer(p_room uuid, p_action text, p_duration int default null)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms;
begin
  if not public.is_host(p_room) then
    raise exception 'NOT_HOST';
  end if;

  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if p_action = 'start' then
    update public.rooms
      set started_at = now(), is_paused = false, paused_accumulated = 0,
          duration_sec = coalesce(p_duration, duration_sec)
      where id = p_room;
  elsif p_action = 'pause' and not v_room.is_paused then
    update public.rooms
      set is_paused = true,
          paused_accumulated = paused_accumulated + extract(epoch from (now() - started_at))::int
      where id = p_room;
  elsif p_action = 'resume' and v_room.is_paused then
    update public.rooms set started_at = now(), is_paused = false where id = p_room;
  elsif p_action = 'reset' then
    update public.rooms set started_at = null, is_paused = true, paused_accumulated = 0
      where id = p_room;
  else
    raise exception 'INVALID_TIMER_ACTION';
  end if;

  return (select * from public.rooms where id = p_room);
end;
$$;

create or replace function public.set_challenge(p_room uuid, p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host(p_room) then
    raise exception 'NOT_HOST';
  end if;
  update public.rooms set current_challenge_id = p_challenge where id = p_room;
end;
$$;

create or replace function public.heartbeat(p_room uuid)
returns void language sql security definer set search_path = public as $$
  update public.participants set last_seen_at = now()
  where room_id = p_room and token = public.requester_token()
$$;

-- realtime
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.conclusions;

create index if not exists idx_chat_room_time on public.chat_messages (room_id, created_at);
create index if not exists idx_participants_room on public.participants (room_id);
create index if not exists idx_submissions_challenge on public.submissions (challenge_id);
create index if not exists idx_challenges_room on public.challenges (room_id, created_at);
