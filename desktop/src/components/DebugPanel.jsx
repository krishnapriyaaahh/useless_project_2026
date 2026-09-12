import React from 'react'

export default function DebugPanel({ debugInfo = {}, micVolume = 0, listeningState = 'idle', settings = {} }) {
  const {
    transcript = '',
    nameDetected = false,
    matchedAlias = null,
    urgency = 0,
    loudness = 0,
    recentCalls = 0,
    language = 'ml',
  } = debugInfo

  return (
    <div className="debug-panel" aria-label="Debug information">
      <div className="debug-title">LIVE AUDIO</div>

      <div className="debug-row">
        <span className="debug-key">Input</span>
        <span className="debug-val">{settings.microphoneDeviceName || 'Default'}</span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Status</span>
        <span className={`debug-val ${listeningState === 'listening' ? 'debug-green' : 'debug-red'}`}>
          {listeningState}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Mode</span>
        <span className="debug-val" style={{ textTransform: 'capitalize', color: '#60a5fa' }}>
          {settings.detectionMode || 'volume'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Volume</span>
        <div className="debug-vol-bar">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`debug-vol-seg ${i < Math.round(micVolume / 10) ? 'active' : ''}`}
            />
          ))}
          <span className="debug-vol-num">{micVolume}</span>
        </div>
      </div>

      <div className="debug-row">
        <span className="debug-key">Language</span>
        <span className="debug-val">{language}</span>
      </div>

      <div className="debug-row debug-row-col">
        <span className="debug-key">Transcript</span>
        <span className="debug-transcript">
          {transcript ? `"${transcript}"` : '—'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Name detected</span>
        <span className={`debug-val ${nameDetected ? 'debug-green' : 'debug-dim'}`}>
          {nameDetected ? `YES (${matchedAlias})` : 'NO'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Urgency phrases</span>
        <span className={`debug-val ${urgency > 0 ? 'debug-orange' : 'debug-dim'}`}>
          {urgency > 0 ? `${urgency} matched` : 'none'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Loudness</span>
        <span className="debug-val">{loudness.toFixed(1)}</span>
      </div>

      <div className="debug-row">
        <span className="debug-key">Recent calls</span>
        <span className="debug-val">{recentCalls}</span>
      </div>
    </div>
  )
}
