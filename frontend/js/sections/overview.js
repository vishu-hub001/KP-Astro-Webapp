// sections/overview.js -- at-a-glance dashboard built from data already
// in the shared store (chart + significators + dasha), no extra fetch.
import { getChart, getDasha, getName, getBirth, getCityLabel } from "../state.js";
import {
  degToSign, isCombust, fmtDate, SIGN_LORDS, getNaamAkshar,
  houseOfLongitude, getDignity, calendarSpan, fmtSpanFull, fmtSpanCompact,
} from "../helpers.js";
import { getAvakhadaChakra, getWeekday, getTithi, getYoga, getKarana } from "../panchang.js";
import { AYANAMSAS, getAyanamsa } from "../api.js";
import { pbadge, ppill, colorOf, chip, dignityTag } from "../ui.js";

const STRONG_DIGNITY = new Set(["Exalted", "Moolatrikona", "Own Sign"]);

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const cusps = chart.houses.cusps;
  const planets = chart.positions.planets;
  const asc = chart.houses.ascendant;
  const ascKp = chart.houses.ascendant_kp;
  const sun = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");

  const retro = planets.filter(p => p.is_retrograde);
  const combust = sun ? planets.filter(p => p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)) : [];
  const exalted = planets.filter(p => STRONG_DIGNITY.has(getDignity(p.name, p.longitude)));
  const debilitated = planets.filter(p => getDignity(p.name, p.longitude) === "Debilitated");
  const friendly = planets.filter(p => getDignity(p.name, p.longitude) === "Friendly Sign");
  const enemy = planets.filter(p => getDignity(p.name, p.longitude) === "Enemy Sign");

  const now = new Date();
  const birth = getBirth();
  const name = getName();
  const cityLabel = getCityLabel();

  // Exact age, calendar-accurate, from birth instant to right now.
  let ageHtml = "";
  if (birth.date) {
    const birthDt = new Date(`${birth.date}T${birth.time || "00:00:00"}`);
    if (!isNaN(birthDt)) {
      const age = calendarSpan(birthDt, now);
      ageHtml = `
        <div class="panel age-panel">
          <h3><span class="mk">◆</span>Age right now</h3>
          <div class="age-hero mono">${fmtSpanFull(age)}</div>
        </div>`;
    }
  }

  const dasha = getDasha();
  let currentMd = null, currentBk = null, currentPk = null;
  if (dasha) {
    currentMd = dasha.find(md => new Date(md.start_date) <= now && now < new Date(md.end_date));
    if (currentMd) currentBk = (currentMd.bhuktis || []).find(bk => new Date(bk.start_date) <= now && now < new Date(bk.end_date));
    if (currentBk) currentPk = (currentBk.antaras || []).find(pk => new Date(pk.start_date) <= now && now < new Date(pk.end_date));
  }

  const avakhada = getAvakhadaChakra(chart);
  const moonSign = moon ? degToSign(moon.longitude).sign : null;
  let avakhadaHtml = "";
  if (avakhada) {
    avakhada["Rashi lord"] = moonSign ? (SIGN_LORDS[moonSign] || "—") : "—";

    const naam = moon ? getNaamAkshar(moon.kp.nakshatra, moon.kp.pada) : null;
    if (naam) {
      avakhada["Naam Akshar (naming letter)"] = naam.letters
        .map(([en, hi], i) => (i === naam.padaIndex
          ? `<b style="color:var(--gold);">${en} (${hi})</b>`
          : `${en} (${hi})`))
        .join(", ");
    }

    const order = [
      "Rashi (Moon sign)", "Rashi lord", "Nakshatra", "Nakshatra lord",
      "Naam Akshar (naming letter)",
      "Varna", "Vashya", "Yoni", "Gana", "Nadi", "Tatva", "Paya",
    ];
    avakhadaHtml = `
      <div class="panel">
        <h3><span class="mk">◆</span>Avakhada Chakra</h3>
        <div class="tbl-scroll"><table><tbody>
          ${order.map(k => `<tr><td>${k}</td><td>${avakhada[k] ?? "—"}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="sub an-note">Vashya and Paya use commonly published simplified whole-sign / Navamsa rules; a Jyotish consultation may apply finer classical variants. The bolded Naam Akshar syllable is the one for the Moon's actual pada at birth.</p>
      </div>`;
  }

  // Panchang -- the five limbs of the birth day (Vaar, Tithi + Paksha,
  // Nakshatra, Yoga, Karana), shown as its own glanceable strip of cards.
  let panchangHtml = "";
  if (sun && moon) {
    const weekday = getWeekday(chart.input?.date);
    const tithi = getTithi(moon.longitude, sun.longitude);
    const yoga = getYoga(moon.longitude, sun.longitude);
    const karana = getKarana(moon.longitude, sun.longitude);
    const pkCards = [
      { l: "Vaar (weekday)", v: weekday },
      { l: "Tithi", v: `${tithi.name} · #${tithi.index}` },
      { l: "Paksha", v: tithi.paksha },
      { l: "Nakshatra", v: `${moon.kp.nakshatra} · pada ${moon.kp.pada}` },
      { l: "Yoga", v: yoga },
      { l: "Karana", v: karana },
    ];
    panchangHtml = `
      <div class="panel">
        <h3><span class="mk">◆</span>Panchang — five limbs of the day</h3>
        <div class="panchang-grid">
          ${pkCards.map(c => `<div class="pk-card"><span class="pk-l">${c.l}</span><span class="pk-v">${c.v}</span></div>`).join("")}
        </div>
        <p class="sub an-note">Computed from the Sun and Moon's longitudes at the birth instant, per classical Vedic Panchang rules.</p>
      </div>`;
  }

  // A compact strip of every planet -- badge, sign, house, and any flags --
  // so the whole chart is skimmable in one glance without leaving Overview.
  const snapshotHtml = `
    <div class="panel">
      <h3><span class="mk">◆</span>Planet snapshot</h3>
      <div class="ov-snap-grid">
        ${planets.map(p => {
          const sd = degToSign(p.longitude);
          const house = houseOfLongitude(p.longitude, cusps);
          const dignity = getDignity(p.name, p.longitude);
          const isCmb = combust.some(c => c.name === p.name);
          return `<div class="ov-snap-cell" style="--pc:${colorOf(p.name)}" title="${p.name} · ${sd.text} · House ${house}">
            ${pbadge(p.name, "lg")}
            <div class="ov-snap-txt">
              <span class="ov-snap-name">${p.name}${p.is_retrograde ? '<sup class="flag-r">R</sup>' : ''}${isCmb ? '<sup class="flag-c">C</sup>' : ''}</span>
              <span class="ov-snap-pos mono">${sd.text}</span>
              <span class="ov-snap-house">House ${house}</span>
            </div>
            ${dignityTag(dignity)}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  // Running dasha: Mahadasha -> Antardasha -> Pratyantardasha chain (as far
  // as the computed tree goes), with a live progress bar on the deepest
  // level and a full-breakdown countdown to its end.
  let dashaHtml;
  if (currentMd) {
    const chain = [
      { lord: currentMd.lord, label: "Mahadasha" },
      ...(currentBk ? [{ lord: currentBk.lord, label: "Antardasha" }] : []),
      ...(currentPk ? [{ lord: currentPk.lord, label: "Pratyantardasha" }] : []),
    ];
    const deepest = currentPk || currentBk || currentMd;
    const total = new Date(deepest.end_date) - new Date(deepest.start_date);
    const elapsed = now - new Date(deepest.start_date);
    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
    const remaining = calendarSpan(now, deepest.end_date);

    dashaHtml = `
      <div class="panel">
        <h3><span class="mk">◆</span>Running dasha</h3>
        <div class="ov-dasha-chain">
          ${chain.map((c, i) => `
            ${i > 0 ? '<span class="sep">›</span>' : ''}
            <div class="lvl">${pbadge(c.lord, "lg")}<span class="lord">${c.lord}</span><span class="lbl">${c.label}</span></div>
          `).join("")}
        </div>
        <div class="dnow-bar-row"><div class="dperiod-bar lg"><div class="dperiod-fill" style="width:${pct.toFixed(1)}%; background:${colorOf(deepest.lord)};"></div></div><span class="dnow-pct mono">${pct.toFixed(1)}%</span></div>
        <div class="ov-dasha-foot">
          <span>Ends ${fmtDate(deepest.end_date)}</span>
          <span class="mono">${fmtSpanCompact(remaining)} left</span>
        </div>
      </div>`;
  } else {
    dashaHtml = `
      <div class="panel">
        <h3><span class="mk">◆</span>Running dasha</h3>
        <p class="sub">Open Dasha Analysis to compute the Vimshottari period tree; it will also appear here.</p>
      </div>`;
  }

  container.innerHTML = `
    <div class="ov-hero">
      <div class="ov-hero-lagna">
        <div class="ov-hero-k">Lagna</div>
        <div class="ov-hero-v">${degToSign(asc).sign}</div>
        <div class="ov-hero-sub">${ascKp.star_lord} · ${ascKp.sub_lord}</div>
      </div>
      <div class="ov-hero-facts">
        <div class="ov-hero-name">${name || "Querent"}</div>
        <div class="ov-hero-line">${birth.date || "—"}${birth.time ? " · " + birth.time : ""}</div>
        <div class="ov-hero-line">${cityLabel || "—"}</div>
      </div>
    </div>

    <div class="chip-row">
      ${chip(moon ? degToSign(moon.longitude).sign : "—", "Moon sign")}
      ${chip(sun ? degToSign(sun.longitude).sign : "—", "Sun sign")}
      ${chip(retro.length, "Retrograde")}
      ${chip(combust.length, "Combust", combust.length ? "warn" : "")}
      ${chip(exalted.length, "Exalted / own", exalted.length ? "good" : "")}
      ${chip(debilitated.length, "Debilitated", debilitated.length ? "warn" : "")}
    </div>

    ${panchangHtml}

    <div class="analysis-grid" style="grid-template-columns:1fr 1fr;">
      ${dashaHtml}
      <div class="panel">
        <h3><span class="mk">◆</span>Flags</h3>
        <dl class="hc-facts">
          <div><dt>Retrograde</dt><dd>${retro.length ? retro.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
          <div><dt>Combust <span class="sub" style="font-weight:400;">(approx. orb)</span></dt><dd>${combust.length ? combust.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
          <div><dt>Exalted / own sign</dt><dd>${exalted.length ? exalted.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
          <div><dt>Debilitated</dt><dd>${debilitated.length ? debilitated.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
          <div><dt>Friendly sign</dt><dd>${friendly.length ? friendly.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
          <div><dt>Enemy sign</dt><dd>${enemy.length ? enemy.map(p => ppill(p.name)).join("") : '<span class="sub">None</span>'}</dd></div>
        </dl>
      </div>
    </div>

    ${snapshotHtml}

    <div class="analysis-grid" style="grid-template-columns:1fr 1fr;">
      ${ageHtml || ""}
      <div class="panel">
        <h3><span class="mk">◆</span>Chart facts</h3>
        <table><tbody>
          <tr><td>Ayanamsa (${AYANAMSAS[getAyanamsa()]})</td><td class="mono">${chart.positions.ayanamsa.toFixed(4)}°</td></tr>
          <tr><td>Midheaven</td><td class="mono">${degToSign(chart.houses.mc).text}</td></tr>
          <tr><td>Julian day (UT)</td><td class="mono">${chart.positions.julian_day_ut.toFixed(4)}</td></tr>
          <tr><td>Latitude / Longitude</td><td class="mono">${birth.latitude ?? "—"} / ${birth.longitude ?? "—"}</td></tr>
          <tr><td>Timezone</td><td class="mono">${birth.tz_offset_hours ?? "—"}</td></tr>
        </tbody></table>
      </div>
    </div>

    ${avakhadaHtml}
  `;
}
