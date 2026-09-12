# -*- coding: utf-8 -*-
"""Quick import and device list test — exits immediately."""
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

print("[test] Python", sys.version, file=sys.stderr)

# Test sounddevice
try:
    import sounddevice as sd
    import numpy as np
    print("[OK] sounddevice", sd.__version__, file=sys.stderr)

    # List devices and emit as JSON
    from microphone.microphone import list_devices
    devices = list_devices()
    print(json.dumps({"type": "MIC_LIST", "devices": devices}, ensure_ascii=False))
    print(f"[OK] Found {len(devices)} input devices", file=sys.stderr)
    for d in devices:
        print(f"     [{d['id']}] {d['name']} ({d['hostApi']})", file=sys.stderr)

except Exception as e:
    print(f"[FAIL] {e}", file=sys.stderr)
    import traceback; traceback.print_exc(file=sys.stderr)

# Test faster-whisper import
try:
    import faster_whisper
    print("[OK] faster_whisper available", file=sys.stderr)
except ImportError:
    print("[WARN] faster_whisper not available", file=sys.stderr)

print(json.dumps({"type": "STATUS", "listening": False, "message": "import test complete"}))
print("[test] Done", file=sys.stderr)
