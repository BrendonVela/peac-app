-- PEAC: coaches choose how far ahead an athlete can see an assigned program.
-- Hidden weeks are blocked in the database itself (not just hidden on screen).
-- Run once in Supabase -> SQL Editor
begin;

alter table public.program_assignments add column if not exists visibility text not null default 'all';   -- all | ahead | through
alter table public.program_assignments add column if not exists visible_weeks int not null default 1;     -- ahead: weeks shown incl. this one / through: last week shown

-- Last program week this assignment lets the athlete see (null = everything)
create or replace function public.assignment_visible_through(p_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  a record; today date; sw int; sd date; wn int; aw int; ad date; ws date; cur int; k text; v text;
begin
  select * into a from program_assignments where id = p_id;
  if not found or coalesce(a.visibility, 'all') = 'all' then return null; end if;
  if a.visibility = 'through' then return greatest(1, a.visible_weeks); end if;
  -- 'ahead': the week they're on now + (visible_weeks - 1)
  today := (now() at time zone 'America/Los_Angeles')::date;
  sw := greatest(1, coalesce(a.start_week, 1));
  sd := coalesce(a.start_date, (a.assigned_at at time zone 'America/Los_Angeles')::date, today);
  cur := sw;
  for wn in sw .. sw + 520 loop
    aw := sw; ad := sd;
    for k, v in select key, value from jsonb_each_text(coalesce(a.phase_starts, '{}'::jsonb)) loop
      if k ~ '^\d+$' and v ~ '^\d{4}-\d{2}-\d{2}$' and k::int > sw and k::int <= wn and k::int > aw then aw := k::int; ad := v::date; end if;
    end loop;
    ws := (ad - (extract(isodow from ad)::int - 1)) + (wn - aw) * 7;
    exit when ws > today;
    cur := wn;
  end loop;
  return cur + greatest(1, a.visible_weeks) - 1;
end $$;

create or replace function public.athlete_can_see_workout(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workouts w
    join program_assignments pa on pa.program_id = w.program_id
    left join training_blocks tb on tb.id = w.block_id
    where w.id = wid and pa.athlete_id = get_my_athlete_id()
      and (coalesce(pa.visibility, 'all') = 'all' or coalesce(tb.week_number, 1) <= public.assignment_visible_through(pa.id))
  )
$$;

create or replace function public.athlete_can_see_block(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from training_blocks tb
    join program_assignments pa on pa.program_id = tb.program_id
    where tb.id = bid and pa.athlete_id = get_my_athlete_id()
      and (coalesce(pa.visibility, 'all') = 'all' or coalesce(tb.week_number, 1) <= public.assignment_visible_through(pa.id))
  )
$$;

grant execute on function public.assignment_visible_through(uuid) to authenticated;
grant execute on function public.athlete_can_see_workout(uuid) to authenticated;
grant execute on function public.athlete_can_see_block(uuid) to authenticated;

-- Athletes only read the weeks they're allowed to see
drop policy if exists "blocks: athlete reads" on public.training_blocks;
create policy "blocks: athlete reads" on public.training_blocks for select using (public.athlete_can_see_block(id));

drop policy if exists "workouts: athlete reads" on public.workouts;
create policy "workouts: athlete reads" on public.workouts for select using (public.athlete_can_see_workout(id));

drop policy if exists "wx: athlete reads" on public.workout_exercises;
create policy "wx: athlete reads" on public.workout_exercises for select using (public.athlete_can_see_workout(workout_id));

commit;
