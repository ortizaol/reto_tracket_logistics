const TIPO_LABELS = {
  paro: "Paro",
  bloqueo: "Bloqueo",
  clima: "Clima extremo",
  congestion: "Congestión",
  naviera: "Naviera",
  otro: "Otro",
};

const SEV_LABELS = { 1: "Muy bajo", 2: "Bajo", 3: "Medio", 4: "Alto", 5: "Crítico" };

const state = {
  events: [],
  activeTipos: new Set(),
  region: "",
};

function relativeTime(isoDate) {
  if (!isoDate) return "fecha desconocida";
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return "fecha desconocida";
  const diffMs = Date.now() - then.getTime();
  const diffH = diffMs / 3_600_000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(diffH) < 1) return rtf.format(-Math.round(diffMs / 60_000), "minute");
  if (Math.abs(diffH) < 48) return rtf.format(-Math.round(diffH), "hour");
  return rtf.format(-Math.round(diffH / 24), "day");
}

function formatUpdated(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return `Última actualización: ${d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} (${relativeTime(isoDate)})`;
}

function cardHtml(event) {
  const tipoClass = `badge-tipo-${event.tipo_evento}`;
  const tipoLabel = TIPO_LABELS[event.tipo_evento] || event.tipo_evento;
  const sevLabel = SEV_LABELS[event.severidad] || event.severidad;
  const fuentesHtml = event.fuentes
    .filter((f) => f.url)
    .map((f) => `<a href="${escapeAttr(f.url)}" target="_blank" rel="noopener">${escapeHtml(f.fuente || f.origen)}</a>`)
    .join("");
  const actoresHtml = event.actores && event.actores.length
    ? `<div class="actores">Actores: ${event.actores.map(escapeHtml).join(", ")}</div>`
    : "";

  return `
    <article class="card" data-tipo="${event.tipo_evento}" data-ubicacion="${escapeAttr(event.ubicacion || "")}">
      <div class="card-top">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span class="badge ${tipoClass}">${tipoLabel}</span>
          <span class="badge badge-sev-${event.severidad}">Severidad ${event.severidad} · ${sevLabel}</span>
        </div>
        <span class="score" title="score = severidad × recencia × log(1+nº fuentes)">score ${event.score}</span>
      </div>
      <p class="resumen">${escapeHtml(event.resumen)}</p>
      <div class="meta-row">
        ${event.ubicacion ? `<span class="ubicacion">${escapeHtml(event.ubicacion)}</span>` : ""}
        <span class="recencia">${relativeTime(event.fecha_mas_reciente)}</span>
        <span>${event.n_fuentes} fuente${event.n_fuentes === 1 ? "" : "s"}</span>
      </div>
      ${actoresHtml}
      <div class="fuentes">${fuentesHtml}</div>
    </article>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

function applyFilters() {
  return state.events.filter((e) => {
    const tipoOk = state.activeTipos.size === 0 || state.activeTipos.has(e.tipo_evento);
    const regionOk = !state.region || e.ubicacion === state.region;
    return tipoOk && regionOk;
  });
}

function render() {
  const filtered = applyFilters();
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("empty-state");
  document.getElementById("count").textContent = `${filtered.length} de ${state.events.length} eventos`;

  if (filtered.length === 0) {
    grid.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  grid.innerHTML = filtered.map(cardHtml).join("");
}

function buildTipoFilters() {
  const container = document.getElementById("tipo-filters");
  const tiposPresentes = [...new Set(state.events.map((e) => e.tipo_evento))];
  const order = Object.keys(TIPO_LABELS).filter((t) => tiposPresentes.includes(t));
  order.forEach((tipo) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = TIPO_LABELS[tipo];
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      if (state.activeTipos.has(tipo)) {
        state.activeTipos.delete(tipo);
        chip.setAttribute("aria-pressed", "false");
      } else {
        state.activeTipos.add(tipo);
        chip.setAttribute("aria-pressed", "true");
      }
      render();
    });
    container.appendChild(chip);
  });
}

function buildRegionFilter() {
  const select = document.getElementById("region-select");
  const regiones = [...new Set(state.events.map((e) => e.ubicacion).filter(Boolean))].sort();
  regiones.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    state.region = select.value;
    render();
  });
}

async function init() {
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.events = data.events || [];
    document.getElementById("updated").textContent = formatUpdated(data.generated_at);

    if (data.demo) {
      document.getElementById("demo-banner").innerHTML =
        `<div class="demo-banner">⚠️ Mostrando datos de demostración. ${escapeHtml(data.demo_note || "")}</div>`;
    }
    if (data.errors && data.errors.length) {
      document.getElementById("error-banner").innerHTML = `
        <details class="error-banner">
          <summary>${data.errors.length} error(es) de ingesta en la última corrida</summary>
          <ul>${data.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
        </details>`;
    }

    buildTipoFilters();
    buildRegionFilter();
    render();
  } catch (err) {
    document.getElementById("grid").innerHTML = "";
    document.getElementById("empty-state").hidden = false;
    document.getElementById("empty-state").textContent = `No se pudo cargar data.json: ${err.message}`;
    document.getElementById("updated").textContent = "";
  }
}

init();
