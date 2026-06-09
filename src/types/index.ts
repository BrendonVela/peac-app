export type UserRole = 'coach' | 'athlete'

export type ExerciseCategory =
  | 'Speed'
  | 'Strength'
  | 'Plyometrics'
  | 'Mobility'
  | 'Conditioning'
  | 'Recovery'

export type TestType =
  | '10_yard'
  | '20_yard'
  | '40_yard'
  | 'vertical_jump'
  | 'broad_jump'
  | 'pro_agility'
  | 'body_weight'

export interface Coach {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Athlete {
  id: string
  user_id: string | null
  coach_id: string | null
  name: string
  sport: string | null
  position: string | null
  graduation_year: number | null
  created_at: string
}

export interface Exercise {
  id: string
  title: string
  category: ExerciseCategory
  description: string | null
  coaching_cues: string | null
  video_url: string | null
  movement_tags: string[] | null
  created_by: string | null
  created_at: string
}

export interface Program {
  id: string
  coach_id: string
  title: string
  description: string | null
  created_at: string
}

export interface TrainingBlock {
  id: string
  program_id: string
  title: string
  week_number: number
  order: number
  created_at: string
}

export interface Workout {
  id: string
  program_id: string
  block_id: string | null
  title: string
  date: string | null
  day_of_week: number | null
  notes: string | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  sets: number | null
  reps: string | null
  load: string | null
  tempo: string | null
  rest: string | null
  notes: string | null
  order: number
  exercise?: Exercise
}

export interface WorkoutResult {
  id: string
  athlete_id: string
  workout_id: string
  workout_exercise_id: string | null
  weight_used: number | null
  reps_completed: number | null
  completed: boolean
  notes: string | null
  logged_at: string
}

export interface PerformanceTest {
  id: string
  athlete_id: string
  test_type: TestType
  result: number
  unit: string
  date: string
  notes: string | null
  created_at: string
}

export interface CheckIn {
  id: string
  athlete_id: string
  sleep_quality: number
  energy: number
  stress: number
  soreness: number
  motivation: number
  readiness_score: number
  notes: string | null
  date: string
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
}

export interface ProgramAssignment {
  id: string
  program_id: string
  athlete_id: string
  assigned_at: string
  start_date: string | null
}
