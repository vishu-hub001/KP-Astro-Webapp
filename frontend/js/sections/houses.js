// sections/houses.js -- one card per house: cusp, KP chain (sign / star /
// sub lord), occupants, the houses the cusp sub lord signifies, and the
// four-level significator ranking. A planet x house matrix below gives
// the whole picture at a glance.
import { getChart, getSignificators } from "../state.js";
import { degToSign, houseOfLongitude, SIGN_LORDS } from "../helpers.js";
import {
  emptyState, lordChain, padaDots, ppill, hpill, tag, segmented, bindSeg,
  fmtDM, HOUSE_INFO, HOUSE_GROUPS, LEVELS, pbadge,
} from "../ui.js";

// Module-scope UI state so it survives store-driven re-renders.
let view = "cards";
let group = "all";

function groupsOf(h) {
  return Object.values(HOUSE_GROUPS).filter(g => g.houses.includes(h)).map(g => g.label);
}

function houseCardHtml(h, ctx) {
  const { cusps, sig, byName, occupantsOf, houseOf, signifies } = ctx;
  const c = cusps[String(h)];
  const sd = degToSign(c.longitude);
  const info = HOUSE_INFO[h];
  const signLord = SIGN_LORDS[sd.sign];
  const noteFor = (name) => (byName[name] ? `in H${houseOf(byName[name])}` : "");

  const chain = lordChain([
    { role: "Sign lord", name: signLord, note: noteFor(signLord) },
    { role: "Star lord", name: c.kp.star_lord, note: noteFor(c.kp.star_lord) },
    { role: "Sub lord",  name: c.kp.sub_lord,  note: noteFor(c.kp.sub_lord) },
  ]);

  const occ = occupantsOf[h];
  const subSig = signifies[c.kp.sub_lord] || [];

  let sigBlock;
  if (!sig) {
    sigBlock = `<p class="sub">Significators haven't been computed yet — press Calculate above.</p>`;
  } else {
    const hd = sig[String(h)] || {};
    const rows = LEVELS.map(lv => {
      const list = hd[lv.key] || [];
      if (!list.length) return "";
      return `<div class="lvl-row">
        <span class="lvl-n lv${lv.n}" title="Level ${lv.n}">${lv.n}</span>
        <div class="lvl-body"><div class="lvl-lbl">${lv.label}</div><div>${list.map(n => ppill(n)).join("")}</div></div>
      </div>`;
    }).join("");
    const total = (hd.all || []).length;
    sigBlock = `<details class="sig-details" ${ctx.openSig ? "open" : ""}>
      <summary><span>Significators</span><span class="sum-count">${total}</span></summary>
      ${rows || '<p class="sub">No significators found.</p>'}
    </details>`;
  }

  return `<article class="hcard" data-house="${h}">
    <header class="hc-head">
      <div class="hc-num">${h}</div>
      <div class="hc-title">
        <h4>${info.name} <span>· ${info.topic}</span></h4>
        <div class="hc-tags">${groupsOf(h).map(g => tag(g)).join("")}</div>
      </div>
    </header>

    <div class="hc-cusp">
      <span class="mono hc-cusp-deg">${fmtDM(sd)}</span>
      <span class="hc-cusp-sign">${sd.sign}</span>
      <span class="hc-cusp-nk">${c.kp.nakshatra} ${padaDots(c.kp.pada)}</span>
    </div>

    ${chain}

    <dl class="hc-facts">
      <div><dt>Occupants</dt><dd>${occ.length ? occ.map(p => ppill(p.name)).join("") : '<span class="sub">Vacant</span>'}</dd></div>
      <div><dt>Sub lord signifies</dt><dd>${sig
        ? (subSig.length ? subSig.map(n => hpill(n, n === h ? "self" : "")).join("") : '<span class="sub">—</span>')
        : '<span class="sub">Needs significators</span>'}</dd></div>
    </dl>

    ${sigBlock}
  </article>`;
}

function cuspTableHtml(ctx) {
  const { cusps, byName, houseOf, signifies } = ctx;
  const rows = Object.keys(cusps).sort((a, b) => a - b).map(h => {
    const c = cusps[h];
    const sd = degToSign(c.longitude);
    const sub = signifies[c.kp.sub_lord] || [];
    return `<tr>
      <td class="sticky-col"><b class="tbl-h">${h}</b> <span class="sub">${HOUSE_INFO[h].name}</span></td>
      <td class="mono">${sd.text}</td>
      <td>${c.kp.nakshatra}</td>
      <td class="mono">${c.kp.pada}</td>
      <td><span class="pill">${SIGN_LORDS[sd.sign]}</span></td>
      <td><span class="pill">${c.kp.star_lord}</span></td>
      <td><span class="pill gold">${c.kp.sub_lord}</span></td>
      <td>${sub.length ? sub.map(n => hpill(n)).join("") : '<span class="sub">—</span>'}</td>
    </tr>`;
  }).join("");
  return `<div class="panel">
    <h3><span class="mk">◆</span>House cusps — KP sub-lords</h3>
    <div class="tbl-scroll">
      <table class="wide-table">
        <thead><tr><th class="sticky-col">House</th><th>Cusp</th><th>Nakshatra</th><th>Pada</th><th>Sign lord</th><th>Star lord</th><th>Sub lord</th><th>Sub lord signifies</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="sub an-note">The cusp sub lord is what actually decides whether a house's matters will fructify.</p>
  </div>`;
}

function sigTableHtml(sig) {
  if (!sig) {
    return `<div class="panel"><h3><span class="mk">◆</span>House significators — four KP levels</h3><p class="sub">Significators haven't been computed yet — press Calculate above.</p></div>`;
  }
  const rows = Object.keys(sig).sort((a, b) => a - b).map(h => {
    const cells = LEVELS.map(lv => {
      const list = sig[h][lv.key] || [];
      return `<td>${list.length ? list.map(n => ppill(n)).join("") : '<span class="sub">—</span>'}</td>`;
    }).join("");
    return `<tr><td class="sticky-col"><b class="tbl-h">${h}</b></td>${cells}</tr>`;
  }).join("");
  return `<div class="panel">
    <h3><span class="mk">◆</span>House significators — four KP levels</h3>
    <div class="tbl-scroll">
      <table class="wide-table">
        <thead><tr><th class="sticky-col">House</th>${LEVELS.map(l => `<th>${l.n}. ${l.label}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// Planet x house grid: each cell shows the strongest level (1 = strongest)
// at which that planet signifies that house.
function matrixHtml(sig, planetNames) {
  if (!sig) return "";
  const best = {};   // planet -> house -> level number
  Object.keys(sig).forEach(h => {
    LEVELS.forEach(lv => {
      (sig[h][lv.key] || []).forEach(n => {
        best[n] = best[n] || {};
        if (!best[n][h] || lv.n < best[n][h]) best[n][h] = lv.n;
      });
    });
  });
  const houses = Array.from({ length: 12 }, (_, i) => i + 1);
  const rows = planetNames.map(n => `<tr>
    <th class="sticky-col mx-name" scope="row" title="${n}">${pbadge(n)}<span>${n}</span></th>
    ${houses.map(h => {
      const lv = best[n] && best[n][h];
      return lv
        ? `<td><span class="mx lv${lv}" title="${n} · House ${h} · Level ${lv}">${lv}</span></td>`
        : `<td><span class="mx none">·</span></td>`;
    }).join("")}
  </tr>`).join("");

  return `<div class="panel">
    <h3><span class="mk">◆</span>Significator matrix — planet × house</h3>
    <div class="tbl-scroll">
      <table class="mx-table">
        <thead><tr><th class="sticky-col"></th>${houses.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="mx-legend">
      ${LEVELS.map(l => `<span><span class="mx lv${l.n}">${l.n}</span>${l.label}</span>`).join("")}
    </div>
  </div>`;
}

export function render(container) {
  const chart = getChart();
  const sig = getSignificators();
  if (!chart) { container.innerHTML = emptyState(); return; }

  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));
  const houseOf = (p) => houseOfLongitude(p.longitude, cusps);

  const occupantsOf = {};
  for (let h = 1; h <= 12; h++) occupantsOf[h] = [];
  planets.forEach(p => occupantsOf[houseOf(p)].push(p));

  // planet -> houses it signifies (any level), from the significators data
  const signifies = {};
  if (sig) {
    Object.keys(sig).forEach(h => {
      (sig[h].all || []).forEach(n => {
        (signifies[n] = signifies[n] || []).push(Number(h));
      });
    });
    Object.values(signifies).forEach(list => list.sort((a, b) => a - b));
  }

  const ctx = {
    cusps, sig, byName, occupantsOf, houseOf, signifies,
    openSig: window.matchMedia && window.matchMedia("(min-width: 721px)").matches,
  };

  const groupOptions = [["all", "All houses"], ...Object.entries(HOUSE_GROUPS).map(([k, g]) => [k, g.label])];
  const shown = group === "all"
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : HOUSE_GROUPS[group].houses;

  const filterRow = `<div class="subtab-row hfilter" role="group" aria-label="Filter houses by type">${
    groupOptions.map(([k, label]) => `<button type="button" class="subtab-btn${k === group ? " active" : ""}" data-group="${k}">${label}</button>`).join("")
  }</div>`;

  const cardsView = `${filterRow}<div class="hc-grid">${shown.map(h => houseCardHtml(h, ctx)).join("")}</div>`;
  const tableView = `${cuspTableHtml(ctx)}${sigTableHtml(sig)}`;

  container.innerHTML = `
    <div class="an-toolbar">
      <div class="an-toolbar-title">12 houses · Placidus cusps · four-level significators</div>
      ${segmented("house-view", [["cards", "Cards"], ["table", "Table"]], view)}
    </div>
    ${view === "table" ? tableView : cardsView}
    ${matrixHtml(sig, planets.map(p => p.name))}
    <p class="sub an-note">The cusp sub lord is what actually decides whether a house's matters will fructify — look at which houses it signifies. Level 1 (planets in the star of an occupant) is the strongest significator; level 4 the weakest.</p>
  `;

  bindSeg(container, "house-view", (val) => { view = val; render(container); });
  container.querySelectorAll(".hfilter .subtab-btn").forEach(btn => {
    btn.addEventListener("click", () => { group = btn.dataset.group; render(container); });
  });
}
