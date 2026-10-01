-- All-time standings: one row per named player, built on the daily board so
-- each puzzle counts once (best finish). Ranked by average in the client;
-- games played is shown alongside so a one-game wonder is visible as such.
create or replace view public.leaderboard_alltime as
select
  player_id,
  name,
  count(*)            as games,
  round(avg(total))   as avg_score,
  max(total)          as best,
  sum(total)          as points
from public.leaderboard
group by player_id, name;

grant select on public.leaderboard_alltime to anon;
