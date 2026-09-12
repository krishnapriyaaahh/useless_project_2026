import { useState, useEffect, useCallback, useRef } from 'react'
import { useIntensity } from './useIntensity.js'
import { useSettings } from './useSettings.js'

export function useRadarState() {
  const { settings, updateSettings, loaded: settingsLoaded } = useSettings()

  const {
    radarState,
    processEvent,
    simulateDemoCall,
    adjustIntensity,
    setIntensityDirect,
    reset,
    addAlert,
  } = useIntensity({
    userName: settings.userName,
    urgencyPhrases: settings.urgencyPhrases,
  })

  // ── UI state ──────────────────────────────────────────────────────────────────
  // listeningState: 'idle' | 'starting' | 'listening' | 'paused' | 'error' | 'permission-denied' | 'mic-unavailable'
  const [listeningState, setListeningState] = useState('idle')
  const [aiOnline, setAiOnline]   = useState(false)
  const [aiError,  setAiError]    = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDebug,    setShowDebug]    = useState(false)
  const [micVolume,    setMicVolume]    = useState(0)
  const [microphones,  setMicrophones]  = useState([])
  const [debugInfo, setDebugInfo] = useState({
    transcript: '', nameDetected: false, matchedAlias: null,
    urgency: 0, loudness: 0, recentCalls: 0, language: 'ml',
  })

  const lastSoundCallRef = useRef(0)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  // ── Register ALL Electron IPC listeners once, on mount ───────────────────────
  // Do this before starting Python so we never miss an event.
  useEffect(() => {
    if (!window.ammaRadar) return

    // ── amma:event  (everything from Python stdout) ──────────────────────────
    window.ammaRadar.onAmmaEvent((data) => {
      switch (data.type) {

        case 'CALL_DETECTED':
          lastSoundCallRef.current = Date.now()
          processEvent({
            text:            data.transcript   || '',
            urgencyWords:    data.urgencyWords || [],
            loudnessDb:      data.loudness     || 50,
            nameDetected:    data.nameDetected,
            matchedAlias:    data.matchedAlias,
            timeSinceLastMs: data.timeSinceLastMs,
          })
          setDebugInfo({
            transcript:   data.transcript   || '',
            nameDetected: data.nameDetected || false,
            matchedAlias: data.matchedAlias || null,
            urgency:      (data.urgencyWords || []).length,
            loudness:     data.loudness    || 0,
            recentCalls:  data.callCount   || 0,
            language:     data.language    || 'ml',
          })
          break

        case 'MIC_ACTIVITY': {
          const vol = data.volume || 0
          setMicVolume(vol)

          // Instant acoustic response: ONLY in volume mode does loud sound trigger calls directly
          if (settingsRef.current?.detectionMode === 'volume') {
            const thresh = settingsRef.current?.volumeThreshold || 35
            const now = Date.now()
            if (vol >= thresh && (now - lastSoundCallRef.current) >= 1600) {
              lastSoundCallRef.current = now
              processEvent({
                text: `[Loud Sound: ${vol}%]`,
                loudnessDb: vol,
                nameDetected: false,
                matchedAlias: 'Loud Calling',
                urgencyWords: vol >= 70 ? ['Loud Sound'] : [],
              })
            }
          }
          break
        }

        case 'TRANSCRIPT':
          setDebugInfo(prev => ({
            ...prev,
            transcript:   data.transcript || '',
            nameDetected: false,
            matchedAlias: null,
          }))
          break

        case 'MIC_LIST':
          setMicrophones(data.devices || [])
          break

        case 'MIC_ERROR':
          if ((data.message || '').match(/permission|Access|denied/i)) {
            setListeningState('permission-denied')
          } else {
            setListeningState('mic-unavailable')
          }
          setAiError(data.message || 'Microphone error')
          break

        case 'STATUS':
          // Python confirms the mic is open
          if (data.listening) {
            setListeningState('listening')
            setAiOnline(true)
            setAiError(null)
          }
          break

        case 'ERROR':
          setAiError(data.message || 'AI error')
          break

        default:
          break
      }
    })

    // ── ai:status  (Python process spawn / exit) ─────────────────────────────
    if (window.ammaRadar.onAiStatus) {
      window.ammaRadar.onAiStatus((data) => {
        if (data.running) {
          // Process spawned — mic may still be opening
          setAiOnline(true)
          setListeningState('starting')
          setAiError(null)
        } else {
          setAiOnline(false)
          // Only revert to idle if we weren't already in a mic-specific error state
          setListeningState(prev =>
            prev === 'permission-denied' || prev === 'mic-unavailable' ? prev : 'idle'
          )
        }
      })
    }

    // ── ai:error  (Python failed to start at OS level) ────────────────────────
    if (window.ammaRadar.onAiError) {
      window.ammaRadar.onAiError((data) => {
        setAiError(data.message || 'AI failed to start')
        setAiOnline(false)
        setListeningState('error')
      })
    }

    return () => {
      window.ammaRadar.removeAmmaListeners?.()
    }
  }, [processEvent]) // processEvent identity is stable (useCallback in useIntensity)

  // ── Auto-start Python when settings are ready ────────────────────────────────
  const aiStartedRef = useRef(false)
  useEffect(() => {
    if (!settingsLoaded)       return  // wait for settings.json to load
    if (settings.demoMode)     return  // demo mode — no Python needed
    if (aiStartedRef.current)  return  // already triggered once
    aiStartedRef.current = true

    setListeningState('starting')

    async function startPython() {
      try {
        if (window.ammaRadar?.startAi) {
          await window.ammaRadar.startAi(settings)
          // Actual confirmation comes via 'ai:status' → 'STATUS' events above
        }
      } catch (e) {
        console.error('[useRadarState] startAi failed:', e)
        setAiError(e.message)
        setListeningState('error')
      }
    }

    startPython()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settings.demoMode])

  // ── When demoMode is toggled ON, paused; OFF, back to starting ────────────────
  useEffect(() => {
    if (settings.demoMode) {
      setListeningState('paused')
    } else if (aiOnline) {
      // aiOnline was already set — keep current listening state
    }
    // Do NOT force 'idle' here — that was breaking the pipeline
  }, [settings.demoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────────
  const toggleSettings = useCallback(() => setShowSettings(p => !p), [])
  const toggleDebug    = useCallback(() => setShowDebug(p => !p),    [])

  const refreshMicrophones = useCallback(async () => {
    try { await window.ammaRadar?.listMicrophones?.() } catch {}
  }, [])

  const handleSaveSettings = useCallback(async (newSettings) => {
    const saved = await updateSettings(newSettings)
    // Push config update to running Python process (hot reload)
    try {
      await window.ammaRadar?.updateAiConfig?.({
        name:               saved.userName,
        aliases:            saved.aliases,
        urgencyPhrases:     saved.urgencyPhrases,
        microphoneEnabled:  saved.microphoneEnabled !== false,
        microphoneDeviceId: saved.microphoneDeviceId,
        sensitivity:        saved.sensitivity,
        detectionMode:      saved.detectionMode,
        volumeThreshold:    saved.volumeThreshold,
      })
    } catch {}
    return saved
  }, [updateSettings])

  const handleReset = useCallback(async () => {
    reset()
    try {
      await window.ammaRadar?.resetAi?.()
    } catch {}
  }, [reset])

  return {
    radarState,
    settings,
    settingsLoaded,
    listeningState,
    aiOnline,
    aiError,
    showSettings,
    showDebug,
    micVolume,
    microphones,
    debugInfo,

    processEvent,
    simulateDemoCall,
    adjustIntensity,
    setIntensityDirect,
    reset: handleReset,
    addAlert,
    updateSettings:    handleSaveSettings,
    toggleSettings,
    toggleDebug,
    refreshMicrophones,
  }
}
