import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_MALAYALAM_URGENCY, DEFAULT_KRISHNA_ALIASES } from '../utils/constants.js'

export const DEFAULT_SETTINGS = {
  // Identity
  userName: 'Krishna',
  aliases: DEFAULT_KRISHNA_ALIASES,

  // Urgency detection
  urgencyPhrases: DEFAULT_MALAYALAM_URGENCY,

  // Microphone
  microphoneEnabled: true,
  microphoneDeviceId: 'default',   // 'default' = OS default input
  microphoneDeviceName: 'Default', // display label

  // Sound & UX
  soundEnabled: true,
  sensitivity: 50,
  detectionMode: 'volume', // 'volume' | 'any_speech' | 'keywords'
  volumeThreshold: 35,
  demoMode: false,

  // Debug panel
  showDebug: false,
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        if (window.ammaRadar?.loadSettings) {
          const saved = await window.ammaRadar.loadSettings()
          // Deep-merge: arrays from saved take precedence, but we ensure arrays exist
          const merged = {
            ...DEFAULT_SETTINGS,
            ...saved,
            aliases: Array.isArray(saved?.aliases) && saved.aliases.length > 0
              ? saved.aliases
              : DEFAULT_SETTINGS.aliases,
            urgencyPhrases: Array.isArray(saved?.urgencyPhrases) && saved.urgencyPhrases.length > 0
              ? saved.urgencyPhrases
              : DEFAULT_SETTINGS.urgencyPhrases,
          }
          setSettings(merged)
        } else {
          // Browser/dev fallback
          const raw = localStorage.getItem('amma-settings')
          if (raw) {
            const saved = JSON.parse(raw)
            setSettings({
              ...DEFAULT_SETTINGS,
              ...saved,
              aliases: Array.isArray(saved?.aliases) && saved.aliases.length > 0
                ? saved.aliases
                : DEFAULT_SETTINGS.aliases,
              urgencyPhrases: Array.isArray(saved?.urgencyPhrases) && saved.urgencyPhrases.length > 0
                ? saved.urgencyPhrases
                : DEFAULT_SETTINGS.urgencyPhrases,
            })
          }
        }
      } catch (e) {
        console.warn('Could not load settings, using defaults.', e)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const updateSettings = useCallback(async (newSettings) => {
    const merged = { ...settings, ...newSettings }
    setSettings(merged)
    try {
      if (window.ammaRadar?.saveSettings) {
        await window.ammaRadar.saveSettings(merged)
      } else {
        localStorage.setItem('amma-settings', JSON.stringify(merged))
      }
    } catch (e) {
      console.warn('Could not save settings.', e)
    }
    return merged
  }, [settings])

  return { settings, updateSettings, loaded }
}
