// sections/horary.js -- Prashna: cast a chart for the moment of
// judgment and check the querent's number against the ruling planets.
import { callApi } from "../api.js";
import { getBirth } from "../state.js";
import { normTime } from "../helpers.js";

export function render(container) {
  const b = getBirth();
  container.innerHTML = `
    <div class="analysis-grid" style="grid-template-columns:300px 1fr;">
      <form class="panel form-panel" id="form-horary">
        <h3 style="text-transform:none; font-family:'Fraunces',serif; font-size:15px;">Judgment details</h3>
        <div class="field"><label>Horary number (1–249)</label><input type="number" min="1" max="249" id="horary-number" value="108" required></div>
        <div class="field"><label>Date of judgment</label><input type="date" id="horary-date" value="${b.date || ''}" required></div>
        <div class="field"><label>Time of judgment</label><input type="time" step="1" id="horary-time" value="${(b.time||'').slice(0,5)}" required></div>
        <div class="field"><label>Timezone ±h</label><input type="number" step="0.25" id="horary-tz" value="${b.tz_offset_hours ?? ''}" required></div>
        <div class="field-inline">
          <div class="field"><label>Latitude</label><input type="number" step="any" id="horary-lat" value="${b.latitude ?? ''}" required></div>
          <div class="field"><label>Longitude</label><input type="number" step="any" id="horary-lng" value="${b.longitude ?? ''}" required></div>
        </div>
        <button class="btn-primary" type="submit" id="horary-submit">Cast horary chart</button>
        <div class="err-box" id="horary-err" style="display:none; margin-top:10px;"></div>
      </form>
      <div id="horary-results"><div class="empty-box"><h3>No judgment yet</h3><p>Enter the querent's number and the moment of judgment.</p></div></div>
    </div>
  `;

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
    };
    const qs = new URLSearchParams(p).toString();
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Working…`;
    try {
      const data = await callApi("/horary/?" + qs);
      renderResult(data);
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.innerHTML = "Cast horary chart";
    }
  });
}

function renderResult(data) {
  const el = document.getElementById("horary-results");
  const rp = data.ruling_planets || {};
  const validation = data.ruling_planets_validation || {};
  const isGenuine = validation.is_valid ?? validation.valid ?? null;
  const hp = data.horary_point || {};

  let sigRows = "";
  if (data.significators) {
    sigRows = Object.keys(data.significators).sort((a,b)=>a-b).map(h => {
      const list = data.significators[h].all || [];
      return `<tr><td>House ${h}</td><td>${list.map(p => `<span class="pill">${p}</span>`).join("") || '<span class="sub">—</span>'}</td></tr>`;
    }).join("");
  }

  const rpAll = rp.all || [];
  const rpPills = rpAll.map(pl => `<span class="pill gold">${pl}</span>`).join("");
  const rpBreakdown = ["day_lord","ascendant","moon"].filter(k => rp[k] !== undefined).map(k => {
    const v = rp[k];
    const val = (v && typeof v === "object")
      ? Object.entries(v).map(([kk,vv]) => `${kk.replace(/_/g," ")}: ${vv}`).join(" · ")
      : v;
    return `<tr><td style="text-transform:capitalize;">${k.replace(/_/g," ")}</td><td class="mono">${val}</td></tr>`;
  }).join("");

  el.innerHTML = `
    ${isGenuine === null ? "" : `
    <div class="verdict ${isGenuine ? 'yes' : 'no'}">
      <div class="big">${isGenuine ? "Genuine" : "Doubtful"}</div>
      <div class="sub">${validation.reason || validation.message || (isGenuine ? "The chosen number aligns with the ruling planets of the moment." : "The chosen number does not align with the ruling planets of the moment.")}</div>
    </div>`}
    <div class="panel"><h3><span class="mk">◆</span>Horary point</h3>
      <table><tbody>${Object.entries(hp).map(([k,v]) => `<tr><td style="text-transform:capitalize;">${k.replace(/_/g," ")}</td><td class="mono">${typeof v === "number" ? v.toFixed(4) : v}</td></tr>`).join("")}</tbody></table>
    </div>
    <div class="panel"><h3><span class="mk">◆</span>Ruling planets of the moment</h3>
      <div>${rpPills || '<div class="sub">Not returned by the API.</div>'}</div>
      ${rpBreakdown ? `<table style="margin-top:10px;"><tbody>${rpBreakdown}</tbody></table>` : ""}
    </div>
    ${sigRows ? `<div class="panel"><h3><span class="mk">◆</span>Significators of the horary point</h3><table><tbody>${sigRows}</tbody></table></div>` : ""}
  `;
}
