// sections/overview.js -- at-a-glance dashboard built from data already
// in the shared store (chart + significators + dasha), no extra fetch.
import { getChart, getDasha, getName } from "../state.js";
import { degToSign, isCombust, fmtDate } from "../helpers.js";

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const planets = chart.positions.planets;
  const asc = chart.houses.ascendant;
  const ascKp = chart.houses.ascendant_kp;
  const sun = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");

  const retro = planets.filter(p => p.is_retrograde);
  const combust = sun ? planets.filter(p => p.name !== "Sun" && isCombust(p.name, p.longitude, sun.longitude)) : [];

  const dasha = getDasha();
  let currentMd = null, currentBk = null;
  if (dasha) {
    const now = new Date();
    currentMd = dasha.find(md => new Date(md.start_date) <= now && now < new Date(md.end_date));
    if (currentMd) currentBk = (currentMd.bhuktis || []).find(bk => new Date(bk.start_date) <= now && now < new Date(bk.end_date));
  }

  container.innerHTML = `
    <div class="stat-strip">
      <div><div class="k">Lagna</div><div class="v">${degToSign(asc).sign}</div></div>
      <div><div class="k">Lagna star / sub</div><div class="v">${ascKp.star_lord} / ${ascKp.sub_lord}</div></div>
      <div><div class="k">Moon sign · nakshatra</div><div class="v">${moon ? degToSign(moon.longitude).sign : "—"} · ${moon ? moon.kp.nakshatra : "—"}</div></div>
      <div><div class="k">Sun sign</div><div class="v">${sun ? degToSign(sun.longitude).sign : "—"}</div></div>
    </div>

    <div class="analysis-grid" style="grid-template-columns:1fr 1fr;">
      <div class="panel">
        <h3><span class="mk">◆</span>Running dasha</h3>
        ${currentMd
          ? `<table><tbody>
              <tr><td>Mahadasha</td><td class="mono">${currentMd.lord}</td></tr>
              ${currentBk ? `<tr><td>Antardasha</td><td class="mono">${currentBk.lord}</td></tr>` : ""}
              <tr><td>Mahadasha ends</td><td class="mono">${fmtDate(currentMd.end_date)}</td></tr>
            </tbody></table>`
          : `<p class="sub">Open Dasha Analysis to compute the Vimshottari period tree; it will also appear here.</p>`}
      </div>
      <div class="panel">
        <h3><span class="mk">◆</span>Flags</h3>
        <table><tbody>
          <tr><td>Retrograde</td><td>${retro.length ? retro.map(p=>p.name).join(", ") : "None"}</td></tr>
          <tr><td>Combust <span class="sub" style="font-weight:400;">(approx. orb)</span></td><td>${combust.length ? combust.map(p=>p.name).join(", ") : "None"}</td></tr>
        </tbody></table>
      </div>
    </div>

    <div class="panel">
      <h3><span class="mk">◆</span>Chart facts</h3>
      <table><tbody>
        <tr><td>Ayanamsa (Krishnamurti)</td><td class="mono">${chart.positions.ayanamsa.toFixed(4)}°</td></tr>
        <tr><td>Midheaven</td><td class="mono">${degToSign(chart.houses.mc).text}</td></tr>
        <tr><td>Julian day (UT)</td><td class="mono">${chart.positions.julian_day_ut.toFixed(4)}</td></tr>
      </tbody></table>
    </div>
  `;
}
