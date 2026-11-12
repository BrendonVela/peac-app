// Turns what the athlete says into a command. Plain rules (no AI), tolerant of how people talk.

export type Command =
  | { type: 'help' } | { type: 'stop' } | { type: 'voice_off' } | { type: 'faster' } | { type: 'slower' } | { type: 'change_voice' }
  | { type: 'nav'; page: string; label: string }
  | { type: 'start' } | { type: 'today' }
  | { type: 'next' } | { type: 'back' } | { type: 'repeat' } | { type: 'whats_next' }
  | { type: 'done' } | { type: 'log'; weight: number | null; reps: number | null; back?: boolean }
  | { type: 'set_entry'; set: number; weight: number | null; reps: number | null } // "set 2 was 205 for 5"
  | { type: 'skip_rest' } | { type: 'add_rest'; seconds: number }
  | { type: 'timer'; seconds: number } | { type: 'stop_timer' }
  | { type: 'message'; text: string } | { type: 'read_messages' }
  | { type: 'stat'; what: string } | { type: 'rank'; what: string | null }
  | { type: 'move'; day: string }
  | { type: 'form' } | { type: 'checkin' }
  | { type: 'yes' } | { type: 'no' } | { type: 'skip' }
  | { type: 'number'; value: number }
  | { type: 'schedule'; when: string }   // today | tomorrow | monday… | week | next week | weekend
  | { type: 'finish' }                   // "I finished the workout"
  | { type: 'rest_left' }                // "how much rest is left"
  | { type: 'undo' }                     // "undo that" — un-log the last set
  | { type: 'correct'; weight: number | null; reps: number | null } // "change that to 210 for 5"
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
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Words people add that don't change the meaning */
const FILLER = /\b(um+|uh+|er+|hmm+|like|so|well|please|pls|just|actually|basically|real quick|quickly|for me|go ahead and|can you|could you|would you|will you|can i|could i|i want to|i wanna|i'?d like to|i need to|i'?m going to|i'?m gonna|let me|do me a favor and|hey|hi|yo|okay so|alright so|you know)\b/g

/** When does the athlete mean? today / tomorrow / a weekday / this week / next week / weekend */
function whenOf(t: string): string | null {
  if (/\bnext week\b/.test(t)) return 'next week'
  if (/\b(this|the) week(end)?\b|\brest of (the|this) week\b|\bweek\b/.test(t)) return /weekend/.test(t) ? 'weekend' : 'week'
  if (/\bweekend\b/.test(t)) return 'weekend'
  if (/\b(tomorrow|tmrw|tomorow)\b/.test(t)) return 'tomorrow'
  if (/\b(today|tonight|this morning|this afternoon|right now|now)\b/.test(t)) return 'today'
  const d = DAYS.find(x => new RegExp(`\\b${x}s?\\b`).test(t))
  return d ?? null
}

const has = (t: string, re: RegExp) => re.test(t)

export function parseCommand(raw: string): Command {
  const original = (afterWakeWord(raw) ?? raw).trim()
  const base = normalizeNumbers(original).replace(/[.?!,;:"]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!base) return { type: 'unknown', text: '' }
  // Short replies are checked before removing filler words ("okay", "yes please")
  if (/^(yes|yeah|yep|yup|sure|correct|do it|send it|ok|okay|confirm|right|submit|sounds good|go ahead)( please| do it| send it| go ahead)?$/.test(base)) return { type: 'yes' }
  if (/^(no|nope|nah|don't|do not|wrong|cancel that)( thanks| thank you| don't send it)?$/.test(base)) return { type: 'no' }
  if (/^(stop|stop talking|be quiet|quiet|shut up|cancel|never ?mind|pause|hold on|wait|shh+)$/.test(base)) return { type: 'stop' }
  if (/^(skip|pass|skip it|skip this|next question)$/.test(base)) return { type: 'skip' }
  let m = base.match(/^(\d+(?:\.\d+)?)$/)
  if (m) return { type: 'number', value: Number(m[1]) }

  const t = (' ' + base + ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim()

  // ----- Messages (keep their words as said) -----
  m = original.match(/(?:send (?:a )?(?:message|text) to|message|text|tell|let) (?:my )?coach(?: know)?(?: that)?[,:]?\s+(.+)$/i)
  if (m) return { type: 'message', text: m[1].trim() }
  if (has(t, /\b(read|check|play|any|new|got|have i got|do i have)\b.*\bmessages?\b|\bmessages? from\b|\bdid (my )?coach (say|text|message|write)/)) return { type: 'read_messages' }

  // ----- The voice itself -----
  if (has(t, /what can (i|you) (say|do|ask)|\bhelp\b|\bcommands\b|how do (i|you) (use|work|talk)/)) return { type: 'help' }
  if (has(t, /\b(turn off|mute|disable|shut off)\b.*\b(voice|coach|talking|you|sound)\b|^(mute|voice off)$/)) return { type: 'voice_off' }
  if (has(t, /\b(talk|speak|go|read) (a (little|bit) )?faster\b|\bspeed (it )?up\b/)) return { type: 'faster' }
  if (has(t, /\b(talk|speak|go|read) (a (little|bit) )?slower\b|\bslow (it )?down\b/)) return { type: 'slower' }
  if (has(t, /\b(change|switch|different|new|another|other)\b.*\bvoice\b/)) return { type: 'change_voice' }

  // ----- Rest timer -----
  if (has(t, /\bhow (much|long)\b.*\b(rest|time|left)\b|\btime left\b|\brest left\b/) && !has(t, /\btimer for\b/)) return { type: 'rest_left' }
  if (has(t, /\b(skip|end|stop|cancel|done with|over)\b.*\brest(ing)?\b|\bdone resting\b|\bno rest\b/)) return { type: 'skip_rest' }
  m = t.match(/\b(?:add|more|another|extra|plus|give me)\b(?: (\d+))?\s*(seconds?|secs?|minutes?|mins?)?/)
  if (m && has(t, /\b(rest|time|seconds?|minutes?|break)\b/) && !has(t, /\btimer\b/)) {
    const n = m[1] ? Number(m[1]) : 30
    return { type: 'add_rest', seconds: /^m/.test(m[2] ?? '') ? n * 60 : n }
  }

  // ----- Timer -----
  m = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|seconds?|secs?)/)
  if (m && has(t, /\btimer\b|\bcount ?down\b|\btime me\b/)) return { type: 'timer', seconds: Math.round(Number(m[1]) * (/^m/.test(m[2]) ? 60 : 1)) }
  if (has(t, /\b(stop|cancel|end|kill)\b.*\btimer\b/)) return { type: 'stop_timer' }

  // ----- Moving a workout -----
  if (has(t, /\b(move|reschedule|push|switch|change|shift|swap)\b/) && has(t, /\b(workout|training|lift|session|it|today'?s|day)\b/)) {
    const w = t.match(/\bto\s+(?:next\s+|this\s+)?(\w+)/)?.[1]
    const day = w && (DAYS.includes(w.replace(/s$/, '')) || w === 'tomorrow' || w === 'today') ? w.replace(/s$/, '') : null
    if (day) return { type: 'move', day }
  }

  // ----- Finished the whole workout -----
  if (has(t, /\b(done|finished|completed|complete|wrapped up|through|all done)\b.*\b(workout|session|training|lift|lifting|everything|today)\b|\b(end|finish|complete|wrap up|close out)\b.*\b(workout|session)\b/)) return { type: 'finish' }

  // ----- Schedule questions -----
  const when = whenOf(t)
  if (when && has(t, /\b(what|what'?s|whats|anything|do i have|is there|have i got|schedule|scheduled|plan|planned|lifting|lift|training|train|workout|workouts|on deck|coming up|supposed to)\b/) && !has(t, /\b(max|pr|record|rank|place|leaderboard)\b/)) {
    return { type: 'schedule', when }
  }
  if (has(t, /\bwhat('?s| is| do i have)?\b.*\b(my |the )?(workout|lift|training|session)\b|\bwhat do i have\b|\bwhat am i doing\b/)) return { type: 'schedule', when: 'today' }

  // ----- Forms / check-in -----
  if (has(t, /\b(fill( out| in)?|do|start|open|take|complete|answer)\b.*\b(forms?|questionnaires?|survey)\b/)) return { type: 'form' }
  if (has(t, /\bcheck ?-?in\b/) && !has(t, /\b(go to|open|show)\b/)) return { type: 'checkin' }

  // ----- During a workout -----
  if (has(t, /what'?s next|what is next|what('?s| is) after (this|that)|what comes next|what do i do (next|now)|what now|what'?s up next/)) return { type: 'whats_next' }
  // ----- Fixing sets -----
  const nums = readSetNumbers(t)
  // A specific set: "set 2 was 205 for 5", "change the second set to 6 reps", "fix set one, 210"
  const setNo = t.match(/\bset (?:number )?(\d+)\b|\b(first|second|third|fourth|fifth|sixth|last) set\b/)
  if (setNo && (nums.weight != null || nums.reps != null)) {
    const n = setNo[1] ? Number(setNo[1]) : ({ first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, last: -1 } as Record<string, number>)[setNo[2]]
    return { type: 'set_entry', set: n, weight: nums.weight, reps: nums.reps }
  }
  if (has(t, /\b(undo|take (that|it) back|delete (that|the last|it)|remove (that|the last)|scratch that|un ?check|didn'?t do (that|it))\b/)) return { type: 'undo' }
  const fixWords = /\b(fix|correct|change|update|edit|redo|i meant|meant|that'?s wrong|it'?s wrong|wrong|mistake|instead|should (be|have been|say|read)|supposed to be|make (it|that)|not \d+|put)\b/
  const startsNo = /^(no|nope|nah|actually|oops|whoops|wait|sorry|my bad|hold on|correction)\b/
  if (has(t, fixWords) || ((has(t, startsNo) || has(base, startsNo)) && (nums.weight != null || nums.reps != null))) {
    return { type: 'correct', weight: nums.weight, reps: nums.reps }
  }
  // "that was 185 for 5" right after a set -> fix it if I just logged it
  const back = has(t, /\b(that|it|that one|this one|the last one) (was|is)\b/)
  if (back && (nums.weight != null || nums.reps != null)) return { type: 'log', weight: nums.weight, reps: nums.reps, back }
  // Phones sometimes hear "210 for 5" as "210 4 5" or "210 5"
  m = t.match(/^(?:i did |did |got |i got )?(\d{2,4}(?:\.\d+)?)\s+(?:4\s+)?(\d{1,2})(?:\s*reps?)?$/)
  if (m) return { type: 'log', weight: Number(m[1]), reps: Number(m[2]) }
  // Logging: "185 for 5", "5 reps at 185", "I did 8 reps", "135 pounds"
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)?\s*(?:for|x|times|by)\s*(\d+)\s*(?:reps?)?/)
  if (m) return { type: 'log', weight: Number(m[1]), reps: Number(m[2]), back }
  m = t.match(/(\d+)\s*reps?\s*(?:at|with|of|@|using)\s*(\d+(?:\.\d+)?)/)
  if (m) return { type: 'log', weight: Number(m[2]), reps: Number(m[1]), back }
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)\b/)
  if (m && !has(t, /\b(what|max|best|how)\b/)) return { type: 'log', weight: Number(m[1]), reps: null }
  m = t.match(/(\d+)\s*reps?\b/)
  if (m && !has(t, /\b(what|how many)\b/)) return { type: 'log', weight: null, reps: Number(m[1]) }
  if (has(t, /\b(repeat|say (that|it) again|again|what was that|didn'?t (hear|catch)|come again|pardon|one more time)\b/)) return { type: 'repeat' }
  if (has(t, /\b(go back|previous|back up|last exercise|before this)\b|^back$/)) return { type: 'back' }
  if (has(t, /\b(next|move on|go on|keep going|continue|skip (this|it|the) ?(exercise|one)?|onto the next|let'?s move)\b/)) return { type: 'next' }
  if (has(t, /\b(done|finished|completed|complete|got it|did it|finished it|nailed it|that'?s it|knocked it out|all set)\b/)) return { type: 'done' }
  if (has(t, /\b(let'?s go|let'?s (do|start|begin|get)|start|begin|i'?m ready|ready|get going|get started|open (my |the |today'?s )?workout|i'?m here)\b/)) return { type: 'start' }

  // ----- Numbers -----
  if (has(t, /\b(where am i|what place|my rank|ranking|ranked|leader ?board|how do i (stack|compare|rank))\b/) && !has(t, /\b(open|go to|show|take me)\b/)) {
    const w = t.match(/\b(?:in|for|on)\s+(?:the\s+)?(.+?)(?:\s+leader ?board)?$/)
    return { type: 'rank', what: w && !/leader ?board|team/.test(w[1]) ? w[1] : null }
  }
  m = t.match(/\bwhat(?:'?s| is| was| are)\s+(?:my|the)\s+(?:best\s+|current\s+|latest\s+|last\s+|top\s+)?(.+?)$/)
  if (m && !has(m[1], /\b(workout|schedule|plan)\b/)) return { type: 'stat', what: m[1].replace(/\b(max|pr|record|time|number|score|result)\b/g, '').trim() || m[1] }
  m = t.match(/\bhow (?:much|heavy|fast|far|high|many) (?:is|was|can|do|did) (?:i |my )?(.+?)$/)
  if (m) return { type: 'stat', what: m[1] }
  m = t.match(/\bmy\s+(squat|bench|dead ?lift|trap ?bar|row|vertical|vert|broad jump|40|forty|10|20|pro agility|body ?weight)\b/)
  if (m) return { type: 'stat', what: m[1] }

  // ----- Going to a page -----
  for (const [re, page, label] of PAGES) if (re.test(t) && (t.split(' ').length <= 4 || has(t, /\b(open|go|show|take|bring|pull|see|view|look|check|switch)\b/))) return { type: 'nav', page, label }

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

/**
 * Make sense of numbers the phone may have run together.
 * "2105" with a 210 lb target -> 210 for 5. "21045" -> 210 for 5 ("for" heard as 4).
 * Returns fixed numbers (with a note when changed), or null if they still don't make sense.
 */
export function sanitySet(weight: number | null, reps: number | null, targetWeight: number | null): { weight: number | null; reps: number | null; fixed: boolean } | null {
  const okReps = (r: number | null) => r == null || (r >= 0 && r <= 50)
  const okWeight = (w: number | null) => w == null || (w >= 0 && w <= 1500)
  if (okReps(reps) && okWeight(weight)) return { weight, reps, fixed: false }
  // One run-together number (in reps or weight), the other missing
  const run = !okReps(reps) && weight == null ? reps : !okWeight(weight) && reps == null ? weight : null
  if (run == null || !Number.isInteger(run)) return null
  const d = String(run)
  const options: { w: number; r: number; rs: string }[] = []
  for (let i = 1; i < d.length; i++) {
    options.push({ w: Number(d.slice(0, i)), r: Number(d.slice(i)), rs: d.slice(i) })
    if (d[i] === '4' && i + 1 < d.length) options.push({ w: Number(d.slice(0, i)), r: Number(d.slice(i + 1)), rs: d.slice(i + 1) })
  }
  const valid = options.filter(o => o.r >= 1 && o.r <= 30 && o.w >= 5 && o.w <= 1500 && !o.rs.startsWith('0'))
  if (!valid.length) return null
  const score = (o: { w: number; r: number }) => (targetWeight ? Math.abs(o.w - targetWeight) / targetWeight : -o.w / 1000)
  const best = valid.sort((a, b) => score(a) - score(b))[0]
  if (targetWeight && Math.abs(best.w - targetWeight) / targetWeight > 0.6) return null
  return { weight: best.w, reps: best.r, fixed: true }
}

/** Weight and reps anywhere in a sentence: "210 for 5", "5 reps at 210", "210 pounds", "6 reps", "210 4 5", or one number */
export function readSetNumbers(t: string): { weight: number | null; reps: number | null } {
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)?\s*(?:for|x|times|by)\s*(\d+)/)
  if (m) return { weight: Number(m[1]), reps: Number(m[2]) }
  m = t.match(/(\d+)\s*reps?\s*(?:at|with|of|@|using)\s*(\d+(?:\.\d+)?)/)
  if (m) return { weight: Number(m[2]), reps: Number(m[1]) }
  m = t.match(/(\d{2,4}(?:\.\d+)?)\s+4\s+(\d{1,2})\b/)
  if (m) return { weight: Number(m[1]), reps: Number(m[2]) }
  const r = t.match(/(\d+)\s*reps?\b/)
  const w = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)\b/)
  if (r || w) return { weight: w ? Number(w[1]) : null, reps: r ? Number(r[1]) : null }
  // Bare numbers (ignore a "set 2" number)
  const nums = Array.from(t.replace(/\bset (?:number )?\d+\b/g, ' ').matchAll(/\d+(?:\.\d+)?/g)).map(x => Number(x[0]))
  if (nums.length >= 2) return { weight: nums[nums.length - 2], reps: nums[nums.length - 1] }
  if (nums.length === 1) return nums[0] <= 30 ? { weight: null, reps: nums[0] } : { weight: nums[0], reps: null }
  return { weight: null, reps: null }
}
