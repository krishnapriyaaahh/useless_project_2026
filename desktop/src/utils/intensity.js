import { INTENSITY_STATES, SCORING, URGENCY_WORDS } from './constants.js'

/**
 * Determine which named state matches a 0–100 intensity score.
 */
export function getStateFromIntensity(intensity) {
  const clamped = clamp(intensity, 0, 100)
  for (const [, range] of Object.entries(INTENSITY_STATES)) {
    if (clamped >= range.min && clamped < range.max) {
      return range.id
    }
  }
  return 'emergency' // 100 edge case
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Normalize a string for loose matching:
 * - lowercase
 * - collapse whitespace
 * - strip punctuation except Malayalam characters
 * - collapse repeated vowels (aaa→a, aaaa→a, etc.)
 */
export function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0D00-\u0D7F]/g, ' ')   // keep Malayalam Unicode + alphanumeric
    .replace(/\s+/g, ' ')
    .replace(/([aeiou])\1{2,}/g, '$1$1')      // "aaaa" → "aa", "kkk" → keep (consonants fine)
    .trim()
}

/**
 * Detect urgency phrases in transcript text.
 * Accepts a custom phrase list (from settings); falls back to built-in URGENCY_WORDS.
 *
 * @param {string} text - transcript
 * @param {string[]} [customPhrases] - user-configured urgency phrases
 * @returns {string[]} matched phrases
 */
export function detectUrgencyWords(text, customPhrases) {
  const phrases = customPhrases && customPhrases.length > 0 ? customPhrases : URGENCY_WORDS
  const normalized = normalizeText(text)
  return phrases.filter(phrase => {
    if (!phrase) return false
    // Check both original and normalized form of the phrase
    const normPhrase = normalizeText(phrase)
    return normalized.includes(normPhrase) || normalized.includes(phrase.toLowerCase())
  })
}

/**
 * Detect if the configured name (or any alias) appears in transcript.
 * Handles:
 *  - direct alias match
 *  - normalized/lowercased match
 *  - repeated-vowel variants ("Krishnaaa" → matches "Krishna")
 *
 * @param {string} text - transcript
 * @param {string} name - primary configured name
 * @param {string[]} [aliases] - additional aliases from settings
 * @returns {{ detected: boolean, matchedAlias: string|null }}
 */
export function detectName(text, name, aliases) {
  if (!text || !name) return { detected: false, matchedAlias: null }

  // Build the full candidate list: primary name + aliases, deduplicated
  const allCandidates = [name, ...(aliases || [])].filter(Boolean)
  const normalizedText = normalizeText(text)

  for (const candidate of allCandidates) {
    if (!candidate.trim()) continue
    const normCandidate = normalizeText(candidate)

    // Direct normalized match
    if (normalizedText.includes(normCandidate)) {
      return { detected: true, matchedAlias: candidate }
    }

    // Repeated-vowel collapsed match: "Krishnaaa" → "Krishna"
    const collapsed = normalizedText.replace(/([aeiou])\1+/g, '$1')
    const collapsedCandidate = normCandidate.replace(/([aeiou])\1+/g, '$1')
    if (collapsed.includes(collapsedCandidate)) {
      return { detected: true, matchedAlias: candidate }
    }
  }

  return { detected: false, matchedAlias: null }
}

/**
 * Calculate intensity score from a detection event.
 *
 * @param {object} event
 * @param {number} event.loudnessDb      - Audio loudness 0–100 normalized
 * @param {string[]} event.urgencyWords  - Matched urgency phrases
 * @param {number} event.timeSinceLastMs - MS since last detected call
 * @param {number} currentCallCount      - Current total call count
 * @param {number} currentIntensity      - Current intensity before this event
 * @returns {number} New intensity 0–100
 */
export function calculateIntensityDelta(event, currentCallCount, currentIntensity) {
  let delta = 0

  // 1. Base score per call
  delta += SCORING.PER_CALL

  // 2. Loudness bonus (0–20)
  const loudness = clamp(event.loudnessDb ?? 50, 0, 100)
  const loudnessBonus = (loudness / 100) * SCORING.MAX_LOUDNESS_BONUS
  delta += loudnessBonus

  // 3. Rapid repetition bonus (0–20)
  if (event.timeSinceLastMs !== undefined && event.timeSinceLastMs !== null) {
    const t = event.timeSinceLastMs
    if (t < 3000) {
      delta += SCORING.MAX_RAPID_BONUS
    } else if (t < 10000) {
      const fraction = 1 - (t - 3000) / 7000
      delta += fraction * SCORING.MAX_RAPID_BONUS
    }
  }

  // 4. Urgency phrase bonus (0–20)
  const matchedUrgency = (event.urgencyWords ?? []).length
  if (matchedUrgency > 0) {
    const urgencyBonus = Math.min(matchedUrgency / 3, 1) * SCORING.MAX_URGENCY_BONUS
    delta += urgencyBonus
  }

  // 5. Escalation bonus & Guaranteed Level Thresholds
  const count = currentCallCount + 1
  let minIntensityForCount = 0
  if (count === 1) {
    minIntensityForCount = 35 // LEVEL 1: Suspicious / Concerned
  } else if (count === 2) {
    minIntensityForCount = 70 // LEVEL 2: Worried / Panic ("GET UP BRO!")
  } else if (count >= 3) {
    minIntensityForCount = 100 // LEVEL 4: 3+ levl4 (100% MAX ANGRINESS!)
  }

  return clamp(Math.max(currentIntensity + delta, minIntensityForCount), 0, 100)
}

/**
 * Create a simulated detection event for Demo Mode.
 * Uses the configured name so Demo Mode reflects personalization.
 *
 * @param {number} callCount
 * @param {string} [userName] - configured user name (defaults to 'Krishna')
 */
export function createDemoEvent(callCount, userName) {
  const name = userName || 'Krishna'

  // Escalating transcripts — use the real configured name
  const transcripts = [
    `${name}?`,
    `${name} come here`,
    `${name}! ${name}!`,
    `${name} come here now!`,
    `${name.toUpperCase()}AAA! Come here immediately!`,
    `${name.toUpperCase()}AAA!!! GET UP NOW!!!`,
  ]
  const idx = Math.min(callCount, transcripts.length - 1)
  const text = transcripts[idx]

  return {
    text,
    nameDetected: true,
    matchedAlias: name,
    urgencyWords: detectUrgencyWords(text),
    loudnessDb: Math.min(30 + callCount * 12, 100),
    timeSinceLastMs: Math.max(8000 - callCount * 1500, 800),
  }
}
