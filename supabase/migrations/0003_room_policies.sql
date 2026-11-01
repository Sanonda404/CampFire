-- 0003: Restore the base permissive policies that room creation and joining depend on.
--
-- The Idea Clash upgrade (0001 as applied live) replaced the chat policies and added
-- team/proposal/judging policies, but never re-created the rooms/participants/challenges
-- policies from the original Shared Spark schema. With RLS enabled and no INSERT policy
-- on rooms, client-side room creation fails with
--   "new row violates row-level security policy for table rooms"
--
-- This migration is idempotent: each policy is dropped if it exists, then re-created.

-- Rooms: anyone may create a room (the code is the capability) and read rooms by code.
drop policy if exists "rooms readable" on public.rooms;
create policy "rooms readable" on public.rooms
for select using (true);

drop policy if exists "rooms insertable" on public.rooms;
create policy "rooms insertable" on public.rooms
for insert with check (true);

-- Participants: lobby presence is public per room; players may join and update
-- only their own row (matched by the x-participant-token header).
drop policy if exists "participants readable" on public.participants;
create policy "participants readable" on public.participants
for select using (true);

drop policy if exists "participants insertable" on public.participants;
create policy "participants insertable" on public.participants
for insert with check (true);

drop policy if exists "participants self update" on public.participants;
create policy "participants self update" on public.participants
for update
using (token = public.requester_token())
with check (token = public.requester_token());

-- Challenges: readable once you know the room.
drop policy if exists "challenges readable" on public.challenges;
create policy "challenges readable" on public.challenges
for select using (true);

-- Shared Spark leftovers kept working (token-scoped, same as the original schema).
drop policy if exists "submissions readable" on public.submissions;
create policy "submissions readable" on public.submissions
for select using (participant_token = public.requester_token());

drop policy if exists "submissions own insert" on public.submissions;
create policy "submissions own insert" on public.submissions
for insert with check (
  participant_token = public.requester_token()
  and exists (
    select 1 from public.rooms r
    join public.challenges c on c.room_id = r.id
    where c.id = challenge_id and public.is_participant(r.id)
  )
);

drop policy if exists "submissions own update" on public.submissions;
create policy "submissions own update" on public.submissions
for update
using (participant_token = public.requester_token())
with check (participant_token = public.requester_token());

drop policy if exists "conclusions readable" on public.conclusions;
create policy "conclusions readable" on public.conclusions
for select using (true);

drop policy if exists "conclusions insert" on public.conclusions;
create policy "conclusions insert" on public.conclusions
for insert with check (
  participant_token = public.requester_token()
  and exists (
    select 1 from public.challenges c
    join public.rooms r on r.id = c.room_id
    where c.id = challenge_id and r.state = 'group_answer' and public.is_participant(r.id)
  )
);

drop policy if exists "sessions readable" on public.sessions;
create policy "sessions readable" on public.sessions
for select using (true);

drop policy if exists "sessions insertable" on public.sessions;
create policy "sessions insertable" on public.sessions
for insert with check (true);

-- Idea Clash server RPCs handle teams, proposals, locking and judging; the policies
-- added by the upgrade for those tables are intentionally left untouched.
