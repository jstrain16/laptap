-- Anonymous play tracking for laptap. Applied via the Supabase MCP; kept here
-- so the schema is in the repo next to the code that writes to it.
--
-- One append-only row per event. The site's publishable key may INSERT and
-- nothing else; stats are read in the dashboard (service role), never through
-- the site.

create table if not exists public.plays (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  player_id   uuid not null,                      -- random, stored in the player's browser
  event       text not null check (event in ('start', 'finish')),
  pool        text not null check (pool in ('ikon', 'epic', 'usa')),
  puzzle      int  not null,
  puzzle_date date not null,
  total       int  check (total between 0 and 1000),  -- finish only
  rounds      jsonb,                                  -- finish only: [{name, base, km, guess:[lat,lng]}]
  device      text check (device in ('mobile', 'desktop')),
  tz          text
);

create index if not exists plays_date_pool_idx on public.plays (puzzle_date, pool);
create index if not exists plays_player_idx    on public.plays (player_id);

alter table public.plays enable row level security;

drop policy if exists "site may log a play" on public.plays;
create policy "site may log a play"
  on public.plays for insert
  to anon
  with check (true);
-- No select/update/delete policy for anon: the table is write-only from the site.

-- How many people are playing, per day and pool.
create or replace view public.daily_stats as
select
  puzzle_date,
  pool,
  puzzle,
  count(distinct player_id) filter (where event = 'start')  as players,
  count(distinct player_id) filter (where event = 'finish') as finishers,
  round(avg(total) filter (where event = 'finish'))         as avg_score,
  percentile_cont(0.5) within group (order by total) filter (where event = 'finish') as median_score,
  max(total) filter (where event = 'finish')                as best_score,
  count(*) filter (where event = 'finish' and device = 'mobile') as mobile_finishes
from public.plays
group by puzzle_date, pool, puzzle
order by puzzle_date desc, pool;

-- Which mountains people can and can't find.
create or replace view public.mountain_stats as
select
  pool,
  r ->> 'name'                        as mountain,
  count(*)                            as plays,
  round(avg((r ->> 'base')::int))     as avg_score,
  round(avg((r ->> 'km')::int) * 0.621371) as avg_miss_miles,
  count(*) filter (where (r ->> 'base')::int = 100) as bullseyes
from public.plays, jsonb_array_elements(rounds) as r
where event = 'finish'
group by pool, r ->> 'name'
order by avg_score desc;

-- Lifetime totals, one row.
create or replace view public.overall_stats as
select
  count(distinct player_id)                                   as unique_players,
  count(*) filter (where event = 'finish')                    as games_finished,
  count(distinct puzzle_date)                                 as days_with_play,
  round(avg(total) filter (where event = 'finish'))           as avg_score,
  min(created_at)                                             as first_play,
  max(created_at)                                             as last_play
from public.plays;
