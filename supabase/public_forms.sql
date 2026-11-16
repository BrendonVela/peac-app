-- PEAC: public form links (anyone can fill out a form without an account)
-- Run once in Supabase -> SQL Editor
begin;

alter table public.forms add column if not exists public_slug text unique;
alter table public.forms add column if not exists show_athletes boolean not null default true;

-- Athletes only see forms meant for them (a form can be public-link only)
create or replace function public.my_forms()
returns setof public.forms
language sql security definer stable
set search_path = public
as $$
  select f.* from forms f
  join athletes a on a.user_id = auth.uid() and a.coach_id = f.coach_id
  where f.active and f.show_athletes
    and (f.group_id is null or exists (
      select 1 from athlete_group_members m where m.group_id = f.group_id and m.athlete_id = a.id))
  order by f.created_at;
$$;
revoke execute on function public.my_forms() from public, anon;
grant execute on function public.my_forms() to authenticated;

create table if not exists public.form_leads (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms(id) on delete cascade,
  name         text not null,
  email        text not null,
  answers      jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);
create index if not exists form_leads_form_idx on public.form_leads (form_id, submitted_at desc);
alter table public.form_leads enable row level security;

-- Coaches see and delete answers sent to their own public forms (nobody inserts directly)
drop policy if exists "form leads: coach reads" on public.form_leads;
create policy "form leads: coach reads" on public.form_leads
  for select using (form_id in (select id from public.forms where coach_id = get_my_coach_id()) or is_admin());
drop policy if exists "form leads: coach deletes" on public.form_leads;
create policy "form leads: coach deletes" on public.form_leads
  for delete using (form_id in (select id from public.forms where coach_id = get_my_coach_id()) or is_admin());

-- The public page loads the form through this (only forms that are shared and turned on)
create or replace function public.get_public_form(p_slug text)
returns table (id uuid, title text, description text, questions jsonb, brand_name text, brand_color text, brand_logo_path text)
language sql security definer stable set search_path = public as $$
  select f.id, f.title, f.description, f.questions, c.brand_name, c.brand_color, c.brand_logo_path
  from forms f join coaches c on c.id = f.coach_id
  where f.public_slug = p_slug and f.active
$$;

-- The public page sends answers through this, with basic spam limits
create or replace function public.submit_public_form(p_slug text, p_name text, p_email text, p_answers jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
begin
  select f.id into fid from forms f where f.public_slug = p_slug and f.active;
  if fid is null then raise exception 'This form is no longer available'; end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 120 then raise exception 'Please enter your name'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'Please enter a valid email'; end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 20000 then raise exception 'Answers are too long'; end if;
  if exists (select 1 from form_leads where form_id = fid and lower(email) = lower(trim(p_email)) and submitted_at > now() - interval '1 minute') then
    raise exception 'Already received. Thanks!';
  end if;
  if (select count(*) from form_leads where form_id = fid and submitted_at > now() - interval '1 hour') > 200 then
    raise exception 'Too many submissions right now. Try again later.';
  end if;
  insert into form_leads (form_id, name, email, answers) values (fid, trim(p_name), lower(trim(p_email)), p_answers);
  return true;
end $$;

revoke execute on function public.get_public_form(text) from public;
revoke execute on function public.submit_public_form(text, text, text, jsonb) from public;
grant execute on function public.get_public_form(text) to anon, authenticated;
grant execute on function public.submit_public_form(text, text, text, jsonb) to anon, authenticated;

commit;
