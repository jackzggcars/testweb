-- Admin-added votes. Purely additive: does not touch anderside_votes,
-- anderside_elections or any existing data. Safe to run on the live DB.
-- Run once in the Supabase SQL editor.

create table if not exists public.anderside_bonus_votes (
  id          bigint generated always as identity primary key,
  election_id text        not null,
  party_id    text        not null,
  votes       integer     not null check (votes <> 0),  -- negative = correction
  note        text,
  created_by  text,                                      -- admin's discord id
  created_at  timestamptz not null default now()
);

create index if not exists anderside_bonus_votes_election_idx
  on public.anderside_bonus_votes (election_id);

alter table public.anderside_bonus_votes enable row level security;

-- Everyone can read (so results pages can include them)
drop policy if exists "bonus votes readable" on public.anderside_bonus_votes;
create policy "bonus votes readable" on public.anderside_bonus_votes
  for select using (true);

-- Only admins listed in anderside_admins can add / remove
drop policy if exists "bonus votes admin write" on public.anderside_bonus_votes;
create policy "bonus votes admin write" on public.anderside_bonus_votes
  for all
  using (exists (
    select 1 from public.anderside_admins a
    where a.discord_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
  ))
  with check (exists (
    select 1 from public.anderside_admins a
    where a.discord_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
  ));
