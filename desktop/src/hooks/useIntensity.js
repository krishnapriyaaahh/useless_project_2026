import { useState, useRef, useCallback, useEffect } from 'react'
import {
  calculateIntensityDelta,
  getStateFromIntensity,
  clamp,
  createDemoEvent,
  detectUrgencyWords,
} from '../utils/intensity.js'
import { SCORING } from '../utils/constants.js'

const INITIAL_STATE = {
  intensity: 0,
  callCount: 0,
  transcript: '',
  state: 'peaceful',
  lastCallTime: null,
  alerts: [],
}

/**
 * useIntensity — central intensity engine.
 *
 * @param {object} [config]
 * @param {string} [config.userName]         - configured user name (for demo events)
 * @param {string[]} [config.urgencyPhrases] - custom urgency phrases
 */
export function useIntensity(config = {}) {
  const [radarState, setRadarState] = useState(INITIAL_STATE)
  const decayTimerRef = useRef(null)
  const alertIdRef = useRef(0)
  // Keep config in a ref so callbacks always see the latest value
  const configRef = useRef(config)
  useEffect(() => { configRef.current = config }, [config])

  // ── Decay ────────────────────────────────────────────────────────────────────
  const scheduleDecay = useCallback(() => {
    if (decayTimerRef.current) clearInterval(decayTimerRef.current)

    const timeout = setTimeout(() => {
      decayTimerRef.current = setInterval(() => {
        setRadarState(prev => {
          const newIntensity = clamp(prev.intensity - SCORING.DECAY_PER_SECOND, 0, 100)
          if (newIntensity <= 0) {
            clearInterval(decayTimerRef.current)
            decayTimerRef.current = null
          }
          return {
            ...prev,
            intensity: newIntensity,
            state: getStateFromIntensity(newIntensity),
          }
        })
      }, 1000)
    }, SCORING.DECAY_DELAY_MS)

    decayTimerRef.current = timeout
  }, [])

  const cancelDecay = useCallback(() => {
    if (decayTimerRef.current) {
      clearTimeout(decayTimerRef.current)
      clearInterval(decayTimerRef.current)
      decayTimerRef.current = null
    }
  }, [])

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const addAlert = useCallback((message, type = 'info') => {
    const id = ++alertIdRef.current
    setRadarState(prev => ({
      ...prev,
      alerts: [...prev.alerts, { id, message, type, ts: Date.now() }],
    }))
    setTimeout(() => {
      setRadarState(prev => ({
        ...prev,
        alerts: prev.alerts.filter(a => a.id !== id),
      }))
    }, 3500)
  }, [])

  // ── Process a real/IPC event ─────────────────────────────────────────────────
  const processEvent = useCallback((event) => {
    cancelDecay()
    setRadarState(prev => {
      const timeSinceLast = prev.lastCallTime ? Date.now() - prev.lastCallTime : null

      // Re-detect urgency using current custom phrases if not already provided
      const urgencyWords = event.urgencyWords && event.urgencyWords.length > 0
        ? event.urgencyWords
        : detectUrgencyWords(event.text, configRef.current.urgencyPhrases)

      const enrichedEvent = { ...event, urgencyWords, timeSinceLastMs: timeSinceLast }
      const newIntensity = calculateIntensityDelta(enrichedEvent, prev.callCount, prev.intensity)
      const newState = getStateFromIntensity(newIntensity)
      const newCallCount = prev.callCount + 1

        const urgency = (event.urgencyWords ?? []).length
        setTimeout(() => {
          if (newState === 'emergency') {
            addAlert('🚨 LEVEL 4: RUN BROOOOO.... MAX ANGRINESS! 🚨', 'emergency')
          } else if (newState === 'panic' || newState === 'worried') {
            addAlert('😱 LEVEL 2: GET UP BRO! THIS IS NOT A DRILL', 'emergency')
          } else if (urgency > 0) {
            addAlert('🚨 AMMA URGENCY ALERT! LEVEL 2', 'emergency')
          } else if (newCallCount > 1) {
            addAlert('⚠️ LEVEL 1: AMMA CALLED AGAIN!', 'warning')
          } else {
            addAlert('👀 LEVEL 1: WAS THAT AMMA?', 'info')
          }
        }, 0)

        return {
          ...prev,
          intensity: newIntensity,
          callCount: newCallCount,
          transcript: event.text || prev.transcript,
          state: newState,
          lastCallTime: Date.now(),
        }
      })

      scheduleDecay()
    }, [cancelDecay, scheduleDecay, addAlert])

  // ── Demo call ────────────────────────────────────────────────────────────────
  const simulateDemoCall = useCallback(() => {
    const userName = configRef.current.userName
    setRadarState(prev => {
      const event = createDemoEvent(prev.callCount, userName)
      const timeSinceLast = prev.lastCallTime ? Date.now() - prev.lastCallTime : null
      const enrichedEvent = { ...event, timeSinceLastMs: timeSinceLast }
      const newIntensity = calculateIntensityDelta(enrichedEvent, prev.callCount, prev.intensity)
      const newState = getStateFromIntensity(newIntensity)
      const newCallCount = prev.callCount + 1

      setTimeout(() => {
        if (newState === 'emergency') {
          addAlert('🚨 LEVEL 4: RUN BROOOOO.... MAX ANGRINESS! 🚨', 'emergency')
        } else if (newState === 'panic' || newState === 'worried') {
          addAlert('😱 LEVEL 2: GET UP BRO! THIS IS NOT A DRILL', 'emergency')
        } else if (newCallCount > 1) {
          addAlert('⚠️ LEVEL 1: AMMA CALLED AGAIN!', 'warning')
        } else {
          addAlert('👀 LEVEL 1: WAS THAT AMMA?', 'info')
        }
      }, 0)

      return {
        ...prev,
        intensity: newIntensity,
        callCount: newCallCount,
        transcript: event.text,
        state: newState,
        lastCallTime: Date.now(),
      }
    })
    cancelDecay()
    scheduleDecay()
  }, [addAlert, cancelDecay, scheduleDecay])

  // ── Manual adjustments ───────────────────────────────────────────────────────
  const adjustIntensity = useCallback((delta) => {
    cancelDecay()
    setRadarState(prev => {
      const newIntensity = clamp(prev.intensity + delta, 0, 100)
      return { ...prev, intensity: newIntensity, state: getStateFromIntensity(newIntensity) }
    })
    if (delta > 0) scheduleDecay()
  }, [cancelDecay, scheduleDecay])

  const setIntensityDirect = useCallback((value) => {
    cancelDecay()
    const clamped = clamp(value, 0, 100)
    setRadarState(prev => ({
      ...prev,
      intensity: clamped,
      state: getStateFromIntensity(clamped),
    }))
    if (clamped > 0) scheduleDecay()
  }, [cancelDecay, scheduleDecay])

  const reset = useCallback(() => {
    cancelDecay()
    setRadarState({ ...INITIAL_STATE })
    addAlert('★ AMMA PACIFIED! 0% ★', 'info')
  }, [cancelDecay, addAlert])

  useEffect(() => () => cancelDecay(), [cancelDecay])

  return {
    radarState,
    processEvent,
    simulateDemoCall,
    adjustIntensity,
    setIntensityDirect,
    reset,
    addAlert,
  }
}
