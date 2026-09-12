"""
Standalone microphone test — run this directly to verify audio capture works.
Usage: python test_mic.py
"""
import sys
import numpy as np

print("=== AMMA RADAR MICROPHONE TEST ===\n")

# ── Check sounddevice ─────────────────────────────────────────────────────────
try:
    import sounddevice as sd
    print(f"[OK] sounddevice {sd.__version__}")
except ImportError as e:
    print(f"[FAIL] sounddevice not installed: {e}")
    print("  Fix: pip install sounddevice")
    sys.exit(1)

# ── Check numpy ───────────────────────────────────────────────────────────────
try:
    import numpy as np
    print(f"[OK] numpy {np.__version__}")
except ImportError as e:
    print(f"[FAIL] numpy not installed: {e}")
    sys.exit(1)

# ── List all input devices ────────────────────────────────────────────────────
print("\n=== INPUT DEVICES ===\n")
devices = sd.query_devices()
hostapis = sd.query_hostapis()
input_devices = []

for i, d in enumerate(devices):
    if d["max_input_channels"] > 0:
        ha = hostapis[d["hostapi"]]["name"]
        input_devices.append((i, d))
        print(f"  [{i:2d}] {d['name']}")
        print(f"        Host API : {ha}")
        print(f"        Channels : {d['max_input_channels']}")
        print(f"        Default SR: {int(d['default_samplerate'])} Hz")
        print()

if not input_devices:
    print("  [FAIL] No input devices found!")
    sys.exit(1)

print(f"Total input devices: {len(input_devices)}")

# ── Default device ────────────────────────────────────────────────────────────
default_in = sd.default.device[0]
print(f"\nDefault input device index: {default_in}")
if default_in is not None and default_in >= 0:
    print(f"Default input device name : {devices[default_in]['name']}")
else:
    print("Default input device      : not set / will use system default")

# ── Audio capture test ────────────────────────────────────────────────────────
print("\n=== AUDIO CAPTURE TEST (2 seconds, please make some noise) ===\n")
SAMPLE_RATE = 16000
DURATION    = 2.0

try:
    print("Recording…")
    audio = sd.rec(
        int(DURATION * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        device=None,   # uses system default
    )
    sd.wait()
    audio = audio.flatten()

    rms  = float(np.sqrt(np.mean(audio ** 2)))
    peak = float(np.max(np.abs(audio)))

    print(f"  Samples  : {len(audio)}")
    print(f"  RMS      : {rms:.6f}")
    print(f"  Peak     : {peak:.6f}")

    if rms < 0.0001:
        print("\n  [WARN] RMS is near zero.")
        print("  Possible causes:")
        print("    - Microphone is muted in Windows sound settings")
        print("    - Wrong default device selected")
        print("    - No sound was made during the test")
    else:
        print(f"\n  [OK] Audio capture working. RMS={rms:.4f}")

except Exception as e:
    print(f"\n  [FAIL] Audio capture failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# ── Stream test (live RMS for 5 seconds) ─────────────────────────────────────
print("\n=== LIVE STREAM TEST (5 seconds, speak into microphone) ===\n")

chunk_count = [0]
max_rms     = [0.0]

def audio_callback(indata, frames, time_info, status):
    if status:
        print(f"  [stream status] {status}", file=sys.stderr)
    rms = float(np.sqrt(np.mean(indata ** 2)))
    chunk_count[0] += 1
    if rms > max_rms[0]:
        max_rms[0] = rms
    bar = int(rms * 500)
    bar = min(bar, 20)
    filled  = "█" * bar
    empty   = "░" * (20 - bar)
    print(f"\r  Chunk {chunk_count[0]:3d}  RMS: {rms:.4f}  [{filled}{empty}]", end="", flush=True)

try:
    import time
    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocksize=4096,
        callback=audio_callback,
    ):
        time.sleep(5)

    print(f"\n\n  [OK] Stream test complete.")
    print(f"  Chunks received : {chunk_count[0]}")
    print(f"  Peak RMS        : {max_rms[0]:.6f}")
    if max_rms[0] < 0.001:
        print("  [WARN] No significant audio detected. Check microphone.")
    else:
        print("  [OK] Microphone is receiving audio.")

except Exception as e:
    print(f"\n  [FAIL] Stream test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n=== TEST COMPLETE ===")
