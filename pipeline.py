#!/usr/bin/env python3
"""Radar de Disrupciones - pipeline: fetch -> classify -> dedup -> score -> data.json

Run with: python pipeline.py
"""
import json
import sys
from pathlib import Path

from radar.sources import fetch_google_news

ROOT = Path(__file__).parent
CONFIG_PATH = ROOT / "config.json"
RAW_ITEMS_PATH = ROOT / "raw_items.json"


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def main():
    config = load_config()
    errors = []

    print("== Fase 1: ingesta ==")
    raw_items = fetch_google_news(config, errors)
    print(f"Google News: {len(raw_items)} items crudos")

    for err in errors:
        print(f"  ERROR: {err}", file=sys.stderr)

    RAW_ITEMS_PATH.write_text(json.dumps(raw_items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado en {RAW_ITEMS_PATH}")


if __name__ == "__main__":
    main()
