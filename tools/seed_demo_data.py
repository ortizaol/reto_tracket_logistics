#!/usr/bin/env python3
"""Generates docs/data.json from a small set of realistic sample items,
run through the SAME classify -> dedup -> score code as pipeline.py.

Only needed because the sandbox used to build this project has its
egress blocked for news.google.com / bsky / mastodon (see README). Once
pipeline.py can reach the internet (e.g. the GitHub Actions workflow),
it overwrites this with live data. The output is tagged "demo": true so
it's never mistaken for a live run.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from radar.classifier import classify_item
from radar.dedup import group_events
from radar.scoring import build_events

ROOT = Path(__file__).parent.parent
DATA_PATH = ROOT / "docs" / "data.json"

SAMPLE_RAW_ITEMS = [
    {"titulo": "Paro portuario en Buenaventura paraliza las exportaciones hacia México", "fuente": "El Tiempo", "url": "https://example.com/n1", "fecha": "Mon, 20 Jul 2026 22:00:00 GMT", "origen": "google_news"},
    {"titulo": "Paro portuario en Buenaventura paraliza exportaciones hacia México, dice gremio", "fuente": "Portafolio", "url": "https://example.com/n2", "fecha": "Mon, 20 Jul 2026 20:00:00 GMT", "origen": "google_news"},
    {"titulo": "Sindicato confirma que continúa el paro en el puerto de Buenaventura", "fuente": "@logisticacol", "url": "https://bsky.app/profile/logisticacol/post/1", "fecha": "2026-07-20T23:00:00.000Z", "origen": "bluesky"},
    {"titulo": "Bloqueo en la vía Buga-Buenaventura cumple 30 horas, camiones varados", "fuente": "Caracol Radio", "url": "https://example.com/n3", "fecha": "Mon, 20 Jul 2026 18:00:00 GMT", "origen": "google_news"},
    {"titulo": "Bloqueo en la vía Buga-Buenaventura cumple 30 horas y varados camiones", "fuente": "@transportecol", "url": "https://bsky.app/profile/transportecol/post/2", "fecha": "2026-07-20T20:30:00.000Z", "origen": "bluesky"},
    {"titulo": "Congestión portuaria en Manzanillo retrasa despachos hacia Colombia", "fuente": "Reforma", "url": "https://example.com/n4", "fecha": "Sun, 19 Jul 2026 15:00:00 GMT", "origen": "google_news"},
    {"titulo": "Puerto de Manzanillo reporta demoras por alta demanda de contenedores", "fuente": "@puertosmx", "url": "https://mastodon.social/@puertosmx/1", "fecha": "2026-07-19T20:00:00.000Z", "origen": "mastodon"},
    {"titulo": "Huracán se aproxima a Veracruz; navieras evalúan retrasos preventivos", "fuente": "El Universal", "url": "https://example.com/n5", "fecha": "Mon, 20 Jul 2026 14:00:00 GMT", "origen": "google_news"},
    {"titulo": "Maersk anuncia recargo por congestión en rutas Colombia-México", "fuente": "La República", "url": "https://example.com/n6", "fecha": "Sat, 18 Jul 2026 10:00:00 GMT", "origen": "google_news"},
    {"titulo": "Cierre temporal del puerto de Cartagena por mantenimiento programado", "fuente": "El Universal Cartagena", "url": "https://example.com/n7", "fecha": "Thu, 16 Jul 2026 08:00:00 GMT", "origen": "google_news"},
    {"titulo": "El precio del café colombiano sube en la bolsa de Nueva York", "fuente": "Bloomberg", "url": "https://example.com/n8", "fecha": "Mon, 20 Jul 2026 07:00:00 GMT", "origen": "google_news"},
]


def main():
    cache = {}
    errors = []
    classified = [{**item, **classify_item(item, cache, errors, api_key=None)} for item in SAMPLE_RAW_ITEMS]
    relevantes = [c for c in classified if c["relevante"]]
    groups = group_events(relevantes)
    events = build_events(groups, half_life_hours=48)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "demo": True,
        "demo_note": (
            "Datos de ejemplo generados localmente porque el sandbox de desarrollo "
            "bloquea el egress a news.google.com / bsky / mastodon (ver README). "
            "El workflow de GitHub Actions corre pipeline.py con internet real y "
            "sobrescribe este archivo con datos en vivo."
        ),
        "sources": {"google_news": 8, "bluesky": 2, "mastodon": 1},
        "errors": [],
        "events": events,
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Demo data: {len(events)} eventos -> {DATA_PATH}")


if __name__ == "__main__":
    main()
