// Saves parsed program weeks as a new program. Server-only (used by the Excel and PDF/photo importers).
import { revalidatePath } from 'next/cache'
import type { ParsedWeek } from './parseExcelProgram'
import { createExerciseMatcher } from './exerciseMatcher'
import { liftForExercise } from './maxes'

function guessCategory(section: string | null): string {
  const s = (section || '').toUpperCase()
  if (s.includes('PLYO')) return 'Plyometrics'
  if (s.includes('POWER') || s.includes('NEURAL') || s.includes('SPEED')) return 'Speed'
  if (s.includes('MOBILITY')) return 'Mobility'
  if (s.includes('CORE')) return 'Core'
  if (s.includes('ARM CARE') || s.includes('RECOVERY')) return 'Recovery'
  if (s.includes('CONDITIONING')) return 'Conditioning'
  return 'Strength'
}

/** Save parsed weeks as a new program (shared by the Excel and PDF/photo importers). Returns the program id. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importWeeks(supabase: any, coachId: string, weeks: ParsedWeek[], title: string, description: string): Promise<string> {
  // Every unique exercise name in the Excel file + its section (for category)
  const nameToSection = new Map<string, string | null>()
  for (const week of weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        if (!nameToSection.has(ex.name)) nameToSection.set(ex.name, ex.section)
      }
    }
  }

  // Load the library
  const { data: existingExercises, error: exLoadError } = await supabase
    .from('exercises')
    .select('id, title, video_url')
  if (exLoadError) throw new Error(`Could not load exercises: ${exLoadError.message}`)

  // Only exercises WITH a video are used for smart matching
  const matcher = createExerciseMatcher(
    (existingExercises || [])
      .filter((ex: any) => !!ex.video_url)
      .map((ex: any) => ({ id: ex.id, name: ex.title, hasVideo: true }))
  )

  // Exact title -> id for everything (so no-video exercises are reused, not duplicated)
  const titleToId = new Map<string, string>()
  for (const ex of existingExercises || []) {
    titleToId.set(ex.title.trim().toLowerCase(), ex.id)
  }

  const nameToId = new Map<string, string>()
  const noVideo: string[] = []
  let createdCount = 0

   for (const [name, section] of Array.from(nameToSection.entries())) {
    const key = name.trim().toLowerCase()
    if (nameToId.has(key)) continue

    // 1. Try to link to a library exercise with a video
    const hit = matcher.match(name)
    if (hit) {
      nameToId.set(key, hit.id)
      if (hit.name.trim().toLowerCase() !== key) {
        console.log(`[import] "${name}" -> "${hit.name}" (${hit.how}${hit.score ? ' ' + hit.score.toFixed(2) : ''})`)
      }
      continue
    }

    // 2. No video match: reuse an existing no-video exercise with the same title
    noVideo.push(name)
    const existingId = titleToId.get(key)
    if (existingId) {
      nameToId.set(key, existingId)
      continue
    }

    // 3. Otherwise create it without a video
    const { data: newEx, error: exError } = await supabase
      .from('exercises')
      .insert({ title: name, category: guessCategory(section) })
      .select('id')
      .single()

    if (exError || !newEx) {
      throw new Error(`Failed to create exercise "${name}": ${exError?.message}`)
    }

    nameToId.set(key, newEx.id)
    titleToId.set(key, newEx.id)
    createdCount++
  }

  for (const name of noVideo) console.log(`[import] NO VIDEO: "${name}"`)
  console.log(`[import] With video: ${nameToId.size - noVideo.length}, no video: ${noVideo.length} (${createdCount} newly created)`)

  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({ coach_id: coachId, title, description })
    .select('id')
    .single()

  if (programError || !program) {
    throw new Error(`Failed to create program: ${programError?.message}`)
  }

  let workoutCount = 0
  let exerciseInstanceCount = 0

  for (const week of weeks) {
    const { data: block, error: blockError } = await supabase
      .from('training_blocks')
      .insert({
        program_id: program.id,
        title: `${week.phaseTitle} — Week ${week.localWeek}`,
        week_number: week.absoluteWeek,
        order: week.absoluteWeek,
      })
      .select('id')
      .single()

    if (blockError || !block) continue

    for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
      const day = week.days[dayIdx]
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          program_id: program.id,
          block_id: block.id,
          title: day.title,
          day_of_week: dayIdx + 1,
          notes: null,
          warmup: day.warmup,
        })
        .select('id')
        .single()

      if (workoutError || !workout) {
        console.error(`[import] workout "${day.title}" failed: ${workoutError?.message}`)
        continue
      }
      workoutCount++

      const exerciseRows = day.exercises
        .filter((ex) => nameToId.has(ex.name.trim().toLowerCase()))
        .map((ex, i) => {
          const firstSet = ex.sets[0]
          const lift = liftForExercise(ex.name)
          const refMax = lift ? week.refMaxes[lift] ?? null : null
          // Keep every set's target when they differ (e.g. pyramids)
          const varies = ex.sets.some(
            st => st.prescWt !== firstSet?.prescWt || st.prescReps !== firstSet?.prescReps
          )
          return {
            workout_id: workout.id,
            exercise_id: nameToId.get(ex.name.trim().toLowerCase()),
            sets: String(ex.sets.length),
            reps: firstSet?.prescReps ?? null,
            load: firstSet?.prescWt ?? null,
            tempo: null,
            rest: null,
            notes: ex.coachingNote,
            section: ex.section,
            max_lift: lift && refMax ? lift : null,
            ref_max: lift && refMax ? refMax : null,
            order: i + 1,
            set_targets: varies
              ? ex.sets.map(st => ({ label: st.setLabel, weight: st.prescWt, reps: st.prescReps }))
              : null,
          }
        })

      if (exerciseRows.length > 0) {
        const { error: wxError } = await supabase.from('workout_exercises').insert(exerciseRows)
        if (wxError) console.error(`[import] exercises for "${day.title}" failed: ${wxError.message}`)
        exerciseInstanceCount += exerciseRows.length
      }
    }
  }

  console.log(`[import] Created ${workoutCount} workouts, ${exerciseInstanceCount} exercise entries`)

  revalidatePath('/coach/programs')
  revalidatePath('/coach/exercises')
  return program.id as string
}