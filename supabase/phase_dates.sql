-- PEAC: start an athlete partway through a program, and set a start date for any phase
-- Run once in Supabase -> SQL Editor
alter table public.program_assignments add column if not exists start_week int not null default 1;
-- { "17": "2026-12-01", ... }  week number -> the date that week starts (blank = right after the previous phase)
alter table public.program_assignments add column if not exists phase_starts jsonb not null default '{}'::jsonb;
