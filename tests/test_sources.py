import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from radar import sources  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


class TestGoogleNewsParsing(unittest.TestCase):
    def test_parses_sample_rss_into_common_schema(self):
        sample = (FIXTURES / "google_news_sample.xml").read_bytes()
        config = {
            "google_news": {
                "base_url": "https://news.google.com/rss/search",
                "hl": "es-419",
                "gl": "CO",
                "ceid": "CO:es-419",
                "queries": ["paro portuario"],
            },
            "max_items_per_query": 15,
        }
        errors = []
        with patch.object(sources, "_http_get", return_value=sample):
            items = sources.fetch_google_news(config, errors)

        self.assertEqual(errors, [])
        self.assertEqual(len(items), 2)
        self.assertIn("Buenaventura", items[0]["titulo"])
        self.assertEqual(items[0]["fuente"], "El Tiempo")
        self.assertEqual(items[0]["origen"], "google_news")
        self.assertTrue(items[0]["url"].startswith("https://"))

    def test_network_failure_is_reported_not_raised(self):
        config = {
            "google_news": {
                "base_url": "https://news.google.com/rss/search",
                "hl": "es-419",
                "gl": "CO",
                "ceid": "CO:es-419",
                "queries": ["paro portuario"],
            },
            "max_items_per_query": 15,
        }
        errors = []
        with patch.object(sources, "_http_get", side_effect=OSError("blocked")):
            items = sources.fetch_google_news(config, errors)

        self.assertEqual(items, [])
        self.assertEqual(len(errors), 1)
        self.assertIn("blocked", errors[0])


if __name__ == "__main__":
    unittest.main()
