// sections/horary.js -- Prashna: cast a chart for the moment of judgment,
// show the horary chart, the querent's number, ruling planets, a topic
// judgment and the full planet / cusp / significator tables.
import { callApi } from "../api.js";
import { getBirth } from "../state.js";
import {
  normTime, degToSign, houseOfLongitude, isCombust, SIGNS, SIGN_LORDS,
  PLANET_ABBR, getDignity,
} from "../helpers.js";
import { pbadge, ppill, hpill, tag, dignityTag, lordChain, HOUSE_INFO } from "../ui.js";

// Same 4x4 North Indian layout used on the Chart analysis page.
const NI_LAYOUT = {
  "2":[0,0], "1":[0,1], "12":[0,2], "11":[0,3],
  "3":[1,0],                       "10":[1,3],
  "4":[2,0],                       "9":[2,3],
  "5":[3,0], "6":[3,1], "7":[3,2], "8":[3,3],
};

const TOPIC_OPTIONS = {
  general: "General (no specific topic)", marriage: "Marriage / relationship",
  career: "Job / career", money: "Money / gain", property: "Property / vehicle purchase",
  education: "Education / exams", health: "Health / recovery", children: "Children",
  travel: "Foreign travel", litigation: "Litigation / dispute win",
};

// Module-scope so the last judgment survives store-driven re-renders.
let lastData = null;
let lastForm = { number: 108, topic: "general" };

const pad2 = (n) => String(n).padStart(2, "0");
const dm = (sd) => `${sd.sign.slice(0, 3)} ${sd.deg}°${pad2(sd.min)}'`;

export function render(container) {
  const b = getBirth();
  container.innerHTML = `
    <div class="analysis-grid hz-layout">
      <form class="panel form-panel hz-form" id="form-horary">
        <h3 style="text-transform:none; font-family:'Fraunces',serif; font-size:15px;">Judgment details</h3>
        <div class="field"><label>Horary number (1–249)</label><input type="number" min="1" max="249" id="horary-number" value="${lastForm.number}" required></div>
        <div class="field"><label>Topic of the question</label>
          <select id="horary-topic">${Object.entries(TOPIC_OPTIONS).map(([k, v]) => `<option value="${k}" ${k === lastForm.topic ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Date of judgment</label><input type="date" id="horary-date" value="${b.date || ''}" required></div>
        <div class="field"><label>Time of judgment</label><input type="time" step="1" id="horary-time" value="${(b.time||'').slice(0,5)}" required></div>
        <div class="field"><label>Timezone ±h</label><input type="number" step="0.25" id="horary-tz" value="${b.tz_offset_hours ?? ''}" required></div>
        <div class="field-inline">
          <div class="field"><label>Latitude</label><input type="number" step="any" id="horary-lat" value="${b.latitude ?? ''}" required></div>
          <div class="field"><label>Longitude</label><input type="number" step="any" id="horary-lng" value="${b.longitude ?? ''}" required></div>
        </div>
        <button type="button" class="sb-btn" id="horary-now" style="width:100%; margin-bottom:8px;">Use current date &amp; time</button>
        <button class="btn-primary" type="submit" id="horary-submit">Cast horary chart</button>
        <div class="err-box" id="horary-err" style="display:none; margin-top:10px;"></div>
      </form>
      <div id="horary-results"><div class="empty-box"><h3>No judgment yet</h3><p>Enter the querent's number, the topic and the moment of judgment, then cast the chart.</p></div></div>
    </div>
  `;

  document.getElementById("horary-now").addEventListener("click", () => {
    const n = new Date();
    document.getElementById("horary-date").value = `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
    document.getElementById("horary-time").value = `${pad2(n.getHours())}:${pad2(n.getMinutes())}`;
    document.getElementById("horary-tz").value = -n.getTimezoneOffset() / 60;
  });

  document.getElementById("form-horary").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("horary-err");
    errEl.style.display = "none";
    const btn = document.getElementById("horary-submit");
    const p = {
      number: document.getElementById("horary-number").value,
      date: document.getElementById("horary-date").value,
      time: normTime(document.getElementById("horary-time").value),
      tz_offset_hours: parseFloat(document.getElementById("horary-tz").value),
      latitude: parseFloat(document.getElementById("horary-lat").value),
      longitude: parseFloat(document.getElementById("horary-lng").value),
      topic: document.getElementById("horary-topic").value,
    };
    lastForm = { number: p.number, topic: p.topic };
    const qs = new URLSearchParams(p).toString();
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Working…`;
    try {
      const data = await callApi("/horary/?" + qs);
      lastData = data;
      renderResult(data);
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.innerHTML = "Cast horary chart";
    }
  });

  if (lastData) renderResult(lastData);
}

/* ---------------- result ---------------- */

function niChartHtml(chart, hp, asc) {
  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const byHouse = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = [];
  planets.forEach(p => byHouse[houseOfLongitude(p.longitude, cusps)].push(p));
  const maxOcc = Math.max(1, ...Object.values(byHouse).map(a => a.length));
  const plScale = Math.max(0.45, Math.min(1, 5 / maxOcc));

  let cells = "";
  for (const [h, [r, c]] of Object.entries(NI_LAYOUT)) {
    const sign = cusps[h].kp.sign;
    const pls = byHouse[h].map(p => {
      const cmb = sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude);
      const title = `${p.name} · ${degToSign(p.longitude).text} · House ${h}${p.is_retrograde ? " · Retrograde" : ""}${cmb ? " · Combust" : ""}`;
      return `<span class="pl" title="${title}">${PLANET_ABBR[p.name] || p.name.slice(0, 2)}${p.is_retrograde ? '<sup class="flag-r">R</sup>' : ""}${cmb ? '<sup class="flag-c">C</sup>' : ""}</span>`;
    }).join("");
    cells += `<div class="ni-cell${h === "1" ? " asc-house" : ""}${byHouse[h].length >= 4 ? " crowded" : ""}" style="grid-row:${r + 1}; grid-column:${c + 1}; cursor:default;">
      <span class="hnum">${h}</span>
      <span class="sign">${sign}<sup class="signno">${SIGNS.indexOf(sign) + 1}</sup></span>
      <div class="planets" style="--pl-scale:${plScale};">${pls}</div>
    </div>`;
  }
  return `<div class="ni-chart">${cells}
    <div class="ni-center" style="cursor:default;">
      <div class="nm">Horary #${hp.horary_number}</div>
      <div class="dt">${chart.input_date} ${chart.input_time}</div>
      <div class="lg">Lagna ${degToSign(asc).sign}</div>
    </div></div>`;
}

function renderResult(data) {
  const el = document.getElementById("horary-results");
  if (!el) return;
  const chart = data.chart;
  const inp = data.input || {};
  chart.input_date = inp.date || "";
  chart.input_time = (inp.time || "").slice(0, 5);

  const hp = data.horary_point || {};
  const rp = data.ruling_planets || {};
  const val = data.ruling_planets_validation || {};
  const isGenuine = val.is_valid ?? null;
  const matched = new Set(val.matched_lords || []);
  const rpAll = rp.all || [];
  const rpSet = new Set(rpAll);
  const sig = data.significators || {};
  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const asc = chart.houses.ascendant;
  const judgment = data.judgment;

  // planet -> houses it signifies (from the 4-level significator table)
  const signifies = {};
  for (let h = 1; h <= 12; h++) (sig[String(h)]?.all || []).forEach(n => { (signifies[n] ||= []).push(h); });
  const houseList = (name) => (signifies[name] || []).map(h => hpill(h)).join("") || '<span class="sub">—</span>';

  // ---- verdict banner
  const banner = isGenuine === null ? "" : `
    <div class="verdict ${isGenuine ? "yes" : "no"} hz-verdict">
      <div>
        <div class="big">${isGenuine ? "Genuine query" : "Doubtful query"}</div>
        <div class="sub">${isGenuine
          ? "The number's lords overlap with the ruling planets of the moment — the question is ripe for judgment."
          : "None of the number's lords appear among the ruling planets — traditionally the querent is asked to pick again."}</div>
      </div>
      <div class="hz-verdict-lords">
        ${[["Sign lord", val.sign_lord], ["Star lord", val.star_lord], ["Sub lord", val.sub_lord]].map(([r, n]) => `
          <div class="hz-vl ${matched.has(n) ? "hit" : ""}">${pbadge(n)}<span><i>${r}</i><b>${n}</b></span>${matched.has(n) ? '<em>✓ in RP</em>' : ""}</div>`).join("")}
      </div>
    </div>`;

  // ---- horary number card
  const numberCard = `
    <div class="panel">
      <h3><span class="mk">◆</span>Horary number ${hp.horary_number}</h3>
      ${lordChain([
        { role: "Sign lord", name: val.sign_lord || SIGN_LORDS[hp.sign] },
        { role: "Star lord", name: hp.star_lord },
        { role: "Sub lord",  name: hp.sub_lord },
      ])}
      <dl class="hc-facts" style="margin-top:12px;">
        <div><dt>Sign</dt><dd>${hp.sign}</dd></div>
        <div><dt>Nakshatra</dt><dd>${hp.nakshatra}</dd></div>
        <div><dt>Zodiac span</dt><dd class="mono">${typeof hp.start_deg === "number" ? `${dm(degToSign(hp.start_deg))} – ${dm(degToSign(hp.end_deg))}` : "—"}</dd></div>
        <div><dt>Sub lord signifies</dt><dd>${houseList(hp.sub_lord)}</dd></div>
      </dl>
    </div>`;

  // ---- ruling planets
  const rpSrc = [
    { l: "Day lord", n: rp.day_lord },
    { l: "Lagna sign lord", n: rp.ascendant?.sign_lord }, { l: "Lagna star lord", n: rp.ascendant?.star_lord }, { l: "Lagna sub lord", n: rp.ascendant?.sub_lord },
    { l: "Moon sign lord", n: rp.moon?.sign_lord }, { l: "Moon star lord", n: rp.moon?.star_lord }, { l: "Moon sub lord", n: rp.moon?.sub_lord },
  ].filter(x => x.n);
  const rpPanel = `
    <div class="panel">
      <h3><span class="mk">◆</span>Ruling planets of the moment</h3>
      <div class="hz-rp-all">
        ${rpAll.map(n => `<div class="hz-rp-card ${matched.has(n) ? "hit" : ""}">${pbadge(n, "lg")}<b>${n}</b><span class="hz-rp-h">${houseList(n)}</span></div>`).join("") || '<span class="sub">Not returned by the API.</span>'}
      </div>
      <div class="hz-rp-src">
        ${rpSrc.map(x => `<div class="hz-src"><span>${x.l}</span>${ppill(x.n)}</div>`).join("")}
      </div>
      <p class="sub an-note">Cards show each ruling planet with the houses it signifies. Highlighted ones match a lord of the horary number.</p>
    </div>`;

  // ---- topic judgment
  const VERDICT = {
    strongly_favorable: { t: "Favourable", c: "yes", d: "The horary sub lord signifies supporting houses and none of the denying ones." },
    strongly_unfavorable: { t: "Unfavourable", c: "no", d: "The horary sub lord signifies denying houses and none of the supporting ones." },
    mixed: { t: "Mixed", c: "warn", d: "The sub lord signifies both supporting and denying houses — the outcome comes with obstacles or delay." },
    inconclusive: { t: "Inconclusive", c: "", d: "The sub lord signifies neither the supporting nor the denying houses of this topic." },
  };
  let judgmentPanel = "";
  if (judgment) {
    const v = VERDICT[judgment.verdict] || VERDICT.inconclusive;
    const fav = new Set(judgment.favorable_matches || []);
    const unf = new Set(judgment.unfavorable_matches || []);
    judgmentPanel = `
      <div class="panel hz-judge ${v.c}">
        <h3><span class="mk">◆</span>Judgment · ${judgment.label}</h3>
        <div class="hz-judge-head"><span class="hz-judge-v ${v.c}">${v.t}</span><span class="sub">${v.d}</span></div>
        <dl class="hc-facts">
          <div><dt>Supporting houses</dt><dd>${judgment.favorable_houses.map(h => hpill(h, fav.has(String(h)) ? "on" : "")).join("")}</dd></div>
          <div><dt>Denying houses</dt><dd>${judgment.unfavorable_houses.map(h => hpill(h, unf.has(String(h)) ? "bad" : "")).join("")}</dd></div>
          <div><dt>${judgment.sub_lord} (horary sub lord) signifies</dt><dd>${(judgment.signifies_houses || []).map(h => hpill(h, fav.has(String(h)) ? "on" : unf.has(String(h)) ? "bad" : "")).join("") || '<span class="sub">—</span>'}</dd></div>
        </dl>
        <p class="sub an-note">House groupings follow common KP practice for this topic and are a guide, not a fixed rule. Judge alongside the ruling planets and the dasha/transit timing.</p>
      </div>`;
  }

  // ---- tables
  const planetRows = planets.map(p => {
    const sd = degToSign(p.longitude);
    const cmb = sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude);
    return `<tr>
      <td class="sticky-col"><span class="tcell-name">${pbadge(p.name)}<span>${p.name}${p.is_retrograde ? '<span class="retro-flag">R</span>' : ""}${cmb ? '<span class="combust-flag">C</span>' : ""}</span></span></td>
      <td class="mono">${sd.text}</td>
      <td>${hpill(houseOfLongitude(p.longitude, cusps))}</td>
      <td>${p.kp.nakshatra} <span class="sub">p${p.kp.pada}</span></td>
      <td>${ppill(p.kp.star_lord)}</td>
      <td>${ppill(p.kp.sub_lord)}</td>
      <td>${dignityTag(getDignity(p.name, p.longitude))}</td>
    </tr>`;
  }).join("");

  const cuspRows = Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
    const c = cusps[String(h)];
    const sd = degToSign(c.longitude);
    return `<tr>
      <td class="sticky-col"><b class="tbl-h">${h}</b> <span class="sub">${(HOUSE_INFO[h] || {}).name || ""}</span></td>
      <td>${sd.sign}</td><td class="mono">${sd.text}</td>
      <td>${ppill(c.kp.star_lord)}</td><td>${ppill(c.kp.sub_lord)}</td>
    </tr>`;
  }).join("");

  const sigRows = Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
    const s = sig[String(h)] || {};
    const cell = (k) => (s[k] || []).map(n => ppill(n)).join("") || '<span class="sub">—</span>';
    return `<tr><td class="sticky-col"><b class="tbl-h">${h}</b></td><td>${cell("level_1")}</td><td>${cell("level_2")}</td><td>${cell("level_3")}</td><td>${cell("level_4")}</td></tr>`;
  }).join("");

  const asck = chart.houses.ascendant_kp;
  el.innerHTML = `
    ${banner}
    <div class="hz-top">
      <div class="panel">
        <h3><span class="mk">◆</span>Horary chart · ${inp.date || ""} ${(inp.time || "").slice(0, 5)}</h3>
        ${niChartHtml(chart, hp, asc)}
        <p class="sub an-note">Lagna ${degToSign(asc).text} · star ${asck.star_lord} · sub ${asck.sub_lord}. Placidus cusps, sidereal.</p>
      </div>
      <div class="hz-side">
        ${numberCard}
        ${judgmentPanel}
      </div>
    </div>
    ${rpPanel}
    <div class="panel">
      <h3><span class="mk">◆</span>Planets at the moment of judgment</h3>
      <div class="tbl-scroll"><table>
        <thead><tr><th class="sticky-col">Planet</th><th>Position</th><th>House</th><th>Nakshatra</th><th>Star lord</th><th>Sub lord</th><th>Dignity</th></tr></thead>
        <tbody>${planetRows}</tbody>
      </table></div>
    </div>
    <div class="analysis-grid">
      <div class="panel">
        <h3><span class="mk">◆</span>House cusps</h3>
        <div class="tbl-scroll"><table>
          <thead><tr><th class="sticky-col">House</th><th>Sign</th><th>Cusp</th><th>Star lord</th><th>Sub lord</th></tr></thead>
          <tbody>${cuspRows}</tbody>
        </table></div>
      </div>
      <div class="panel">
        <h3><span class="mk">◆</span>House significators</h3>
        <div class="tbl-scroll"><table>
          <thead><tr><th class="sticky-col">House</th><th>L1 star of occupant</th><th>L2 occupant</th><th>L3 owner</th><th>L4 star of owner</th></tr></thead>
          <tbody>${sigRows}</tbody>
        </table></div>
      </div>
    </div>`;
}
