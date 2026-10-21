-- PEAC: athlete invite links
-- Run once in Supabase -> SQL Editor
begin;

-- 1) Each coach gets an invite code
alter table public.coaches add column if not exists join_code text unique;

-- 2) Look up a coach's name from a code (used on the join page, works before sign-in)
create or replace function public.coach_name_for_code(code text)
returns text
language sql security definer stable
set search_path = public
as $$
  select name from coaches where upper(join_code) = upper(trim(code)) limit 1
$$;
grant execute on function public.coach_name_for_code(text) to anon, authenticated;

-- 3) A signed-in athlete with no coach joins the coach behind a code
create or replace function public.join_coach(code text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  select id into cid from coaches where upper(join_code) = upper(trim(code));
  if cid is null then return false; end if;
  update athletes set coach_id = cid where user_id = auth.uid() and coach_id is null;
  return found;
end
$$;
grant execute on function public.join_coach(text) to authenticated;

-- 4) When an athlete account is created, make their athlete profile
--    (and add them to the coach's roster if they signed up with an invite link)
create or replace function public.handle_new_athlete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if coalesce(new.raw_user_meta_data->>'role', '') = 'athlete' then
    if coalesce(new.raw_user_meta_data->>'join_code', '') <> '' then
      select id into cid from coaches
      where upper(join_code) = upper(trim(new.raw_user_meta_data->>'join_code'));
    end if;

    insert into athletes (user_id, name, coach_id)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Athlete'), cid)
    on conflict (user_id) do update
      set coach_id = coalesce(athletes.coach_id, excluded.coach_id);
  end if;
  return new;
exception when others then
  -- Never block a sign-up because of this
  return new;
end
$$;

drop trigger if exists on_auth_user_created_athlete on auth.users;
create trigger on_auth_user_created_athlete
  after insert on auth.users
  for each row execute function public.handle_new_athlete();

commit;
