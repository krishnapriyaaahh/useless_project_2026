# -*- coding: utf-8 -*-
"""
Speech recognition using faster-whisper.
Loads the model once and exposes a transcribe() function.
Supports Malayalam (ml) with automatic English/Manglish fallthrough.
"""
import sys
import os
import numpy as np

# ── Suppress noisy TF/torch warnings on stderr ────────────────────────────────
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

_model = None
_model_size = "base"      # base = good quality + reasonable speed
_language = "ml"          # Malayalam; faster-whisper will still accept code-switched English


def load_model(model_size: str = "base") -> bool:
    """
    Load the Whisper model (downloads on first run, cached afterward).
    Returns True on success, False on failure.
    """
    global _model, _model_size

    try:
        from faster_whisper import WhisperModel
        print(f"[whisper] Loading model '{model_size}'...", file=sys.stderr, flush=True)
        # Use int8 compute type with 4 CPU threads for fast real-time inference
        _model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
            download_root=os.path.join(os.path.dirname(__file__), "..", ".model_cache"),
        )
        _model_size = model_size
        print(f"[whisper] Model '{model_size}' loaded (4 threads, int8).", file=sys.stderr, flush=True)
        return True

    except ImportError:
        print("[whisper] faster_whisper not installed. Run: pip install faster-whisper", file=sys.stderr, flush=True)
        return False

    except Exception as e:
        print(f"[whisper] Failed to load model: {e}", file=sys.stderr, flush=True)
        return False


def transcribe(audio: np.ndarray, sample_rate: int = 16000, language: str = None, initial_prompt: str = None) -> dict:
    """
    Transcribe a numpy float32 audio array.
    If language is None, Whisper auto-detects language (English, Malayalam, Manglish).
    """
    global _model

    if _model is None:
        return {"text": "", "language": language or "unknown", "confidence": 0.0, "segments": []}

    # Ensure float32 mono, normalized
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    if audio.ndim > 1:
        audio = audio[:, 0]  # take first channel

    # Resample to 16kHz if needed (faster-whisper expects 16kHz)
    if sample_rate != 16000:
        audio = _resample(audio, sample_rate, 16000)

    # Only scale down if audio exceeds [-1, 1] to prevent clipping; NEVER amplify quiet noise
    max_val = float(np.max(np.abs(audio)))
    if max_val > 1.0:
        audio = audio / max_val

    try:
        # Fast greedy decoding (beam_size=1) with Silero VAD for low-latency live speech
        # condition_on_previous_text=False prevents infinite repetition loops
        kwargs = {
            "beam_size": 1,
            "best_of": 1,
            "vad_filter": True,
            "vad_parameters": dict(min_silence_duration_ms=250),
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.5,
            "compression_ratio_threshold": 2.4,
            "word_timestamps": False,
        }
        if language:
            kwargs["language"] = language
        if initial_prompt:
            kwargs["initial_prompt"] = initial_prompt

        segments_iter, info = _model.transcribe(audio, **kwargs)

        segments = []
        full_text_parts = []
        avg_log_prob = 0.0

        for seg in segments_iter:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })
            full_text_parts.append(seg.text.strip())
            avg_log_prob += seg.avg_logprob

        if segments:
            avg_log_prob /= len(segments)

        full_text = " ".join(p for p in full_text_parts if p).strip()
        # Convert log-prob to 0-1 confidence (log_prob is typically -1 to 0)
        confidence = float(np.exp(avg_log_prob)) if segments else 0.0

        return {
            "text": full_text,
            "language": info.language,
            "confidence": round(confidence, 3),
            "segments": segments,
        }

    except Exception as e:
        print(f"[whisper] Transcription error: {e}", file=sys.stderr, flush=True)
        return {"text": "", "language": language, "confidence": 0.0, "segments": []}


def _resample(audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Simple linear resampling when scipy is not available."""
    try:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(target_sr, orig_sr)
        return resample_poly(audio, target_sr // g, orig_sr // g).astype(np.float32)
    except ImportError:
        # Fallback: numpy interpolation
        duration = len(audio) / orig_sr
        target_len = int(duration * target_sr)
        indices = np.linspace(0, len(audio) - 1, target_len)
        return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)
