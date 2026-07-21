#!/usr/bin/env python3
"""Radar de Disrupciones - pipeline: fetch -> classify -> dedup -> score -> data.json

Run with: python pipeline.py
"""
import json
import os
import sys
from pathlib import Path

from radar.classifier import classify_item, content_hash, load_cache, save_cache
from radar.sources import fetch_google_news

ROOT = Path(__file__).parent
CONFIG_PATH = ROOT / "config.json"
RAW_ITEMS_PATH = ROOT / "raw_items.json"
CLASSIFY_CACHE_PATH = ROOT / "classify_cache.json"


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def print_errors(errors, since=0):
    for err in errors[since:]:
        print(f"  ERROR: {err}", file=sys.stderr)


def main():
    config = load_config()
    errors = []

    print("== Fase 1: ingesta ==")
    raw_items = fetch_google_news(config, errors)
    print(f"Google News: {len(raw_items)} items crudos")
    print_errors(errors)

    RAW_ITEMS_PATH.write_text(json.dumps(raw_items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado en {RAW_ITEMS_PATH}")

    print("== Fase 2: clasificación ==")
    cache = load_cache(CLASSIFY_CACHE_PATH)
    backend = "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "heuristico"
    print(f"Backend: {backend} ({len(cache)} items ya en cache)")

    errors_before = len(errors)
    classified = []
    cache_hits = 0
    for item in raw_items:
        was_cached = content_hash(item) in cache
        result = classify_item(item, cache, errors)
        cache_hits += was_cached
        classified.append({**item, **result})
    save_cache(CLASSIFY_CACHE_PATH, cache)

    relevantes = [c for c in classified if c["relevante"]]
    print(f"Clasificados: {len(classified)} ({cache_hits} desde cache), relevantes: {len(relevantes)}")
    print_errors(errors, since=errors_before)


if __name__ == "__main__":
    main()
