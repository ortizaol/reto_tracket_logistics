"""Groups classified items that likely report the same disruption event.

Simple similarity: normalized-token Jaccard overlap OR difflib ratio > 0.6.
No embeddings, no ML - greedy clustering is enough at this volume.
"""
import difflib
import re

STOPWORDS = {
    "a", "al", "de", "del", "la", "el", "los", "las", "en", "y", "o", "que",
    "un", "una", "unos", "unas", "por", "para", "con", "su", "sus", "se",
    "the", "of", "in", "on", "and", "to", "for", "is", "at",
}


def _normalize(text):
    text = text.lower()
    text = re.sub(r"[^\w\sáéíóúñ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text):
    return {t for t in _normalize(text).split() if t not in STOPWORDS and len(t) > 2}


def _is_similar(a, b):
    tokens_a, tokens_b = _tokens(a), _tokens(b)
    if tokens_a and tokens_b:
        overlap = len(tokens_a & tokens_b) / len(tokens_a | tokens_b)
        if overlap > 0.5:
            return True
    ratio = difflib.SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()
    return ratio > 0.6


def group_events(items):
    """items: list of classified dicts with a 'titulo' key.
    Returns a list of groups, each a list of the original item dicts.
    """
    groups = []  # list of {"repr": text, "members": [item, ...]}
    for item in items:
        title = item.get("titulo", "")
        placed = False
        for group in groups:
            if any(_is_similar(title, member.get("titulo", "")) for member in group["members"]):
                group["members"].append(item)
                placed = True
                break
        if not placed:
            groups.append({"repr": title, "members": [item]})
    return [g["members"] for g in groups]
