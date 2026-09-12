import React from 'react'

const STATE_CONFIGS = {
  listening:          { dot: '●', label: 'Listening...',     color: '#4ade80', pulse: true  },
  starting:           { dot: '●', label: 'Starting...',      color: '#facc15', pulse: true  },
  paused:             { dot: '○', label: 'Paused',           color: '#facc15', pulse: false },
  error:              { dot: '●', label: 'Mic unavailable',  color: '#ef4444', pulse: false },
  'mic-unavailable':  { dot: '●', label: 'Mic unavailable',  color: '#ef4444', pulse: false },
  'permission-denied':{ dot: '●', label: 'Permission denied',color: '#ef4444', pulse: false },
  idle:               { dot: '●', label: 'Starting...',      color: '#facc15', pulse: true  },
}

export default function ListeningIndicator({ listeningState = 'idle', aiOnline = false, micVolume = 0 }) {
  const cfg = STATE_CONFIGS[listeningState] || STATE_CONFIGS.idle
  const isListening = listeningState === 'listening'

  const segments = 5
  const filled = isListening ? Math.round((micVolume / 100) * segments) : 0

  return (
    <div className="listening-indicator" aria-live="polite">
      <span
        className={`listening-dot ${cfg.pulse ? 'pulse' : ''}`}
        style={{ color: cfg.color }}
        aria-hidden="true"
      >
        {cfg.dot}
      </span>

      <span className="listening-label" style={{ color: cfg.color }}>
        {cfg.label}
      </span>

      {/* Live volume bar — only when microphone is open */}
      {isListening && (
        <div className="mic-vol-bar" aria-label={`Mic volume ${micVolume}`} aria-hidden="true">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={`mic-vol-seg ${i < filled ? 'active' : ''}`}
              style={i < filled ? { background: cfg.color } : {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
