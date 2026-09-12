const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ammaRadar', {
  // ── Window controls ────────────────────────────────────────────────
  close:    () => ipcRenderer.send('window:close'),
  minimize: () => ipcRenderer.send('window:minimize'),
  hide:     () => ipcRenderer.send('window:hide'),
  show:     () => ipcRenderer.send('window:show'),
  drag:     (delta) => ipcRenderer.send('window:drag', delta),
  resize:   (size)  => ipcRenderer.send('window:resize', size),
  vibrate:  (opts)  => ipcRenderer.invoke('window:vibrate', opts),

  // ── Settings ───────────────────────────────────────────────────────
  loadSettings:  ()           => ipcRenderer.invoke('settings:load'),
  saveSettings:  (settings)   => ipcRenderer.invoke('settings:save', settings),

  // ── AI service ─────────────────────────────────────────────────────
  getAiStatus:   ()           => ipcRenderer.invoke('ai:status'),
  startAi:       (settings)   => ipcRenderer.invoke('ai:start', settings),
  stopAi:        ()           => ipcRenderer.invoke('ai:stop'),
  updateAiConfig:(config)     => ipcRenderer.invoke('ai:updateConfig', config),
  resetAi:       ()           => ipcRenderer.invoke('ai:reset'),

  // ── Microphones ────────────────────────────────────────────────────
  listMicrophones: ()         => ipcRenderer.invoke('mic:list'),

  // ── Push events: Python → Electron → React ─────────────────────────
  // CALL_DETECTED | MIC_ACTIVITY | TRANSCRIPT | MIC_ERROR | MIC_LIST | STATUS
  onAmmaEvent: (callback) => {
    ipcRenderer.on('amma:event', (_, data) => callback(data))
  },
  onAiStatus: (callback) => {
    ipcRenderer.on('ai:status', (_, data) => callback(data))
  },
  onAiError: (callback) => {
    ipcRenderer.on('ai:error', (_, data) => callback(data))
  },
  removeAmmaListeners: () => {
    ipcRenderer.removeAllListeners('amma:event')
    ipcRenderer.removeAllListeners('ai:status')
    ipcRenderer.removeAllListeners('ai:error')
  },
})
