import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from radar import sources  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


class TestBlueskyParsing(unittest.TestCase):
    def test_parses_sample_into_common_schema(self):
        sample = (FIXTURES / "bluesky_sample.json").read_bytes()
        config = {"bluesky": {"base_url": "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts", "queries": ["bloqueo"]}}
        errors = []
        with patch.object(sources, "_http_get", return_value=sample):
            items = sources.fetch_bluesky(config, errors)

        self.assertEqual(errors, [])
        self.assertEqual(len(items), 1)
        self.assertIn("Bloqueo total", items[0]["titulo"])
        self.assertEqual(items[0]["origen"], "bluesky")
        self.assertTrue(items[0]["url"].startswith("https://bsky.app/profile/"))

    def test_auth_or_network_failure_is_reported_not_raised(self):
        config = {"bluesky": {"base_url": "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts", "queries": ["bloqueo"]}}
        errors = []
        with patch.object(sources, "_http_get", side_effect=OSError("blocked")):
            items = sources.fetch_bluesky(config, errors)
        self.assertEqual(items, [])
        self.assertEqual(len(errors), 1)


class TestMastodonParsing(unittest.TestCase):
    def test_parses_sample_into_common_schema_and_strips_html(self):
        sample = (FIXTURES / "mastodon_sample.json").read_bytes()
        config = {"mastodon": {"instance": "https://mastodon.social", "queries": ["congestion"]}}
        errors = []
        with patch.object(sources, "_http_get", return_value=sample):
            items = sources.fetch_mastodon(config, errors)

        self.assertEqual(errors, [])
        self.assertEqual(len(items), 1)
        self.assertNotIn("<p>", items[0]["titulo"])
        self.assertIn("Manzanillo", items[0]["titulo"])
        self.assertEqual(items[0]["origen"], "mastodon")

    def test_auth_or_network_failure_is_reported_not_raised(self):
        config = {"mastodon": {"instance": "https://mastodon.social", "queries": ["congestion"]}}
        errors = []
        with patch.object(sources, "_http_get", side_effect=OSError("401 unauthorized")):
            items = sources.fetch_mastodon(config, errors)
        self.assertEqual(items, [])
        self.assertEqual(len(errors), 1)


if __name__ == "__main__":
    unittest.main()
