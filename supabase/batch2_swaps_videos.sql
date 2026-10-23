-- PEAC batch 2: exercise swaps + athlete form-check videos
-- Run once in Supabase -> SQL Editor
begin;

-- ---------- Exercise swaps ----------
create table if not exists public.exercise_alternatives (
  exercise_id    uuid not null references public.exercises(id) on delete cascade,
  alternative_id uuid not null references public.exercises(id) on delete cascade,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (exercise_id, alternative_id),
  check (exercise_id <> alternative_id)
);
alter table public.exercise_alternatives enable row level security;
drop policy if exists "alternatives: anyone signed in reads" on public.exercise_alternatives;
create policy "alternatives: anyone signed in reads" on public.exercise_alternatives
  for select to authenticated using (true);
drop policy if exists "alternatives: coaches write" on public.exercise_alternatives;
create policy "alternatives: coaches write" on public.exercise_alternatives
  for all using (is_coach()) with check (is_coach());

-- Which exercise the athlete actually did instead
alter table public.workout_results add column if not exists swapped_exercise_id uuid references public.exercises(id) on delete set null;

-- ---------- Form-check videos ----------
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists attachment_type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-videos', 'form-videos', false, 52428800, array['video/mp4','video/quicktime','video/webm','video/3gpp','video/x-m4v'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "form videos: upload own folder" on storage.objects;
create policy "form videos: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "form videos: sender or receiver can watch" on storage.objects;
create policy "form videos: sender or receiver can watch" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-videos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
        where m.attachment_path = storage.objects.name
          and (m.sender_id = auth.uid() or m.receiver_id = auth.uid())
      )
      or public.is_admin()
    )
  );

drop policy if exists "form videos: owner or admin deletes" on storage.objects;
create policy "form videos: owner or admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'form-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;
