// sections/print.js -- build a compact, plain-text KP data summary that can
// be copied straight into an AI chat, plus a print / save-as-PDF button.
import { getChart, getSignificators, getDasha, getName, getBirth, getCityLabel } from "../state.js";
import { AYANAMSAS, getAyanamsa } from "../api.js";
import {
  SIGNS, PLANET_ABBR, degToSign, isCombust, getDignity, houseOfLongitude, SIGN_LORDS,
  getNaamAkshar, fmtDate,
} from "../helpers.js";
import { getAvakhadaChakra } from "../panchang.js";

const OPTIONS = [
  { key: "birth",   label: "Birth details & settings", on: true },
  { key: "chart",   label: "Birth chart diagram (North Indian) — PDF only", on: true },
  { key: "planets", label: "Planets (sign, house, nakshatra, pada, star/sub lord, flags)", on: true },
  { key: "cusps",   label: "House cusps (with sub lords)", on: true },
  { key: "sig",     label: "House significators (4 levels)", on: true },
  { key: "dasha",   label: "Vimshottari dasha (maha list + running period)", on: true },
  { key: "antar",   label: "All antardashas for every mahadasha (longer)", on: false },
  { key: "panchang", label: "Panchang & Avakhada (Moon-based)", on: true },
  { key: "prompt",  label: "Add a short instruction line for the AI", on: true },
];
// Module-scope so choices survive re-renders.
const chosen = Object.fromEntries(OPTIONS.map(o => [o.key, o.on]));
let lastText = "";

const dm = (sd) => `${sd.sign} ${sd.deg}°${String(sd.min).padStart(2, "0")}'${String(Math.round(sd.sec)).padStart(2, "0")}"`;
const d = (iso) => { try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return iso; } };


// Panchang & Avakhada entries, split into the most important / well-known
// items first and the remaining details after.
const MAIN_KEYS = ["Rashi (Moon sign)", "Rashi lord", "Nakshatra", "Nakshatra lord", "Naam Akshar", "Tithi", "Vaar (weekday)", "Yoga", "Karana", "Gana", "Nadi"];
const OTHER_KEYS = ["Varna", "Vashya", "Yoni", "Tatva", "Paya"];
function panchangEntries(chart) {
  const av = getAvakhadaChakra(chart);
  if (!av) return null;
  const moon = chart.positions.planets.find(p => p.name === "Moon");
  av["Rashi lord"] = moon ? (SIGN_LORDS[degToSign(moon.longitude).sign] || "—") : "—";
  const naam = moon ? getNaamAkshar(moon.kp.nakshatra, moon.kp.pada) : null;
  if (naam && naam.letters[naam.padaIndex]) {
    const [en, hi] = naam.letters[naam.padaIndex];
    av["Naam Akshar"] = `${en} (${hi})`;
  }
  const pick = (keys) => keys.filter(k => av[k] !== undefined).map(k => [k, av[k]]);
  const known = new Set([...MAIN_KEYS, ...OTHER_KEYS]);
  const extra = Object.keys(av).filter(k => !known.has(k) && av[k] !== undefined).map(k => [k, av[k]]);
  return { main: pick(MAIN_KEYS), other: [...pick(OTHER_KEYS), ...extra] };
}

function buildText() {
  const chart = getChart();
  if (!chart) return "";
  const out = [];
  const planets = chart.positions.planets;
  const cusps = chart.houses.cusps;
  const sun = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");
  const b = getBirth();
  const now = new Date();

  if (chosen.prompt) {
    out.push("You are an expert Krishnamurti Paddhati (KP) astrologer. Use the KP chart data below (sidereal, Placidus, sub-lord theory) to answer my questions. Base answers on cusp sub lords, significators and dasha timing.");
    out.push("");
  }

  if (chosen.birth) {
    out.push("## BIRTH DETAILS");
    out.push(`Name: ${getName() || "—"}`);
    out.push(`Date/Time: ${b.date || "—"} ${b.time || ""} (UTC${b.tz_offset_hours >= 0 ? "+" : ""}${b.tz_offset_hours})`);
    out.push(`Place: ${getCityLabel() || "—"} (lat ${b.latitude}, lon ${b.longitude})`);
    out.push(`Ayanamsa: ${AYANAMSAS[getAyanamsa()]} = ${chart.positions.ayanamsa.toFixed(4)}° | House system: Placidus | Zodiac: Sidereal`);
    out.push(`Lagna: ${dm(degToSign(chart.houses.ascendant))} (star lord ${chart.houses.ascendant_kp.star_lord}, sub lord ${chart.houses.ascendant_kp.sub_lord}) | MC: ${dm(degToSign(chart.houses.mc))}`);
    out.push("");
  }

  if (chosen.panchang) {
    const pe = panchangEntries(chart);
    if (pe) {
      out.push("## PANCHANG & AVAKHADA");
      pe.main.forEach(([k, v]) => out.push(`${k}: ${v}`));
      if (pe.other.length) {
        out.push("Other details:");
        pe.other.forEach(([k, v]) => out.push(`${k}: ${v}`));
      }
      out.push("");
    }
  }

  if (chosen.planets) {
    out.push("## PLANETS");
    out.push("Planet | Position | House | Nakshatra (pada) | Star lord | Sub lord | Flags");
    planets.forEach(p => {
      const sd = degToSign(p.longitude);
      const flags = [];
      if (p.is_retrograde) flags.push("Retro");
      if (sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)) flags.push("Combust");
      const dig = getDignity(p.name, p.longitude);
      if (dig) flags.push(dig);
      out.push(`${p.name} | ${dm(sd)} | H${houseOfLongitude(p.longitude, cusps)} | ${p.kp.nakshatra} (${p.kp.pada}) | ${p.kp.star_lord} | ${p.kp.sub_lord} | ${flags.join(", ") || "—"}`);
    });
    out.push("");
  }

  if (chosen.cusps) {
    out.push("## HOUSE CUSPS");
    out.push("House | Cusp | Sign lord | Star lord | Sub lord");
    for (let h = 1; h <= 12; h++) {
      const c = cusps[String(h)];
      const sd = degToSign(c.longitude);
      out.push(`H${h} | ${dm(sd)} | ${SIGN_LORDS[sd.sign]} | ${c.kp.star_lord} | ${c.kp.sub_lord}`);
    }
    out.push("");
  }

  if (chosen.sig) {
    const sig = getSignificators();
    out.push("## HOUSE SIGNIFICATORS (strongest level first: L1 in star of occupant, L2 occupant, L3 owner, L4 in star of owner)");
    if (!sig) out.push("(not computed — press Calculate)");
    else {
      for (let h = 1; h <= 12; h++) {
        const s = sig[String(h)] || {};
        const lv = [1, 2, 3, 4].map(n => `L${n}: ${(s[`level_${n}`] || []).join(", ") || "—"}`).join(" | ");
        out.push(`H${h} — ${lv}`);
      }
    }
    out.push("");
  }

  if (chosen.dasha) {
    const dasha = getDasha();
    out.push("## VIMSHOTTARI DASHA");
    if (!dasha) out.push("(not computed — press Calculate)");
    else {
      const inRange = (x) => new Date(x.start_date) <= now && now < new Date(x.end_date);
      const md = dasha.find(inRange);
      const bk = md && (md.bhuktis || []).find(inRange);
      const pk = bk && (bk.antaras || []).find(inRange);
      if (md) out.push(`Running now (${d(now.toISOString())}): ${md.lord} MD${bk ? " > " + bk.lord + " AD" : ""}${pk ? " > " + pk.lord + " PD" : ""}${(pk || bk || md) ? " (ends " + d((pk || bk || md).end_date) + ")" : ""}`);
      out.push("Mahadashas:");
      dasha.forEach(m => {
        out.push(`- ${m.lord}: ${d(m.start_date)} to ${d(m.end_date)}${md && m === md ? "  <-- running" : ""}`);
        const showBk = chosen.antar || (md && m === md);
        if (showBk) (m.bhuktis || []).forEach(k => out.push(`    · ${m.lord}-${k.lord}: ${d(k.start_date)} to ${d(k.end_date)}${bk && k === bk ? "  <-- running" : ""}`));
      });
    }
    out.push("");
  }

  return out.join("\n").trim() + "\n";
}

const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");


// North Indian (diamond) D1 chart as inline SVG, for the printed document.
function northIndianSvg(chart) {
  const W = 360, q = W / 4, h2 = W / 2;
  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const byHouse = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = [];
  planets.forEach(p => byHouse[houseOfLongitude(p.longitude, cusps)].push(p));
  const P = (pts) => pts.map(([x, y]) => `${x},${y}`).join(" ");
  const A = [0, 0], B = [W, 0], C = [W, W], D = [0, W];
  const T = [h2, 0], R = [W, h2], Bt = [h2, W], L = [0, h2];
  const P1 = [q, q], P2 = [3 * q, q], P3 = [3 * q, 3 * q], P4 = [q, 3 * q], O = [h2, h2];
  // polygon + centre point for each house (house 1 top-centre, anticlockwise)
  const HOUSES = {
    1:  { poly: [T, P1, O, P2],  c: [h2, q] },
    2:  { poly: [A, T, P1],      c: [q, W * 0.09] },
    3:  { poly: [A, L, P1],      c: [W * 0.09, q] },
    4:  { poly: [L, P1, O, P4],  c: [q, h2] },
    5:  { poly: [L, D, P4],      c: [W * 0.09, 3 * q] },
    6:  { poly: [D, Bt, P4],     c: [q, W * 0.91] },
    7:  { poly: [Bt, P4, O, P3], c: [h2, 3 * q] },
    8:  { poly: [Bt, C, P3],     c: [3 * q, W * 0.91] },
    9:  { poly: [C, R, P3],      c: [W * 0.91, 3 * q] },
    10: { poly: [R, P3, O, P2],  c: [3 * q, h2] },
    11: { poly: [R, B, P2],      c: [W * 0.91, q] },
    12: { poly: [B, T, P2],      c: [3 * q, W * 0.09] },
  };
  let body = "";
  for (let h = 1; h <= 12; h++) {
    const { poly, c } = HOUSES[h];
    const sign = cusps[String(h)].kp.sign;
    const labels = byHouse[h].map(p => {
      let t = PLANET_ABBR[p.name] || p.name.slice(0, 2);
      if (p.is_retrograde) t += "ᴿ";
      if (sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)) t += "ᶜ";
      return t;
    });
    const perLine = h === 1 || h === 4 || h === 7 || h === 10 ? 3 : 2;
    const lines = [];
    for (let i = 0; i < labels.length; i += perLine) lines.push(labels.slice(i, i + perLine).join("  "));
    const lh = 13;
    const startY = c[1] + 4 - ((lines.length - 1) * lh) / 2;
    const inner = h === 1 || h === 4 || h === 7 || h === 10;
    body += `<polygon points="${P(poly)}" fill="${h === 1 ? "#fbf1e0" : "none"}" stroke="none"/>`;
    body += `<text x="${c[0]}" y="${c[1] + (inner ? -(lines.length * 7 + 8) : -(lines.length * 7 + 5))}" text-anchor="middle" font-size="9" fill="#a9762c" font-weight="700">${SIGNS.indexOf(sign) + 1}</text>`;
    lines.forEach((ln, i) => {
      body += `<text x="${c[0]}" y="${startY + i * lh}" text-anchor="middle" font-size="12" font-weight="600" fill="#26365c" font-family="Inter,sans-serif">${esc(ln)}</text>`;
    });
  }
  const lines = `<rect x="1" y="1" width="${W - 2}" height="${W - 2}" fill="none" stroke="#26365c" stroke-width="1.6"/>
    <polygon points="${P([T, R, Bt, L])}" fill="none" stroke="#26365c" stroke-width="1.4"/>
    <line x1="0" y1="0" x2="${W}" y2="${W}" stroke="#26365c" stroke-width="1.4"/>
    <line x1="${W}" y1="0" x2="0" y2="${W}" stroke="#26365c" stroke-width="1.4"/>`;
  return `<svg class="pd-chart" viewBox="-4 -4 ${W + 8} ${W + 8}" xmlns="http://www.w3.org/2000/svg">${body}${lines}</svg>`;
}

// Nicely laid-out document used only when printing / saving as PDF.
function buildPrintDoc() {
  const chart = getChart();
  if (!chart) return "";
  const planets = chart.positions.planets;
  const cusps = chart.houses.cusps;
  const sun = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");
  const b = getBirth();
  const now = new Date();
  const asc = degToSign(chart.houses.ascendant);
  const parts = [];

  parts.push(`
    <header class="pd-head">
      <div class="pd-brand">Sthira · Krishnamurti Paddhati</div>
      <h1>${esc(getName() || "KP Horoscope")}</h1>
      <div class="pd-meta">
        <span><b>Born</b> ${esc(b.date || "—")} ${esc(b.time || "")} (UTC${b.tz_offset_hours >= 0 ? "+" : ""}${esc(b.tz_offset_hours)})</span>
        <span><b>Place</b> ${esc(getCityLabel() || "—")} · ${esc(b.latitude)}, ${esc(b.longitude)}</span>
      </div>
      <div class="pd-meta">
        <span><b>Lagna</b> ${esc(asc.sign)} ${asc.deg}°${String(asc.min).padStart(2,"0")}'</span>
        <span><b>Star / Sub</b> ${esc(chart.houses.ascendant_kp.star_lord)} / ${esc(chart.houses.ascendant_kp.sub_lord)}</span>
        <span><b>Ayanamsa</b> ${esc(AYANAMSAS[getAyanamsa()])} ${chart.positions.ayanamsa.toFixed(4)}°</span>
        <span><b>Houses</b> Placidus · Sidereal</span>
      </div>
    </header>`);

  if (chosen.panchang) {
    const pe = panchangEntries(chart);
    if (pe) {
      const cell = ([k, v]) => `<div class="pd-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
      parts.push(`<section><h2>Panchang &amp; Avakhada</h2>
        <div class="pd-kv-grid">${pe.main.map(cell).join("")}</div>
        ${pe.other.length ? `<div class="pd-sub">Other details</div><div class="pd-kv-grid minor">${pe.other.map(cell).join("")}</div>` : ""}
      </section>`);
    }
  }

  if (chosen.chart) {
    parts.push(`<section class="pd-chart-sec"><h2>Birth chart · Rasi (D1)</h2>
      <div class="pd-chart-wrap">${northIndianSvg(chart)}</div>
      <div class="pd-chart-note">North Indian style · number in each house = sign (1 Aries … 12 Pisces) · ᴿ retrograde · ᶜ combust · house 1 (Lagna) at top</div>
    </section>`);
  }

  if (chosen.planets) {
    const rows = planets.map(p => {
      const sd = degToSign(p.longitude);
      const flags = [];
      if (p.is_retrograde) flags.push("Retro");
      if (sun && p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)) flags.push("Combust");
      const dig = getDignity(p.name, p.longitude);
      if (dig) flags.push(dig);
      return `<tr><td class="pl">${esc(p.name)}</td><td>${esc(dm(sd))}</td><td>${houseOfLongitude(p.longitude, cusps)}</td><td>${esc(p.kp.nakshatra)} (${p.kp.pada})</td><td>${esc(p.kp.star_lord)}</td><td>${esc(p.kp.sub_lord)}</td><td class="fl">${esc(flags.join(" · ") || "—")}</td></tr>`;
    }).join("");
    parts.push(`<section><h2>Planets</h2><table><thead><tr><th>Planet</th><th>Position</th><th>House</th><th>Nakshatra (pada)</th><th>Star lord</th><th>Sub lord</th><th>Flags</th></tr></thead><tbody>${rows}</tbody></table></section>`);
  }

  if (chosen.cusps) {
    let rows = "";
    for (let h = 1; h <= 12; h++) {
      const c = cusps[String(h)]; const sd = degToSign(c.longitude);
      rows += `<tr><td class="pl">House ${h}</td><td>${esc(dm(sd))}</td><td>${esc(SIGN_LORDS[sd.sign])}</td><td>${esc(c.kp.star_lord)}</td><td>${esc(c.kp.sub_lord)}</td></tr>`;
    }
    parts.push(`<section><h2>House cusps</h2><table><thead><tr><th>House</th><th>Cusp</th><th>Sign lord</th><th>Star lord</th><th>Sub lord</th></tr></thead><tbody>${rows}</tbody></table></section>`);
  }

  if (chosen.sig) {
    const sig = getSignificators();
    if (sig) {
      let rows = "";
      for (let h = 1; h <= 12; h++) {
        const sg = sig[String(h)] || {};
        rows += `<tr><td class="pl">House ${h}</td>${[1,2,3,4].map(n => `<td>${esc((sg[`level_${n}`] || []).join(", ") || "—")}</td>`).join("")}</tr>`;
      }
      parts.push(`<section><h2>House significators</h2><table><thead><tr><th>House</th><th>L1 · In star of occupant</th><th>L2 · Occupant</th><th>L3 · Owner</th><th>L4 · In star of owner</th></tr></thead><tbody>${rows}</tbody></table></section>`);
    }
  }

  if (chosen.dasha) {
    const dasha = getDasha();
    if (dasha) {
      const inRange = (x) => new Date(x.start_date) <= now && now < new Date(x.end_date);
      const md = dasha.find(inRange);
      const bk = md && (md.bhuktis || []).find(inRange);
      const pk = bk && (bk.antaras || []).find(inRange);
      let run = "";
      if (md) run = `<div class="pd-run">Running now: <b>${esc(md.lord)}</b> Mahadasha${bk ? ` › <b>${esc(bk.lord)}</b> Antardasha` : ""}${pk ? ` › <b>${esc(pk.lord)}</b> Pratyantar` : ""} · ends ${d((pk || bk || md).end_date)}</div>`;
      let rows = "";
      dasha.forEach(m => {
        rows += `<tr class="${md && m === md ? "now" : ""}"><td class="pl">${esc(m.lord)} Mahadasha</td><td>${d(m.start_date)}</td><td>${d(m.end_date)}</td></tr>`;
        if (chosen.antar || (md && m === md)) (m.bhuktis || []).forEach(k => {
          rows += `<tr class="sub ${bk && k === bk ? "now" : ""}"><td>&nbsp;&nbsp;› ${esc(m.lord)} – ${esc(k.lord)}</td><td>${d(k.start_date)}</td><td>${d(k.end_date)}</td></tr>`;
        });
      });
      parts.push(`<section><h2>Vimshottari dasha</h2>${run}<table><thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead><tbody>${rows}</tbody></table></section>`);
    }
  }

  parts.push(`<footer class="pd-foot">Generated ${d(now.toISOString())} · Sthira KP Astro</footer>`);
  return parts.join("");
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.getElementById("print-text");
    if (!ta) return false;
    ta.select();
    try { return document.execCommand("copy"); } catch (e2) { return false; }
  }
}

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }
  lastText = buildText();

  container.innerHTML = `
    <div class="panel no-print">
      <h3><span class="mk">◆</span>Include in export</h3>
      <div class="print-opts">
        ${OPTIONS.map(o => `<label class="print-opt"><input type="checkbox" data-opt="${o.key}" ${chosen[o.key] ? "checked" : ""}> ${o.label}</label>`).join("")}
      </div>
      <div class="print-actions">
        <button type="button" class="sb-btn" id="print-copy">Copy</button>
        <button type="button" class="sb-btn" id="print-print">Print / Save PDF</button>
        <span class="sub" id="print-status"></span>
      </div>
    </div>
    <div class="panel print-area">
      <h3><span class="mk">◆</span>Preview <span class="sub" style="font-weight:400;">(editable — this text is what Copy uses; the PDF is a formatted version of the same selection)</span></h3>
      <textarea id="print-text" class="print-text mono" spellcheck="false">${lastText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textarea>
      <div id="print-doc" class="print-doc"></div>
    </div>`;

  const ta = document.getElementById("print-text");
  const status = document.getElementById("print-status");
  const flash = (msg) => { status.textContent = msg; setTimeout(() => { status.textContent = ""; }, 2200); };

  container.querySelectorAll("[data-opt]").forEach(cb => cb.addEventListener("change", () => {
    chosen[cb.dataset.opt] = cb.checked;
    ta.value = buildText();
  }));
  document.getElementById("print-copy").addEventListener("click", async () => {
    flash((await copyText(ta.value)) ? "Copied ✓ — paste it into your AI chat" : "Copy failed — select the text and copy manually");
  });
  // Printing uses a separate, nicely laid-out document built from the chart data.
  const doc = document.getElementById("print-doc");
  const syncDoc = () => { doc.innerHTML = buildPrintDoc(); };
  syncDoc();
  window.onbeforeprint = syncDoc;
  document.getElementById("print-print").addEventListener("click", () => { syncDoc(); window.print(); });
}
