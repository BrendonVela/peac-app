-- PEAC: per-athlete workout scheduling
-- Run once in Supabase -> SQL Editor

begin;

-- 1) Per-athlete planned dates (when a coach or athlete moves a workout)
create table if not exists public.workout_schedule (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.athletes(id) on delete cascade,
  workout_id     uuid not null references public.workouts(id) on delete cascade,
  scheduled_date date not null,
  updated_at     timestamptz default now(),
  unique (athlete_id, workout_id)
);

create index if not exists idx_workout_schedule_athlete on public.workout_schedule (athlete_id);

alter table public.workout_schedule enable row level security;

drop policy if exists "ws: athlete manages" on public.workout_schedule;
create policy "ws: athlete manages" on public.workout_schedule
  for all
  using (athlete_id = get_my_athlete_id())
  with check (athlete_id = get_my_athlete_id());

drop policy if exists "ws: coach manages" on public.workout_schedule;
create policy "ws: coach manages" on public.workout_schedule
  for all
  using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()))
  with check (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()));

-- 2) Existing assignments: Week 1 starts the day they were assigned
update public.program_assignments
set start_date = (assigned_at at time zone 'America/Los_Angeles')::date
where start_date is null;

commit;
