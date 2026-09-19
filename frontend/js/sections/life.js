// sections/life.js -- "Life overview": one place with many sub-sections,
// each reading a traditional cluster of houses for a specific life topic
// (career, marriage, finance, health, etc.) via cusp sub-lords and their
// significators. Replaces the old single-purpose Health analysis section
// with a broader, tabbed view built on the same underlying data.
import { getChart, getSignificators } from "../state.js";
import { degToSign, isCombust, SIGN_LORDS, houseOfLongitude } from "../helpers.js";
import {
  emptyState, lordChain, padaDots, ppill, hpill, tag, chip, fmtDM, HOUSE_INFO,
} from "../ui.js";

const LIFE_AREAS = [
  { key: "self",      icon: "◉", label: "Self & vitality",           houses: ["1"],                note: "Personality, physical body, general vitality, and how the native presents to the world." },
  { key: "wealth",     icon: "◈", label: "Wealth & finance",          houses: ["2", "11"],          note: "Accumulated wealth, family assets, savings, and income." },
  { key: "siblings",   icon: "◇", label: "Siblings & courage",        houses: ["3"],                note: "Younger siblings, courage, short journeys, communication." },
  { key: "home",       icon: "⌂", label: "Home & property",           houses: ["4"],                note: "Mother, fixed property, vehicles, and domestic comfort." },
  { key: "education",  icon: "✦", label: "Education & romance",       houses: ["4", "5", "9"],      note: "Learning, intellect, creativity, romance, and progeny." },
  { key: "health",     icon: "✚", label: "Health & disease",          houses: ["1", "6", "8", "12"],note: "General constitution, acute illness, chronic conditions, and hospitalization." },
  { key: "marriage",   icon: "♥", label: "Marriage & partnerships",   houses: ["2", "7", "11"],     note: "Spouse, marital harmony, and business partnerships." },
  { key: "career",     icon: "▲", label: "Career & profession",       houses: ["2", "6", "10", "11"], note: "Status, profession, authority, daily work, and gains from career." },
  { key: "longevity",  icon: "∞", label: "Longevity & transformation",houses: ["8"],                note: "Life-span indications, sudden events, inheritance, and occult matters." },
  { key: "fortune",    icon: "☀", label: "Father & fortune",          houses: ["9"],                note: "Father, luck, higher learning, dharma, and long journeys." },
  { key: "gains",      icon: "◆", label: "Gains & aspirations",       houses: ["11"],               note: "Fulfilment of desires, income, elder siblings, and social circle." },
  { key: "foreign",    icon: "✈", label: "Foreign travel & losses",   houses: ["3", "9", "12"],     note: "Travel abroad, expenditure, isolation, and closure." },
];

// Keep the selected tab across re-renders (e.g. after a store update)
// by holding it at module scope rather than inside render().
let activeArea = "self";

function houseCardHtml(h, ctx) {
  const { cusps, byName, sig, sun } = ctx;
  const c = cusps[h];
  const sd = degToSign(c.longitude);
  const rashiLord = SIGN_LORDS[sd.sign] || "—";
  const info = HOUSE_INFO[h] || {};
  const occupants = ctx.planets.filter(p => houseOfLongitude(p.longitude, cusps) === Number(h));
  const sigList = sig ? (sig[h]?.all || []) : [];
  const stressed = sigList.filter(name => {
    const p = byName[name];
    if (!p) return false;
    return p.is_retrograde || (sun && isCombust(name, p.longitude, sun.longitude));
  });
  const lordPlacement = byName[c.kp.sub_lord]
    ? houseOfLongitude(byName[c.kp.sub_lord].longitude, cusps)
    : null;
  const noteFor = (name) => (byName[name] ? `in H${houseOfLongitude(byName[name].longitude, cusps)}` : "");

  const chain = lordChain([
    { role: "Rashi lord", name: rashiLord, note: noteFor(rashiLord) },
    { role: "Star lord",  name: c.kp.star_lord, note: noteFor(c.kp.star_lord) },
    { role: "Sub lord",   name: c.kp.sub_lord,  note: lordPlacement ? `in H${lordPlacement}` : "" },
  ]);

  return `<article class="hcard" data-house="${h}">
    <header class="hc-head">
      <div class="hc-num">${h}</div>
      <div class="hc-title">
        <h4>${info.name || ("House " + h)} <span>· ${info.topic || ""}</span></h4>
      </div>
    </header>

    <div class="hc-cusp">
      <span class="mono hc-cusp-deg">${fmtDM(sd)}</span>
      <span class="hc-cusp-sign">${sd.sign}</span>
      <span class="hc-cusp-nk">${c.kp.nakshatra} ${padaDots(c.kp.pada)}</span>
    </div>

    ${chain}

    <dl class="hc-facts">
      <div><dt>Occupants</dt><dd>${occupants.length ? occupants.map(p => ppill(p.name)).join("") : '<span class="sub">Vacant</span>'}</dd></div>
      <div><dt>Significators</dt><dd>${sig
        ? (sigList.length ? sigList.map(n => ppill(n)).join("") : '<span class="sub">None</span>')
        : '<span class="sub">Press Calculate to compute significators</span>'}</dd></div>
      <div><dt>Stressed</dt><dd>${stressed.length ? stressed.map(n => tag(n, "tag-r")).join("") : '<span class="sub">None flagged retro/combust</span>'}</dd></div>
    </dl>
  </article>`;
}

export function render(container) {
  const chart = getChart();
  const sig = getSignificators();

  if (!chart) { container.innerHTML = emptyState(); return; }

  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));

  const area = LIFE_AREAS.find(a => a.key === activeArea) || LIFE_AREAS[0];
  const ctx = { cusps, byName, sig, sun, planets };

  // Icon grid of life areas -- larger, tappable tiles rather than plain
  // text tabs, so the section reads consistently with the rest of the app.
  const tabs = LIFE_AREAS.map(a => `
    <button class="life-tile${a.key === area.key ? ' active' : ''}" data-area="${a.key}" title="${a.label}">
      <span class="lt-ic">${a.icon}</span>
      <span class="lt-lbl">${a.label}</span>
      <span class="lt-houses">${a.houses.map(h => hpill(h)).join("")}</span>
    </button>`).join("");

  // Summary chips for the active area, at a glance.
  const areaStressed = area.houses.reduce((sum, h) => {
    const sigList = sig ? (sig[h]?.all || []) : [];
    return sum + sigList.filter(name => {
      const p = byName[name];
      if (!p) return false;
      return p.is_retrograde || (sun && isCombust(name, p.longitude, sun.longitude));
    }).length;
  }, 0);
  const areaOccupants = area.houses.reduce((sum, h) => sum + planets.filter(p => houseOfLongitude(p.longitude, cusps) === Number(h)).length, 0);
  const areaVacant = area.houses.filter(h => !planets.some(p => houseOfLongitude(p.longitude, cusps) === Number(h))).length;

  const summaryChips = `<div class="chip-row">
    ${chip(area.houses.length, area.houses.length === 1 ? "House" : "Houses")}
    ${chip(areaOccupants, "Occupants")}
    ${chip(areaVacant, "Vacant", areaVacant ? "warn" : "")}
    ${chip(areaStressed, "Retro / combust", areaStressed ? "warn" : "good")}
  </div>`;

  const noteBox = area.key === "health"
    ? `<div class="err-box" style="background:var(--gold-bg); border-color:var(--gold); color:var(--gold);">
        ${area.note} This is a traditional KP interpretive framework shown for study purposes only. It is <strong>not medical advice or a diagnosis</strong>. For any actual health concern, please consult a qualified doctor.
      </div>`
    : `<p class="sub an-note" style="margin:0 0 14px;">${area.note}</p>`;

  const cards = area.houses.map(h => houseCardHtml(h, ctx)).join("");

  container.innerHTML = `
    <div class="life-tiles">${tabs}</div>
    ${summaryChips}
    ${noteBox}
    <div class="hc-grid life-hc-grid">${cards}</div>
  `;

  container.querySelectorAll(".life-tile").forEach(btn => {
    btn.addEventListener("click", () => {
      activeArea = btn.dataset.area;
      render(container);
    });
  });
}
