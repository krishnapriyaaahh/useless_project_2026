import React from 'react'
import { STATE_CONFIG } from '../utils/constants.js'

export default function IntensityMeter({ intensity = 0, state = 'peaceful', callCount = 0, micVolume = 0, onReset }) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.peaceful
  const pct = Math.min(100, Math.max(0, Math.round(intensity)))
  const vol = Math.min(100, Math.max(0, Math.round(micVolume)))
  const isMaxAnger = state === 'emergency' || pct >= 95

  // 10 Chunky 8-Bit HP blocks
  const totalBlocks = 10
  const activeBlocks = Math.round((pct / 100) * totalBlocks)

  return (
    <div className="retro-hud-meter" aria-label={`Amma Anger Level ${pct}%`}>
      {/* ── Top Row: Heart + Anger % + Level + Times Called + Reset ── */}
      <div className="retro-hud-header">
        <div className="retro-hud-title">
          <span className={`retro-pixel-heart ${pct > 40 ? 'heart-beating' : ''}`}>❤️</span>
          <span className="retro-hud-tag">ANGER:</span>
          <span className="retro-hud-pct" style={{ color: config.color }}>{pct}%</span>
        </div>

        <div className="retro-hud-badges">
          {/* Prominent Level Indicator */}
          <span className={`retro-hud-level level-${config.levelNum} ${isMaxAnger ? 'level-max-pulse' : ''}`}>
            {config.levelNum >= 4 ? 'LVL 4: MAX!' : `LVL ${config.levelNum}`}
          </span>

          {/* Times Called Out counter */}
          <span className={`retro-hud-calls ${callCount > 0 ? 'calls-active' : ''}`} title="Count of times called out">
            CALLED: {callCount}x
          </span>

          {/* Reset button shown when intensity or calls > 0 */}
          {(pct > 0 || callCount > 0) && onReset && (
            <button
              type="button"
              className="retro-hud-reset-pill animate-pulse"
              onClick={onReset}
              title="Reset Amma's Anger to 0%"
            >
              ↺ RESET
            </button>
          )}
        </div>
      </div>

      {/* ── 8-Bit Segmented HP Bar ── */}
      <div className="retro-hp-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        {Array.from({ length: totalBlocks }).map((_, i) => {
          const isActive = i < activeBlocks
          // Color stages like classic game health
          let blockColor = '#22c55e' // green
          if (pct >= 80) blockColor = '#ef4444' // red
          else if (pct >= 50) blockColor = '#f97316' // orange
          else if (pct >= 25) blockColor = '#eab308' // yellow

          return (
            <div
              key={i}
              className={`retro-hp-block ${isActive ? 'filled' : 'empty'}`}
              style={isActive ? { background: blockColor } : {}}
            />
          )
        })}
      </div>

      {/* ── LEVEL 4 MAX ANGRINESS Alert Banner ── */}
      {isMaxAnger && (
        <div className="retro-max-banner animate-flicker">
          ⚡ LEVEL 4: MAX ANGRINESS REACHED! ⚡
        </div>
      )}

      {/* ── Sub Row: Mic Volume Level ── */}
      <div className="retro-mic-subrow">
        <span className="retro-mic-tag">MIC SOUND:</span>
        <div className="retro-mic-track">
          <div
            className="retro-mic-fill"
            style={{
              width: `${vol}%`,
              background: vol > 60 ? '#ef4444' : vol > 35 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
        <span className="retro-mic-num">{vol}%</span>
      </div>
    </div>
  )
}
