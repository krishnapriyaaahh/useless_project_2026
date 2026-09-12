# -*- coding: utf-8 -*-
"""
Intensity calculation — mirrors the JS logic in desktop/src/utils/intensity.js
so Python can also compute/pre-score events before sending to Electron.
The authoritative score lives in the React state; this is a helper only.
"""
import time
from dataclasses import dataclass, field


@dataclass
class IntensityState:
    intensity: float = 0.0
    call_count: int = 0
    last_call_time: float = 0.0   # epoch seconds


# Scoring weights (mirror JS constants.js)
PER_CALL            = 15
MAX_LOUDNESS_BONUS  = 20
MAX_RAPID_BONUS     = 20
MAX_URGENCY_BONUS   = 20
MAX_ESCALATION_BONUS= 25


def calculate(state: IntensityState, loudness: float, urgency_count: int) -> float:
    """
    Calculate a new intensity score given an incoming call event.
    Returns the new intensity (0–100).
    This is informational — the JS engine in React is the source of truth.
    """
    now = time.time()
    delta = 0.0

    # 1. Base per call
    delta += PER_CALL

    # 2. Loudness bonus
    delta += (min(max(loudness, 0), 100) / 100) * MAX_LOUDNESS_BONUS

    # 3. Rapid repetition bonus
    if state.last_call_time > 0:
        gap_ms = (now - state.last_call_time) * 1000
        if gap_ms < 3000:
            delta += MAX_RAPID_BONUS
        elif gap_ms < 10000:
            fraction = 1 - (gap_ms - 3000) / 7000
            delta += fraction * MAX_RAPID_BONUS

    # 4. Urgency bonus
    if urgency_count > 0:
        delta += min(urgency_count / 3, 1.0) * MAX_URGENCY_BONUS

    # 5. Escalation bonus
    count = state.call_count + 1
    if count >= 5:
        delta += MAX_ESCALATION_BONUS
    elif count >= 3:
        delta += MAX_ESCALATION_BONUS * 0.6
    elif count >= 2:
        delta += MAX_ESCALATION_BONUS * 0.3

    new_intensity = min(state.intensity + delta, 100.0)
    return round(new_intensity, 1)
