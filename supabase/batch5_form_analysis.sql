-- PEAC batch 5: saved form-analysis results for form-check videos
-- Run once in Supabase -> SQL Editor
begin;

create table if not exists public.video_analyses (
  id          uuid primary key default gen_random_uuid(),
  video_path  text not null unique,
  exercise    text,
  view        text,
  result      jsonb,
  frames      jsonb,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.video_analyses enable row level security;

-- Whoever can watch the video (the athlete who sent it, the coach it went to, or the admin) can see and save its analysis
create or replace function public.can_see_video(p text)
returns boolean language sql security definer stable
set search_path = public
as $$
  select split_part(p, '/', 1) = auth.uid()::text
      or exists (select 1 from messages m where m.attachment_path = p and (m.sender_id = auth.uid() or m.receiver_id = auth.uid()))
      or coalesce(is_admin(), false)
$$;
grant execute on function public.can_see_video(text) to authenticated;

drop policy if exists "video analyses: viewers" on public.video_analyses;
create policy "video analyses: viewers" on public.video_analyses
  for all using (public.can_see_video(video_path)) with check (public.can_see_video(video_path));

commit;
