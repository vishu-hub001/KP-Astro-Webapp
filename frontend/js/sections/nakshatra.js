// sections/nakshatra.js -- the chart re-read nakshatra by nakshatra:
// which of the 27 are occupied, by what, and their star/sub lords.
import { getChart } from "../state.js";
import { NAKSHATRAS } from "../helpers.js";

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const points = [
    { name: "Asc", kp: chart.houses.ascendant_kp },
    ...chart.positions.planets.map(p => ({ name: p.name, kp: p.kp })),
  ];

  const byNakshatra = {};
  points.forEach(pt => {
    const idx = pt.kp.nakshatra_index;
    if (!byNakshatra[idx]) byNakshatra[idx] = [];
    byNakshatra[idx].push(pt);
  });

  const rows = NAKSHATRAS.map((name, i) => {
    const idx = i + 1;
    const occ = byNakshatra[idx];
    if (!occ) {
      return `<tr class="empty-row"><td>${idx}</td><td>${name}</td><td colspan="3" class="sub">Unoccupied</td></tr>`;
    }
    return occ.map((pt, j) => `<tr>
      ${j === 0 ? `<td rowspan="${occ.length}">${idx}</td><td rowspan="${occ.length}">${name}</td>` : ""}
      <td>${pt.name} <span class="sub" style="font-weight:400;">(pada ${pt.kp.pada})</span></td>
      <td><span class="pill">${pt.kp.star_lord}</span></td>
      <td><span class="pill gold">${pt.kp.sub_lord}</span></td>
    </tr>`).join("");
  }).join("");

  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>Nakshatra-wise placement</h3>
      <table>
        <thead><tr><th>#</th><th>Nakshatra</th><th>Occupant</th><th>Star lord</th><th>Sub lord</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
