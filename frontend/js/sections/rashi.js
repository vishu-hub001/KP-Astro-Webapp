// sections/rashi.js -- the chart re-read sign by sign: who rules each
// Rashi and which planets/cusps sit in it.
import { getChart } from "../state.js";
import { SIGNS, SIGN_LORDS } from "../helpers.js";

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const planets = chart.positions.planets;
  const cusps = chart.houses.cusps;

  const rows = SIGNS.map(sign => {
    const occupants = planets.filter(p => p.kp.sign === sign).map(p => p.name);
    const cuspHouses = Object.keys(cusps).filter(h => cusps[h].kp.sign === sign);
    return `<tr>
      <td>${sign}</td>
      <td><span class="pill gold">${SIGN_LORDS[sign]}</span></td>
      <td>${occupants.length ? occupants.map(n=>`<span class="pill">${n}</span>`).join("") : '<span class="sub">—</span>'}</td>
      <td>${cuspHouses.length ? cuspHouses.map(h=>`House ${h}`).join(", ") : '<span class="sub">—</span>'}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>Rashi-wise placement</h3>
      <table>
        <thead><tr><th>Rashi</th><th>Sign lord</th><th>Planets placed here</th><th>House cusps falling here</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
