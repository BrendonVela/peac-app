// Turns what the athlete says into a command. Plain rules (no AI), tolerant of how people talk.

export type Command =
  | { type: 'help' } | { type: 'stop' } | { type: 'voice_off' } | { type: 'faster' } | { type: 'slower' } | { type: 'change_voice' }
  | { type: 'nav'; page: string; label: string }
  | { type: 'start' } | { type: 'today' }
  | { type: 'next' } | { type: 'back' } | { type: 'repeat' } | { type: 'whats_next' }
  | { type: 'done' } | { type: 'log'; weight: number | null; reps: number | null }
  | { type: 'skip_rest' } | { type: 'add_rest'; seconds: number }
  | { type: 'timer'; seconds: number } | { type: 'stop_timer' }
  | { type: 'message'; text: string } | { type: 'read_messages' }
  | { type: 'stat'; what: string } | { type: 'rank'; what: string | null }
  | { type: 'move'; day: string }
  | { type: 'form' } | { type: 'checkin' }
  | { type: 'yes' } | { type: 'no' } | { type: 'skip' }
  | { type: 'number'; value: number }
  | { type: 'unknown'; text: string }

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const isNumWord = (w: string) => w in ONES || w in TENS || w === 'hundred' || w === 'and' || w === 'a' || w === 'half'

/** "one eighty five" -> 185, "two hundred and five" -> 205, "forty five" -> 45 */
function wordsValue(words: string[]): number | null {
  const ws = words.filter(w => w !== 'and')
  if (!ws.length) return null
  if (ws.length === 1 && ws[0] === 'half') return 0.5
  // Spoken weights: "one eighty five", "two twenty five", "three fifteen"
  if (ws.length >= 2 && ws[0] in ONES && ONES[ws[0]] < 10 && (ws[1] in TENS || (ws[1] in ONES && ONES[ws[1]] >= 10))) {
    const rest = wordsValue(ws.slice(1))
    if (rest != null && rest >= 10 && rest < 100) return ONES[ws[0]] * 100 + rest
  }
  let total = 0, cur = 0, any = false
  for (const w of ws) {
    if (w === 'a') { cur = cur || 1; continue }
    if (w in ONES) { cur += ONES[w]; any = true }
    else if (w in TENS) { cur += TENS[w]; any = true }
    else if (w === 'hundred') { cur = (cur || 1) * 100; any = true }
    else return null
  }
  total += cur
  return any ? total : null
}

/** Replace number words with digits: "one eighty five for five" -> "185 for 5" */
export function normalizeNumbers(text: string): string {
  const tokens = text.toLowerCase().replace(/[^\w\s.'\/-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < tokens.length; ) {
    if (isNumWord(tokens[i]) && !['and', 'a'].includes(tokens[i]) || (tokens[i] === 'a' && tokens[i + 1] === 'hundred')) {
      let j = i
      while (j < tokens.length && isNumWord(tokens[j])) j++
      // don't swallow a trailing "and"/"a"
      while (j > i && ['and', 'a'].includes(tokens[j - 1])) j--
      const v = wordsValue(tokens.slice(i, j))
      if (v != null) { out.push(String(v)); i = j; continue }
    }
    out.push(tokens[i]); i++
  }
  return out.join(' ')
}

const PAGES: [RegExp, string, string][] = [
  [/\b(home|dashboard|main page)\b/, '/athlete/dashboard', 'home'],
  [/\b(calendar|schedule)\b/, '/athlete/calendar', 'your calendar'],
  [/\b(progress|stats|charts)\b/, '/athlete/progress', 'your progress'],
  [/\bcheck ?in\b/, '/athlete/checkin', 'check-in'],
  [/\b(messages?|inbox|chat)\b/, '/athlete/messages', 'messages'],
  [/\b(leader ?board|rankings?)\b/, '/athlete/leaderboard', 'the leaderboard'],
  [/\b(timer|stopwatch|intervals?)\b/, '/athlete/timer', 'the timer'],
  [/\b(forms?|questionnaires?|surveys?)\b/, '/athlete/forms', 'forms'],
  [/\b(settings|preferences|account)\b/, '/athlete/settings', 'settings'],
]
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'today', 'tomorrow']

export function parseCommand(raw: string): Command {
  const original = raw.trim()
  const t = normalizeNumbers(original).replace(/[.?!,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return { type: 'unknown', text: '' }

  // Messages first (free text after "message coach")
  let m = original.match(/^(?:send (?:a )?message to|message|text|tell|send) (?:my )?coach(?: that)?[,:]?\s+(.+)$/i)
  if (m) return { type: 'message', text: m[1].trim() }
  if (/\b(read|check|any|new|play)\b.*\bmessages?\b|\bmessages? from (my )?coach\b/.test(t)) return { type: 'read_messages' }

  if (/^(help|what can i say|what do i say|commands|what can you do)\b/.test(t)) return { type: 'help' }
  if (/^(stop|stop talking|be quiet|quiet|shut up|cancel|never ?mind|pause)$/.test(t)) return { type: 'stop' }
  if (/\b(turn off|mute|disable)\b.*\b(voice|coach|talking|you)\b|^(mute|voice off)$/.test(t)) return { type: 'voice_off' }
  if (/\b(talk|speak|go) faster\b|\bspeed up\b/.test(t)) return { type: 'faster' }
  if (/\b(talk|speak|go) slower\b|\bslow down\b/.test(t)) return { type: 'slower' }
  if (/\b(change|switch|different|new|another)\b.*\bvoice\b/.test(t)) return { type: 'change_voice' }

  if (/^(yes|yeah|yep|yup|sure|correct|do it|send it|ok|okay|confirm|right|submit)( please| do it| send it| go ahead)?$/.test(t)) return { type: 'yes' }
  if (/^(no|nope|nah|don't|do not|wrong)( thanks| thank you| don't send it)?$/.test(t)) return { type: 'no' }
  if (/^(skip|pass|next question|skip it|skip this)$/.test(t)) return { type: 'skip' }

  // Rest timer
  if (/\b(skip|end|stop|cancel)\b.*\brest\b|\bdone resting\b/.test(t)) return { type: 'skip_rest' }
  m = t.match(/\b(?:add|more|another|plus)\b(?: (\d+))?\s*(seconds?|secs?|minutes?|mins?)?(?: (?:of )?(?:rest|time))?/)
  if (m && /\b(rest|time|seconds?|minutes?)\b/.test(t) && !/\btimer\b/.test(t)) {
    const n = m[1] ? Number(m[1]) : 30
    return { type: 'add_rest', seconds: /^m/.test(m[2] ?? '') ? n * 60 : n }
  }

  // Timer
  m = t.match(/\b(?:start|set|run)?\s*(?:a |an )?(?:timer (?:for )?)?(\d+(?:\.\d+)?)\s*(minutes?|mins?|seconds?|secs?)\s*(?:timer)?/)
  if (m && /\btimer\b/.test(t)) return { type: 'timer', seconds: Math.round(Number(m[1]) * (/^m/.test(m[2]) ? 60 : 1)) }
  if (/\b(stop|cancel|end)\b.*\btimer\b/.test(t)) return { type: 'stop_timer' }

  // Move a workout
  m = t.match(/\bmove\b.*\b(?:workout|session|lift|training)?\b.*\bto\b\s+(?:next\s+)?(\w+)/)
  if (m && DAYS.includes(m[1])) return { type: 'move', day: m[1] }

  // Workout flow
  if (/^(let'?s go|let'?s do (it|this)|let'?s get (it|started|going)|start( my)?( the)? workout|get started|begin|i'?m ready|ready|start|go)$/.test(t)) return { type: 'start' }
  if (/what'?s next|what is next|what'?s after this|what comes next/.test(t)) return { type: 'whats_next' }
  if (/what('?s| is| do i have)? (my |the )?(workout|lift|training|session)( today| for today)?|what do i have today|today'?s workout/.test(t)) return { type: 'today' }
  if (/^(next|next (one|exercise|step|set|up)|move on|go on|keep going|continue)$/.test(t)) return { type: 'next' }
  if (/^(back|go back|previous|last (one|exercise|step))$/.test(t)) return { type: 'back' }
  if (/\b(repeat|say (that|it) again|again|what was that|one more time)\b/.test(t)) return { type: 'repeat' }
  if (/\b(fill (out|in)|do|start|open)\b.*\bforms?\b/.test(t)) return { type: 'form' }
  if (/\b(do|start|take|fill out)\b.*\bcheck ?in\b|^check ?in$/.test(t)) return { type: 'checkin' }

  // Logging sets: "185 for 5", "5 reps at 185", "did 8", "135 pounds"
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)?\s*(?:for|x|times|by)\s*(\d+)\s*(?:reps?)?/)
  if (m) return { type: 'log', weight: Number(m[1]), reps: Number(m[2]) }
  m = t.match(/(\d+)\s*reps?\s*(?:at|with|of|@)\s*(\d+(?:\.\d+)?)/)
  if (m) return { type: 'log', weight: Number(m[2]), reps: Number(m[1]) }
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)\b/)
  if (m && !/what|max|best/.test(t)) return { type: 'log', weight: Number(m[1]), reps: null }
  m = t.match(/^(?:did |got |i did |i got )?(\d+)\s*reps?$/)
  if (m) return { type: 'log', weight: null, reps: Number(m[1]) }
  if (/^(?:(?:i'?m|i am|it'?s|that'?s|we'?re|ok|okay|alright|all)\s+)?(done|finished|set done|done with (that|this|the|it)( set)?|complete|completed|got it|logged|check|check it( off)?|finished it|did it|i did it|i finished)$/.test(t)) return { type: 'done' }

  // Questions about numbers
  if (/\b(where am i|what place|my rank|ranking|leader ?board)\b/.test(t) && !/^(open|go to|show)/.test(t)) {
    const w = t.match(/\b(?:in|for|on)\s+(?:the\s+)?(.+?)(?:\s+leader ?board)?$/)
    return { type: 'rank', what: w && !/leader ?board/.test(w[1]) ? w[1] : null }
  }
  m = t.match(/\bwhat(?:'?s| is| was| are)\s+my\s+(?:best\s+|current\s+|latest\s+|last\s+)?(.+?)$/)
  if (m && !/\bworkout|schedule\b/.test(m[1])) return { type: 'stat', what: m[1].replace(/\b(max|pr|record|time|number|score)\b/g, '').trim() || m[1] }
  m = t.match(/\bhow (?:much|heavy|fast|far|high) (?:is|was|can) (?:my )?(.+?)$/)
  if (m) return { type: 'stat', what: m[1] }

  // Navigation
  if (/^(open|go to|show( me)?|take me to|bring up|pull up|switch to)?\s*(my |the )?/.test(t)) {
    for (const [re, page, label] of PAGES) if (re.test(t) && t.split(' ').length <= 6) return { type: 'nav', page, label }
  }

  m = t.match(/^(\d+(?:\.\d+)?)$/)
  if (m) return { type: 'number', value: Number(m[1]) }

  return { type: 'unknown', text: original }
}

/** A number 1–10 in an answer like "seven", "about a 6", "8 out of 10" */
export function answerNumber(raw: string, min = 1, max = 10): number | null {
  const m = normalizeNumbers(raw).match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const v = Math.round(Number(m[1]))
  return v >= min && v <= max ? v : null
}

/** "Hey PEAC" (and how phones tend to hear it). Returns the words after it, or null if it wasn't said. */
const WAKE = /\b(?:hey|hi|hay|okay|ok|yo)[,.!\s]+(?:peac|peak|peek|peake|pique|peke|pete|peet|peat|piece|pk|pec|p\.?\s?e\.?\s?a\.?\s?c\.?)\b[,.!?\s]*/i
export function afterWakeWord(text: string): string | null {
  const m = text.match(WAKE)
  if (!m || m.index === undefined) return null
  return text.slice(m.index + m[0].length).trim()
}
