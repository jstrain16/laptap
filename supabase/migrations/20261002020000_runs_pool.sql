-- The runs mode (name the ski run, tap it on the trail map) records under its
-- own pool, so it gets its own daily and all-time boards for free.
alter table public.plays drop constraint if exists plays_pool_check;
alter table public.plays add constraint plays_pool_check
  check (pool in ('ikon', 'epic', 'usa', 'runs'));
