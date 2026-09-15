// sections/dasha.js -- Vimshottari mahadasha/antardasha/pratyantardasha tree.
import { callApi } from "../api.js";
import { getBirth, isBirthValid, getDasha, setDasha } from "../state.js";
import { fmtDate } from "../helpers.js";

export function render(container) {
  container.innerHTML = `
    <div class="panel form-panel" style="max-width:420px;">
      <div class="field-inline">
        <div class="field"><label>Depth</label>
          <select id="dasha-levels">
            <option value="1">Mahadasha only</option>
            <option value="2">+ Antardasha</option>
            <option value="3" selected>+ Pratyantardasha</option>
          </select>
        </div>
        <div class="field"><label>Cycles</label>
          <select id="dasha-cycles"><option value="1" selected>1</option><option value="2">2</option></select>
        </div>
      </div>
      <button class="btn-primary" id="dasha-run">Compute periods</button>
      <div class="err-box" id="dasha-err" style="display:none; margin-top:10px;"></div>
    </div>
    <div id="dasha-results" style="margin-top:14px;"></div>
  `;

  const existing = getDasha();
  if (existing) renderTree(existing);
  else document.getElementById("dasha-results").innerHTML = `<div class="empty-box"><h3>No periods yet</h3><p>Set birth details above, then compute periods.</p></div>`;

  document.getElementById("dasha-run").addEventListener("click", async () => {
    const errEl = document.getElementById("dasha-err");
    errEl.style.display = "none";
    const btn = document.getElementById("dasha-run");
    const birth = getBirth();
    if (!isBirthValid()) { errEl.textContent = "Fill in birth details at the top first."; errEl.style.display = "block"; return; }
    const payload = { ...birth, levels: document.getElementById("dasha-levels").value, num_cycles: document.getElementById("dasha-cycles").value };
    const qs = new URLSearchParams(payload).toString();
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Working…`;
    try {
      const data = await callApi("/dasha/?" + qs);
      setDasha(data.mahadashas);
      renderTree(data.mahadashas);
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.innerHTML = "Compute periods";
    }
  });
}

function renderTree(mahadashas) {
  const el = document.getElementById("dasha-results");
  const now = new Date();
  const isCurrent = p => new Date(p.start_date) <= now && now < new Date(p.end_date);

  el.innerHTML = `<div class="panel">` + mahadashas.map(md => {
    const bhuktis = (md.bhuktis || []).map(bk => {
      const antaras = (bk.antaras || []).map(an => `
        <div class="bhukti-row" style="padding-left:20px;">
          <span>${an.lord}${isCurrent(an) ? '<span class="now-tag">now</span>' : ''}</span>
          <span class="dates">${fmtDate(an.start_date)} – ${fmtDate(an.end_date)}</span>
        </div>`).join("");
      return `<div class="bhukti-row"><span>${bk.lord}${isCurrent(bk) ? '<span class="now-tag">now</span>' : ''}</span><span class="dates">${fmtDate(bk.start_date)} – ${fmtDate(bk.end_date)}</span></div>${antaras}`;
    }).join("");
    return `
      <div class="maha">
        <div class="maha-head" onclick="this.nextElementSibling.classList.toggle('open')">
          <span class="lord">${md.lord}${isCurrent(md) ? '<span class="now-tag">now</span>' : ''}</span>
          <span class="dates">${fmtDate(md.start_date)} – ${fmtDate(md.end_date)} · ${md.duration_years.toFixed(2)}y</span>
        </div>
        <div class="maha-body ${isCurrent(md) ? 'open' : ''}">${bhuktis || '<div class="sub">No sub-periods requested.</div>'}</div>
      </div>`;
  }).join("") + `</div>`;
}
