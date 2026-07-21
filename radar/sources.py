"""Fetchers for raw disruption-related items. Each returns a list of dicts
with the common raw schema: {titulo, fuente, url, fecha, query, origen}.
Network failures are caught per-query and reported, never raised, so the
pipeline can keep going with whatever sources actually respond.
"""
import json
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
TIMEOUT = 15


def _http_get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def fetch_google_news(config, errors):
    cfg = config["google_news"]
    items = []
    for query in cfg["queries"]:
        params = {
            "q": query,
            "hl": cfg.get("hl", "es-419"),
            "gl": cfg.get("gl", "CO"),
            "ceid": cfg.get("ceid", "CO:es-419"),
        }
        url = f"{cfg['base_url']}?{urllib.parse.urlencode(params)}"
        try:
            raw = _http_get(url)
            root = ET.fromstring(raw)
            channel_items = root.findall("./channel/item")[: config.get("max_items_per_query", 15)]
            for it in channel_items:
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or "").strip()
                pub_date = (it.findtext("pubDate") or "").strip()
                source_el = it.find("source")
                source_name = source_el.text.strip() if source_el is not None and source_el.text else "Google News"
                items.append(
                    {
                        "titulo": title,
                        "fuente": source_name,
                        "url": link,
                        "fecha": pub_date,
                        "query": query,
                        "origen": "google_news",
                    }
                )
        except Exception as e:  # noqa: BLE001 - report and move on, never crash the pipeline
            errors.append(f"google_news[{query!r}]: {type(e).__name__}: {e}")
    return items


def fetch_bluesky(config, errors):
    cfg = config.get("bluesky")
    if not cfg:
        return []
    items = []
    for query in cfg["queries"]:
        params = {"q": query, "limit": str(config.get("max_items_per_query", 15))}
        url = f"{cfg['base_url']}?{urllib.parse.urlencode(params)}"
        try:
            raw = _http_get(url, headers={"Accept": "application/json"})
            data = json.loads(raw)
            for post in data.get("posts", []):
                record = post.get("record", {})
                author = post.get("author", {})
                uri = post.get("uri", "")
                rkey = uri.rsplit("/", 1)[-1] if uri else ""
                handle = author.get("handle", "")
                web_url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else uri
                items.append(
                    {
                        "titulo": (record.get("text") or "").strip(),
                        "fuente": f"@{handle}" if handle else "Bluesky",
                        "url": web_url,
                        "fecha": record.get("createdAt", ""),
                        "query": query,
                        "origen": "bluesky",
                    }
                )
        except Exception as e:  # noqa: BLE001
            errors.append(f"bluesky[{query!r}]: {type(e).__name__}: {e}")
    return items


def fetch_mastodon(config, errors):
    cfg = config.get("mastodon")
    if not cfg:
        return []
    items = []
    for query in cfg["queries"]:
        params = {"q": query, "type": "statuses", "limit": str(config.get("max_items_per_query", 15))}
        url = f"{cfg['instance']}/api/v2/search?{urllib.parse.urlencode(params)}"
        try:
            raw = _http_get(url, headers={"Accept": "application/json"})
            data = json.loads(raw)
            for status in data.get("statuses", []):
                account = status.get("account", {})
                content = status.get("content", "")
                text = _strip_html(content)
                items.append(
                    {
                        "titulo": text.strip(),
                        "fuente": f"@{account.get('acct', 'mastodon')}",
                        "url": status.get("url", ""),
                        "fecha": status.get("created_at", ""),
                        "query": query,
                        "origen": "mastodon",
                    }
                )
        except Exception as e:  # noqa: BLE001
            errors.append(f"mastodon[{query!r}]: {type(e).__name__}: {e}")
    return items


def _strip_html(html):
    import re

    return re.sub(r"<[^>]+>", " ", html)


SOURCE_FETCHERS = {
    "google_news": fetch_google_news,
    "bluesky": fetch_bluesky,
    "mastodon": fetch_mastodon,
}
