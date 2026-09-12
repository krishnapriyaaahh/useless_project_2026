import React from 'react'
import { STATE_CONFIG } from '../utils/constants.js'

export default function Character({ state = 'peaceful', intensity = 0, micVolume = 0 }) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.peaceful
  const isEmergency = state === 'emergency'
  const isPanic = state === 'panic'
  const isWorried = state === 'worried' || state === 'concerned'
  const isSuspicious = state === 'suspicious'
  const isPeaceful = state === 'peaceful'

  // Headphone LED color maps directly to state color
  const ledColor = config.color

  // Live audio bar height for retro visualizer
  const audioBars = 6
  const activeBars = Math.round((micVolume / 100) * audioBars)

  return (
    <div className={`retro-game-stage state-${state}`} aria-label={`Amma Game Screen: ${state}`}>
      {/* ── Retro Pixel Sky Background with Clouds ── */}
      <div className="retro-sky">
        <div className="pixel-cloud cloud-1" />
        <div className="pixel-cloud cloud-2" />
        <div className="pixel-sun" />
      </div>

      {/* ── Retro Floating Blocks [ ? ] [ ■ ] ── */}
      <div className="retro-floating-blocks">
        <div className="retro-block block-q">?</div>
        <div className="retro-block block-brick" />
        <div className="retro-block block-brick" />
      </div>

      {/* ── Main Pixel Sprite Character ── */}
      <div className={`pixel-sprite-wrapper ${isPanic ? 'sprite-panic' : ''} ${isEmergency ? 'sprite-emergency' : ''} ${isWorried ? 'sprite-worried' : ''}`}>
        <svg
          viewBox="0 0 48 48"
          className="pixel-sprite-svg"
          shapeRendering="crispEdges"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Headphone Band */}
          <rect x="14" y="6" width="20" height="3" fill="#334155" />
          <rect x="11" y="9" width="3" height="7" fill="#334155" />
          <rect x="34" y="9" width="3" height="7" fill="#334155" />

          {/* Left Headphone Earcup with State LED */}
          <rect x="8" y="16" width="5" height="12" fill="#1e293b" />
          <rect x="9" y="18" width="3" height="8" fill={ledColor} />

          {/* Right Headphone Earcup with State LED */}
          <rect x="35" y="16" width="5" height="12" fill="#1e293b" />
          <rect x="36" y="18" width="3" height="8" fill={ledColor} />

          {/* Cat Ears / Hair Tufts */}
          <rect x="15" y="9" width="4" height="4" fill="#1e293b" />
          <rect x="29" y="9" width="4" height="4" fill="#1e293b" />
          <rect x="16" y="10" width="2" height="2" fill="#fb7185" />
          <rect x="30" y="10" width="2" height="2" fill="#fb7185" />

          {/* Face Base */}
          <rect x="14" y="13" width="20" height="18" fill="#fed7aa" />
          {/* Hair fringe */}
          <rect x="17" y="13" width="14" height="4" fill="#334155" />

          {/* Expressions */}
          {isPeaceful && (
            <g>
              {/* Chill Closed Happy Eyes (^_^) */}
              <rect x="18" y="20" width="4" height="2" fill="#7c2d12" />
              <rect x="17" y="21" width="2" height="2" fill="#7c2d12" />
              <rect x="26" y="20" width="4" height="2" fill="#7c2d12" />
              <rect x="29" y="21" width="2" height="2" fill="#7c2d12" />
              {/* Cute Smile */}
              <rect x="22" y="25" width="4" height="2" fill="#7c2d12" />
              {/* Pixel Blush */}
              <rect x="16" y="23" width="3" height="2" fill="#fb7185" />
              <rect x="29" y="23" width="3" height="2" fill="#fb7185" />
            </g>
          )}

          {isSuspicious && (
            <g>
              {/* One Big Eye, One Squinting Eye (O_o) */}
              <rect x="17" y="19" width="5" height="5" fill="#ffffff" />
              <rect x="19" y="20" width="3" height="3" fill="#7c2d12" />
              {/* Squint Eye */}
              <rect x="26" y="21" width="5" height="2" fill="#7c2d12" />
              {/* Question mark mouth */}
              <rect x="22" y="25" width="3" height="2" fill="#7c2d12" />
            </g>
          )}

          {isWorried && (
            <g>
              {/* Wide Nervous Eyes */}
              <rect x="17" y="19" width="4" height="5" fill="#ffffff" />
              <rect x="18" y="20" width="3" height="3" fill="#7c2d12" />
              <rect x="27" y="19" width="4" height="5" fill="#ffffff" />
              <rect x="28" y="20" width="3" height="3" fill="#7c2d12" />
              {/* Slanted brows */}
              <rect x="16" y="17" width="5" height="2" fill="#7c2d12" />
              <rect x="27" y="17" width="5" height="2" fill="#7c2d12" />
              {/* Wavy mouth */}
              <rect x="21" y="25" width="6" height="2" fill="#7c2d12" />
              {/* Sweat drop */}
              <rect x="32" y="18" width="2" height="4" fill="#38bdf8" />
            </g>
          )}

          {(isPanic || isEmergency) && (
            <g>
              {/* Shocked Pixel Eyes */}
              <rect x="16" y="18" width="6" height="6" fill="#ffffff" />
              <rect x="18" y="19" width="3" height="3" fill="#991b1b" />
              <rect x="26" y="18" width="6" height="6" fill="#ffffff" />
              <rect x="27" y="19" width="3" height="3" fill="#991b1b" />
              {/* Screaming Open Mouth */}
              <rect x="21" y="25" width="6" height="4" fill="#7f1d1d" />
              {/* Sweat drops on both sides */}
              <rect x="14" y="18" width="2" height="4" fill="#38bdf8" />
              <rect x="32" y="18" width="2" height="4" fill="#38bdf8" />
            </g>
          )}

          {/* Body / Hoodie */}
          <rect x="16" y="31" width="16" height="10" fill={ledColor} />
          <rect x="20" y="32" width="8" height="9" fill="#1e293b" />
          <rect x="22" y="34" width="4" height="6" fill="#ffffff" />

          {/* Pixel Feet */}
          <rect x="18" y="41" width="4" height="3" fill="#334155" />
          <rect x="26" y="41" width="4" height="3" fill="#334155" />
        </svg>

        {/* Floating 8-Bit Notes / Emotes */}
        {isPeaceful && <div className="pixel-emote emote-music">♪</div>}
        {isSuspicious && <div className="pixel-emote emote-alert">?</div>}
        {isWorried && <div className="pixel-emote emote-sweat">💦</div>}
        {(isPanic || isEmergency) && <div className="pixel-emote emote-panic">!</div>}

        {/* 8-Bit Flying Chappal for Emergency */}
        {isEmergency && (
          <div className="pixel-chappal-warning" title="CHAPPAL INCOMING!">
            🩴
          </div>
        )}
      </div>

      {/* ── Retro Ground Platform with Grass ── */}
      <div className="retro-ground">
        <div className="pixel-grass" />
        <div className="pixel-dirt" />
      </div>

      {/* ── Live 8-Bit Sound Equalizer Bars (Reacts to Mic Volume) ── */}
      <div className="pixel-sound-eq" aria-hidden="true">
        {Array.from({ length: audioBars }).map((_, i) => (
          <div
            key={i}
            className={`pixel-eq-bar ${i < activeBars ? 'active' : ''}`}
            style={i < activeBars ? { background: ledColor } : {}}
          />
        ))}
      </div>
    </div>
  )
}
