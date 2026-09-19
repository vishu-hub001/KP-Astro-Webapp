// sections/nakshatra.js -- the chart re-read nakshatra by nakshatra.
// A 27-tile map (each row is one Vimshottari cycle, so columns line up by
// star lord), detail cards for occupied nakshatras, and a "planets by star
// lord" panel -- the KP relationship that matters most.
import { getChart } from "../state.js";
import { NAKSHATRAS } from "../helpers.js";
import {
  emptyState, pbadge, ppill, padaDots, chip, segmented, bindSeg,
  fmtLon, abbr, colorOf, nakshatraLord, DASHA_ORDER,
} from "../ui.js";

// Held at module scope so the choice survives store-driven re-renders.
let filter = "occ";

const SPAN = 360 / 27;

function occupantRow(pt) {
  return `<div class="nk-occ-row">
    ${pbadge(pt.name)}
    <div class="nk-occ-main">
      <b>${pt.isAsc ? "Ascendant" : pt.name}</b>${pt.retro ? '<span class="retro-flag">R</span>' : ""}
      ${padaDots(pt.kp.pada)}
    </div>
    <div class="nk-sub"><span class="nk-sub-l">Sub</span>${pbadge(pt.kp.sub_lord)}<span class="nk-sub-n">${pt.kp.sub_lord}</span></div>
  </div>`;
}

function nakshatraCard(i0, occ) {
  const idx = i0 + 1;
  const lord = nakshatraLord(i0);
  const span = `${fmtLon(i0 * SPAN)} – ${fmtLon((i0 + 1) * SPAN, true)}`;
  const empty = !occ.length;
  return `<article class="ncard${empty ? " is-empty" : ""}" id="nk-${idx}" style="--pc:${colorOf(lord)}">
    <header class="nc-head">
      <div class="nc-num">${idx}</div>
      <div class="nc-title">
        <h4>${NAKSHATRAS[i0]}</h4>
        <div class="nc-span mono">${span}</div>
      </div>
      <div class="nc-lord" title="Nakshatra (star) lord">${pbadge(lord)}<span><small>Star lord</small>${lord}</span></div>
    </header>
    ${empty
      ? `<p class="sub nc-empty">Unoccupied</p>`
      : `<div class="nk-occ-list">${occ.map(occupantRow).join("")}</div>`}
  </article>`;
}

function mapHtml(byNk) {
  const head = DASHA_ORDER.map(l => `<div class="nkm-h" title="${l}">${pbadge(l)}</div>`).join("");
  const tiles = NAKSHATRAS.map((name, i0) => {
    const idx = i0 + 1;
    const occ = byNk[idx] || [];
    const dots = occ.map(pt => `<i style="--pc:${colorOf(pt.name)}" title="${pt.isAsc ? "Ascendant" : pt.name}"><b>${abbr(pt.name)}</b></i>`).join("");
    const label = `${idx}. ${name}${occ.length ? " — " + occ.map(p => p.isAsc ? "Asc" : p.name).join(", ") : ""}`;
    return `<button type="button" class="nk-tile${occ.length ? " occ" : ""}" data-idx="${idx}" title="${label}" aria-label="${label}" ${occ.length ? "" : "tabindex=\"-1\""}>
      <span class="nk-n">${idx}</span>
      <span class="nk-name">${name}</span>
      <span class="nk-dots">${dots}</span>
    </button>`;
  }).join("");
  return `<div class="nkm-grid">${head}${tiles}</div>`;
}

function starLordPanel(points) {
  const by = {};
  DASHA_ORDER.forEach(l => { by[l] = []; });
  points.forEach(pt => { if (by[pt.kp.star_lord]) by[pt.kp.star_lord].push(pt); });
  const cells = DASHA_ORDER.map(l => `<div class="sl-cell${by[l].length ? "" : " is-empty"}">
    <div class="sl-head">${pbadge(l)}<b>${l}</b><span class="sl-count">${by[l].length}</span></div>
    <div class="sl-body">${by[l].length
      ? by[l].map(pt => ppill(pt.isAsc ? "Asc" : pt.name, pt.kp.nakshatra)).join("")
      : '<span class="sub">No planet in its stars</span>'}</div>
  </div>`).join("");
  return `<div class="panel">
    <h3><span class="mk">◆</span>Planets by star lord</h3>
    <div class="sl-grid">${cells}</div>
    <p class="sub an-note">In KP a planet acts through the star lord it occupies — each planet delivers the results of the star lord's houses, filtered by its sub lord.</p>
  </div>`;
}

export function render(container) {
  const chart = getChart();
  if (!chart) { container.innerHTML = emptyState(); return; }

  const points = [
    { name: "Asc", isAsc: true, retro: false, kp: chart.houses.ascendant_kp },
    ...chart.positions.planets.map(p => ({ name: p.name, isAsc: false, retro: !!p.is_retrograde, kp: p.kp })),
  ];

  const byNk = {};
  points.forEach(pt => { (byNk[pt.kp.nakshatra_index] = byNk[pt.kp.nakshatra_index] || []).push(pt); });

  const occIdx = Object.keys(byNk).map(Number).sort((a, b) => a - b);
  const moon = points.find(p => p.name === "Moon");
  const top = occIdx.reduce((a, k) => byNk[k].length > a[1] ? [k, byNk[k].length] : a, [0, 0]);
  const asc = points[0];

  const cardIdx = filter === "all" ? Array.from({ length: 27 }, (_, i) => i + 1) : occIdx;

  container.innerHTML = `
    <div class="chip-row an-chips">
      ${chip(moon ? moon.kp.nakshatra : "—", "Janma nakshatra (Moon)")}
      ${chip(asc.kp.nakshatra, "Lagna nakshatra")}
      ${chip(`${occIdx.length}/27`, "Occupied")}
      ${top[1] > 1 ? chip(NAKSHATRAS[top[0] - 1], `Most crowded (${top[1]})`) : ""}
    </div>

    <div class="panel">
      <h3><span class="mk">◆</span>The 27 nakshatras</h3>
      ${mapHtml(byNk)}
      <p class="sub an-note nkm-hint">Each row is one Vimshottari cycle — columns share a star lord. Tap an occupied nakshatra to jump to it.</p>
    </div>

    <div class="an-toolbar">
      <div class="an-toolbar-title">${cardIdx.length} nakshatra${cardIdx.length === 1 ? "" : "s"} shown</div>
      ${segmented("nk-filter", [["occ", "Occupied only"], ["all", "All 27"]], filter)}
    </div>
    <div class="nc-grid">${cardIdx.map(idx => nakshatraCard(idx - 1, byNk[idx] || [])).join("")}</div>

    ${starLordPanel(points)}
  `;

  bindSeg(container, "nk-filter", (val) => { filter = val; render(container); });

  container.querySelectorAll(".nkm-grid .nk-tile.occ").forEach(tile => {
    tile.addEventListener("click", () => {
      const card = container.querySelector(`#nk-${tile.dataset.idx}`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("flash");
      void card.offsetWidth;            // restart the CSS animation
      card.classList.add("flash");
    });
  });
}
