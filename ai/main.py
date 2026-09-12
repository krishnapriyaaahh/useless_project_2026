"""
Amma Radar -- Python AI Service
================================
stdout  = JSON events for Electron (machine-readable, one JSON object per line)
stderr  = human-readable ASCII diagnostics (never reaches Electron IPC)

Launch:
  AMMA_CONFIG=<json> python main.py

Config JSON keys:
  name              str   primary user name
  aliases           list  name variations
  urgencyPhrases    list  urgency phrases
  microphoneDeviceId str  "default" or device index string
  sensitivity       int   0-100

Event types emitted on stdout:
  {"type":"STATUS",       "listening":bool, "whisper":bool, "device":str, "message":str}
  {"type":"MIC_LIST",     "devices":[...]}
  {"type":"MIC_ACTIVITY", "volume":0-100}
  {"type":"TRANSCRIPT",   "transcript":str, "language":str, "confidence":float}
  {"type":"CALL_DETECTED","transcript":str, "nameDetected":bool, "matchedAlias":str,
                           "urgencyWords":[...], "loudness":float, "callCount":int,
                           "timeSinceLastMs":int|null}
  {"type":"MIC_ERROR",    "message":str}
  {"type":"ERROR",        "message":str}

Commands accepted on stdin (one JSON object per line):
  {"cmd":"list_devices"}
  {"cmd":"update_config","config":{...}}
  {"cmd":"stop"}
"""
import sys
import os
import json
import time
import threading

import numpy as np

# ── Fix stdout/stderr encoding for Windows ────────────────────────────────────
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────────────────────────────────────
# IPC emit (stdout -- Electron reads this)
# ─────────────────────────────────────────────────────────────────────────────
_emit_lock = threading.Lock()

def emit(obj: dict):
    """Write one JSON event to stdout. Thread-safe."""
    with _emit_lock:
        try:
            print(json.dumps(obj, ensure_ascii=False), flush=True)
        except UnicodeEncodeError:
            print(json.dumps(obj, ensure_ascii=True), flush=True)
        except Exception as e:
            _log(f"emit error: {e}")


def _log(msg: str):
    """ASCII-safe diagnostic log to stderr."""
    try:
        print(f"[amma-ai] {msg}", file=sys.stderr, flush=True)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
_DEFAULT_CONFIG = {
    "name":              "Krishna",
    "aliases":           ["Krishna", "Krishnaa", "Krish"],
    "urgencyPhrases":    ["vaa", "come here", "hurry up", "get up"],
    "microphoneDeviceId":"default",
    "sensitivity":       50,
    "detectionMode":     "volume",
    "volumeThreshold":   35,
}

def load_config() -> dict:
    raw = os.environ.get("AMMA_CONFIG", "")
    if raw:
        try:
            user = json.loads(raw)
            cfg  = {**_DEFAULT_CONFIG, **user}
            _log(f"Config loaded: name={cfg['name']!r}  aliases={cfg['aliases']}")
            return cfg
        except Exception as e:
            _log(f"Config parse error: {e}")
    _log("Using default config")
    return dict(_DEFAULT_CONFIG)


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────
class AmmaService:

    def __init__(self, config: dict):
        self.config       = config
        self._mic         = None
        self._whisper_ok  = False
        self._running     = False
        self._call_count  = 0
        self._last_call_t = 0.0   # epoch seconds

    # ── Whisper setup ─────────────────────────────────────────────────────────
    def _load_whisper(self):
        try:
            from speech.speech_recognition import load_model
            ok = load_model("base")
            self._whisper_ok = ok
            _log(f"Whisper loaded: {ok}")
            # Push updated STATUS once whisper is done
            emit({"type": "STATUS",
                  "listening": self._running,
                  "whisper":   ok,
                  "device":    self.config.get("microphoneDeviceId", "default"),
                  "message":   "Whisper ready" if ok else "Whisper failed"})
        except Exception as e:
            _log(f"Whisper load error: {e}")
            self._whisper_ok = False

    # ── Volume callback (called from mic worker thread ~7x/sec) ──────────────
    def _on_volume(self, vol: int):
        emit({"type": "MIC_ACTIVITY", "volume": vol})

        mode = self.config.get("detectionMode", "volume")
        # ONLY trigger call events in 'volume' mode!
        # In 'keywords' and 'any_speech' modes, speech transcription (_on_chunk) strictly handles calls.
        if mode == "volume":
            thresh = int(self.config.get("volumeThreshold", 35))
            now = time.time()
            if vol >= thresh and (now - self._last_call_t) >= 1.5:
                gap_ms = int((now - self._last_call_t) * 1000) if self._last_call_t > 0 else None
                self._last_call_t = now
                self._call_count += 1
                _log(f"ACOUSTIC CALL #{self._call_count}: vol={vol} >= {thresh}")
                emit({
                    "type":           "CALL_DETECTED",
                    "transcript":     f"[Loud Sound: {vol}%]",
                    "nameDetected":   True,
                    "matchedAlias":   "Loud Calling",
                    "urgencyWords":   ["Loud Sound"] if vol >= 70 else [],
                    "loudness":       float(vol),
                    "callCount":      self._call_count,
                    "timeSinceLastMs":gap_ms,
                    "language":       "auto",
                })

    # ── Audio chunk callback (called from mic worker thread every 2s) ─────────
    def _on_chunk(self, audio: np.ndarray, rms: float):
        if not self._running:
            return

        from speech.keywords import rms_to_loudness_db
        loudness = rms_to_loudness_db(rms)

        # Skip Whisper transcription if audio is silent / quiet room noise
        if rms < 0.002 or loudness < 8:
            return

        if not self._whisper_ok:
            return

        # Prepare config values needed for detection
        name = str(self.config.get("name") or "Krishna").strip()
        aliases = [str(a).strip() for a in self.config.get("aliases") or [] if str(a).strip()]
        urgency_phrases = self.config.get("urgencyPhrases") or []
        mode = self.config.get("detectionMode", "volume")

        # Build clean keyword priming prompt for Whisper
        alias_str = ", ".join(aliases[:3]) if aliases else name
        initial_prompt = f"Calling {name}, {alias_str}. Amma calling, come here, get up."

        # Transcribe (auto-detects English or Malayalam, primed with user keywords)
        try:
            from speech.speech_recognition import transcribe
            sr = self._mic.sample_rate if self._mic else 16000
            result = transcribe(audio, sample_rate=sr, language=None, initial_prompt=initial_prompt)
        except Exception as e:
            _log(f"Transcription error: {e}")
            return

        text = (result.get("text") or "").strip()
        if not text:
            return

        import re
        # Discard hallucinated repetition loops (e.g. repeated single characters or looped vowels)
        if len(text) > 25:
            compact = re.sub(r"\s+", "", text)
            if len(set(compact)) < 6:
                _log(f"Filtered hallucination loop: {text[:30]}...")
                return

        _log(f"Transcript ({mode}): {text!r}")

        # Always emit raw transcript (feeds the debug panel)
        emit({
            "type":       "TRANSCRIPT",
            "transcript": text,
            "language":   result.get("language", "auto"),
            "confidence": result.get("confidence", 0.0),
        })

        # Ignore bogus transcripts that are just punctuation/noise
        clean_chars = re.sub(r"[^\w\u0D00-\u0D7F]", "", text)
        if len(clean_chars) < 2:
            return

        # Check if user's name or urgency phrases were called
        from speech.keywords import detect_name, detect_urgency
        name_res = detect_name(text, name, aliases)
        urgency = detect_urgency(text, urgency_phrases)

        should_trigger = False
        matched_alias = name_res.get("matchedAlias")

        if name_res.get("detected"):
            # Name detected — always trigger regardless of mode
            should_trigger = True
            _log(f"Name detected: {matched_alias!r} in {text!r}")
        elif urgency:
            # Urgency phrase detected — trigger in keywords mode too
            should_trigger = True
            if not matched_alias:
                matched_alias = urgency[0]
            _log(f"Urgency detected: {urgency} in {text!r}")
        elif mode == "any_speech":
            should_trigger = True
            if not matched_alias:
                matched_alias = "Voice Detected"
        # In 'keywords' mode: only name/urgency trigger calls (already handled above)
        # In 'volume' mode: only acoustic triggers from _on_volume (skip speech-based calls)

        if not should_trigger:
            return

        now = time.time()
        # Avoid double-triggering if call trigger fired within the last 0.6s
        if (now - self._last_call_t) < 0.6:
            return

        gap_ms = int((now - self._last_call_t) * 1000) if self._last_call_t > 0 else None
        self._last_call_t = now
        self._call_count += 1

        _log(f"CALL #{self._call_count} ({mode}): alias={matched_alias!r} "
             f"urgency={len(urgency)} loudness={loudness:.1f}")

        emit({
            "type":           "CALL_DETECTED",
            "transcript":     text,
            "nameDetected":   name_res.get("detected", False),
            "matchedAlias":   matched_alias,
            "urgencyWords":   urgency,
            "loudness":       round(loudness, 1),
            "callCount":      self._call_count,
            "timeSinceLastMs":gap_ms,
            "language":       result.get("language", "ml"),
        })

    # ── Mic error callback ─────────────────────────────────────────────────────
    def _on_mic_error(self, msg: str):
        _log(f"Mic error: {msg}")
        emit({"type": "MIC_ERROR", "message": msg})

    # ── Public: list and emit devices ─────────────────────────────────────────
    def list_devices(self):
        try:
            from microphone.microphone import list_devices
            devs = list_devices()
            emit({"type": "MIC_LIST", "devices": devs})
            _log(f"Listed {len(devs)} devices")
        except Exception as e:
            _log(f"list_devices error: {e}")

    # ── Internal mic management ───────────────────────────────────────────────
    def _start_mic(self):
        if self._mic:
            self._mic.stop()
            self._mic = None
        try:
            from microphone.microphone import MicrophoneStream
            self._mic = MicrophoneStream(
                device_id   = self.config.get("microphoneDeviceId", "default"),
                sample_rate = 16000,
                sensitivity = self.config.get("sensitivity", 50),
                on_chunk    = self._on_chunk,
                on_volume   = self._on_volume,
                on_error    = self._on_mic_error,
            )
            self._mic.start()
        except Exception as e:
            _log(f"Could not start microphone: {e}")
            self._on_mic_error(str(e))

    def _stop_mic(self):
        if self._mic:
            self._mic.stop()
            self._mic = None

    # ── Public: start ─────────────────────────────────────────────────────────
    def start(self):
        self._running = True

        # 1. Enumerate devices right away
        self.list_devices()

        # 2. Start Whisper load in background (non-blocking)
        threading.Thread(target=self._load_whisper, daemon=True, name="whisper-load").start()

        # 3. Open microphone if enabled
        mic_enabled = self.config.get("microphoneEnabled", True)
        if mic_enabled:
            self._start_mic()
        else:
            _log("Microphone is disabled in config.")

        # 4. Notify Electron: service status
        is_listening = self._mic is not None and getattr(self._mic, "_running", False)
        emit({
            "type":      "STATUS",
            "listening": is_listening,
            "whisper":   self._whisper_ok,
            "device":    self.config.get("microphoneDeviceId", "default"),
            "message":   "Microphone open. Loading Whisper..." if is_listening else "Microphone paused.",
        })

    # ── Public: stop ──────────────────────────────────────────────────────────
    def stop(self):
        self._running = False
        self._stop_mic()

    # ── Public: reset ─────────────────────────────────────────────────────────
    def reset(self):
        self._call_count = 0
        self._last_call_t = 0.0
        _log("Service reset: call count and timer cleared")

    # ── Public: hot-reload config ─────────────────────────────────────────────
    def update_config(self, new_cfg: dict):
        old_device      = self.config.get("microphoneDeviceId")
        old_enabled     = self.config.get("microphoneEnabled", True)
        old_sensitivity = self.config.get("sensitivity", 50)

        self.config = {**self.config, **new_cfg}

        new_device      = self.config.get("microphoneDeviceId")
        new_enabled     = self.config.get("microphoneEnabled", True)
        new_sensitivity = self.config.get("sensitivity", 50)

        _log(f"Config updated: name={self.config.get('name')!r} mode={self.config.get('detectionMode')} volThreshold={self.config.get('volumeThreshold')} mic_enabled={new_enabled}")

        if not new_enabled:
            if self._mic:
                _log("Disabling microphone stream")
                self._stop_mic()
            emit({
                "type":      "STATUS",
                "listening": False,
                "whisper":   self._whisper_ok,
                "device":    new_device,
                "message":   "Microphone disabled in settings.",
            })
        else:
            if not old_enabled or old_device != new_device or self._mic is None:
                _log(f"Starting mic: device={new_device!r} sensitivity={new_sensitivity}")
                self._start_mic()
            elif old_sensitivity != new_sensitivity and self._mic:
                self._mic.sensitivity = max(10, min(100, int(new_sensitivity)))

            is_listening = self._mic is not None and getattr(self._mic, "_running", False)
            emit({
                "type":      "STATUS",
                "listening": is_listening,
                "whisper":   self._whisper_ok,
                "device":    new_device,
                "message":   "Microphone open." if is_listening else "Microphone starting...",
            })


# ─────────────────────────────────────────────────────────────────────────────
# Stdin listener (commands from Electron)
# ─────────────────────────────────────────────────────────────────────────────
def _stdin_loop(svc: AmmaService):
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            _log(f"Bad stdin JSON: {raw!r}")
            continue

        cmd = msg.get("cmd", "")
        _log(f"stdin cmd: {cmd!r}")

        if cmd == "list_devices":
            svc.list_devices()
        elif cmd == "update_config":
            svc.update_config(msg.get("config", {}))
        elif cmd == "reset":
            svc.reset()
        elif cmd == "stop":
            svc.stop()
            os._exit(0)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    _log(f"Python {sys.version.split()[0]}  pid={os.getpid()}")
    _log(f"cwd={os.getcwd()}")

    # Dependency check
    missing = []
    for pkg in ("sounddevice", "numpy", "faster_whisper"):
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        emit({"type": "ERROR",
              "message": f"Missing packages: {missing}. Run: pip install sounddevice numpy faster-whisper"})
        sys.exit(1)

    config  = load_config()
    service = AmmaService(config)

    # Stdin listener (non-blocking)
    t = threading.Thread(target=_stdin_loop, args=(service,), daemon=True, name="stdin")
    t.start()

    # Start service
    service.start()

    # Keep process alive while running
    try:
        while service._running:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        service.stop()
        _log("Service stopped")
