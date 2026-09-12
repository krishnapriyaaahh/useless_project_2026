import React, { useEffect, useRef, useCallback, useState } from 'react'
import Character from './Character.jsx'
import IntensityMeter from './IntensityMeter.jsx'
import StatusMessage from './StatusMessage.jsx'
import ListeningIndicator from './ListeningIndicator.jsx'
import { AlertPopup } from './AlertPopup.jsx'
import Settings from './Settings.jsx'
import DemoControls from './DemoControls.jsx'
import DebugPanel from './DebugPanel.jsx'
import { STATE_CONFIG } from '../utils/constants.js'

// 8-bit retro rumble sound for Level 4
function playRetroRumble(enabled = true) {
  if (!enabled) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(58, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(32, ctx.currentTime + 0.8)

    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.8)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.85)
  } catch {
    // AudioContext permission or unsupported
  }
}

export default function Radar({
  radarState,
  settings,
  listeningState,
  aiOnline,
  showSettings,
  showDebug,
  micVolume,
  microphones,
  debugInfo,
  onClose,
  onMinimize,
  onToggleSettings,
  onToggleDebug,
  onSimulateCall,
  onAdjustIntensity,
  onSetIntensity,
  onReset,
  onSaveSettings,
  onRefreshMics,
}) {
  const { intensity, callCount, transcript, state, alerts } = radarState
  const stateConfig = STATE_CONFIG[state] || STATE_CONFIG.peaceful
  const dragRef = useRef(null)
  const isEmergency = state === 'emergency'
  const isPanic = state === 'panic'
  const [resetFeedback, setResetFeedback] = useState(false)
  const [isVibrating, setIsVibrating] = useState(false)
  const prevLevel4Ref = useRef(false)
  const prevCallCountRef = useRef(callCount)

  // ─── Dragging ────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    // Ignore clicks on buttons or interactive inputs
    if (e.target.closest('button') || e.target.closest('input')) return
    e.preventDefault()
    const startX = e.screenX
    const startY = e.screenY
    dragRef.current = { startX, startY }

    const onMouseMove = (me) => {
      if (!dragRef.current) return
      const deltaX = me.screenX - dragRef.current.startX
      const deltaY = me.screenY - dragRef.current.startY
      dragRef.current.startX = me.screenX
      dragRef.current.startY = me.screenY
      window.ammaRadar?.drag({ deltaX, deltaY })
    }

    const onMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // ─── Level 4 Vibration (Physical window shake + rumble) ─────────────────────
  useEffect(() => {
    const isLevel4 = state === 'emergency' || callCount >= 3
    const callIncreasedAtLevel4 = isLevel4 && callCount > prevCallCountRef.current
    const justEnteredLevel4 = isLevel4 && !prevLevel4Ref.current

    if (justEnteredLevel4 || callIncreasedAtLevel4) {
      setIsVibrating(true)
      // 1. Physical Electron window shake
      window.ammaRadar?.vibrate?.({ duration: 950, intensity: 8 })
      // 2. Hardware vibration API fallback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 80, 200, 80, 300])
      }
      // 3. 8-bit rumble buzz
      playRetroRumble(settings?.soundEnabled !== false)

      const timer = setTimeout(() => setIsVibrating(false), 950)
      return () => clearTimeout(timer)
    }

    prevLevel4Ref.current = isLevel4
    prevCallCountRef.current = callCount
  }, [state, callCount, settings?.soundEnabled])

  // ─── Window size is fixed — no dynamic resize ────────────────────────────────
  // The window is created at 280×360 and stays that size regardless of panel state.


  // Handle Reset button with visual feedback
  const handleResetPress = () => {
    setResetFeedback(true)
    onReset?.()
    setTimeout(() => setResetFeedback(false), 800)
  }

  // ─── Widget shake CSS class ───────────────────────────────────────────────────
  const widgetShakeClass = {
    peaceful:   '',
    suspicious: '',
    concerned:  'widget-shake-1',
    worried:    'widget-shake-2',
    panic:      'widget-shake-3',
    emergency:  'widget-shake-4',
  }[state] || ''

  return (
    <div
      className={`gameboy-console ${widgetShakeClass} ${resetFeedback ? 'console-reset-flash' : ''} ${isVibrating ? 'console-vibrating' : ''}`}
      onMouseDown={handleMouseDown}
      style={{ '--glow-color': stateConfig.bgGlow }}
    >
      {/* ─── Top Console Header ───────────────────────────────────────── */}
      <div className="gameboy-top-bar">
        <div className="power-switch-housing">
          <span className={`power-led ${aiOnline ? 'power-led-on' : 'power-led-off'}`} />
          <span className="power-label">POWER</span>
        </div>

        <div className="console-drag-handle">
          <span className="retro-screw">⊕</span>
          <span className="console-model-tag">AMMA-BOY</span>
          <span className="retro-screw">⊕</span>
        </div>

        <div className="top-window-controls">
          <button
            className="retro-header-btn"
            onClick={onMinimize}
            aria-label="Minimize"
            title="Minimize"
          >−</button>
          <button
            className="retro-header-btn retro-header-close"
            onClick={onClose}
            aria-label="Power off"
            title="Close"
          >×</button>
        </div>
      </div>

      {/* ─── Settings Overlay Panel ──────────────────────────────────── */}
      {showSettings && (
        <Settings
          settings={settings}
          onSave={onSaveSettings}
          onClose={onToggleSettings}
          microphones={microphones || []}
          onRefreshMics={onRefreshMics}
        />
      )}

      {/* ─── Main Screen Bezel (Game Boy Curved Frame) ───────────────── */}
      {!showSettings && (
        <>
          <div className="gameboy-bezel">
            {/* Bezel header with classic twin racing stripes */}
            <div className="bezel-header-strip">
              <div className="bezel-stripe stripe-magenta" />
              <div className="bezel-stripe stripe-blue" />
              <span className="bezel-text">DOT MATRIX WITH STEREO SOUND</span>
            </div>

            <div className="bezel-status-row">
              <div className="battery-indicator">
                <span className={`battery-dot ${aiOnline ? 'battery-active' : ''}`} />
                <span className="battery-text">BATTERY</span>
              </div>
              <ListeningIndicator
                listeningState={listeningState}
                aiOnline={aiOnline}
                micVolume={micVolume || 0}
              />
            </div>

            {/* ─── The Retro LCD Screen ────────────────────────────── */}
            <div className="gameboy-screen">
              {/* Scanline CRT overlay */}
              <div className="screen-scanlines" aria-hidden="true" />

              {/* Reset Flash Banner */}
              {resetFeedback && (
                <div className="retro-reset-banner">
                  ★ PACIFIED! 0% ★
                </div>
              )}

              {/* Top HP Meter */}
              <IntensityMeter
                intensity={intensity}
                state={state}
                callCount={callCount}
                micVolume={micVolume || 0}
                onReset={handleResetPress}
              />

              {/* Platformer Stage with 8-Bit Pixel Character */}
              <Character
                state={state}
                intensity={intensity}
                micVolume={micVolume || 0}
              />

              {/* 8-Bit RPG Dialogue Box */}
              <StatusMessage
                state={state}
                callCount={callCount}
                transcript={transcript}
              />

              {/* Alert Popups */}
              <AlertPopup alerts={alerts || []} />
            </div>
          </div>

          {/* ─── Lower Console Controls (D-Pad, Speaker, A/B Buttons) ───── */}
          <div className="gameboy-controls-deck">
            {/* Directional D-Pad */}
            <div className="gameboy-dpad" aria-label="Directional D-Pad">
              <div className="dpad-btn dpad-up" />
              <div className="dpad-btn dpad-right" />
              <div className="dpad-btn dpad-down" />
              <div className="dpad-btn dpad-left" />
              <div className="dpad-center" />
            </div>

            {/* Speaker Grille Vents (diagonal oval slots) */}
            <div className="gameboy-speaker" aria-hidden="true">
              <div className="speaker-slot" />
              <div className="speaker-slot" />
              <div className="speaker-slot" />
              <div className="speaker-slot" />
              <div className="speaker-slot" />
            </div>

            {/* Action Buttons A & B (B: Test, A: RESET) */}
            <div className="gameboy-action-buttons">
              {/* Button B: Test / Simulate Call */}
              <div className="action-btn-group btn-group-b">
                <button
                  type="button"
                  className="action-btn btn-b"
                  onClick={onSimulateCall}
                  aria-label="Button B: Test Call"
                  title="Test Call (B)"
                >
                  B
                </button>
                <span className="action-btn-label">TEST</span>
              </div>

              {/* Button A: RESET BUTTON (prominent, lights up when intensity > 0) */}
              <div className="action-btn-group btn-group-a">
                <button
                  type="button"
                  className={`action-btn btn-a ${intensity > 0 ? 'btn-a-active' : ''}`}
                  onClick={handleResetPress}
                  aria-label="Button A: Reset Intensity"
                  title="RESET AMMA (A)"
                >
                  A
                </button>
                <span className={`action-btn-label ${intensity > 0 ? 'label-a-active' : ''}`}>
                  RESET
                </span>
              </div>
            </div>
          </div>

          {/* ─── Bottom Rubber Pill Buttons: SELECT & START ──────────── */}
          <div className="gameboy-bottom-deck">
            <div className="pill-btn-group">
              <button
                type="button"
                className="pill-btn"
                onClick={onToggleSettings}
                aria-label="Select: Open Settings"
                title="Settings (Select)"
              />
              <span className="pill-label">SELECT</span>
            </div>

            <div className="pill-btn-group">
              <button
                type="button"
                className={`pill-btn ${showDebug ? 'pill-btn-active' : ''}`}
                onClick={onToggleDebug}
                aria-label="Start: Toggle Debug"
                title="Debug (Start)"
              />
              <span className="pill-label">START</span>
            </div>
          </div>

          {/* ─── Debug Panel Drawer ──────────────────────────────────── */}
          {showDebug && (
            <DebugPanel
              debugInfo={debugInfo || {}}
              micVolume={micVolume || 0}
              listeningState={listeningState}
              settings={settings}
            />
          )}

          {/* ─── Demo Controls Drawer ────────────────────────────────── */}
          {settings?.demoMode && (
            <DemoControls
              intensity={intensity}
              onSimulateCall={onSimulateCall}
              onAddIntensity={() => onAdjustIntensity(10)}
              onSubIntensity={() => onAdjustIntensity(-10)}
              onPanic={() => onSetIntensity(88)}
              onEmergency={() => onSetIntensity(98)}
              onReset={handleResetPress}
            />
          )}

          {/* Mic error hint */}
          {(listeningState === 'error' || listeningState === 'mic-unavailable' || listeningState === 'permission-denied') && (
            <div className="retro-error-banner">
              <span>⚠ MIC UNAVAILABLE</span>
              <button
                className="retro-demo-btn"
                onClick={() => onSaveSettings({ ...settings, demoMode: true })}
              >
                USE DEMO
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
