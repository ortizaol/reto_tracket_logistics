# Radar de Disrupciones

Sistema que escucha noticias y redes sociales y muestra, en un dashboard
estático, eventos que amenazan la cadena de suministro Colombia ↔ México
(paros portuarios, bloqueos de vías, clima extremo, congestión, líos de
navieras), agrupados y rankeados por severidad.

**Dashboard en vivo (GitHub Pages):** `https://ortizaol.github.io/reto_tracket_logistics/`
(ver [Desplegar en GitHub Pages](#desplegar-en-github-pages) — falta un paso manual de configuración).

## Arquitectura

```
config.json          queries de búsqueda, editable
pipeline.py           orquestador: fetch -> classify -> dedup -> score -> docs/data.json
radar/
  sources.py           fetchers: Google News RSS, Bluesky, Mastodon
  classifier.py         clasificación (Anthropic API o heurístico) + cache por hash
  dedup.py               agrupa ítems que reportan el mismo evento
  scoring.py              score = severidad x recencia x log(1+nº fuentes)
docs/                  dashboard estático (servido por GitHub Pages)
  index.html, app.js, styles.css, data.json
tools/seed_demo_data.py  genera datos de ejemplo con el mismo código real (ver Limitaciones)
tests/                 unit tests con fixtures (sin red)
.github/workflows/refresh-data.yml  corre pipeline.py cada 6h y commitea docs/data.json
```

Sin backend en vivo: `index.html` simplemente hace `fetch('./data.json')` y
renderiza. Todo el trabajo pesado (ingesta, clasificación, dedup, scoring)
pasa en `pipeline.py`, que es el único comando que hay que correr para
refrescar los datos.

## Correr localmente

Requiere Python 3.9+ y nada más — todo el pipeline usa solo la librería
estándar (`urllib`, `xml.etree`, `difflib`, `hashlib`).

```bash
python pipeline.py
```

Esto imprime el progreso de cada fase (ingesta, clasificación, dedup+scoring)
y escribe `docs/data.json`. Luego abre el dashboard:

```bash
cd docs && python3 -m http.server 8000
# abre http://localhost:8000
```

(`fetch()` no funciona con `file://`, por eso hace falta un servidor local
para probarlo; en GitHub Pages esto no aplica.)

### Clasificador: Anthropic API o heurístico

`classify_item()` es la única función de clasificación y tiene dos backends:

- **Anthropic API** (preferido): si la variable de entorno `ANTHROPIC_API_KEY`
  existe, cada ítem se clasifica con el modelo, pidiendo JSON estructurado.
- **Heurístico** (fallback): si no hay key, o si la llamada falla, cae a
  palabras clave/regex para asignar tipo, ubicación y severidad aproximados.

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # opcional
python pipeline.py
```

Los resultados se cachean por hash del contenido (título+url) en
`classify_cache.json`, para no reclasificar en cada corrida ni gastar
llamadas de más.

### Configurar las búsquedas

Edita `config.json` — las queries de Google News, Bluesky y Mastodon están
ahí, junto con el half-life de recencia usado en el scoring.

## Desplegar en GitHub Pages

El dashboard vive en `docs/`, así que basta con activar Pages sobre esa
carpeta (paso manual único, GitHub no lo expone por API para repos nuevos):

1. En GitHub: **Settings → Pages**.
2. **Source**: `Deploy from a branch`.
3. **Branch**: `main`, carpeta `/docs`.
4. Guardar. La URL queda en `https://<owner>.github.io/<repo>/`.

El workflow `.github/workflows/refresh-data.yml` corre `pipeline.py` cada 6
horas (o manualmente desde la pestaña Actions) y commitea `docs/data.json`
si cambió — cada commit dispara un redeploy de Pages automáticamente. Si
quieres usar el backend de Anthropic en ese workflow, agrega el secret
`ANTHROPIC_API_KEY` en **Settings → Secrets and variables → Actions**.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

Los tests corren sin red: usan fixtures (RSS/JSON de ejemplo) para validar
que el parseo, la clasificación heurística, el dedup y el scoring funcionan
de punta a punta.

## Limitaciones conocidas

- Este proyecto se desarrolló en un sandbox cuyo egress bloquea
  `news.google.com`, `public.api.bsky.app` y `mastodon.social` (política de
  red del entorno, confirmada contra dominios de control). Por eso no pude
  verificar en vivo cuál de las dos fuentes sociales responde sin
  credenciales — el código de ambas está implementado y probado contra
  fixtures, pero su comportamiento real en producción se valida la primera
  vez que corra el workflow de Actions (que sí tiene internet completo).
- `docs/data.json` en este PR se generó con `tools/seed_demo_data.py`
  (mismo código de clasificación/dedup/scoring, datos de ejemplo) para que
  el dashboard tenga algo que mostrar desde ya — está marcado con
  `"demo": true` y el dashboard lo señala con un banner. El primer run del
  workflow programado lo sobrescribe con datos reales.
- Clustering simple (solapamiento de tokens o `difflib` > 0.6), sin ML: dos
  titulares que hablan del mismo evento con palabras muy distintas pueden no
  agruparse. Es una limitación conocida y aceptada del enfoque.
