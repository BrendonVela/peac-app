-- ============================================================
-- PEAC Performance App — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE coaches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE athletes (vscode-webview://1vt6e0vghp4b3s30sfou97aueppj44o0mh051s2lj1u8lkv6neoj/peac-app/src/app/coach/messages/
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  coach_id        UUID REFERENCES coaches(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  sport           TEXT,
  position        TEXT,
  graduation_year INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exercises (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Speed','Strength','Plyometrics','Mobility','Conditioning','Recovery')),
  description   TEXT,
  coaching_cues TEXT,
  video_url     TEXT,
  movement_tags TEXT[],
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE programs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id    UUID REFERENCES coaches(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE training_blocks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  week_number INTEGER NOT NULL DEFAULT 1,
  "order"     INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workouts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  block_id    UUID REFERENCES training_blocks(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  date        DATE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_exercises (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id  UUID REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  sets        INTEGER,
  reps        TEXT,
  load        TEXT,
  tempo       TEXT,
  rest        TEXT,
  notes       TEXT,
  "order"     INTEGER DEFAULT 0
);

CREATE TABLE program_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  athlete_id  UUID REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  start_date  DATE,
  UNIQUE (program_id, athlete_id)
);

CREATE TABLE workout_results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id          UUID REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  workout_id          UUID REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  workout_exercise_id UUID REFERENCES workout_exercises(id) ON DELETE SET NULL,
  weight_used         NUMERIC,
  reps_completed      INTEGER,
  completed           BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  logged_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE performance_tests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id  UUID REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  test_type   TEXT NOT NULL CHECK (test_type IN ('10_yard','20_yard','40_yard','vertical_jump','broad_jump','pro_agility','body_weight')),
  result      NUMERIC NOT NULL,
  unit        TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE check_ins (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id     UUID REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  sleep_quality  INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 10),
  energy         INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 10),
  stress         INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 10),
  soreness       INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 10),
  motivation     INTEGER NOT NULL CHECK (motivation BETWEEN 1 AND 10),
  readiness_score NUMERIC GENERATED ALWAYS AS (
    (sleep_quality + energy + (11 - stress) + (11 - soreness) + motivation)::numeric / 5
  ) STORED,
  notes          TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (athlete_id, date)
);

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_athletes_coach ON athletes (coach_id);
CREATE INDEX idx_workouts_program ON workouts (program_id);
CREATE INDEX idx_workouts_block ON workouts (block_id);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id);
CREATE INDEX idx_results_athlete ON workout_results (athlete_id);
CREATE INDEX idx_results_workout ON workout_results (workout_id);
CREATE INDEX idx_tests_athlete ON performance_tests (athlete_id);
CREATE INDEX idx_checkins_athlete_date ON check_ins (athlete_id, date);
CREATE INDEX idx_messages_sender ON messages (sender_id);
CREATE INDEX idx_messages_receiver ON messages (receiver_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_coach_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT id FROM coaches WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_athlete_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT id FROM athletes WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM coaches WHERE user_id = auth.uid());
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE coaches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_tests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;

-- coaches
CREATE POLICY "coaches: own row"    ON coaches FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "coaches: athlete can read their coach" ON coaches FOR SELECT
  USING (id = (SELECT coach_id FROM athletes WHERE user_id = auth.uid()));

-- athletes
CREATE POLICY "athletes: coach manages"   ON athletes FOR ALL
  USING (coach_id = get_my_coach_id());
CREATE POLICY "athletes: own row"         ON athletes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "athletes: self update"     ON athletes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "athletes: self insert"     ON athletes FOR INSERT WITH CHECK (user_id = auth.uid());

-- exercises (all authenticated can read; coaches can write)
CREATE POLICY "exercises: authenticated read" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercises: coach write"        ON exercises FOR ALL USING (is_coach());

-- programs
CREATE POLICY "programs: coach manages" ON programs FOR ALL USING (coach_id = get_my_coach_id());
CREATE POLICY "programs: athlete reads assigned" ON programs FOR SELECT USING (
  id IN (SELECT program_id FROM program_assignments WHERE athlete_id = get_my_athlete_id())
);

-- training_blocks
CREATE POLICY "blocks: coach manages" ON training_blocks FOR ALL USING (
  program_id IN (SELECT id FROM programs WHERE coach_id = get_my_coach_id())
);
CREATE POLICY "blocks: athlete reads" ON training_blocks FOR SELECT USING (
  program_id IN (SELECT program_id FROM program_assignments WHERE athlete_id = get_my_athlete_id())
);

-- workouts
CREATE POLICY "workouts: coach manages" ON workouts FOR ALL USING (
  program_id IN (SELECT id FROM programs WHERE coach_id = get_my_coach_id())
);
CREATE POLICY "workouts: athlete reads" ON workouts FOR SELECT USING (
  program_id IN (SELECT program_id FROM program_assignments WHERE athlete_id = get_my_athlete_id())
);

-- workout_exercises
CREATE POLICY "wx: coach manages" ON workout_exercises FOR ALL USING (
  workout_id IN (
    SELECT w.id FROM workouts w
    JOIN programs p ON w.program_id = p.id
    WHERE p.coach_id = get_my_coach_id()
  )
);
CREATE POLICY "wx: athlete reads" ON workout_exercises FOR SELECT USING (
  workout_id IN (
    SELECT w.id FROM workouts w
    JOIN program_assignments pa ON w.program_id = pa.program_id
    WHERE pa.athlete_id = get_my_athlete_id()
  )
);

-- program_assignments
CREATE POLICY "pa: coach manages" ON program_assignments FOR ALL USING (
  program_id IN (SELECT id FROM programs WHERE coach_id = get_my_coach_id())
);
CREATE POLICY "pa: athlete reads" ON program_assignments FOR SELECT USING (
  athlete_id = get_my_athlete_id()
);

-- workout_results
CREATE POLICY "results: athlete manages"  ON workout_results FOR ALL USING (athlete_id = get_my_athlete_id());
CREATE POLICY "results: coach reads"      ON workout_results FOR SELECT USING (
  athlete_id IN (SELECT id FROM athletes WHERE coach_id = get_my_coach_id())
);

-- performance_tests
CREATE POLICY "tests: athlete manages"  ON performance_tests FOR ALL USING (athlete_id = get_my_athlete_id());
CREATE POLICY "tests: coach all"        ON performance_tests FOR ALL USING (
  athlete_id IN (SELECT id FROM athletes WHERE coach_id = get_my_coach_id())
);

-- check_ins
CREATE POLICY "checkins: athlete manages" ON check_ins FOR ALL USING (athlete_id = get_my_athlete_id());
CREATE POLICY "checkins: coach reads"     ON check_ins FOR SELECT USING (
  athlete_id IN (SELECT id FROM athletes WHERE coach_id = get_my_coach_id())
);

-- messages
CREATE POLICY "messages: participants read"  ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages: sender inserts"     ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages: receiver marks read" ON messages FOR UPDATE USING (receiver_id = auth.uid());
