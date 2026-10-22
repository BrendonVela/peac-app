-- PEAC: combine a hand-added athlete profile (no login) with the account that athlete made
-- Keeps the hand-added profile (programs, maxes, schedule...) and moves the login + anything
-- the new account already logged onto it. Run once in Supabase -> SQL Editor
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

  -- Move anything the new account already has. If both have the same item, the hand-added profile wins.
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

  update workout_results   set athlete_id = k.id where athlete_id = a.id;
  update performance_tests set athlete_id = k.id where athlete_id = a.id;

  -- Hand the login over to the kept profile
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
