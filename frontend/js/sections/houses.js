// sections/houses.js -- house cusps (with their own star/sub lord) plus
// the four-level KP significator ranking for every house.
import { getChart, getSignificators } from "../state.js";
import { degToSign } from "../helpers.js";

const LEVEL_LABEL = { level_1: "In star of occupant", level_2: "Occupant", level_3: "Owner", level_4: "In star of owner" };

export function render(container) {
  const chart = getChart();
  const sig = getSignificators();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const cusps = chart.houses.cusps;
  const cuspRows = Object.keys(cusps).sort((a,b)=>a-b).map(h => {
    const c = cusps[h];
    const sd = degToSign(c.longitude);
    return `<tr>
      <td>${h}</td>
      <td class="mono">${sd.text}</td>
      <td>${c.kp.nakshatra}</td>
      <td class="mono">${c.kp.pada}</td>
      <td><span class="pill">${c.kp.star_lord}</span></td>
      <td><span class="pill gold">${c.kp.sub_lord}</span></td>
    </tr>`;
  }).join("");

  let sigHtml = `<p class="sub">Significators haven't been computed yet — press Calculate above.</p>`;
  if (sig) {
    const houses = Object.keys(sig).sort((a,b)=>a-b);
    sigHtml = `<div class="sig-grid">` + houses.map(h => {
      const hd = sig[h];
      const levels = ["level_1","level_2","level_3","level_4"].map(lv => {
        const list = hd[lv] || [];
        if (!list.length) return "";
        return `<div class="sig-lvl"><div class="lbl">${LEVEL_LABEL[lv]}</div>${list.map(pl => `<span class="pill${lv==='level_3'?' gold':''}">${pl}</span>`).join("")}</div>`;
      }).join("");
      return `<div class="sig-card"><div class="hn">${h}</div>${levels || '<div class="sub">No significators found</div>'}</div>`;
    }).join("") + `</div>`;
  }

  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>House cusps — KP sub-lords</h3>
      <table>
        <thead><tr><th>House</th><th>Cusp</th><th>Nakshatra</th><th>Pada</th><th>Star lord</th><th>Sub lord</th></tr></thead>
        <tbody>${cuspRows}</tbody>
      </table>
      <p class="sub" style="margin-top:8px;">The cusp sub lord is what actually decides whether a house's matters will fructify.</p>
    </div>
    <div class="panel">
      <h3><span class="mk">◆</span>House significators — four KP levels</h3>
      ${sigHtml}
    </div>
  `;
}
