-- PEAC security fix (Nov 2026). Run once in Supabase -> SQL Editor. Safe to run again.
begin;

-- ---------- 1. COACHES: nobody can make themselves admin or join another team ----------
drop policy if exists "coaches: own row" on public.coaches;
drop policy if exists "coaches: read own row" on public.coaches;
drop policy if exists "coaches: update own row" on public.coaches;
create policy "coaches: read own row" on public.coaches
  for select using (user_id = auth.uid());
create policy "coaches: update own row" on public.coaches
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No insert/delete from the app: coach accounts are made only by the invite / coach-code functions.

create or replace function public.guard_coach_row()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Only checks requests coming from the app (signed-in users). Our own SQL functions are trusted.
  if current_user in ('authenticated', 'anon') and not coalesce(public.is_admin(), false) then
    if new.is_admin is distinct from old.is_admin
       or new.head_coach_id is distinct from old.head_coach_id
       or new.user_id is distinct from old.user_id
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change that';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_coach_row on public.coaches;
create trigger guard_coach_row before update on public.coaches
  for each row execute function public.guard_coach_row();

-- ---------- 2. ATHLETES: athletes can't move themselves onto another coach's team ----------
drop policy if exists "athletes: self insert" on public.athletes;
create policy "athletes: self insert" on public.athletes
  for insert with check (user_id = auth.uid() and coach_id is null);
drop policy if exists "athletes: self update" on public.athletes;
create policy "athletes: self update" on public.athletes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "athletes: coach releases" on public.athletes;

create or replace function public.guard_athlete_row()
returns trigger language plpgsql set search_path = public as $$
declare me uuid := public.get_my_coach_id();
begin
  if current_user in ('authenticated', 'anon') and not coalesce(public.is_admin(), false) then
    if tg_op = 'INSERT' then
      -- coaches add athletes without a login; a person can only make a row for themself
      if new.user_id is not null and new.user_id <> auth.uid() then
        raise exception 'Not allowed';
      end if;
    else
      if new.user_id is distinct from old.user_id then
        raise exception 'Not allowed to change the login';
      end if;
      if new.coach_id is distinct from old.coach_id and not (
           (old.coach_id is not null and old.coach_id = me and new.coach_id is null)  -- coach removes athlete
        or (old.coach_id is null and new.coach_id = me)                             -- coach claims athlete
      ) then
        raise exception 'Not allowed to change the coach';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_athlete_row on public.athletes;
create trigger guard_athlete_row before insert or update on public.athletes
  for each row execute function public.guard_athlete_row();

-- ---------- 3. EXERCISES: coaches can only edit/delete their own team's exercises ----------
create or replace function public.can_edit_exercise(eid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.is_admin(), false) or exists (
    select 1 from exercises e
    join coaches c on c.user_id = e.created_by
    where e.id = eid and coalesce(c.head_coach_id, c.id) = public.get_my_coach_id()
  )
$$;
grant execute on function public.can_edit_exercise(uuid) to authenticated;

drop policy if exists "exercises: coach write" on public.exercises;
drop policy if exists "exercises: coach adds" on public.exercises;
drop policy if exists "exercises: coach edits own" on public.exercises;
drop policy if exists "exercises: coach deletes own" on public.exercises;
create policy "exercises: coach adds" on public.exercises
  for insert with check (is_coach() and created_by = auth.uid());
create policy "exercises: coach edits own" on public.exercises
  for update using (public.can_edit_exercise(id)) with check (public.can_edit_exercise(id));
create policy "exercises: coach deletes own" on public.exercises
  for delete using (public.can_edit_exercise(id));

drop policy if exists "alternatives: coaches write" on public.exercise_alternatives;
create policy "alternatives: coaches write" on public.exercise_alternatives
  for all using (is_coach() and public.can_edit_exercise(exercise_id))
  with check (is_coach() and public.can_edit_exercise(exercise_id));

-- ---------- 4. MESSAGES: only message people you're connected to; can't change other people's messages ----------
create or replace function public.can_message(r uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select r is not null and r <> auth.uid() and (
       coalesce(public.is_admin(), false)
    -- coaches can message the admin
    or (exists (select 1 from coaches me where me.user_id = auth.uid())
        and exists (select 1 from coaches c where c.user_id = r and c.is_admin))
    -- coach/staff -> their athletes
    or exists (select 1 from athletes a where a.user_id = r and a.coach_id = public.get_my_coach_id())
    -- coach <-> coaches on the same team
    or exists (select 1 from coaches c where c.user_id = r and public.get_my_coach_id() is not null
               and coalesce(c.head_coach_id, c.id) = public.get_my_coach_id())
    -- athlete -> their coach or that coach's assistants
    or exists (select 1 from athletes me join coaches c on coalesce(c.head_coach_id, c.id) = me.coach_id
               where me.user_id = auth.uid() and c.user_id = r)
    -- replying to someone who messaged you
    or exists (select 1 from messages m where m.sender_id = r and m.receiver_id = auth.uid())
  )
$$;
grant execute on function public.can_message(uuid) to authenticated;

drop policy if exists "messages: sender inserts" on public.messages;
create policy "messages: sender inserts" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.can_message(receiver_id)
    and (attachment_path is null or public.can_see_video(attachment_path))
  );

create or replace function public.guard_message_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not coalesce(public.is_admin(), false)
     and (to_jsonb(new) - 'read') is distinct from (to_jsonb(old) - 'read') then
    raise exception 'You can only mark messages as read';
  end if;
  return new;
end $$;
drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------- 5. PROGRAM ASSIGNMENTS: coaches can only assign to their own athletes ----------
create or replace function public.is_my_program(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from programs where id = pid and coach_id = public.get_my_coach_id())
$$;
create or replace function public.is_my_athlete(aid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from athletes where id = aid and coach_id = public.get_my_coach_id())
$$;
grant execute on function public.is_my_program(uuid) to authenticated;
grant execute on function public.is_my_athlete(uuid) to authenticated;

drop policy if exists "pa: coach manages" on public.program_assignments;
create policy "pa: coach manages" on public.program_assignments
  for all using (public.is_my_program(program_id))
  with check (public.is_my_program(program_id) and public.is_my_athlete(athlete_id));

commit;
