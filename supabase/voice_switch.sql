-- PEAC: admin switch to turn the voice coach + microphone off for everyone. Safe to run more than once.
insert into public.app_settings (key, value) values ('voice_enabled', 'true')
on conflict (key) do nothing;

-- Everyone signed in can ask "is the voice coach on?" (they can't change it; only the admin can)
create or replace function public.voice_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select lower(trim(value)) <> 'false' from app_settings where key = 'voice_enabled'), true)
$$;
revoke all on function public.voice_allowed() from public;
grant execute on function public.voice_allowed() to authenticated;

notify pgrst, 'reload schema';
