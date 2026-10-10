-- PEAC: athlete 1-rep maxes + lift scaling on exercises
-- Run once in Supabase -> SQL Editor
begin;

alter table public.workout_exercises add column if not exists max_lift text;
alter table public.workout_exercises add column if not exists ref_max  numeric;

create table if not exists public.athlete_maxes (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  lift        text not null,
  value       numeric not null,
  updated_at  timestamptz default now(),
  unique (athlete_id, lift)
);

alter table public.athlete_maxes enable row level security;

drop policy if exists "maxes: coach manages" on public.athlete_maxes;
create policy "maxes: coach manages" on public.athlete_maxes
  for all
  using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()))
  with check (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()));

drop policy if exists "maxes: athlete reads" on public.athlete_maxes;
create policy "maxes: athlete reads" on public.athlete_maxes
  for select
  using (athlete_id = get_my_athlete_id());

commit;
