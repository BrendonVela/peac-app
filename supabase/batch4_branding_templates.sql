-- PEAC batch 4: coach branding + program templates
-- Run once in Supabase -> SQL Editor
begin;

-- ---------- Branding ----------
alter table public.coaches add column if not exists brand_name text;
alter table public.coaches add column if not exists brand_color text;
alter table public.coaches add column if not exists brand_logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "brand logos: own folder read" on storage.objects;
create policy "brand logos: own folder read" on storage.objects
  for select to authenticated using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "brand logos: own folder upload" on storage.objects;
create policy "brand logos: own folder upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "brand logos: own folder update" on storage.objects;
create policy "brand logos: own folder update" on storage.objects
  for update to authenticated using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "brand logos: own folder delete" on storage.objects;
create policy "brand logos: own folder delete" on storage.objects
  for delete to authenticated using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Sign-up page: show the coach's logo and team name from their invite code
create or replace function public.coach_brand_for_code(code text)
returns table (name text, brand_name text, brand_color text, brand_logo_path text)
language sql security definer stable
set search_path = public
as $$
  select c.name, c.brand_name, c.brand_color, c.brand_logo_path
  from coaches c where upper(c.join_code) = upper(trim(coach_brand_for_code.code)) limit 1
$$;
grant execute on function public.coach_brand_for_code(text) to anon, authenticated;

-- ---------- Program templates ----------
alter table public.programs add column if not exists is_template boolean not null default false;
alter table public.programs add column if not exists is_public_template boolean not null default false;

-- Only the admin can share a template with every coach
create or replace function public.guard_public_template()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.is_public_template and not coalesce(public.is_admin(), false)
     and (tg_op = 'INSERT' or not coalesce(old.is_public_template, false)) then
    raise exception 'Only the admin can share templates with all coaches';
  end if;
  return new;
end
$$;
drop trigger if exists guard_public_template on public.programs;
create trigger guard_public_template before insert or update on public.programs
  for each row execute function public.guard_public_template();

-- Every coach can read shared templates (to copy them)
drop policy if exists "programs: coaches read shared templates" on public.programs;
create policy "programs: coaches read shared templates" on public.programs
  for select using (is_public_template and is_coach());

drop policy if exists "blocks: coaches read shared templates" on public.training_blocks;
create policy "blocks: coaches read shared templates" on public.training_blocks
  for select using (is_coach() and program_id in (select id from public.programs where is_public_template));

drop policy if exists "workouts: coaches read shared templates" on public.workouts;
create policy "workouts: coaches read shared templates" on public.workouts
  for select using (is_coach() and program_id in (select id from public.programs where is_public_template));

drop policy if exists "wx: coaches read shared templates" on public.workout_exercises;
create policy "wx: coaches read shared templates" on public.workout_exercises
  for select using (is_coach() and workout_id in (
    select w.id from public.workouts w join public.programs p on p.id = w.program_id where p.is_public_template));

commit;
