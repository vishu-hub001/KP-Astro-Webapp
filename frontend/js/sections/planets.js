// sections/planets.js -- the star KP table: every planet with its sign,
// nakshatra, pada, star lord and sub lord (the actual predictive unit).
import { getChart } from "../state.js";
import { degToSign, PLANET_ABBR, houseOfLongitude } from "../helpers.js";

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

  const rows = planets.map(p => {
    const sd = degToSign(p.longitude);
    return `<tr>
      <td>${PLANET_ABBR[p.name] || ''} ${p.name}${p.is_retrograde ? '<span class="retro-flag">R</span>' : ''}</td>
      <td class="mono">${sd.text}</td>
      <td>${p.kp.sign}</td>
      <td>${houseOfLongitude(p.longitude, cusps)}</td>
      <td>${p.kp.nakshatra}</td>
      <td class="mono">${p.kp.pada}</td>
      <td><span class="pill">${p.kp.star_lord}</span></td>
      <td><span class="pill gold">${p.kp.sub_lord}</span></td>
      <td class="mono">${p.speed.toFixed(4)}°/d</td>
    </tr>`;
  }).join("");

  const ascRow = `<tr>
    <td>Asc <span class="sub" style="font-weight:400;">(Lagna)</span></td>
    <td class="mono">${degToSign(asc).text}</td>
    <td>${ascKp.sign}</td>
    <td>1</td>
    <td>${ascKp.nakshatra}</td>
    <td class="mono">${ascKp.pada}</td>
    <td><span class="pill">${ascKp.star_lord}</span></td>
    <td><span class="pill gold">${ascKp.sub_lord}</span></td>
    <td class="mono">—</td>
  </tr>`;

  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>Planets &amp; ascendant — full KP breakdown</h3>
      <table>
        <thead><tr><th>Point</th><th>Position</th><th>Sign</th><th>House</th><th>Nakshatra</th><th>Pada</th><th>Star lord</th><th>Sub lord</th><th>Speed</th></tr></thead>
        <tbody>${ascRow}${rows}</tbody>
      </table>
    </div>
    <p class="sub" style="margin-top:6px;">In KP, the sub lord of a planet or cusp — not the sign or even the nakshatra — is treated as the deciding factor for what that point actually promises.</p>
  `;
}
