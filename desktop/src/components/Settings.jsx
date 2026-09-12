import React, { useState, useEffect, useCallback } from 'react'
import { DEFAULT_MALAYALAM_URGENCY, DEFAULT_KRISHNA_ALIASES } from '../utils/constants.js'

// ─── Small reusable tag-list editor ──────────────────────────────────────────
function TagListEditor({ items, onChange, placeholder, ariaLabel }) {
  const [draft, setDraft] = useState('')

  const addItem = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setDraft('')
  }, [draft, items, onChange])

  const removeItem = useCallback((idx) => {
    onChange(items.filter((_, i) => i !== idx))
  }, [items, onChange])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addItem() }
  }

  return (
    <div className="tag-list-editor">
      <div className="tag-list">
        {items.map((item, idx) => (
          <div key={idx} className="tag-item">
            <span className="tag-text">{item}</span>
            <button
              className="tag-remove"
              onClick={() => removeItem(idx)}
              aria-label={`Remove ${item}`}
            >×</button>
          </div>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          className="settings-input tag-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        <button
          className="tag-add-btn"
          onClick={addItem}
          aria-label="Add item"
          disabled={!draft.trim()}
        >+</button>
      </div>
    </div>
  )
}

// ─── Main Settings component ──────────────────────────────────────────────────
export default function Settings({ settings, onSave, onClose, microphones, onRefreshMics }) {
  const [form, setForm] = useState({ ...settings })
  const [activeSection, setActiveSection] = useState('personalize') // personalize | microphone | general

  useEffect(() => {
    setForm({ ...settings })
  }, [settings])

  const handleChange = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  const resetAliases = () => {
    handleChange('aliases', DEFAULT_KRISHNA_ALIASES)
  }

  const resetPhrases = () => {
    handleChange('urgencyPhrases', DEFAULT_MALAYALAM_URGENCY)
  }

  const tabs = [
    { id: 'personalize', label: '👤 Name' },
    { id: 'microphone',  label: '🎙 Mic' },
    { id: 'general',     label: '⚙️ General' },
  ]

  return (
    <div className="settings-panel" role="dialog" aria-label="Settings">
      {/* Header */}
      <div className="settings-header">
        <span>⚙️ AMMA RADAR SETTINGS</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings">×</button>
      </div>

      {/* Tab bar */}
      <div className="settings-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`settings-tab ${activeSection === t.id ? 'active' : ''}`}
            onClick={() => setActiveSection(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings-body">

        {/* ── PERSONALIZATION & DETECTION MODE ── */}
        {activeSection === 'personalize' && (
          <>
            <div className="settings-section-title">DETECTION MODE</div>

            <div className="detection-mode-grid">
              <button
                type="button"
                className={`detection-mode-card ${form.detectionMode === 'volume' ? 'active' : ''}`}
                onClick={() => handleChange('detectionMode', 'volume')}
              >
                <div className="mode-card-icon">🔊</div>
                <div className="mode-card-info">
                  <div className="mode-card-title">Sound / Volume (No Keywords)</div>
                  <div className="mode-card-sub">Instant alert on loud voice / calling. Zero delay.</div>
                </div>
              </button>

              <button
                type="button"
                className={`detection-mode-card ${form.detectionMode === 'any_speech' ? 'active' : ''}`}
                onClick={() => handleChange('detectionMode', 'any_speech')}
              >
                <div className="mode-card-icon">🗣️</div>
                <div className="mode-card-info">
                  <div className="mode-card-title">Any Voice</div>
                  <div className="mode-card-sub">Alerts when any words are spoken in the room.</div>
                </div>
              </button>

              <button
                type="button"
                className={`detection-mode-card ${form.detectionMode === 'keywords' ? 'active' : ''}`}
                onClick={() => handleChange('detectionMode', 'keywords')}
              >
                <div className="mode-card-icon">🏷️</div>
                <div className="mode-card-info">
                  <div className="mode-card-title">Name & Keywords Only</div>
                  <div className="mode-card-sub">Strict: only triggers when your name or phrase is recognized.</div>
                </div>
              </button>
            </div>

            {form.detectionMode === 'volume' && (
              <div className="settings-row settings-row-col" style={{ marginTop: '4px', marginBottom: '8px' }}>
                <label className="settings-label">
                  Loudness Trigger Threshold <span className="settings-val">{form.volumeThreshold ?? 35}%</span>
                </label>
                <input
                  type="range" min="15" max="80" step="5"
                  value={form.volumeThreshold ?? 35}
                  onChange={e => handleChange('volumeThreshold', Number(e.target.value))}
                  className="settings-slider"
                  aria-label="Volume Threshold"
                />
                <span className="settings-hint">
                  Sounds louder than {form.volumeThreshold ?? 35}% will trigger an alert.
                </span>
              </div>
            )}

            <div className="settings-section-title" style={{ marginTop: '10px' }}>PERSONALIZE YOUR RADAR</div>

            {/* Primary name */}
            <div className="settings-row settings-row-col">
              <label className="settings-label">
                {form.detectionMode === 'keywords' ? 'What name should Amma Radar listen for?' : 'Your Name (for alerts & intensity)'}
              </label>
              <input
                className="settings-input settings-input-full"
                value={form.userName}
                onChange={e => handleChange('userName', e.target.value)}
                placeholder="Krishna"
                maxLength={60}
                aria-label="Your name"
              />
              <span className="settings-hint">
                Primary name shown on alert banners.
              </span>
            </div>

            {/* Aliases */}
            <div className="settings-row settings-row-col">
              <div className="settings-label-row">
                <label className="settings-label">Name variations / Nicknames</label>
                <button className="settings-link-btn" onClick={resetAliases}>
                  Reset to defaults
                </button>
              </div>
              <TagListEditor
                items={form.aliases || []}
                onChange={v => handleChange('aliases', v)}
                placeholder="Add variation… (e.g. കൃഷ്ണാ)"
                ariaLabel="Add name variation"
              />
              <span className="settings-hint">
                Add Malayalam, Manglish, or English variations.
              </span>
            </div>

            {/* Urgency phrases */}
            <div className="settings-row settings-row-col">
              <div className="settings-label-row">
                <label className="settings-label">Urgency phrases</label>
                <button className="settings-link-btn" onClick={resetPhrases}>
                  Reset to defaults
                </button>
              </div>
              <TagListEditor
                items={form.urgencyPhrases || []}
                onChange={v => handleChange('urgencyPhrases', v)}
                placeholder="Add phrase… (e.g. ഇങ്ങോട്ട് വാ)"
                ariaLabel="Add urgency phrase"
              />
              <span className="settings-hint">
                Phrases that trigger emergency alert levels.
              </span>
            </div>
          </>
        )}

        {/* ── MICROPHONE ── */}
        {activeSection === 'microphone' && (
          <>
            <div className="settings-section-title">MICROPHONE</div>

            <div className="settings-row">
              <label className="settings-label">Microphone on/off</label>
              <button
                className={`toggle-btn ${form.microphoneEnabled ? 'on' : 'off'}`}
                onClick={() => handleChange('microphoneEnabled', !form.microphoneEnabled)}
                aria-pressed={form.microphoneEnabled}
              >
                {form.microphoneEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="settings-row settings-row-col">
              <div className="settings-label-row">
                <label className="settings-label">Input device</label>
                <button
                  className="settings-link-btn"
                  onClick={onRefreshMics}
                  aria-label="Refresh microphone list"
                >
                  🔄 Refresh
                </button>
              </div>
              <select
                className="settings-select"
                value={form.microphoneDeviceId || 'default'}
                onChange={e => {
                  const opt = (microphones || []).find(m => m.id === e.target.value)
                  handleChange('microphoneDeviceId', e.target.value)
                  handleChange('microphoneDeviceName', opt ? opt.name : e.target.value)
                }}
                aria-label="Select microphone"
              >
                <option value="default">Default (OS default input)</option>
                {(microphones || []).map(mic => (
                  <option key={mic.id} value={mic.id}>{mic.name}</option>
                ))}
              </select>
              {(!microphones || microphones.length === 0) && (
                <span className="settings-hint settings-hint-warn">
                  No devices found — click Refresh or start the Python service first.
                </span>
              )}
            </div>

            <div className="settings-row settings-row-col">
              <label className="settings-label">
                Sensitivity <span className="settings-val">{form.sensitivity}</span>
              </label>
              <input
                type="range" min="10" max="100" step="5"
                value={form.sensitivity}
                onChange={e => handleChange('sensitivity', Number(e.target.value))}
                className="settings-slider"
                aria-label="Sensitivity"
              />
            </div>
          </>
        )}

        {/* ── GENERAL ── */}
        {activeSection === 'general' && (
          <>
            <div className="settings-section-title">GENERAL</div>

            <div className="settings-row">
              <label className="settings-label">Sounds</label>
              <button
                className={`toggle-btn ${form.soundEnabled ? 'on' : 'off'}`}
                onClick={() => handleChange('soundEnabled', !form.soundEnabled)}
                aria-pressed={form.soundEnabled}
              >
                {form.soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="settings-row">
              <label className="settings-label">Demo Mode</label>
              <button
                className={`toggle-btn ${form.demoMode ? 'on' : 'off'}`}
                onClick={() => handleChange('demoMode', !form.demoMode)}
                aria-pressed={form.demoMode}
              >
                {form.demoMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="settings-row">
              <label className="settings-label">Debug Panel</label>
              <button
                className={`toggle-btn ${form.showDebug ? 'on' : 'off'}`}
                onClick={() => handleChange('showDebug', !form.showDebug)}
                aria-pressed={form.showDebug}
              >
                {form.showDebug ? 'ON' : 'OFF'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <button className="settings-save-btn" onClick={handleSave}>
          💾 Save
        </button>
      </div>

      <div className="settings-privacy">
        🔒 All audio processed locally. Nothing is uploaded.
      </div>
    </div>
  )
}
