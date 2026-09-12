"""
Amma Radar -- Raw Microphone Test
Run: py test_microphone.py  OR  python test_microphone.py

Tests ONLY raw audio capture. No Whisper. No UI. No Electron.
All output is plain ASCII so it works on any Windows console.
Runs for ~10 seconds then prints PASS or FAIL.
"""
import sys
import time
import queue
import threading

# ── Verify Python ─────────────────────────────────────────────────────────────
print("=== MICROPHONE TEST ===")
print("Python:", sys.version.split()[0])

# ── Verify sounddevice ────────────────────────────────────────────────────────
try:
    import sounddevice as sd
    import numpy as np
    print("sounddevice:", sd.__version__)
except ImportError as e:
    print("FAIL: sounddevice not installed --", e)
    print("Fix:  pip install sounddevice")
    sys.exit(1)

# ── List input devices ────────────────────────────────────────────────────────
print()
print("Input devices:")
all_devices = sd.query_devices()
input_devs = [(i, d) for i, d in enumerate(all_devices) if d["max_input_channels"] > 0]

if not input_devs:
    print("FAIL: no input devices found")
    sys.exit(1)

for idx, d in input_devs:
    marker = " <-- default" if idx == sd.default.device[0] else ""
    print(f"  [{idx:2d}] {d['name']}  (SR:{int(d['default_samplerate'])} CH:{d['max_input_channels']}){marker}")

default_idx = sd.default.device[0]
default_name = all_devices[default_idx]["name"] if default_idx >= 0 else "unknown"
native_sr    = int(all_devices[default_idx]["default_samplerate"]) if default_idx >= 0 else 44100
print()
print("Default input:", default_name)
print("Native SR:    ", native_sr)

# ── Determine usable sample rate ──────────────────────────────────────────────
# Prefer 16000 Hz for speech; fall back to device native SR
TARGET_SR = 16000
try:
    # Quick probe -- open briefly at 16000 Hz
    probe = sd.InputStream(samplerate=TARGET_SR, channels=1, dtype="float32", device=None)
    probe.start()
    probe.stop()
    probe.close()
    USE_SR = TARGET_SR
    print("Sample rate:   16000 Hz (speech-optimal)")
except Exception:
    USE_SR = native_sr
    print(f"Sample rate:   {USE_SR} Hz (device native, 16kHz unsupported)")

# ── Audio queue (callback -> main thread, NO printing in callback) ────────────
audio_q = queue.Queue(maxsize=200)

def audio_callback(indata, frames, time_info, status):
    # NEVER print here. NEVER use Unicode here.
    # Just copy audio data into the queue and return immediately.
    if not audio_q.full():
        audio_q.put_nowait(indata[:, 0].copy())

# ── Start stream ──────────────────────────────────────────────────────────────
print()
print("Starting stream...")
try:
    stream = sd.InputStream(
        samplerate=USE_SR,
        channels=1,
        dtype="float32",
        blocksize=int(USE_SR * 0.05),   # 50ms blocks
        callback=audio_callback,
        device=None,                     # use system default
    )
    stream.start()
    print("Stream started OK")
except Exception as e:
    print("FAIL: stream start failed --", e)
    sys.exit(1)

# ── Read audio for 10 seconds, print RMS every 500ms ─────────────────────────
print()
print("Listening for 10 seconds -- speak into your microphone:")
print("(RMS should increase when you speak)")
print()

TEST_DURATION = 10.0
REPORT_EVERY  = 0.5     # seconds

t_start      = time.monotonic()
acc_buf      = []
last_report  = t_start
chunks_total = 0
max_rms      = 0.0
nonzero      = 0

while True:
    now = time.monotonic()
    if now - t_start >= TEST_DURATION:
        break

    # Drain queue
    drained = 0
    while not audio_q.empty() and drained < 50:
        try:
            chunk = audio_q.get_nowait()
            acc_buf.append(chunk)
            chunks_total += 1
            drained += 1
        except queue.Empty:
            break

    # Report every 500ms
    if now - last_report >= REPORT_EVERY and acc_buf:
        audio = np.concatenate(acc_buf)
        acc_buf = []
        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms > max_rms:
            max_rms = rms
        if rms > 0.001:
            nonzero += 1
        bar_len  = min(int(rms * 400), 30)
        bar      = "#" * bar_len + "." * (30 - bar_len)
        elapsed  = now - t_start
        print(f"  t={elapsed:5.1f}s  RMS={rms:.6f}  [{bar}]")
        last_report = now
    else:
        time.sleep(0.01)

stream.stop()
stream.close()

# ── Results ───────────────────────────────────────────────────────────────────
print()
print("--- Results ---")
print(f"  Chunks received : {chunks_total}")
print(f"  Peak RMS        : {max_rms:.6f}")
print(f"  Non-zero frames : {nonzero}")
print()

if chunks_total == 0:
    print("STREAM TEST: FAIL -- no audio chunks received")
    sys.exit(1)
elif max_rms < 0.0001:
    print("STREAM TEST: WARN -- audio received but RMS near zero")
    print("  Check: microphone not muted? correct device selected?")
    sys.exit(0)
else:
    print("STREAM TEST: PASS")
    sys.exit(0)
