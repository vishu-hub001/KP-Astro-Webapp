// sections/life.js -- "Life overview": one place with many sub-sections,
// each reading a traditional cluster of houses for a specific life topic
// (career, marriage, finance, health, etc.) via cusp sub-lords and their
// significators. Replaces the old single-purpose Health analysis section
// with a broader, tabbed view built on the same underlying data.
import { getChart, getSignificators } from "../state.js";
import { degToSign, isCombust } from "../helpers.js";

const LIFE_AREAS = [
  { key: "self",      label: "Self & vitality",           houses: ["1"],                note: "Personality, physical body, general vitality, and how the native presents to the world." },
  { key: "wealth",     label: "Wealth & finance",          houses: ["2", "11"],          note: "Accumulated wealth, family assets, savings, and income." },
  { key: "siblings",   label: "Siblings & courage",        houses: ["3"],                note: "Younger siblings, courage, short journeys, communication." },
  { key: "home",       label: "Home & property",           houses: ["4"],                note: "Mother, fixed property, vehicles, and domestic comfort." },
  { key: "education",  label: "Education & romance",       houses: ["4", "5", "9"],      note: "Learning, intellect, creativity, romance, and progeny." },
  { key: "health",     label: "Health & disease",          houses: ["1", "6", "8", "12"],note: "General constitution, acute illness, chronic conditions, and hospitalization." },
  { key: "marriage",   label: "Marriage & partnerships",   houses: ["2", "7", "11"],     note: "Spouse, marital harmony, and business partnerships." },
  { key: "career",     label: "Career & profession",       houses: ["2", "6", "10", "11"], note: "Status, profession, authority, daily work, and gains from career." },
  { key: "longevity",  label: "Longevity & transformation",houses: ["8"],                note: "Life-span indications, sudden events, inheritance, and occult matters." },
  { key: "fortune",    label: "Father & fortune",          houses: ["9"],                note: "Father, luck, higher learning, dharma, and long journeys." },
  { key: "gains",      label: "Gains & aspirations",       houses: ["11"],               note: "Fulfilment of desires, income, elder siblings, and social circle." },
  { key: "foreign",    label: "Foreign travel & losses",   houses: ["3", "9", "12"],     note: "Travel abroad, expenditure, isolation, and closure." },
];

// Keep the selected tab across re-renders (e.g. after a store update)
// by holding it at module scope rather than inside render().
let activeArea = "self";

export function render(container) {
  const chart = getChart();
  const sig = getSignificators();

  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));

  const area = LIFE_AREAS.find(a => a.key === activeArea) || LIFE_AREAS[0];

  const tabs = LIFE_AREAS.map(a =>
    `<button class="subtab-btn${a.key === area.key ? ' active' : ''}" data-area="${a.key}">${a.label}</button>`
  ).join("");

  const cards = area.houses.map(h => {
    const c = cusps[h];
    const sd = degToSign(c.longitude);
    const sigList = sig ? (sig[h]?.all || []) : [];
    const stressed = sigList.filter(name => {
      const p = byName[name];
      if (!p) return false;
      return p.is_retrograde || (sun && isCombust(name, p.longitude, sun.longitude));
    });

    return `<div class="panel">
      <h3><span class="mk">◆</span>House ${h}</h3>
      <table><tbody>
        <tr><td>Cusp</td><td class="mono">${sd.text}</td></tr>
        <tr><td>Nakshatra</td><td>${c.kp.nakshatra} (pada ${c.kp.pada})</td></tr>
        <tr><td>Star lord</td><td><span class="pill">${c.kp.star_lord}</span></td></tr>
        <tr><td>Sub lord</td><td><span class="pill gold">${c.kp.sub_lord}</span></td></tr>
        <tr><td>Significators</td><td>${sigList.length ? sigList.map(n => `<span class="pill">${n}</span>`).join("") : '<span class="sub">Compute significators (press Calculate) to see this.</span>'}</td></tr>
        <tr><td>Retrograde / combust among them</td><td>${stressed.length ? stressed.map(n => `<span class="pill">${n}</span>`).join("") : '<span class="sub">None flagged</span>'}</td></tr>
      </tbody></table>
    </div>`;
  }).join("");

  const noteBox = area.key === "health"
    ? `<div class="err-box" style="background:var(--gold-bg); border-color:var(--gold); color:#6b4a15;">
        ${area.note} This is a traditional KP interpretive framework shown for study purposes only. It is <strong>not medical advice or a diagnosis</strong>. For any actual health concern, please consult a qualified doctor.
      </div>`
    : `<p class="sub" style="margin-bottom:14px;">${area.note}</p>`;

  container.innerHTML = `
    <div class="subtab-row">${tabs}</div>
    ${noteBox}
    <div class="life-cards">${cards}</div>
  `;

  container.querySelectorAll(".subtab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeArea = btn.dataset.area;
      render(container);
    });
  });
}
