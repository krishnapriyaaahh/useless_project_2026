// ─── Intensity thresholds ─────────────────────────────────────────────────────
export const INTENSITY_STATES = {
  PEACEFUL:   { min: 0,  max: 20, id: 'peaceful'  },
  SUSPICIOUS: { min: 20, max: 40, id: 'suspicious' },
  CONCERNED:  { min: 40, max: 60, id: 'concerned'  },
  WORRIED:    { min: 60, max: 80, id: 'worried'    },
  PANIC:      { min: 80, max: 95, id: 'panic'      },
  EMERGENCY:  { min: 95, max: 100, id: 'emergency' },
}

// ─── State metadata ───────────────────────────────────────────────────────────
export const STATE_CONFIG = {
  peaceful: {
    levelName: 'PEACEFUL',
    levelNum: 0,
    emoji: '😌',
    message: 'All peaceful at home.',
    subMessage: null,
    color: '#22c55e',
    bgGlow: 'rgba(34, 197, 94, 0.15)',
    shakeIntensity: 0,
  },
  suspicious: {
    levelName: 'LEVEL 1',
    levelNum: 1,
    emoji: '👀',
    message: 'Was that Amma? (LEVEL 1)',
    subMessage: ['AMMA CALLED...', 'CHECK ON HER BRO', 'BETTER ANSWER BRO'],
    color: '#eab308',
    bgGlow: 'rgba(234, 179, 8, 0.15)',
    shakeIntensity: 0,
  },
  concerned: {
    levelName: 'LEVEL 1',
    levelNum: 1,
    emoji: '😐',
    message: 'Amma called again... (LEVEL 1)',
    subMessage: ['AMMA CALLED...', 'CHECK ON HER BRO', 'BETTER ANSWER BRO'],
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.2)',
    shakeIntensity: 1,
  },
  worried: {
    levelName: 'LEVEL 2',
    levelNum: 2,
    emoji: '😰',
    message: 'AMMA VEENDUM VILICHU! (LEVEL 2)',
    subMessage: ['GET UP BRO!', 'THIS IS NOT A DRILL', 'SERIOUSLY BRO!', 'IPPO POYILLEL PRASHNAM!'],
    color: '#f97316',
    bgGlow: 'rgba(249, 115, 22, 0.25)',
    shakeIntensity: 2,
  },
  panic: {
    levelName: 'LEVEL 2',
    levelNum: 2,
    emoji: '😱',
    message: 'IPPO POYILLEL PRASHNAM! (LEVEL 2)',
    subMessage: ['GET UP BRO!', 'THIS IS NOT A DRILL', 'SERIOUSLY BRO!', 'AMMA VEENDUM VILICHU!'],
    color: '#ef4444',
    bgGlow: 'rgba(239, 68, 68, 0.3)',
    shakeIntensity: 3,
  },
  emergency: {
    levelName: 'LEVEL 4: MAX ANGRINESS!',
    levelNum: 4,
    emoji: '💀',
    message: 'AMMA EMERGENCY 🚨 LEVEL 4 MAX ANGRINESS!',
    subMessage: ['RUN BROOOOO....', 'RUN BRO RUNNNN....', 'RUN BRO RUN', 'OMG OMG OMG', '🚨🚨🚨', '🩴 CHAPPAL INCOMING!'],
    color: '#dc2626',
    bgGlow: 'rgba(220, 38, 38, 0.4)',
    shakeIntensity: 4,
  },
}

// ─── Fallback English urgency words (used when no config loaded yet) ──────────
export const URGENCY_WORDS = [
  'come', 'here', 'now', 'quickly', 'listen',
  'where are you', 'come here', 'get up', 'immediately',
  'fast', 'hurry', 'quick',
]

// ─── Default Malayalam urgency phrases ────────────────────────────────────────
export const DEFAULT_MALAYALAM_URGENCY = [
  // Malayalam Unicode
  'വാ',
  'ഇങ്ങോട്ട് വാ',
  'ഇവിടെ വാ',
  'വേഗം വാ',
  'ഇപ്പോ വാ',
  'ഇപ്പോൾ വാ',
  'ഇപ്പോൾ തന്നെ വാ',
  'ഇപ്പോ തന്നെ വാ',
  'വേഗം',
  'എവിടെയാ',
  'എവിടെ ആണ്',
  'കേൾക്കുന്നുണ്ടോ',
  'കേൾക്കുന്നില്ലേ',
  'ഒന്ന് ഇങ്ങോട്ട് വാ',
  'ഒന്ന് വന്നേ',
  // Manglish
  'vaa',
  'ivide vaa',
  'ingottu vaa',
  'vegam vaa',
  'ippo vaa',
  'ippol vaa',
  'ippo thanne vaa',
  'vegam',
  'evideya',
  'evide aanu',
  'kelkkunnundo',
  'kelkkunnille',
  // English
  'come here',
  'come now',
  'get up',
  'hurry up',
  'where are you',
  'quickly',
  'now',
]

// ─── Default name aliases for "Krishna" ──────────────────────────────────────
export const DEFAULT_KRISHNA_ALIASES = [
  'കൃഷ്ണ',
  'കൃഷ്ണാ',
  'Krishna',
  'Krishnaa',
  'Krish',
]

// ─── Manglish → Malayalam Unicode normalization map ──────────────────────────
// Used to normalize Whisper Manglish output before name/phrase matching
export const MANGLISH_NORMALIZE = {
  // vowel elongation variants
  'aa': 'a',
  'ee': 'i',
  'oo': 'u',
}

// ─── Intensity scoring weights ────────────────────────────────────────────────
export const SCORING = {
  PER_CALL: 15,
  MAX_LOUDNESS_BONUS: 20,
  MAX_RAPID_BONUS: 20,
  MAX_URGENCY_BONUS: 20,
  MAX_ESCALATION_BONUS: 25,
  DECAY_PER_SECOND: 1,     // slow gentle decay after long silence
  DECAY_DELAY_MS: 30000,   // wait 30 seconds before decaying so anger does not drop between calls
}

// ─── Window sizes per state ───────────────────────────────────────────────────
export const WINDOW_SIZES = {
  compact:   { width: 280, height: 320 },
  expanded:  { width: 280, height: 380 },
  emergency: { width: 300, height: 420 },
}
