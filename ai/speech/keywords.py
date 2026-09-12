# -*- coding: utf-8 -*-
"""
Personalized name and urgency detection.
Works with Malayalam Unicode, Manglish, English, and mixed transcripts.
Includes phonetic variants, vocatives, and fuzzy matching.
"""
import re
import unicodedata
import difflib

# # Common name phonetic mappings between English, Manglish & Malayalam
COMMON_NAME_VARIANTS = {
    "krishna": ["krishna", "krishnaa", "krish", "krrishna", "കൃഷ്ണ", "കൃഷ്ണാ", "ക്രിഷ്ണ", "കൃഷ്ണൻ", "കൃഷ്ണേ"],
    "johny":   ["johny", "johnny", "jonny", "jony", "joni", "john", "ജോണി", "ജോണീ"],
    "johnny":  ["johny", "johnny", "jonny", "jony", "joni", "john", "ജോണി", "ജോണീ"],
    "rahul":   ["rahul", "raahul", "രാഹുൽ", "രാഹുലേ"],
    "amal":    ["amal", "അമൽ", "അമലേ"],
    "manu":    ["manu", "മനു", "മനൂ"],
    "arun":    ["arun", "അരുൺ", "അരുണേ"],
    "appu":    ["appu", "അപ്പു", "അപ്പൂ"],
    "kannan":  ["kannan", "കണ്ണൻ", "കണ്ണാ"],
    "mone":    ["mone", "mwone", "mwonu", "monu", "മോനേ", "മോനെ", "മോനു"],
}

BUILTIN_URGENCY = [
    # Malayalam Unicode
    "വാ", "ഇങ്ങോട്ട് വാ", "ഇവിടെ വാ", "വേഗം വാ", "ഇപ്പോ വാ", "ഇപ്പോൾ വാ", "വേഗം",
    "എവിടെയാ", "കേൾക്കുന്നുണ്ടോ", "കേൾക്കുന്നില്ലേ", "ഒന്ന് വാ", "എണീക്ക്", "വന്നേ",
    "മോനെ", "മോനേ", "എടാ", "അമ്മ",
    # Manglish
    "vaa", "ingottu vaa", "ivide vaa", "vegam vaa", "vegam", "evideya",
    "kelkkunnundo", "kelkkunnille", "onnu vaa", "eneekku", "vanne", "ippo vaa",
    "mone", "mwone", "eda", "amma", "chappal",
    # English
    "come here", "hurry up", "get up", "come now", "listen", "where are you",
    "quickly", "fast", "calling you", "hurry", "quick", "come"
]


def normalize(text: str) -> str:
    """
    Normalize a string for loose matching:
    - lowercase
    - NFC unicode normalization
    - strip punctuation (keep Malayalam Unicode range U+0D00–U+0D7F and alphanumeric)
    - collapse whitespace
    - collapse repeated vowels beyond 2 (krishnaaa → krishnaa)
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    # Remove punctuation except Malayalam characters and alphanumeric
    text = re.sub(r"[^\w\s\u0D00-\u0D7F]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Collapse triple+ repeated vowels: "aaaa" → "aa"
    text = re.sub(r"([aeiouaeioùáéíóú])\1{2,}", r"\1\1", text)
    return text


def phonetic_skeleton(text: str) -> str:
    """
    Produce a phonetic skeleton for resilient matching across English/Manglish/Malayalam transliterations:
    - drops silent or aspirated 'h' (johnny -> jonny, johny -> jony)
    - normalizes common vowel spellings (ee/y/ie -> i, oo/ou -> u, ph -> f)
    - deduplicates consecutive letters
    """
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r"[^\w\u0D00-\u0D7F]", "", t)
    # Roman phonetic normalization
    t = t.replace("ph", "f").replace("ee", "i").replace("oo", "u").replace("ou", "u")
    t = t.replace("y", "i").replace("ie", "i")
    t = t.replace("h", "")
    t = re.sub(r"(.)\1+", r"\1", t)
    return t


def expand_candidates(primary_name: str, aliases: list) -> list:
    """Expand primary name and aliases with phonetic and Malayalam equivalents."""
    all_raw = [primary_name] + (aliases or [])
    expanded = set()
    for raw in all_raw:
        if not raw or not str(raw).strip():
            continue
        clean = str(raw).strip()
        expanded.add(clean)
        clean_lower = clean.lower()
        if clean_lower in COMMON_NAME_VARIANTS:
            for var in COMMON_NAME_VARIANTS[clean_lower]:
                expanded.add(var)
    return list(expanded)


def detect_name(transcript: str, primary_name: str, aliases: list) -> dict:
    """
    Check whether the user's name (or any alias/phonetic variant) appears in transcript.
    Uses direct substring, vowel-collapse, vocative prefix/suffix, phonetic skeleton, and fuzzy matching.
    """
    if not transcript:
        return {"detected": False, "matchedAlias": None}

    norm_transcript = normalize(transcript)
    if not norm_transcript:
        return {"detected": False, "matchedAlias": None}

    collapsed_transcript = re.sub(r"([aeiou])\1+", r"\1", norm_transcript)
    words = norm_transcript.split()
    skel_words = [phonetic_skeleton(w) for w in words]

    candidates = expand_candidates(primary_name, aliases)

    for candidate in candidates:
        norm_candidate = normalize(candidate)
        if not norm_candidate:
            continue

        # 1. Direct normalized match
        if norm_candidate in norm_transcript:
            return {"detected": True, "matchedAlias": candidate}

        # 2. Vowel-collapsed match ("Krishnaaa" → "Krishna")
        collapsed_candidate = re.sub(r"([aeiou])\1+", r"\1", norm_candidate)
        if collapsed_candidate and collapsed_candidate in collapsed_transcript:
            return {"detected": True, "matchedAlias": candidate}

        # 3. Word-boundary regex check
        pattern = r"\b" + re.escape(norm_candidate) + r"\b"
        if re.search(pattern, norm_transcript):
            return {"detected": True, "matchedAlias": candidate}

        # 4. Phonetic skeleton match (e.g. "johny" matches "Johnny", "Joni", "Jony")
        skel_cand = phonetic_skeleton(norm_candidate)
        if len(skel_cand) >= 3:
            for sw in skel_words:
                if sw == skel_cand or (len(sw) >= 3 and sw.startswith(skel_cand)):
                    return {"detected": True, "matchedAlias": candidate}

        # 5. Word-level fuzzy similarity (e.g. "johny" vs "johnny" or "krishna" vs "krishnan")
        for w in words:
            if len(w) >= 3 and len(norm_candidate) >= 3:
                # Vocative stem/prefix match
                if w.startswith(norm_candidate) or norm_candidate.startswith(w):
                    if abs(len(w) - len(norm_candidate)) <= 2:
                        return {"detected": True, "matchedAlias": candidate}
                # SequenceMatcher similarity
                ratio = difflib.SequenceMatcher(None, w, norm_candidate).ratio()
                if ratio >= 0.75:
                    return {"detected": True, "matchedAlias": candidate}

    return {"detected": False, "matchedAlias": None}


def detect_urgency(transcript: str, urgency_phrases: list) -> list:
    """
    Find which urgency phrases appear in the transcript.
    Handles Malayalam Unicode, Manglish, and English phrases.
    """
    if not transcript:
        return []

    norm_transcript = normalize(transcript)
    if not norm_transcript:
        return []

    all_phrases = list(dict.fromkeys((urgency_phrases or []) + BUILTIN_URGENCY))
    matched = []

    for phrase in all_phrases:
        if not phrase or not str(phrase).strip():
            continue
        norm_phrase = normalize(phrase)
        if not norm_phrase:
            continue
        # Direct normalized match
        if norm_phrase in norm_transcript:
            matched.append(phrase)
        elif len(norm_phrase.split()) == 1 and len(norm_phrase) >= 4:
            if re.search(r"\b" + re.escape(norm_phrase) + r"\b", norm_transcript):
                matched.append(phrase)

    # Deduplicate while preserving order
    seen = set()
    result = []
    for p in matched:
        if p not in seen:
            seen.add(p)
            result.append(p)
    return result


def rms_to_loudness_db(rms: float) -> float:
    """
    Convert RMS amplitude (0.0–1.0 float32) to a 0–100 loudness score.
    Calibrated for typical speech: RMS ~0.01 = quiet, ~0.2 = loud.
    """
    import math
    if rms <= 0:
        return 0.0
    db = 20 * math.log10(max(rms, 1e-9))
    normalized = (db + 50) / 40.0   # -50→0, -10→1
    return max(0.0, min(100.0, normalized * 100))

