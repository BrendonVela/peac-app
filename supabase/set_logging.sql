-- PEAC: per-set targets and per-set logging
-- Run once in Supabase -> SQL Editor
alter table public.workout_exercises add column if not exists set_targets jsonb;
alter table public.workout_results   add column if not exists set_logs    jsonb;
