import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from radar import classifier  # noqa: E402


class TestHeuristicClassifier(unittest.TestCase):
    def test_paro_alto_severidad(self):
        item = {"titulo": "Paro portuario paraliza operaciones en Buenaventura", "url": "https://x/1"}
        cache = {}
        result = classifier.classify_item(item, cache, [], api_key=None)
        self.assertTrue(result["relevante"])
        self.assertEqual(result["tipo_evento"], "paro")
        self.assertEqual(result["severidad"], 5)
        self.assertEqual(result["ubicacion"], "Buenaventura")
        self.assertEqual(result["_backend"], "heuristico")

    def test_congestion_media_severidad(self):
        item = {"titulo": "Congestión y demora en el puerto de Manzanillo", "url": "https://x/2"}
        result = classifier.classify_item(item, {}, [], api_key=None)
        self.assertEqual(result["tipo_evento"], "congestion")
        self.assertEqual(result["severidad"], 3)

    def test_irrelevante_por_defecto(self):
        item = {"titulo": "El precio del café sube en la bolsa de Nueva York", "url": "https://x/3"}
        result = classifier.classify_item(item, {}, [], api_key=None)
        self.assertFalse(result["relevante"])
        self.assertEqual(result["tipo_evento"], "otro")

    def test_cache_avoids_reclassification(self):
        item = {"titulo": "Bloqueo en vía Buga Buenaventura", "url": "https://x/4"}
        cache = {}
        first = classifier.classify_item(item, cache, [], api_key=None)
        h = classifier.content_hash(item)
        self.assertIn(h, cache)
        # mutate cache to prove the second call reads from cache, not recomputes
        cache[h]["resumen"] = "FROM_CACHE"
        second = classifier.classify_item(item, cache, [], api_key=None)
        self.assertEqual(second["resumen"], "FROM_CACHE")
        self.assertEqual(first["tipo_evento"], "bloqueo")


class TestAnthropicBackend(unittest.TestCase):
    def test_uses_anthropic_when_key_present_and_falls_back_on_error(self):
        item = {"titulo": "Huelga de camioneros bloquea acceso a Cartagena", "url": "https://x/5"}
        errors = []
        with patch("urllib.request.urlopen", side_effect=OSError("blocked in sandbox")):
            result = classifier.classify_item(item, {}, errors, api_key="fake-key")
        # falls back to heuristic when the API call fails, pipeline keeps running
        self.assertEqual(result["_backend"], "heuristico")
        self.assertTrue(any("classifier(anthropic)" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
