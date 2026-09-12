import React from 'react'

const ALERT_STYLES = {
  info:      { bg: '#1e3a5f', border: '#3b82f6', icon: '👀' },
  warning:   { bg: '#3b2200', border: '#f97316', icon: '⚠️' },
  emergency: { bg: '#3b0000', border: '#ef4444', icon: '🚨' },
}

export function AlertPopup({ alerts = [] }) {
  return (
    <div className="alert-container" aria-live="assertive" aria-atomic="false">
      {alerts.map(alert => {
        const style = ALERT_STYLES[alert.type] || ALERT_STYLES.info
        return (
          <div
            key={alert.id}
            className="alert-bubble animate-alert-in"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              boxShadow: `0 0 12px ${style.border}55`,
            }}
            role="alert"
          >
            <span className="alert-icon">{style.icon}</span>
            <span className="alert-text">{alert.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// Floating bubbles that appear around character at emergency level
export function EmergencyBubbles({ active = false }) {
  if (!active) return null
  const bubbles = ['🚨', '😱', '💀', '!!', '🚨']
  return (
    <div className="emergency-bubbles" aria-hidden="true">
      {bubbles.map((b, i) => (
        <div key={i} className={`emg-bubble emg-bubble-${i}`}>{b}</div>
      ))}
    </div>
  )
}
