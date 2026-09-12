import React, { useEffect, useState } from 'react'
import { STATE_CONFIG } from '../utils/constants.js'

export default function StatusMessage({ state = 'peaceful', callCount = 0, transcript = '' }) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.peaceful
  const [subMsg, setSubMsg] = useState('')

  // Cycle through sub-messages for high-intensity states
  useEffect(() => {
    if (!config.subMessage || config.subMessage.length === 0) {
      setSubMsg('')
      return
    }
    setSubMsg(config.subMessage[0])
    const interval = setInterval(() => {
      setSubMsg(prev => {
        const msgs = config.subMessage
        const idx = msgs.indexOf(prev)
        return msgs[(idx + 1) % msgs.length]
      })
    }, 1100)
    return () => clearInterval(interval)
  }, [state, config.subMessage])

  return (
    <div className={`retro-dialogue-box state-${state}`}>
      {/* ── Header: Speaker + Level + Times Called ── */}
      <div className="retro-dialogue-header">
        <span className="retro-dialogue-speaker">► AMMA:</span>
        <div className="retro-dialogue-meta">
          <span className={`retro-level-pill level-${config.levelNum} ${config.levelNum >= 4 ? 'animate-flash' : ''}`}>
            {config.levelNum >= 4 ? 'LEVEL 4: MAX!' : config.levelNum > 0 ? `LEVEL ${config.levelNum}` : 'PEACEFUL'}
          </span>
          <span className={`retro-call-badge ${callCount > 0 ? 'call-badge-active' : ''}`} title="Count of times called out">
            CALLED: {callCount}x
          </span>
        </div>
      </div>

      {/* ── Main Message ── */}
      <div className="retro-dialogue-body" style={{ color: config.color }}>
        {config.message}
      </div>

      {/* ── Retro Warning Sub-message (RUN BROOOOO...., RUN BRO RUNNNN.... etc) ── */}
      {subMsg && (
        <div className="retro-dialogue-sub animate-flicker">
          ⚠ {subMsg}
        </div>
      )}

      {/* ── Count of Times Called Out (Old style info row) ── */}
      {callCount > 0 && (
        <div className="retro-dialogue-call-count">
          Times called out: <strong>{callCount}</strong> {config.levelNum >= 4 && <span className="max-tag">[LEVEL 4 MAX REACHED!]</span>}
        </div>
      )}

      {/* ── Speech Transcript ── */}
      {transcript && state !== 'peaceful' && (
        <div className="retro-dialogue-transcript" title={transcript}>
          "{transcript.length > 28 ? transcript.slice(0, 28) + '…' : transcript}"
        </div>
      )}

      {/* Retro blinking RPG prompt arrow */}
      <span className="retro-cursor-blink">▼</span>
    </div>
  )
}
