import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from radar.dedup import group_events  # noqa: E402
from radar.scoring import build_events, parse_date  # noqa: E402


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


class TestDedup(unittest.TestCase):
    def test_groups_near_duplicate_titles(self):
        items = [
            {"titulo": "Paro portuario paraliza Buenaventura", "url": "https://a/1", "fuente": "El Tiempo"},
            {"titulo": "Paro portuario paraliza el puerto de Buenaventura", "url": "https://a/2", "fuente": "Portafolio"},
            {"titulo": "Congestión reportada en Manzanillo", "url": "https://a/3", "fuente": "Reforma"},
        ]
        groups = group_events(items)
        self.assertEqual(len(groups), 2)
        sizes = sorted(len(g) for g in groups)
        self.assertEqual(sizes, [1, 2])

    def test_distinct_events_stay_separate(self):
        items = [
            {"titulo": "Bloqueo en la vía Buga-Buenaventura", "url": "https://a/1", "fuente": "X"},
            {"titulo": "Huracán afecta el puerto de Veracruz", "url": "https://a/2", "fuente": "Y"},
        ]
        groups = group_events(items)
        self.assertEqual(len(groups), 2)


class TestScoring(unittest.TestCase):
    def test_more_sources_and_higher_severity_score_higher(self):
        now = datetime(2026, 7, 21, tzinfo=timezone.utc)
        recent = _iso(now - timedelta(hours=1))
        group_a = [
            {"titulo": "Paro total", "url": "https://a/1", "fuente": "X", "fecha": recent, "severidad": 5, "tipo_evento": "paro", "ubicacion": "Buenaventura", "actores": []},
            {"titulo": "Paro total", "url": "https://a/2", "fuente": "Y", "fecha": recent, "severidad": 5, "tipo_evento": "paro", "ubicacion": "Buenaventura", "actores": []},
        ]
        group_b = [
            {"titulo": "Retraso menor", "url": "https://b/1", "fuente": "Z", "fecha": recent, "severidad": 2, "tipo_evento": "congestion", "ubicacion": "Manzanillo", "actores": []},
        ]
        events = build_events([group_a, group_b], half_life_hours=48, now=now)
        self.assertEqual(events[0]["tipo_evento"], "paro")
        self.assertGreater(events[0]["score"], events[1]["score"])
        self.assertEqual(events[0]["n_fuentes"], 2)

    def test_recency_decays_score(self):
        now = datetime(2026, 7, 21, tzinfo=timezone.utc)
        fresh = _iso(now - timedelta(hours=1))
        old = _iso(now - timedelta(hours=200))
        group_fresh = [{"titulo": "A", "url": "https://a/1", "fuente": "X", "fecha": fresh, "severidad": 3, "tipo_evento": "bloqueo", "ubicacion": "", "actores": []}]
        group_old = [{"titulo": "B", "url": "https://a/2", "fuente": "X", "fecha": old, "severidad": 3, "tipo_evento": "bloqueo", "ubicacion": "", "actores": []}]
        events = build_events([group_fresh, group_old], half_life_hours=48, now=now)
        self.assertEqual(events[0]["resumen"], "A")
        self.assertGreater(events[0]["score"], events[1]["score"])

    def test_parse_date_handles_rfc822_and_iso(self):
        self.assertIsNotNone(parse_date("Mon, 20 Jul 2026 14:00:00 GMT"))
        self.assertIsNotNone(parse_date("2026-07-20T18:00:00.000Z"))
        self.assertIsNone(parse_date("not a date"))


if __name__ == "__main__":
    unittest.main()
