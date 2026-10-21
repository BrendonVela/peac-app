-- PEAC: one shared coach sign-up code that the admin can change or turn off
-- Run once in Supabase -> SQL Editor
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings: admin manages" on public.app_settings;
create policy "app_settings: admin manages" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Starting code (change it any time on the Admin page)
insert into public.app_settings (key, value) values ('coach_signup_code', 'PEACCOACH26')
on conflict (key) do nothing;

-- Sign-up page: turn a new account into a coach if the shared code matches
drop function if exists public.claim_coach_role(text);
create function public.claim_coach_role(invite_code text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  current_code text;
  uname text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select nullif(trim(value), '') into current_code from app_settings where key = 'coach_signup_code';
  if current_code is null or upper(trim(invite_code)) <> upper(current_code) then
    raise exception 'Invalid coach code';
  end if;

  if exists (select 1 from coaches where user_id = auth.uid()) then return true; end if;

  select coalesce(nullif(trim(raw_user_meta_data->>'name'), ''), split_part(email, '@', 1))
    into uname from auth.users where id = auth.uid();

  insert into coaches (user_id, name) values (auth.uid(), uname);
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"coach"}'::jsonb
    where id = auth.uid();
  delete from athletes where user_id = auth.uid() and coach_id is null;
  return true;
end
$$;
grant execute on function public.claim_coach_role(text) to authenticated;
