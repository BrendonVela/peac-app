-- PEAC: coaches can add their own performance tests (saved to the team's list)
-- Run once in Supabase -> SQL Editor
begin;

-- Allow any test type (built-in ones, plus 'custom:<id>' for your own)
alter table public.performance_tests drop constraint if exists performance_tests_test_type_check;

create table if not exists public.custom_tests (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references public.coaches(id) on delete cascade,
  label            text not null,
  unit             text not null default '',
  higher_is_better boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index if not exists custom_tests_coach_label on public.custom_tests (coach_id, lower(label));
alter table public.custom_tests enable row level security;

drop policy if exists "custom tests: coach manages" on public.custom_tests;
create policy "custom tests: coach manages" on public.custom_tests
  for all using (coach_id = get_my_coach_id() or is_admin())
  with check (coach_id = get_my_coach_id() or is_admin());

drop policy if exists "custom tests: athletes read" on public.custom_tests;
create policy "custom tests: athletes read" on public.custom_tests
  for select using (coach_id in (select coach_id from public.athletes where user_id = auth.uid()));

commit;
