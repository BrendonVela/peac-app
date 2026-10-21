-- PEAC: let people delete their own account (App Store requirement)
-- Run once in Supabase -> SQL Editor
begin;

create or replace function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;

  -- Don't leave the app without an admin
  if exists (select 1 from coaches where user_id = uid and is_admin)
     and (select count(*) from coaches where is_admin) <= 1 then
    raise exception 'You are the only admin. Make another coach an admin first.';
  end if;

  -- Athletes coached by this account become unassigned; their programs are deleted
  delete from coaches where user_id = uid;
  delete from athletes where user_id = uid;
  delete from auth.users where id = uid;
end
$$;
grant execute on function public.delete_my_account() to authenticated;

commit;
