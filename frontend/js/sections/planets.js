// sections/planets.js -- every planet (and the ascendant) with its sign,
// nakshatra, pada and the KP chain: sign lord -> star lord -> sub lord.
// Two views: rich cards (default, best on phones) and a compact table.
import { getChart } from "../state.js";
import {
  degToSign, houseOfLongitude, isCombust, getDignity, SIGN_LORDS,
} from "../helpers.js";
import {
  emptyState, pbadge, lordChain, padaDots, dignityTag, tag, chip,
  segmented, bindSeg, hpill, fmtDM, colorOf,
} from "../ui.js";

// Held at module scope so the choice survives store-driven re-renders.
let view = "cards";

const STRONG = new Set(["Exalted", "Moolatrikona", "Own Sign"]);

function buildRows(chart) {
  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));
  const houseOf = (p) => (p ? houseOfLongitude(p.longitude, cusps) : null);

  // Houses each planet rules, judged by the sign on each cusp.
  const rules = {};
  for (let h = 1; h <= 12; h++) {
    const lord = SIGN_LORDS[degToSign(cusps[String(h)].longitude).sign];
    (rules[lord] = rules[lord] || []).push(h);
  }

  const mk = (name, lon, kp, extra) => {
    const sd = degToSign(lon);
    return {
      name, lon, sd, kp,
      // Sign is derived from the longitude itself: the sub-lord table labels
      // a row that straddles a sign boundary with only its starting sign.
      sign: sd.sign,
      signLord: SIGN_LORDS[sd.sign],
      starHouse: houseOf(byName[kp.star_lord]),
      subHouse: houseOf(byName[kp.sub_lord]),
      signLordHouse: houseOf(byName[SIGN_LORDS[sd.sign]]),
      ...extra,
    };
  };

  const ascRow = mk("Asc", chart.houses.ascendant, chart.houses.ascendant_kp, {
    isAsc: true, house: 1, retro: false, combust: false, speed: null, dignity: null, rules: [],
  });

  const rows = planets.map(p => mk(p.name, p.longitude, p.kp, {
    isAsc: false,
    house: houseOf(p),
    retro: !!p.is_retrograde,
    combust: !!(sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)),
    speed: p.speed,
    dignity: getDignity(p.name, p.longitude),
    rules: rules[p.name] || [],
  }));

  return { ascRow, rows };
}

function cardHtml(r) {
  const pct = ((r.sd.deg + r.sd.min / 60 + r.sd.sec / 3600) / 30 * 100).toFixed(1);
  const flags = [
    r.isAsc ? tag("Lagna") : "",
    r.retro ? tag("Retro", "tag-r") : "",
    r.combust ? tag("Combust", "tag-c") : "",
  ].join("");

  const chain = lordChain([
    { role: "Sign lord", name: r.signLord, note: r.signLordHouse ? `in H${r.signLordHouse}` : "" },
    { role: "Star lord", name: r.kp.star_lord, note: r.starHouse ? `in H${r.starHouse}` : "" },
    { role: "Sub lord",  name: r.kp.sub_lord,  note: r.subHouse ? `in H${r.subHouse}` : "" },
  ]);

  const facts = [
    `<div><dt>Nakshatra</dt><dd>${r.kp.nakshatra} ${padaDots(r.kp.pada)}</dd></div>`,
    r.isAsc
      ? `<div><dt>Role</dt><dd>Lagna · house 1 cusp</dd></div>`
      : `<div><dt>Rules</dt><dd>${r.rules.length ? r.rules.map(h => hpill(h)).join("") : '<span class="sub">— (node)</span>'}</dd></div>`,
    r.isAsc ? "" : `<div><dt>Speed</dt><dd class="mono">${r.speed.toFixed(4)}°/day</dd></div>`,
  ].join("");

  return `<article class="pcard${r.retro ? " is-retro" : ""}" style="--pc:${colorOf(r.name)}">
    <header class="pc-head">
      ${pbadge(r.name, "lg")}
      <div class="pc-title">
        <h4>${r.isAsc ? "Ascendant" : r.name}</h4>
        <div class="pc-flags">${flags}</div>
      </div>
      ${dignityTag(r.dignity)}
    </header>

    <div class="pc-pos">
      <div class="pc-pos-main">
        <span class="pc-deg mono">${fmtDM(r.sd)}</span>
        <span class="pc-sign">${r.sign}</span>
        <span class="pc-house">House ${r.house}</span>
      </div>
      <div class="degbar" role="img" aria-label="${fmtDM(r.sd)} of 30° in ${r.sign}"><span style="left:${pct}%"></span></div>
    </div>

    ${chain}

    <dl class="pc-facts">${facts}</dl>
  </article>`;
}

function tableHtml(all) {
  const body = all.map(r => `<tr>
    <td class="sticky-col"><span class="tcell-name">${pbadge(r.name)}<span>${r.isAsc ? "Asc" : r.name}${r.retro ? '<span class="retro-flag">R</span>' : ""}${r.combust ? '<span class="combust-flag">C</span>' : ""}</span></span></td>
    <td class="mono">${r.sd.text}</td>
    <td>${r.sign}</td>
    <td>${r.house}</td>
    <td>${r.dignity ? dignityTag(r.dignity) : '<span class="sub">—</span>'}</td>
    <td>${r.kp.nakshatra}</td>
    <td class="mono">${r.kp.pada}</td>
    <td><span class="pill">${r.signLord}</span></td>
    <td><span class="pill">${r.kp.star_lord}</span></td>
    <td><span class="pill gold">${r.kp.sub_lord}</span></td>
    <td class="mono">${r.speed === null ? "—" : r.speed.toFixed(4) + "°/d"}</td>
  </tr>`).join("");

  return `<div class="panel">
    <h3><span class="mk">◆</span>Planets &amp; ascendant — full KP breakdown</h3>
    <div class="tbl-scroll">
      <table class="wide-table">
        <thead><tr><th class="sticky-col">Point</th><th>Position</th><th>Sign</th><th>House</th><th>Dignity</th><th>Nakshatra</th><th>Pada</th><th>Sign lord</th><th>Star lord</th><th>Sub lord</th><th>Speed</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

export function render(container) {
  const chart = getChart();
  if (!chart) { container.innerHTML = emptyState(); return; }

  const { ascRow, rows } = buildRows(chart);
  const all = [ascRow, ...rows];

  const nRetro = rows.filter(r => r.retro).length;
  const nCombust = rows.filter(r => r.combust).length;
  const nStrong = rows.filter(r => STRONG.has(r.dignity)).length;
  const nDebil = rows.filter(r => r.dignity === "Debilitated").length;

  container.innerHTML = `
    <div class="chip-row an-chips">
      ${chip(nRetro, "Retrograde")}
      ${chip(nCombust, "Combust", nCombust ? "warn" : "")}
      ${chip(nStrong, "Exalted / own", nStrong ? "good" : "")}
      ${chip(nDebil, "Debilitated", nDebil ? "warn" : "")}
    </div>

    <div class="an-toolbar">
      <div class="an-toolbar-title">${all.length} points · sign lord › star lord › sub lord</div>
      ${segmented("planet-view", [["cards", "Cards"], ["table", "Table"]], view)}
    </div>

    ${view === "table"
      ? tableHtml(all)
      : `<div class="pc-grid">${all.map(cardHtml).join("")}</div>`}

    <p class="sub an-note">In KP, the sub lord of a planet or cusp — not the sign or even the nakshatra — is treated as the deciding factor for what that point actually promises. “In H#” shows where each lord sits in this chart.</p>
  `;

  bindSeg(container, "planet-view", (val) => { view = val; render(container); });
}
