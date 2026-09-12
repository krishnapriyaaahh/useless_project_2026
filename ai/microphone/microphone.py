"""
Microphone capture for Amma Radar.

Architecture:
  sounddevice callback -> audio queue (NEVER prints, NEVER blocks)
  MicrophoneStream.read_loop() runs in a worker thread, consumes the queue,
  fires on_volume() and on_chunk() callbacks safely off the audio thread.

Works on Windows with Realtek, USB, Bluetooth, and WASAPI devices.
All output to stderr is plain ASCII so it survives any Windows console encoding.
"""
import sys
import queue
import threading
import time

import numpy as np
import sounddevice as sd


# ─────────────────────────────────────────────────────────────────────────────
# Device helpers
# ─────────────────────────────────────────────────────────────────────────────

def list_devices():
    """Return deduplicated list of Windows input devices."""
    try:
        all_dev  = sd.query_devices()
        hostapis = sd.query_hostapis()
    except Exception as e:
        print(f"[mic] list_devices error: {e}", file=sys.stderr)
        return []

    result   = []
    seen     = set()

    for i, d in enumerate(all_dev):
        if d["max_input_channels"] <= 0:
            continue
        name = d["name"].strip()
        # Keep first occurrence of each name (avoids MME/DS/WASAPI triplicates)
        if name in seen:
            continue
        seen.add(name)
        ha_idx = d.get("hostapi", 0)
        ha = hostapis[ha_idx]["name"] if 0 <= ha_idx < len(hostapis) else "Unknown"
        result.append({
            "id":                str(i),
            "name":              name,
            "hostApi":           ha,
            "channels":          d["max_input_channels"],
            "defaultSampleRate": int(d["default_samplerate"]),
        })

    return result


def find_device_index(device_id):
    """
    Resolve a device_id string or int to a sounddevice device index.
    Returns None for 'default' (lets sounddevice pick system default).
    """
    if not device_id or str(device_id).lower() in ("default", "none"):
        return None

    try:
        devs = sd.query_devices()
    except Exception:
        return None

    # Numeric string or int e.g. "1" or 1
    try:
        idx = int(device_id)
        if 0 <= idx < len(devs) and devs[idx]["max_input_channels"] > 0:
            return idx
    except (ValueError, TypeError):
        pass

    # Substring search by device name among valid input devices
    search_str = str(device_id).lower()
    for i, d in enumerate(devs):
        if d["max_input_channels"] > 0 and search_str in d["name"].lower():
            return i

    return None


def get_device_native_sr(device_index):
    """Return the device's reported default sample rate."""
    try:
        if device_index is None:
            idx = sd.default.device[0]
        else:
            idx = device_index
        if idx is None or idx < 0:
            return 44100
        return int(sd.query_devices(idx)["default_samplerate"])
    except Exception:
        return 44100


def probe_sample_rate(device_index, target_sr):
    """
    Return target_sr if the device supports it, otherwise the native SR.
    Does a brief open/close to check.
    """
    try:
        s = sd.InputStream(samplerate=target_sr, channels=1,
                           dtype="float32", device=device_index)
        s.start(); s.stop(); s.close()
        return target_sr
    except Exception:
        return get_device_native_sr(device_index)


# ─────────────────────────────────────────────────────────────────────────────
# MicrophoneStream
# ─────────────────────────────────────────────────────────────────────────────

class MicrophoneStream:
    """
    Continuous microphone stream with queue-based audio delivery.

    Callbacks (all called from the read_loop worker thread, not the audio thread):
      on_volume(int 0-100)         -- called every VOLUME_INTERVAL_S seconds
      on_chunk(np.ndarray, float)  -- called every SPEECH_CHUNK_S seconds
                                      args: (audio_float32_mono, rms)
      on_error(str)                -- called if stream fails to open
    """

    SPEECH_CHUNK_S    = 2.0   # seconds of audio sent to Whisper per chunk (low latency)
    SPEECH_OVERLAP_S  = 0.8   # seconds retained in buffer for smooth word boundary overlap
    VOLUME_INTERVAL_S = 0.12  # seconds between volume/activity events

    def __init__(self,
                 device_id   = "default",
                 sample_rate = 16000,
                 sensitivity = 50,
                 on_chunk    = None,
                 on_volume   = None,
                 on_error    = None):

        self.device_index = find_device_index(device_id)
        self.sensitivity  = max(10, min(100, int(sensitivity)))
        self.on_chunk     = on_chunk  or (lambda a, r: None)
        self.on_volume    = on_volume or (lambda v:    None)
        self.on_error     = on_error  or (lambda e:    None)

        # Probe the actual usable sample rate for this device
        self.sample_rate = probe_sample_rate(self.device_index, sample_rate)

        self._q             = queue.Queue(maxsize=500)
        self._speech_q      = queue.Queue(maxsize=2)
        self._stream        = None
        self._running       = False
        self._thread        = None
        self._speech_thread = None

    # ── sounddevice audio callback ────────────────────────────────────────────
    # CRITICAL RULES for this function:
    #   - No print()
    #   - No locks that could block
    #   - No Unicode
    #   - No heavy computation
    #   - Put data in queue and return immediately
    def _sd_callback(self, indata, frames, time_info, status):
        if not self._q.full():
            self._q.put_nowait(indata[:, 0].copy())  # mono float32

    # ── Background speech worker: processes heavy Whisper transcribe off the audio loop ──
    def _speech_worker(self):
        while self._running:
            try:
                item = self._speech_q.get(timeout=0.2)
            except queue.Empty:
                continue
            if not self._running:
                break
            audio, rms = item
            try:
                self.on_chunk(audio, rms)
            except Exception as e:
                print(f"[mic] on_chunk error: {e}", file=sys.stderr)

    # ── Worker thread: consumes queue, fires volume callbacks at 10Hz without delay ──────
    def _read_loop(self):
        speech_buf      = []
        speech_target   = int(self.sample_rate * self.SPEECH_CHUNK_S)
        overlap_samples = int(self.sample_rate * self.SPEECH_OVERLAP_S)

        vol_buf       = []
        vol_target    = int(self.sample_rate * self.VOLUME_INTERVAL_S)

        while self._running:
            # Drain up to 25 chunks per iteration to stay responsive
            drained = 0
            while drained < 25:
                try:
                    chunk = self._q.get_nowait()
                except queue.Empty:
                    break
                drained += 1

                # --- Volume event (non-blocking) ---
                vol_buf.append(chunk)
                vol_samples = sum(len(c) for c in vol_buf)
                if vol_samples >= vol_target:
                    audio = np.concatenate(vol_buf)
                    vol_buf = []
                    rms = float(np.sqrt(np.mean(audio ** 2)))
                    scale = (self.sensitivity / 50.0) * 800.0
                    vol_0_100 = min(100, int(rms * scale))
                    try:
                        self.on_volume(vol_0_100)
                    except Exception as e:
                        print(f"[mic] on_volume error: {e}", file=sys.stderr)

                # --- Speech chunk with sliding window ---
                speech_buf.append(chunk)
                speech_samples = sum(len(c) for c in speech_buf)
                if speech_samples >= speech_target:
                    audio = np.concatenate(speech_buf)
                    # Keep overlap samples so words across boundaries aren't split
                    speech_buf = [audio[-overlap_samples:].copy()] if overlap_samples > 0 else []
                    rms = float(np.sqrt(np.mean(audio ** 2)))
                    # Voice gate: only send to Whisper if audio has audible energy (not background silence)
                    if rms >= 0.002:
                        try:
                            if self._speech_q.full():
                                try:
                                    self._speech_q.get_nowait()
                                except queue.Empty:
                                    pass
                            self._speech_q.put_nowait((audio, rms))
                        except Exception as e:
                            print(f"[mic] speech queue put error: {e}", file=sys.stderr)

            if drained == 0:
                time.sleep(0.015)   # nothing in queue; brief yield

    # ── Public API ────────────────────────────────────────────────────────────
    def start(self):
        if self._running:
            return

        # Resolve device name for logging
        try:
            if self.device_index is not None:
                dev_name = sd.query_devices(self.device_index)["name"]
            else:
                default_idx = sd.default.device[0]
                dev_name = sd.query_devices(default_idx)["name"] if default_idx >= 0 else "system default"
        except Exception:
            dev_name = "unknown"

        print(f"[mic] Opening: {dev_name!r} @ {self.sample_rate}Hz mono", file=sys.stderr)

        try:
            self._stream = sd.InputStream(
                device    = self.device_index,
                samplerate= self.sample_rate,
                channels  = 1,
                dtype     = "float32",
                blocksize = int(self.sample_rate * 0.05),  # 50ms blocks
                callback  = self._sd_callback,
            )
            self._stream.start()
            self._running = True
            print(f"[mic] Stream open: {dev_name!r}", file=sys.stderr)
        except Exception as e:
            print(f"[mic] Failed to open stream: {e}", file=sys.stderr)
            self.on_error(str(e))
            return

        # Start worker threads
        self._thread = threading.Thread(target=self._read_loop, daemon=True, name="mic-reader")
        self._thread.start()
        self._speech_thread = threading.Thread(target=self._speech_worker, daemon=True, name="mic-speech")
        self._speech_thread.start()

    def stop(self):
        self._running = False
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        if self._thread:
            self._thread.join(timeout=1)
            self._thread = None
        if self._speech_thread:
            self._speech_thread.join(timeout=1)
            self._speech_thread = None
