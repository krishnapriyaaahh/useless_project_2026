const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, spawnSync } = require('child_process')

// ─── Find the correct Python executable ──────────────────────────────────────
// Windows: 'python' or 'py' may default to versions without sounddevice/numpy.
// Try candidates in order and verify sounddevice + numpy can be imported.
function findPython() {
  const candidates = [
    { cmd: 'C:\\Users\\krishna\\AppData\\Local\\Programs\\Python\\Python311\\python.exe', args: [] },
    { cmd: 'py', args: ['-3.11'] },
    { cmd: 'C:\\Users\\krishna\\AppData\\Local\\Programs\\Python\\Python313\\python.exe', args: [] },
    { cmd: 'py', args: ['-3'] },
    { cmd: 'py', args: [] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ]
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate.cmd, [...candidate.args, '-c', 'import sounddevice, numpy; print("PY_OK")'], {
        encoding: 'utf-8',
        timeout: 4000,
        windowsHide: true,
      })
      if (result.status === 0 && result.stdout && result.stdout.includes('PY_OK')) {
        console.log(`[Amma Radar] Using Python: ${candidate.cmd} ${candidate.args.join(' ')}`)
        return candidate
      }
    } catch { /* try next */ }
  }
  // Fallback: check if at least --version works
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate.cmd, [...candidate.args, '--version'], {
        encoding: 'utf-8',
        timeout: 3000,
        windowsHide: true,
      })
      if (result.status === 0 || (result.stdout && result.stdout.includes('Python'))) {
        console.warn(`[Amma Radar] Fallback Python (unverified packages): ${candidate.cmd}`)
        return candidate
      }
    } catch { /* try next */ }
  }
  console.warn('[Amma Radar] No working Python found!')
  return { cmd: 'py', args: [] }
}

const pythonCandidate = findPython()

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Paths ────────────────────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json')
const aiDir = isDev
  ? path.join(__dirname, '../../ai')
  : path.join(process.resourcesPath, 'ai')

// ─── Default settings ─────────────────────────────────────────────────────────
const defaultSettings = {
  userName: 'Krishna',
  aliases: ['കൃഷ്ണ', 'കൃഷ്ണാ', 'Krishna', 'Krishnaa', 'Krish'],
  urgencyPhrases: ['വാ', 'ഇങ്ങോട്ട് വാ', 'വേഗം വാ', 'come here', 'get up', 'hurry up'],
  microphoneEnabled: true,
  microphoneDeviceId: 'default',
  microphoneDeviceName: 'Default',
  soundEnabled: true,
  sensitivity: 50,
  detectionMode: 'volume',
  volumeThreshold: 35,
  demoMode: false,
  showDebug: false,
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8')
      const saved = JSON.parse(raw)
      return {
        ...defaultSettings,
        ...saved,
        aliases: Array.isArray(saved.aliases) ? saved.aliases : defaultSettings.aliases,
        urgencyPhrases: Array.isArray(saved.urgencyPhrases) ? saved.urgencyPhrases : defaultSettings.urgencyPhrases,
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return { ...defaultSettings }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

// ─── Python process management ────────────────────────────────────────────────
let pythonProcess = null
let aiRunning = false
let aiError = null

function startPythonService(settings) {
  if (pythonProcess) return  // already running

  const scriptPath = path.join(aiDir, 'main.py')
  if (!fs.existsSync(scriptPath)) {
    aiError = 'Python service not found'
    console.warn('Python service not found at:', scriptPath)
    return
  }

  const config = JSON.stringify({
    name: settings.userName || 'Krishna',
    aliases: settings.aliases || [],
    urgencyPhrases: settings.urgencyPhrases || [],
    microphoneEnabled: settings.microphoneEnabled !== false,
    microphoneDeviceId: settings.microphoneDeviceId || 'default',
    sensitivity: settings.sensitivity || 50,
    detectionMode: settings.detectionMode || 'volume',
    volumeThreshold: settings.volumeThreshold || 35,
  })

  // Pass config as environment variable (avoids shell quoting issues)
  const env = {
    ...process.env,
    AMMA_CONFIG: config,
    PYTHONIOENCODING: 'utf-8',
  }

  console.log(`[Amma Radar] Starting Python service:`)
  console.log(`  Executable : ${pythonCandidate.cmd} ${pythonCandidate.args.join(' ')}`)
  console.log(`  Script     : ${scriptPath}`)
  console.log(`  CWD        : ${aiDir}`)
  console.log(`  Name       : ${settings.userName}`)

  pythonProcess = spawn(pythonCandidate.cmd, [...pythonCandidate.args, scriptPath], {
    env,
    // CRITICAL: cwd must be the ai/ directory so Python relative imports work
    cwd: aiDir,
    windowsHide: true,
  })

  if (!pythonProcess.pid) {
    console.error('[Amma Radar] Python process failed to start (no PID)')
    return
  }
  console.log(`[Amma Radar] Python PID: ${pythonProcess.pid}`)

  pythonProcess.stdout.setEncoding('utf-8')
  pythonProcess.stderr.setEncoding('utf-8')

  pythonProcess.stdout.on('data', (data) => {
    // Python sends newline-delimited JSON events
    const lines = data.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        handlePythonEvent(event)
      } catch {
        // Not JSON — plain log line
        console.log('[Python]', line)
      }
    }
  })

  pythonProcess.stderr.on('data', (data) => {
    console.error('[Python stderr]', data)
    // Mark specific known errors
    if (data.includes('No module named') || data.includes('ModuleNotFoundError')) {
      aiError = 'Missing Python dependency. Run: pip install -r ai/requirements.txt'
      notifyRenderer('ai:error', { message: aiError })
    }
  })

  pythonProcess.on('spawn', () => {
    aiRunning = true
    aiError = null
    console.log('[Amma Radar] Python service started')
    notifyRenderer('ai:status', { running: true })
  })

  pythonProcess.on('exit', (code) => {
    aiRunning = false
    pythonProcess = null
    console.log('[Amma Radar] Python service exited, code:', code)
    notifyRenderer('ai:status', { running: false, exitCode: code })
  })

  pythonProcess.on('error', (err) => {
    aiRunning = false
    pythonProcess = null
    aiError = err.message
    console.error('[Amma Radar] Failed to start Python:', err.message)
    notifyRenderer('ai:error', { message: 'Python not found. Install Python 3.9+ and run: pip install -r ai/requirements.txt' })
  })
}

function stopPythonService() {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM')
    pythonProcess = null
    aiRunning = false
  }
}

// Dispatch events from Python to the renderer
function handlePythonEvent(event) {
  if (!mainWindow) return
  
  switch (event.type) {
    case 'CALL_DETECTED':
    case 'MIC_ACTIVITY':
    case 'TRANSCRIPT':
    case 'MIC_ERROR':
    case 'MIC_LIST':
    case 'STATUS':
      notifyRenderer('amma:event', event)
      break
    default:
      notifyRenderer('amma:event', event)
  }
}

function notifyRenderer(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  } catch (e) {
    // renderer may not be ready yet
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────
let mainWindow = null

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  const winWidth = 280
  const winHeight = 360
  const margin = 20

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - margin,
    y: screenHeight - winHeight - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close() })
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize() })
ipcMain.on('window:hide', () => { if (mainWindow) mainWindow.hide() })
ipcMain.on('window:show', () => { if (mainWindow) mainWindow.show() })

ipcMain.on('window:drag', (_, { deltaX, deltaY }) => {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + deltaX, y + deltaY)
})

ipcMain.on('window:resize', (_, { width, height }) => {
  if (!mainWindow) return
  mainWindow.setSize(width, height)
})

// Physical window vibration on desktop for Last Level (Level 4: Max Angriness)
let shakeTimer = null

function vibrateWindow(duration = 950, intensity = 8) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (shakeTimer) {
    clearInterval(shakeTimer)
    shakeTimer = null
  }

  const [originX, originY] = mainWindow.getPosition()
  const start = Date.now()

  shakeTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(shakeTimer)
      shakeTimer = null
      return
    }

    const elapsed = Date.now() - start
    if (elapsed >= duration) {
      clearInterval(shakeTimer)
      shakeTimer = null
      try { mainWindow.setPosition(originX, originY) } catch {}
      return
    }

    const factor = Math.max(0.25, 1 - (elapsed / duration))
    const mag = Math.max(2, Math.round(intensity * factor))
    const dx = Math.round((Math.random() - 0.5) * mag * 2)
    const dy = Math.round((Math.random() - 0.5) * mag * 2)
    try {
      mainWindow.setPosition(originX + dx, originY + dy)
    } catch {}
  }, 22)
}

ipcMain.handle('window:vibrate', (_, opts) => {
  const duration = opts?.duration || 950
  const intensity = opts?.intensity || 8
  vibrateWindow(duration, intensity)
  return { ok: true }
})

// Settings
ipcMain.handle('settings:load', () => loadSettings())
ipcMain.handle('settings:save', (_, settings) => {
  saveSettings(settings)
  return { ok: true }
})

// AI service — start/stop/status
ipcMain.handle('ai:status', () => ({
  running: aiRunning,
  error: aiError,
  message: aiRunning ? 'Python service running' : (aiError || 'AI service not started'),
}))

ipcMain.handle('ai:start', (_, settings) => {
  const s = settings || loadSettings()
  startPythonService(s)
  return { ok: true }
})

ipcMain.handle('ai:stop', () => {
  stopPythonService()
  return { ok: true }
})

// Microphone list — ask the Python service, or return cached
ipcMain.handle('mic:list', () => {
  // Ask Python to enumerate devices by sending it a command via stdin
  if (pythonProcess && pythonProcess.stdin) {
    try {
      pythonProcess.stdin.write(JSON.stringify({ cmd: 'list_devices' }) + '\n')
    } catch (e) {
      console.warn('Could not send list_devices to Python:', e.message)
    }
  }
  // Return empty list; Python will push 'MIC_LIST' event asynchronously
  return { requested: true }
})

// Send config update to running Python process
ipcMain.handle('ai:updateConfig', (_, config) => {
  if (pythonProcess && pythonProcess.stdin) {
    try {
      pythonProcess.stdin.write(JSON.stringify({ cmd: 'update_config', config }) + '\n')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
  return { ok: false, error: 'Python not running' }
})

// Reset call counts and state in running Python process
ipcMain.handle('ai:reset', () => {
  if (pythonProcess && pythonProcess.stdin) {
    try {
      pythonProcess.stdin.write(JSON.stringify({ cmd: 'reset' }) + '\n')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
  return { ok: false, error: 'Python not running' }
})

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopPythonService()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopPythonService()
})
