import React from 'react'

export default function DemoControls({
  onSimulateCall,
  onAddIntensity,
  onSubIntensity,
  onPanic,
  onEmergency,
  onReset,
  intensity,
}) {
  return (
    <div className="demo-controls" aria-label="Demo controls">
      <div className="demo-header">🎮 DEMO MODE</div>

      <div className="demo-buttons">
        <button className="demo-btn demo-btn-primary" onClick={onSimulateCall}>
          📞 Simulate Call
        </button>

        <div className="demo-row">
          <button className="demo-btn demo-btn-small" onClick={() => onAddIntensity(10)}>
            +10
          </button>
          <button className="demo-btn demo-btn-small" onClick={() => onSubIntensity(10)}>
            -10
          </button>
        </div>

        <div className="demo-row">
          <button className="demo-btn demo-btn-warn" onClick={onPanic}>
            😱 Panic
          </button>
          <button className="demo-btn demo-btn-danger" onClick={onEmergency}>
            💀 Emergency
          </button>
        </div>

        <button className="demo-btn demo-btn-reset" onClick={onReset}>
          🔄 Reset
        </button>
      </div>

      <div className="demo-intensity-preview">
        Intensity: <strong>{Math.round(intensity)}</strong>
      </div>

      <div className="demo-escalation">
        <span title="Peaceful">😌</span>
        <span className="demo-arrow">→</span>
        <span title="Suspicious">👀</span>
        <span className="demo-arrow">→</span>
        <span title="Concerned">😐</span>
        <span className="demo-arrow">→</span>
        <span title="Worried">😰</span>
        <span className="demo-arrow">→</span>
        <span title="Panic">😱</span>
        <span className="demo-arrow">→</span>
        <span title="Emergency">💀</span>
      </div>
    </div>
  )
}
