-- PEAC: warm-ups and exercise sections
-- Run once in Supabase -> SQL Editor
begin;

alter table public.workouts          add column if not exists warmup  jsonb;
alter table public.workout_exercises add column if not exists section text;

-- Saved warm-up checkboxes (per athlete, per workout)
create table if not exists public.warmup_logs (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  done        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz default now(),
  unique (athlete_id, workout_id)
);

alter table public.warmup_logs enable row level security;

drop policy if exists "warmup: athlete manages" on public.warmup_logs;
create policy "warmup: athlete manages" on public.warmup_logs
  for all
  using (athlete_id = get_my_athlete_id())
  with check (athlete_id = get_my_athlete_id());

drop policy if exists "warmup: coach reads" on public.warmup_logs;
create policy "warmup: coach reads" on public.warmup_logs
  for select
  using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()));

commit;
