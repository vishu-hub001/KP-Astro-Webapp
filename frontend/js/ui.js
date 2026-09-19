// ui.js -- small presentation helpers shared by the analysis sections
// (Planets, Houses, Rashi, Nakshatra). Pure HTML-string builders plus a
// few static reference tables; no API calls and no store access.
import { PLANET_ABBR, DIGNITY_COLOR } from "./helpers.js";

/* ---------- planet colours & labels ---------- */
export const PLANET_COLOR = {
  Sun: "#c2691a", Moon: "#5f7396", Mars: "#bb4b3f", Mercury: "#2f8f5b",
  Jupiter: "#a9762c", Venus: "#b0507f", Saturn: "#3c4a70",
  Rahu: "#6a5590", Ketu: "#8a6a3f", Asc: "#26365c",
};

export function abbr(name) {
  if (name === "Asc") return "As";
  return PLANET_ABBR[name] || String(name).slice(0, 2);
}

export function colorOf(name) {
  return PLANET_COLOR[name] || "#69748a";
}

/* ---------- static reference data (classical, display-only) ---------- */
export const HOUSE_INFO = {
  1:  { name: "Tanu",   topic: "Self, body, vitality" },
  2:  { name: "Dhana",  topic: "Wealth, family, speech" },
  3:  { name: "Sahaja", topic: "Siblings, courage, skills" },
  4:  { name: "Sukha",  topic: "Home, mother, property" },
  5:  { name: "Putra",  topic: "Children, intellect, romance" },
  6:  { name: "Ari",    topic: "Debts, disease, service" },
  7:  { name: "Kalatra",topic: "Marriage, partnerships" },
  8:  { name: "Ayu",    topic: "Longevity, sudden change" },
  9:  { name: "Dharma", topic: "Fortune, father, higher learning" },
  10: { name: "Karma",  topic: "Career, status, authority" },
  11: { name: "Labha",  topic: "Gains, income, networks" },
  12: { name: "Vyaya",  topic: "Losses, foreign, moksha" },
};

export const HOUSE_GROUPS = {
  kendra:   { label: "Kendra",   houses: [1, 4, 7, 10] },
  trikona:  { label: "Trikona",  houses: [1, 5, 9] },
  dusthana: { label: "Dusthana", houses: [6, 8, 12] },
  upachaya: { label: "Upachaya", houses: [3, 6, 10, 11] },
  maraka:   { label: "Maraka",   houses: [2, 7] },
};

// Vimshottari order -- the 27 nakshatras cycle through these lords 3 times.
export const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
export const nakshatraLord = (i0) => DASHA_ORDER[i0 % 9];

export const LEVELS = [
  { key: "level_1", n: 1, label: "In star of occupant" },
  { key: "level_2", n: 2, label: "Occupant" },
  { key: "level_3", n: 3, label: "Owner" },
  { key: "level_4", n: 4, label: "In star of owner" },
];

/* ---------- formatting ---------- */
export function fmtDM(sd) {
  return `${sd.deg}°${String(sd.min).padStart(2, "0")}′`;
}

// Longitude -> "Tau 10°00′" (isEnd: a value sitting exactly on a sign
// boundary is shown as 30°00′ of the previous sign, not 0°00′ of the next).
export function fmtLon(lon, isEnd = false) {
  const SIGN3 = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
  const norm = ((lon % 360) + 360) % 360 || (isEnd ? 360 : 0);
  const idx = Math.min(11, Math.floor((norm - (isEnd ? 1e-9 : 0)) / 30));
  const totalMin = Math.round((norm - idx * 30) * 60);
  return `${SIGN3[idx]} ${Math.floor(totalMin / 60)}°${String(totalMin % 60).padStart(2, "0")}′`;
}

/* ---------- building blocks ---------- */
export function emptyState() {
  return `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
}

export function pbadge(name, cls = "") {
  return `<span class="pbadge ${cls}" style="--pc:${colorOf(name)}" aria-hidden="true">${abbr(name)}</span>`;
}

// Planet pill: tinted with the planet's colour, with an optional suffix
// (e.g. degrees, or an R flag).
export function ppill(name, suffix = "") {
  return `<span class="ppill" style="--pc:${colorOf(name)}"><i></i>${name}${suffix ? `<em>${suffix}</em>` : ""}</span>`;
}

export function hpill(h, cls = "") {
  return `<span class="hpill ${cls}">H${h}</span>`;
}

// Sign lord -> star lord -> sub lord: the KP "chain" every point carries.
// items: [{ role, name, note? }]
export function lordChain(items) {
  return `<div class="kp-chain">${items.map((it, i) => `
    ${i ? '<span class="kc-arrow" aria-hidden="true">›</span>' : ""}
    <div class="kc-node">
      ${pbadge(it.name)}
      <div class="kc-txt">
        <span class="kc-role">${it.role}</span>
        <span class="kc-name">${it.name}</span>
        ${it.note ? `<span class="kc-note">${it.note}</span>` : ""}
      </div>
    </div>`).join("")}</div>`;
}

// Pada (quarter 1-4) as four segments with the active one lit.
export function padaDots(pada) {
  return `<span class="pada" title="Pada ${pada} of 4" aria-label="Pada ${pada} of 4">${
    [1, 2, 3, 4].map(i => `<i class="${i === pada ? "on" : ""}"></i>`).join("")
  }<b>${pada}</b></span>`;
}

export function dignityTag(d) {
  if (!d) return "";
  const c = DIGNITY_COLOR[d] || "#69748a";
  return `<span class="dtag" style="color:${c}; border-color:${c}; background:${c}18;">${d.replace(" Sign", "")}</span>`;
}

export function tag(text, cls = "") {
  return `<span class="tag ${cls}">${text}</span>`;
}

export function chip(n, label, cls = "") {
  return `<div class="chip${cls ? " " + cls : ""}"><span class="chip-n">${n}</span><span class="chip-l">${label}</span></div>`;
}

/* ---------- segmented control (Cards | Table, Occupied | All ...) ---------- */
export function segmented(id, options, active) {
  return `<div class="seg" role="group" data-seg="${id}">${options.map(([val, label]) =>
    `<button type="button" class="${val === active ? "active" : ""}" data-val="${val}" aria-pressed="${val === active}">${label}</button>`
  ).join("")}</div>`;
}

export function bindSeg(root, id, onChange) {
  const el = root.querySelector(`.seg[data-seg="${id}"]`);
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => onChange(btn.dataset.val));
  });
}
