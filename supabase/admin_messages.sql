-- PEAC: admin messaging
--  * coaches can message the admin
--  * the admin can message any coach or athlete
--  * athletes see the admin once the admin has messaged them
-- Run once in Supabase -> SQL Editor
drop function if exists public.message_contacts();

create function public.message_contacts()
returns table (user_id uuid, name text, kind text, detail text)
language sql security definer stable
set search_path = public
as $$
  -- Coaches see the admins
  select c.user_id, c.name, 'admin'::text, null::text
  from coaches c
  where c.is_admin and c.user_id is not null and c.user_id <> auth.uid()
    and exists (select 1 from coaches me where me.user_id = auth.uid())

  union
  -- Admins see every other coach
  select c.user_id, c.name, 'coach'::text, null::text
  from coaches c
  where not c.is_admin and c.user_id is not null and c.user_id <> auth.uid()
    and public.is_admin()

  union
  -- Admins see every athlete with an account
  select a.user_id, a.name, 'athlete'::text, coalesce('Coach ' || c.name, 'No coach')
  from athletes a
  left join coaches c on c.id = a.coach_id
  where a.user_id is not null and a.user_id <> auth.uid()
    and public.is_admin()

  union
  -- Athletes see an admin once that admin has messaged them (so they can reply)
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
