"""Classification layer: turns a raw item into a structured event.

classify_item() is the single entry point. It picks a backend:
  - Anthropic API, if ANTHROPIC_API_KEY is set (preferred, more accurate).
  - Heuristic keyword/regex fallback otherwise, so the pipeline always runs.

Results are cached by a hash of the item content so re-runs don't
reclassify (and don't re-spend LLM calls / hit rate limits).
"""
import hashlib
import json
import os
import re
import urllib.error
import urllib.request

ANTHROPIC_MODEL = "claude-sonnet-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

TIPOS = ["paro", "bloqueo", "clima", "congestion", "naviera", "otro"]

SCHEMA_PROMPT = """Eres un analista de riesgo logístico para la ruta Colombia<->México.
Clasifica la siguiente noticia/post y responde SOLO con un JSON (sin markdown, sin texto extra) con estas claves:
{
  "relevante": true|false,   // true si describe una disrupción real o potencial a cadenas de suministro/transporte
  "tipo_evento": "paro"|"bloqueo"|"clima"|"congestion"|"naviera"|"otro",
  "ubicacion": "string corto, ciudad/puerto/vía si se identifica, o vacío",
  "actores": ["lista corta de actores involucrados, ej. sindicato, naviera, gobierno"],
  "severidad": 1-5,  // 1=menor/rumor, 5=paralización total confirmada
  "resumen": "una frase que resuma el evento"
}

Texto a clasificar:
Título: __TITULO__
Fuente: __FUENTE__
Fecha: __FECHA__
"""

# --- keyword tables for the heuristic fallback ---
KEYWORDS_TIPO = {
    "paro": ["paro", "huelga", "cese de actividades", "strike"],
    "bloqueo": ["bloqueo", "bloqueado", "vía cerrada", "taponamiento", "blockade", "roadblock"],
    "clima": ["huracán", "tormenta", "inundación", "lluvias", "clima extremo", "storm", "hurricane", "flood"],
    "congestion": ["congestión", "congestion", "saturación", "demora", "cuellos de botella", "backlog", "delay"],
    "naviera": ["naviera", "maersk", "msc", "hapag-lloyd", "cma cgm", "cosco", "buque", "carrier", "shipping line"],
}

KEYWORDS_SEVERIDAD_ALTA = ["paraliza", "cierre total", "indefinid", "colapso", "shutdown", "paralización"]
KEYWORDS_SEVERIDAD_MEDIA = ["retraso", "demora", "afecta", "restricción", "parcial", "delay"]

UBICACIONES_CONOCIDAS = [
    "Buenaventura", "Cartagena", "Santa Marta", "Barranquilla", "Bogotá",
    "Manzanillo", "Veracruz", "Lázaro Cárdenas", "Altamira", "Ciudad de México",
    "Colombia", "México", "Panamá", "Buga", "Medellín",
]

ACTORES_CONOCIDOS = [
    "sindicato", "transportistas", "gobierno", "camioneros", "trabajadores portuarios",
    "Maersk", "MSC", "Hapag-Lloyd", "CMA CGM", "Cosco", "aduana", "DIAN",
]


def content_hash(item):
    raw = f"{item.get('titulo', '')}|{item.get('url', '')}".strip().lower()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def load_cache(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(path, cache):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def classify_item(item, cache, errors, api_key=None):
    """Returns a structured classification dict, using the cache when possible."""
    h = content_hash(item)
    if h in cache:
        return cache[h]

    api_key = api_key if api_key is not None else os.environ.get("ANTHROPIC_API_KEY")
    result = None
    if api_key:
        result = _classify_with_anthropic(item, api_key, errors)
    if result is None:
        result = _classify_heuristic(item)

    cache[h] = result
    return result


def _classify_with_anthropic(item, api_key, errors):
    prompt = (
        SCHEMA_PROMPT.replace("__TITULO__", item.get("titulo", ""))
        .replace("__FUENTE__", item.get("fuente", ""))
        .replace("__FECHA__", item.get("fecha", ""))
    )
    body = json.dumps(
        {
            "model": ANTHROPIC_MODEL,
            "max_tokens": 400,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
        text = "".join(block.get("text", "") for block in payload.get("content", []))
        text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
        parsed = json.loads(text)
        return _normalize_classification(parsed, backend="anthropic")
    except Exception as e:  # noqa: BLE001 - fall back to heuristic, never crash
        errors.append(f"classifier(anthropic): {type(e).__name__}: {e}")
        return None


def _classify_heuristic(item):
    text = f"{item.get('titulo', '')}".lower()

    tipo_evento = "otro"
    for tipo, keywords in KEYWORDS_TIPO.items():
        if any(kw in text for kw in keywords):
            tipo_evento = tipo
            break

    relevante = tipo_evento != "otro"

    severidad = 2
    if any(kw in text for kw in KEYWORDS_SEVERIDAD_ALTA):
        severidad = 5
    elif any(kw in text for kw in KEYWORDS_SEVERIDAD_MEDIA):
        severidad = 3

    ubicacion = ""
    for lugar in UBICACIONES_CONOCIDAS:
        if lugar.lower() in text:
            ubicacion = lugar
            break

    actores = [a for a in ACTORES_CONOCIDOS if a.lower() in text]

    resumen = item.get("titulo", "")[:180]

    return _normalize_classification(
        {
            "relevante": relevante,
            "tipo_evento": tipo_evento,
            "ubicacion": ubicacion,
            "actores": actores,
            "severidad": severidad,
            "resumen": resumen,
        },
        backend="heuristico",
    )


def _normalize_classification(parsed, backend):
    tipo = parsed.get("tipo_evento", "otro")
    if tipo not in TIPOS:
        tipo = "otro"
    try:
        severidad = int(parsed.get("severidad", 1))
    except (TypeError, ValueError):
        severidad = 1
    severidad = max(1, min(5, severidad))
    return {
        "relevante": bool(parsed.get("relevante", False)),
        "tipo_evento": tipo,
        "ubicacion": (parsed.get("ubicacion") or "").strip(),
        "actores": parsed.get("actores") or [],
        "severidad": severidad,
        "resumen": (parsed.get("resumen") or "").strip(),
        "_backend": backend,
    }
