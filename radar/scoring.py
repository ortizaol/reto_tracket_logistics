"""Turns event groups into scored, dashboard-ready event dicts.

score = severidad x factor_recencia x log(1 + n_fuentes)
factor_recencia decays exponentially with a configurable half-life.
"""
import math
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

DEFAULT_RECENCY_FACTOR = 0.4  # used when a date can't be parsed at all


def parse_date(fecha_str):
    if not fecha_str:
        return None
    fecha_str = fecha_str.strip()
    try:
        return parsedate_to_datetime(fecha_str).astimezone(timezone.utc)
    except (TypeError, ValueError):
        pass
    try:
        iso = fecha_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _recency_factor(most_recent_dt, half_life_hours, now=None):
    if most_recent_dt is None:
        return DEFAULT_RECENCY_FACTOR
    now = now or datetime.now(timezone.utc)
    age_hours = max(0.0, (now - most_recent_dt).total_seconds() / 3600)
    factor = 0.5 ** (age_hours / half_life_hours)
    return max(0.05, min(1.0, factor))


def _most_common(values):
    values = [v for v in values if v]
    if not values:
        return ""
    return max(set(values), key=values.count)


def build_event(group, half_life_hours, now=None):
    fuentes = []
    seen_urls = set()
    dates = []
    for item in group:
        url = item.get("url", "")
        if url and url in seen_urls:
            continue
        seen_urls.add(url)
        parsed = parse_date(item.get("fecha", ""))
        if parsed:
            dates.append(parsed)
        fuentes.append(
            {
                "fuente": item.get("fuente", ""),
                "url": url,
                "fecha": item.get("fecha", ""),
                "origen": item.get("origen", ""),
            }
        )

    most_recent = max(dates) if dates else None
    n_fuentes = max(1, len(fuentes))
    severidad = max((item.get("severidad", 1) for item in group), default=1)
    tipo_evento = _most_common([item.get("tipo_evento") for item in group])
    ubicacion = _most_common([item.get("ubicacion") for item in group])
    actores = []
    for item in group:
        for actor in item.get("actores", []):
            if actor not in actores:
                actores.append(actor)
    resumenes = [item.get("resumen", "") for item in group if item.get("resumen")]
    resumen = max(resumenes, key=len) if resumenes else group[0].get("titulo", "")

    recencia = _recency_factor(most_recent, half_life_hours, now)
    score = round(severidad * recencia * math.log(1 + n_fuentes), 4)

    return {
        "tipo_evento": tipo_evento or "otro",
        "ubicacion": ubicacion,
        "severidad": severidad,
        "resumen": resumen,
        "actores": actores,
        "fuentes": fuentes,
        "n_fuentes": n_fuentes,
        "fecha_mas_reciente": most_recent.isoformat() if most_recent else None,
        "score": score,
    }


def build_events(groups, half_life_hours, now=None):
    events = [build_event(group, half_life_hours, now) for group in groups]
    events.sort(key=lambda e: e["score"], reverse=True)
    for idx, event in enumerate(events, start=1):
        event["id"] = idx
    return events
