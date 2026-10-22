-- PEAC: athletes need a coach code to sign up
-- Run once in Supabase -> SQL Editor
begin;

-- Store every athlete code in capitals so codes are easy to match
update public.coaches set join_code = upper(trim(join_code)) where join_code is not null;

-- Is the shared coach sign-up code right? (used on the Sign up page before the account is made)
create or replace function public.coach_signup_code_valid(code text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from app_settings
    where key = 'coach_signup_code'
      and nullif(trim(value), '') is not null
      and upper(trim(value)) = upper(trim(coach_signup_code_valid.code))
  ) or exists (
    select 1 from coach_invites i
    where upper(i.code) = upper(trim(coach_signup_code_valid.code))
      and i.used_at is null and i.expires_at > now()
  )
$$;
grant execute on function public.coach_signup_code_valid(text) to anon, authenticated;

-- New athlete accounts must come with a real coach code
create or replace function public.handle_new_athlete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if coalesce(new.raw_user_meta_data->>'role', '') <> 'athlete' then
    return new;
  end if;

  if coalesce(trim(new.raw_user_meta_data->>'join_code'), '') <> '' then
    select id into cid from coaches
    where upper(join_code) = upper(trim(new.raw_user_meta_data->>'join_code'));
  end if;

  if cid is null then
    raise exception 'A valid coach code is required to sign up as an athlete';
  end if;

  insert into athletes (user_id, name, coach_id)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Athlete'), cid)
  on conflict (user_id) do update
    set coach_id = coalesce(athletes.coach_id, excluded.coach_id);
  return new;
end
$$;

drop trigger if exists on_auth_user_created_athlete on auth.users;
create trigger on_auth_user_created_athlete
  after insert on auth.users
  for each row execute function public.handle_new_athlete();

commit;
