// sections/rashi.js -- the chart re-read sign by sign. A zodiac wheel
// shows every planet at its real longitude; twelve sign cards list the
// lord, occupants and any house cusps that fall in each sign.
import { getChart } from "../state.js";
import {
  SIGNS, SIGN_LORDS, SIGN_ELEMENT, SIGN_QUALITY, ELEMENT_COLOR, QUALITY_COLOR,
  degToSign, houseOfLongitude,
} from "../helpers.js";
import {
  emptyState, pbadge, ppill, hpill, tag, chip, segmented, bindSeg,
  fmtDM, abbr, colorOf,
} from "../ui.js";

// Held at module scope so the choice survives store-driven re-renders.
let filter = "all";

const SIGN3 = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];

/* ---------- zodiac wheel (SVG) ---------- */
function polar(cx, cy, r, lon) {
  const a = (lon - 90) * Math.PI / 180;   // Aries 0° at the top, clockwise
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function sectorPath(cx, cy, r0, r1, lon0, lon1) {
  const [x0, y0] = polar(cx, cy, r1, lon0);
  const [x1, y1] = polar(cx, cy, r1, lon1);
  const [x2, y2] = polar(cx, cy, r0, lon1);
  const [x3, y3] = polar(cx, cy, r0, lon0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}

function wheelSvg(planets, ascLon, occupied, lagnaSign) {
  const cx = 160, cy = 160, R = 150, r0 = 62, rLabel = 138;
  const tiers = [116, 100, 84, 70];

  const sectors = SIGNS.map((s, i) => {
    const el = SIGN_ELEMENT[s];
    const isLagna = s === lagnaSign;
    const has = occupied.has(s);
    const [lx, ly] = polar(cx, cy, rLabel, i * 30 + 15);
    return `<g>
      <path d="${sectorPath(cx, cy, r0, R, i * 30, (i + 1) * 30)}"
        fill="${ELEMENT_COLOR[el]}" fill-opacity="${has ? 0.2 : 0.07}"
        style="stroke:var(--line-strong)" stroke-width="1"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
        class="wh-sign${has ? " has" : ""}">${SIGN3[i]}</text>
    </g>`;
  }).join("");

  // Lagna sign outline is drawn after every sector so no neighbour paints over it.
  const lagnaIdx = SIGNS.indexOf(lagnaSign);
  const lagnaRing = lagnaIdx < 0 ? "" : `<path d="${sectorPath(cx, cy, r0, R, lagnaIdx * 30, (lagnaIdx + 1) * 30)}" fill="none" style="stroke:var(--gold)" stroke-width="2.4" stroke-linejoin="round"/>`;

  // Place planets at their real longitude. When badges would collide (judged by
  // actual pixel distance, since angular spacing shrinks toward the centre)
  // a planet drops to the next tier inward, or the one with most clearance.
  const MIN_D = 18.5;
  const placed = [];
  const marks = [...planets].sort((a, b) => a.longitude - b.longitude).map(p => {
    const cands = tiers.map(r => polar(cx, cy, r, p.longitude));
    const clearance = (pt) => placed.reduce((m, q) => Math.min(m, Math.hypot(pt[0] - q[0], pt[1] - q[1])), Infinity);
    let pick = cands.findIndex(pt => clearance(pt) >= MIN_D);
    if (pick < 0) {
      const scores = cands.map(clearance);
      pick = scores.indexOf(Math.max(...scores));
    }
    const [x, y] = cands[pick];
    placed.push([x, y]);
    const sd = degToSign(p.longitude);
    return `<g class="wh-pl" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <title>${p.name} · ${sd.sign} ${fmtDM(sd)}${p.is_retrograde ? " · Retrograde" : ""}</title>
      <circle r="8.5" fill="${colorOf(p.name)}"/>
      <text text-anchor="middle" dominant-baseline="central" class="wh-pl-t">${abbr(p.name)}</text>
      ${p.is_retrograde ? `<circle cx="7" cy="-7" r="3.2" fill="var(--retro)" stroke="#fff" stroke-width="1"/>` : ""}
    </g>`;
  }).join("");

  const [ax0, ay0] = polar(cx, cy, r0, ascLon);
  const [ax1, ay1] = polar(cx, cy, R + 6, ascLon);
  const [ax2, ay2] = polar(cx, cy, R + 4, ascLon);
  const asc = `<line x1="${ax0.toFixed(1)}" y1="${ay0.toFixed(1)}" x2="${ax1.toFixed(1)}" y2="${ay1.toFixed(1)}" stroke="var(--gold)" stroke-width="1.6" stroke-dasharray="3 3"/>
    <g transform="translate(${ax2.toFixed(1)} ${ay2.toFixed(1)})"><circle r="5.5" fill="var(--gold)"/><text text-anchor="middle" dominant-baseline="central" class="wh-asc-t">A</text></g>`;

  return `<svg class="rashi-wheel" viewBox="0 0 320 320" role="img" aria-label="Zodiac wheel showing planets by sign, Aries at the top">
    ${sectors}
    ${lagnaRing}
    <circle cx="${cx}" cy="${cy}" r="${r0}" fill="var(--navy)"/>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="wh-c1">RASHI</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="wh-c2">Aries at top ↻</text>
    ${asc}
    ${marks}
  </svg>`;
}

/* ---------- sign cards ---------- */
function signCardHtml(sign, i, ctx) {
  const { planets, byName, cusps, houseOf, moonSign, lagnaSign } = ctx;
  const el = SIGN_ELEMENT[sign];
  const q = SIGN_QUALITY[sign];
  const lord = SIGN_LORDS[sign];
  const occ = planets.filter(p => degToSign(p.longitude).sign === sign)
    .sort((a, b) => a.longitude - b.longitude);
  const cuspHouses = Object.keys(cusps).filter(h => degToSign(cusps[h].longitude).sign === sign).map(Number);
  const lp = byName[lord];
  const lpSign = lp ? degToSign(lp.longitude).sign : null;
  const lordAt = lp
    ? (lpSign === sign
        ? `in own sign · H${houseOf(lp)}`
        : `in ${lpSign} · H${houseOf(lp)}`)
    : "";

  const badges = [
    sign === lagnaSign ? tag("Lagna", "tag-gold") : "",
    sign === moonSign ? tag("Moon sign", "tag-blue") : "",
  ].join("");

  return `<article class="scard${occ.length ? "" : " is-empty"}${sign === lagnaSign ? " is-lagna" : ""}" style="--ec:${ELEMENT_COLOR[el]}">
    <header class="sc-head">
      <div class="sc-num">${i + 1}</div>
      <div class="sc-title">
        <h4>${sign}</h4>
        <div class="sc-tags">
          <span class="etag" style="--tc:${ELEMENT_COLOR[el]}">${el}</span>
          <span class="etag" style="--tc:${QUALITY_COLOR[q]}">${q}</span>
        </div>
      </div>
      <div class="sc-badges">${badges}</div>
    </header>

    <dl class="sc-facts">
      <div class="sc-lord"><dt>Sign lord</dt><dd>${pbadge(lord)}<span><b>${lord}</b>${lordAt ? `<small>${lordAt}</small>` : ""}</span></dd></div>
      <div><dt>Planets</dt><dd>${occ.length
        ? occ.map(p => ppill(p.name, `${fmtDM(degToSign(p.longitude))}${p.is_retrograde ? " R" : ""}`)).join("")
        : '<span class="sub">None</span>'}</dd></div>
      <div><dt>Cusps</dt><dd>${cuspHouses.length
        ? cuspHouses.map(h => hpill(h)).join("")
        : '<span class="sub">None</span>'}</dd></div>
    </dl>
  </article>`;
}

export function render(container) {
  const chart = getChart();
  if (!chart) { container.innerHTML = emptyState(); return; }

  const planets = chart.positions.planets;
  const cusps = chart.houses.cusps;
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));
  const houseOf = (p) => houseOfLongitude(p.longitude, cusps);
  const moon = byName.Moon;
  // Signs come from the longitudes (the sub-lord table's own sign label is
  // wrong for the few sub-rows that straddle a sign boundary).
  const moonSign = moon ? degToSign(moon.longitude).sign : null;
  const lagnaSign = degToSign(chart.houses.ascendant).sign;

  const counts = Object.fromEntries(SIGNS.map(s => [s, planets.filter(p => degToSign(p.longitude).sign === s).length]));
  const occupied = new Set(SIGNS.filter(s => counts[s] > 0));
  const nEmpty = 12 - occupied.size;
  const [topSign, topN] = SIGNS.reduce((a, s) => counts[s] > a[1] ? [s, counts[s]] : a, ["—", 0]);

  const ctx = { planets, byName, cusps, houseOf, moonSign, lagnaSign };
  const list = SIGNS.map((s, i) => ({ s, i })).filter(({ s }) => filter === "all" || occupied.has(s));

  container.innerHTML = `
    <div class="panel rashi-hero">
      <div class="rashi-wheel-wrap">${wheelSvg(planets, chart.houses.ascendant, occupied, lagnaSign)}</div>
      <div class="rashi-side">
        <h3><span class="mk">◆</span>Sign overview</h3>
        <div class="chip-row">
          ${chip(lagnaSign, "Lagna sign")}
          ${chip(moonSign || "—", "Moon sign")}
          ${chip(occupied.size, "Occupied signs")}
          ${chip(nEmpty, "Empty signs")}
        </div>
        <p class="sub rashi-line">${topN > 1
          ? `<b>${topSign}</b> is the busiest sign with ${topN} planets.`
          : "No sign holds more than one planet."}</p>
        <div class="wh-legend">
          ${Object.entries(ELEMENT_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join("")}
          <span><i class="lg-asc"></i>Ascendant</span>
          <span><i class="lg-retro"></i>Retrograde</span>
        </div>
      </div>
    </div>

    <div class="an-toolbar">
      <div class="an-toolbar-title">${list.length} of 12 signs</div>
      ${segmented("rashi-filter", [["all", "All signs"], ["occ", "Occupied only"]], filter)}
    </div>

    <div class="sc-grid">${list.map(({ s, i }) => signCardHtml(s, i, ctx)).join("")}</div>
  `;

  bindSeg(container, "rashi-filter", (val) => { filter = val; render(container); });
}
