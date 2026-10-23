-- PEAC batch 1: groups + workout effort (RPE)
-- Run once in Supabase -> SQL Editor
begin;

-- ---------- Groups ----------
create table if not exists public.athlete_groups (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.coaches(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.athlete_group_members (
  group_id   uuid not null references public.athlete_groups(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  primary key (group_id, athlete_id)
);
alter table public.athlete_groups enable row level security;
alter table public.athlete_group_members enable row level security;

drop policy if exists "groups: coach manages" on public.athlete_groups;
create policy "groups: coach manages" on public.athlete_groups
  for all using (coach_id = get_my_coach_id() or is_admin())
  with check (coach_id = get_my_coach_id() or is_admin());

drop policy if exists "group members: coach manages" on public.athlete_group_members;
create policy "group members: coach manages" on public.athlete_group_members
  for all using (group_id in (select id from public.athlete_groups where coach_id = get_my_coach_id()) or is_admin())
  with check (group_id in (select id from public.athlete_groups where coach_id = get_my_coach_id()) or is_admin());

-- ---------- Workout effort: session RPE x minutes = training load ----------
create table if not exists public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  rpe          integer not null check (rpe between 1 and 10),
  minutes      integer check (minutes between 1 and 600),
  notes        text,
  completed_at timestamptz not null default now(),
  unique (athlete_id, workout_id)
);
create index if not exists idx_workout_sessions_athlete on public.workout_sessions (athlete_id, completed_at);
alter table public.workout_sessions enable row level security;

drop policy if exists "sessions: athlete own" on public.workout_sessions;
create policy "sessions: athlete own" on public.workout_sessions
  for all using (athlete_id = get_my_athlete_id()) with check (athlete_id = get_my_athlete_id());

drop policy if exists "sessions: coach manages" on public.workout_sessions;
create policy "sessions: coach manages" on public.workout_sessions
  for all using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()) or is_admin())
  with check (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()) or is_admin());

commit;

-- Combining athletes (from merge_athletes.sql) also moves effort ratings and groups
create or replace function public.merge_athlete_profiles(keep_id uuid, account_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  k athletes%rowtype;
  a athletes%rowtype;
  uid uuid;
begin
  select * into k from athletes where id = keep_id for update;
  select * into a from athletes where id = account_id for update;
  if k.id is null or a.id is null then raise exception 'Athlete not found'; end if;
  if k.id = a.id then raise exception 'Pick two different athletes'; end if;
  if k.user_id is not null then raise exception 'That profile already has a login'; end if;
  if a.user_id is null then raise exception 'The athlete you picked has not signed up yet'; end if;
  if not (is_admin() or (k.coach_id = get_my_coach_id() and a.coach_id = get_my_coach_id())) then
    raise exception 'Not allowed';
  end if;

  delete from program_assignments x where x.athlete_id = a.id
    and exists (select 1 from program_assignments y where y.athlete_id = k.id and y.program_id = x.program_id);
  update program_assignments set athlete_id = k.id where athlete_id = a.id;

  delete from athlete_maxes x where x.athlete_id = a.id
    and exists (select 1 from athlete_maxes y where y.athlete_id = k.id and y.lift = x.lift);
  update athlete_maxes set athlete_id = k.id where athlete_id = a.id;

  delete from check_ins x where x.athlete_id = a.id
    and exists (select 1 from check_ins y where y.athlete_id = k.id and y.date = x.date);
  update check_ins set athlete_id = k.id where athlete_id = a.id;

  delete from workout_schedule x where x.athlete_id = a.id
    and exists (select 1 from workout_schedule y where y.athlete_id = k.id and y.workout_id = x.workout_id);
  update workout_schedule set athlete_id = k.id where athlete_id = a.id;

  delete from warmup_logs x where x.athlete_id = a.id
    and exists (select 1 from warmup_logs y where y.athlete_id = k.id and y.workout_id = x.workout_id);
  update warmup_logs set athlete_id = k.id where athlete_id = a.id;

  delete from workout_sessions x where x.athlete_id = a.id
    and exists (select 1 from workout_sessions y where y.athlete_id = k.id and y.workout_id = x.workout_id);
  update workout_sessions set athlete_id = k.id where athlete_id = a.id;

  insert into athlete_group_members (group_id, athlete_id)
    select group_id, k.id from athlete_group_members where athlete_id = a.id
    on conflict do nothing;

  update workout_results   set athlete_id = k.id where athlete_id = a.id;
  update performance_tests set athlete_id = k.id where athlete_id = a.id;

  uid := a.user_id;
  delete from athletes where id = a.id;
  update athletes set
    user_id = uid,
    coach_id = coalesce(k.coach_id, a.coach_id),
    sport = coalesce(k.sport, a.sport),
    position = coalesce(k.position, a.position),
    graduation_year = coalesce(k.graduation_year, a.graduation_year)
  where id = k.id;
end
$$;
grant execute on function public.merge_athlete_profiles(uuid, uuid) to authenticated;
