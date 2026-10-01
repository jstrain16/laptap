-- Nicknames and a public leaderboard. A player is the browser's random id
-- plus a self-chosen name, claimed first-come; no email, no password. The
-- leaderboard view is the one thing readable through the site — nicknames
-- and scores only — while raw plays stay write-only.

create table if not exists public.players (
  id         uuid primary key,
  name       text not null check (char_length(name) between 2 and 20 and name !~ '[^[:alnum:] _.''-]'),
  created_at timestamptz not null default now()
);

-- First come, first served, case-insensitively: "joe" and "Joe" are one name.
create unique index if not exists players_name_lower_idx on public.players (lower(name));

alter table public.players enable row level security;

drop policy if exists "site may claim a name" on public.players;
create policy "site may claim a name"
  on public.players for insert
  to anon
  with check (true);
-- No select/update/delete for anon: names are only ever seen via the leaderboard.

-- Best finish per named player, per puzzle. Reads plays as the view's owner,
-- so it works for anon even though plays itself is locked down.
create or replace view public.leaderboard as
select
  p.puzzle_date,
  p.pool,
  p.puzzle,
  pl.id   as player_id,
  pl.name,
  max(p.total) as total
from public.plays p
join public.players pl on pl.id = p.player_id
where p.event = 'finish' and p.total is not null
group by p.puzzle_date, p.pool, p.puzzle, pl.id, pl.name;

grant select on public.leaderboard to anon;
