-- PEAC speed fix. Safe to run more than once.

-- 1) One fast request for everything the calendars and dashboards need
create or replace function public.get_schedule_data(p_athlete_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_coach uuid;
  v_admin boolean := false;
  v_service boolean := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role';
  v_ids uuid[];
  v_staff_ids uuid[];
begin
  if v_uid is not null then
    select coalesce(head_coach_id, id), coalesce(is_admin, false) into v_coach, v_admin from coaches where user_id = v_uid;
  end if;

  -- Only athletes this person may see
  select coalesce(array_agg(a.id), '{}') into v_ids
  from athletes a
  where a.id = any(p_athlete_ids)
    and (v_service or v_admin
         or (v_coach is not null and a.coach_id = v_coach)
         or (v_uid is not null and a.user_id = v_uid));

  -- Athletes seen by their coach/admin (see every week); the rest only see weeks the coach has opened
  select coalesce(array_agg(a.id), '{}') into v_staff_ids
  from athletes a
  where a.id = any(v_ids)
    and (v_service or v_admin or (v_coach is not null and a.coach_id = v_coach));

  return (
    with pa as (
      select * from program_assignments where athlete_id = any(v_ids)
    ),
    vis as (  -- the highest week each program shows (null = all)
      select program_id,
             case when bool_or(athlete_id = any(v_staff_ids) or coalesce(visibility, 'all') = 'all') then null
                  else max(assignment_visible_through(id)) end as through
      from pa group by program_id
    ),
    blocks as (
      select tb.* from training_blocks tb join vis on vis.program_id = tb.program_id
      where vis.through is null or coalesce(tb.week_number, 1) <= vis.through
    ),
    wk as (
      select w.id, w.program_id, w.block_id, w.title, w.day_of_week,
             (select count(*) from workout_exercises x where x.workout_id = w.id) as n
      from workouts w join blocks b on b.id = w.block_id
    ),
    st as (
      select r.athlete_id, r.workout_id,
             count(distinct r.workout_exercise_id) as d,
             max(r.logged_at) as t
      from workout_results r
      join workout_exercises x on x.id = r.workout_exercise_id and x.workout_id = r.workout_id
      where r.athlete_id = any(v_ids) and r.completed and r.workout_id in (select id from wk)
      group by r.athlete_id, r.workout_id
    )
    select jsonb_build_object(
      'assignments', coalesce((select jsonb_agg(to_jsonb(pa)) from pa), '[]'),
      'programs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'title', p.title,
          'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'week_number', b.week_number, 'order', b."order"))
                              from blocks b where b.program_id = p.id), '[]'),
          'workouts', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'block_id', w.block_id, 'title', w.title, 'day_of_week', w.day_of_week, 'n', w.n))
                                from wk w where w.program_id = p.id), '[]')))
        from programs p where p.id in (select program_id from pa)), '[]'),
      'stats', coalesce((select jsonb_agg(jsonb_build_object('a', athlete_id, 'w', workout_id, 'd', d, 't', t)) from st), '[]'),
      'last', coalesce((select jsonb_agg(jsonb_build_object('a', athlete_id, 't', t))
                        from (select athlete_id, max(logged_at) t from workout_results where athlete_id = any(v_ids) group by athlete_id) l), '[]'),
      'overrides', coalesce((select jsonb_agg(jsonb_build_object('athlete_id', athlete_id, 'workout_id', workout_id, 'scheduled_date', scheduled_date))
                             from workout_schedule where athlete_id = any(v_ids)), '[]')
    )
  );
end;
$$;

revoke all on function public.get_schedule_data(uuid[]) from public, anon;
grant execute on function public.get_schedule_data(uuid[]) to authenticated, service_role;

-- 2) Speed up the security rules: check "who am I" once per request instead of once per row
do $$
declare
  r record;
  q text;
  c text;
  sql text;
  fix text := '';
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies where schemaname = 'public'
  loop
    q := r.qual; c := r.with_check;
    if q is not null then
      q := regexp_replace(q, '(?<![A-Za-z_.])(public\.)?(get_my_coach_id|get_my_athlete_id|is_admin|is_coach)\(\)', '(select public.\2())', 'g');
      q := regexp_replace(q, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      q := regexp_replace(q, '(?<![A-Za-z_.])(public\.)?athlete_can_see_(workout|block)\(([A-Za-z_]+)\)', '((select public.get_my_athlete_id()) is not null and public.athlete_can_see_\2(\3))', 'g');
    end if;
    if c is not null then
      c := regexp_replace(c, '(?<![A-Za-z_.])(public\.)?(get_my_coach_id|get_my_athlete_id|is_admin|is_coach)\(\)', '(select public.\2())', 'g');
      c := regexp_replace(c, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    end if;
    if q is distinct from r.qual or c is distinct from r.with_check then
      sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if q is not null then sql := sql || ' using (' || q || ')'; end if;
      if c is not null then sql := sql || ' with check (' || c || ')'; end if;
      execute sql;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
