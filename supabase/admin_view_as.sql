-- PEAC: admins can see and change everything (for "View as")
-- Run once in Supabase -> SQL Editor
begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'coaches', 'athletes', 'programs', 'training_blocks', 'workouts', 'workout_exercises',
    'program_assignments', 'workout_schedule', 'check_ins', 'performance_tests', 'athlete_maxes'
  ] loop
    execute format('drop policy if exists "admin: full access" on public.%I', t);
    execute format('create policy "admin: full access" on public.%I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Admins can read messages (but only send as themselves)
drop policy if exists "admin: read messages" on public.messages;
create policy "admin: read messages" on public.messages for select using (is_admin());

commit;
