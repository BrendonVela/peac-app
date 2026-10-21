-- PEAC: admin controls
-- Run once in Supabase -> SQL Editor
begin;

-- ---------- Admins ----------
alter table public.coaches add column if not exists is_admin boolean not null default false;

update public.coaches c set is_admin = true
from auth.users u
where u.id = c.user_id and lower(u.email) = 'brendonvela24@gmail.com';

create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from coaches where user_id = auth.uid()), false)
$$;
grant execute on function public.is_admin() to authenticated;

-- ---------- Coach invites (one-time links) ----------
create table if not exists public.coach_invites (
  code        text primary key,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz
);
alter table public.coach_invites enable row level security;
drop policy if exists "coach_invites: admin manages" on public.coach_invites;
create policy "coach_invites: admin manages" on public.coach_invites
  for all using (is_admin()) with check (is_admin());

-- Is this coach invite usable? (works before sign-in)
create or replace function public.coach_invite_valid(code text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from coach_invites i
    where upper(i.code) = upper(trim(coach_invite_valid.code))
      and i.used_at is null and i.expires_at > now()
  )
$$;
grant execute on function public.coach_invite_valid(text) to anon, authenticated;

-- Signed-in user turns their new account into a coach using an invite
create or replace function public.claim_coach_invite(code text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  inv coach_invites%rowtype;
  uname text;
begin
  if auth.uid() is null then return false; end if;
  select * into inv from coach_invites i
  where upper(i.code) = upper(trim(claim_coach_invite.code))
    and i.used_at is null and i.expires_at > now()
  for update;
  if not found then return false; end if;
  if exists (select 1 from coaches where user_id = auth.uid()) then return false; end if;

  select coalesce(nullif(trim(raw_user_meta_data->>'name'), ''), split_part(email, '@', 1))
    into uname from auth.users where id = auth.uid();

  insert into coaches (user_id, name) values (auth.uid(), uname);
  update coach_invites set used_by = auth.uid(), used_at = now() where coach_invites.code = inv.code;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"coach"}'::jsonb
    where id = auth.uid();
  -- An athlete profile shouldn't exist for a coach account
  delete from athletes where user_id = auth.uid() and coach_id is null;
  return true;
end
$$;
grant execute on function public.claim_coach_invite(text) to authenticated;

-- ---------- Admin: list everyone ----------
create or replace function public.admin_list_people()
returns table (
  kind text, id uuid, user_id uuid, name text, email text,
  coach_id uuid, coach_name text, is_admin boolean,
  athlete_count int, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  return query
    select 'coach'::text, c.id, c.user_id, c.name, u.email::text,
           null::uuid, null::text, c.is_admin,
           (select count(*)::int from athletes a where a.coach_id = c.id),
           c.created_at, u.last_sign_in_at
    from coaches c left join auth.users u on u.id = c.user_id
    union all
    select 'athlete'::text, a.id, a.user_id, a.name, u.email::text,
           a.coach_id, c.name, false, 0,
           a.created_at, u.last_sign_in_at
    from athletes a
    left join auth.users u on u.id = a.user_id
    left join coaches c on c.id = a.coach_id;
end
$$;
grant execute on function public.admin_list_people() to authenticated;

-- ---------- Admin: make / remove admin ----------
create or replace function public.admin_set_admin(coach_id uuid, value boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if not value and (select count(*) from coaches where is_admin) <= 1
     and (select is_admin from coaches where id = admin_set_admin.coach_id) then
    raise exception 'There must be at least one admin';
  end if;
  update coaches set is_admin = value where id = admin_set_admin.coach_id;
end
$$;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

-- ---------- Admin: move an athlete to a coach (or unassign with null) ----------
create or replace function public.admin_move_athlete(athlete_id uuid, coach_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  update athletes set coach_id = admin_move_athlete.coach_id where id = admin_move_athlete.athlete_id;
end
$$;
grant execute on function public.admin_move_athlete(uuid, uuid) to authenticated;

-- ---------- Admin: delete an athlete (and their login) ----------
create or replace function public.admin_delete_athlete(athlete_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select user_id into uid from athletes where id = admin_delete_athlete.athlete_id;
  delete from athletes where id = admin_delete_athlete.athlete_id;
  if uid is not null and not exists (select 1 from coaches where user_id = uid) then
    delete from auth.users where id = uid;
  end if;
end
$$;
grant execute on function public.admin_delete_athlete(uuid) to authenticated;

-- ---------- Admin: delete a coach (optionally hand athletes + programs to another coach) ----------
create or replace function public.admin_delete_coach(coach_id uuid, transfer_to uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select user_id into uid from coaches where id = admin_delete_coach.coach_id;
  if uid = auth.uid() then raise exception 'You can''t delete your own account here'; end if;
  if transfer_to is not null then
    if transfer_to = admin_delete_coach.coach_id then raise exception 'Pick a different coach'; end if;
    update programs set coach_id = transfer_to where programs.coach_id = admin_delete_coach.coach_id;
    update athletes set coach_id = transfer_to where athletes.coach_id = admin_delete_coach.coach_id;
  end if;
  delete from coaches where id = admin_delete_coach.coach_id;
  if uid is not null then delete from auth.users where id = uid; end if;
end
$$;
grant execute on function public.admin_delete_coach(uuid, uuid) to authenticated;

-- ---------- Reset an athlete's training data (their coach or an admin) ----------
create or replace function public.reset_athlete_data(athlete_id uuid, include_checkins boolean, include_tests boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not (is_admin() or exists (
    select 1 from athletes a where a.id = reset_athlete_data.athlete_id and a.coach_id = get_my_coach_id()
  )) then
    raise exception 'Not allowed';
  end if;
  delete from workout_results  where workout_results.athlete_id  = reset_athlete_data.athlete_id;
  delete from warmup_logs      where warmup_logs.athlete_id      = reset_athlete_data.athlete_id;
  delete from workout_schedule where workout_schedule.athlete_id = reset_athlete_data.athlete_id;
  if include_checkins then delete from check_ins where check_ins.athlete_id = reset_athlete_data.athlete_id; end if;
  if include_tests then delete from performance_tests where performance_tests.athlete_id = reset_athlete_data.athlete_id; end if;
end
$$;
grant execute on function public.reset_athlete_data(uuid, boolean, boolean) to authenticated;

-- ---------- Coaches can fix their athletes' logged sets ----------
drop policy if exists "results: coach manages" on public.workout_results;
create policy "results: coach manages" on public.workout_results
  for all
  using (athlete_id in (select id from athletes where coach_id = get_my_coach_id()) or is_admin())
  with check (athlete_id in (select id from athletes where coach_id = get_my_coach_id()) or is_admin());

drop policy if exists "warmup: coach manages" on public.warmup_logs;
create policy "warmup: coach manages" on public.warmup_logs
  for all
  using (athlete_id in (select id from athletes where coach_id = get_my_coach_id()) or is_admin())
  with check (athlete_id in (select id from athletes where coach_id = get_my_coach_id()) or is_admin());

commit;
