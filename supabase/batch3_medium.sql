-- PEAC batch 3: readiness adjustments, custom forms, assistant coaches
-- Run once in Supabase -> SQL Editor
begin;

-- ---------- Readiness adjustments (per coach) ----------
alter table public.coaches add column if not exists readiness_low numeric not null default 5;
alter table public.coaches add column if not exists readiness_cut integer not null default 10;
alter table public.coaches add column if not exists readiness_on boolean not null default true;

-- ---------- Assistant coaches / staff ----------
alter table public.coaches add column if not exists head_coach_id uuid references public.coaches(id) on delete cascade;

-- "My coach id" is the head coach's id for assistants, so they share the head coach's team
create or replace function public.get_my_coach_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select coalesce(head_coach_id, id) from coaches where user_id = auth.uid();
$$;

drop policy if exists "coaches: staff read head coach" on public.coaches;
create policy "coaches: staff read head coach" on public.coaches
  for select using (id = get_my_coach_id());

drop policy if exists "coaches: head reads staff" on public.coaches;
create policy "coaches: head reads staff" on public.coaches
  for select using (head_coach_id is not null and head_coach_id = get_my_coach_id());

alter table public.coach_invites add column if not exists head_coach_id uuid references public.coaches(id) on delete cascade;

drop policy if exists "coach_invites: head coach makes staff invites" on public.coach_invites;
create policy "coach_invites: head coach makes staff invites" on public.coach_invites
  for all using (head_coach_id is not null and head_coach_id = get_my_coach_id())
  with check (head_coach_id is not null and head_coach_id = get_my_coach_id()
              and not exists (select 1 from coaches c where c.user_id = auth.uid() and c.head_coach_id is not null));

-- Claiming an invite: staff invites attach the new coach to the head coach's team
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

  insert into coaches (user_id, name, head_coach_id) values (auth.uid(), uname, inv.head_coach_id);
  update coach_invites set used_by = auth.uid(), used_at = now() where coach_invites.code = inv.code;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"coach"}'::jsonb
    where id = auth.uid();
  delete from athletes where user_id = auth.uid() and coach_id is null;
  return true;
end
$$;
grant execute on function public.claim_coach_invite(text) to authenticated;

-- Head coach removes an assistant (they become a coach with their own, empty team)
create or replace function public.remove_staff(staff_coach_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update coaches set head_coach_id = null
  where id = staff_coach_id and head_coach_id = get_my_coach_id()
    and get_my_coach_id() = (select id from coaches where user_id = auth.uid());
end
$$;
grant execute on function public.remove_staff(uuid) to authenticated;

-- ---------- Custom forms / questionnaires ----------
create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches(id) on delete cascade,
  title       text not null,
  description text,
  frequency   text not null default 'once' check (frequency in ('once','daily','weekly')),
  questions   jsonb not null default '[]'::jsonb,
  group_id    uuid references public.athlete_groups(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.form_responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  period       text not null,
  answers      jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (form_id, athlete_id, period)
);
alter table public.forms enable row level security;
alter table public.form_responses enable row level security;

drop policy if exists "forms: coach manages" on public.forms;
create policy "forms: coach manages" on public.forms
  for all using (coach_id = get_my_coach_id() or is_admin())
  with check (coach_id = get_my_coach_id() or is_admin());

drop policy if exists "form responses: athlete own" on public.form_responses;
create policy "form responses: athlete own" on public.form_responses
  for all using (athlete_id = get_my_athlete_id()) with check (athlete_id = get_my_athlete_id());

drop policy if exists "form responses: coach reads" on public.form_responses;
create policy "form responses: coach reads" on public.form_responses
  for select using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()) or is_admin());

drop policy if exists "form responses: coach deletes" on public.form_responses;
create policy "form responses: coach deletes" on public.form_responses
  for delete using (athlete_id in (select id from public.athletes where coach_id = get_my_coach_id()) or is_admin());

-- Forms an athlete should see (their coach's active forms, for everyone or a group they're in)
create or replace function public.my_forms()
returns setof public.forms
language sql security definer stable
set search_path = public
as $$
  select f.* from forms f
  join athletes a on a.user_id = auth.uid() and a.coach_id = f.coach_id
  where f.active
    and (f.group_id is null or exists (
      select 1 from athlete_group_members m where m.group_id = f.group_id and m.athlete_id = a.id))
  order by f.created_at;
$$;
grant execute on function public.my_forms() to authenticated;

-- Messaging: coaches see their head coach / assistants; athletes see their coach's assistants
create or replace function public.message_contacts()
returns table (user_id uuid, name text, kind text, detail text)
language sql security definer stable
set search_path = public
as $$
  select c.user_id, c.name, 'admin'::text, null::text
  from coaches c
  where c.is_admin and c.user_id is not null and c.user_id <> auth.uid()
    and exists (select 1 from coaches me where me.user_id = auth.uid())

  union
  select c.user_id, c.name, 'coach'::text, null::text
  from coaches c
  where not c.is_admin and c.user_id is not null and c.user_id <> auth.uid()
    and public.is_admin()

  union
  -- Same team: head coach + assistants see each other
  select c.user_id, c.name, 'coach'::text, case when c.head_coach_id is null then 'Head coach' else 'Assistant coach' end
  from coaches c
  where c.user_id is not null and c.user_id <> auth.uid()
    and exists (select 1 from coaches me where me.user_id = auth.uid())
    and coalesce(c.head_coach_id, c.id) = get_my_coach_id()

  union
  select a.user_id, a.name, 'athlete'::text, coalesce('Coach ' || c.name, 'No coach')
  from athletes a
  left join coaches c on c.id = a.coach_id
  where a.user_id is not null and a.user_id <> auth.uid()
    and public.is_admin()

  union
  -- Athletes see their coach's assistants
  select s.user_id, s.name, 'staff'::text, 'Assistant coach'
  from coaches s
  join athletes me on me.user_id = auth.uid()
  where s.head_coach_id = me.coach_id and s.user_id is not null

  union
  select c.user_id, c.name, 'admin'::text, null::text
  from coaches c
  where c.is_admin and c.user_id is not null
    and exists (select 1 from athletes me where me.user_id = auth.uid())
    and exists (
      select 1 from messages m
      where (m.sender_id = c.user_id and m.receiver_id = auth.uid())
         or (m.sender_id = auth.uid() and m.receiver_id = c.user_id)
    )
$$;
grant execute on function public.message_contacts() to authenticated;

commit;
