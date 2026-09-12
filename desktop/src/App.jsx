import React from 'react'
import './App.css'
import Radar from './components/Radar.jsx'
import { useRadarState } from './hooks/useRadarState.js'

export default function App() {
  const {
    radarState,
    settings,
    settingsLoaded,
    listeningState,
    aiOnline,
    showSettings,
    showDebug,
    micVolume,
    microphones,
    debugInfo,
    simulateDemoCall,
    adjustIntensity,
    setIntensityDirect,
    reset,
    updateSettings,
    toggleSettings,
    toggleDebug,
    refreshMicrophones,
  } = useRadarState()

  if (!settingsLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-text">AMMA RADAR™</div>
        <div className="loading-sub">Initializing…</div>
      </div>
    )
  }

  return (
    <Radar
      radarState={radarState}
      settings={settings}
      listeningState={listeningState}
      aiOnline={aiOnline}
      showSettings={showSettings}
      showDebug={showDebug}
      micVolume={micVolume}
      microphones={microphones}
      debugInfo={debugInfo}
      onClose={() => window.ammaRadar?.close()}
      onMinimize={() => window.ammaRadar?.minimize()}
      onToggleSettings={toggleSettings}
      onToggleDebug={toggleDebug}
      onSimulateCall={simulateDemoCall}
      onAdjustIntensity={adjustIntensity}
      onSetIntensity={setIntensityDirect}
      onReset={reset}
      onSaveSettings={updateSettings}
      onRefreshMics={refreshMicrophones}
    />
  )
}
