// app.js -- wires the shell (top bar, sidebar nav, subtitle bar) to the
// section modules and the shared store. This is the only file that
// touches the DOM outside of #main-content.

import { callApi, checkApiHealth, geocodeCity, tzOffsetHours } from "./api.js";
import {
  getBirth, setBirth, isBirthValid, setName, getName,
  setCityLabel, getCityLabel, setChart, setSignificators, setDasha,
  onStoreChange,
} from "./state.js";
import { normTime } from "./helpers.js";

import * as Overview from "./sections/overview.js";
import * as Chart from "./sections/chart.js";
import * as Planets from "./sections/planets.js";
import * as Houses from "./sections/houses.js";
import * as Life from "./sections/life.js";
import * as Rashi from "./sections/rashi.js";
import * as Nakshatra from "./sections/nakshatra.js";
import * as Dasha from "./sections/dasha.js";
import * as Horary from "./sections/horary.js";
import * as Profiles from "./sections/profiles.js";
import * as Settings from "./sections/settings.js";

const SECTIONS = {
  overview: Overview, chart: Chart, planets: Planets, houses: Houses, life: Life,
  rashi: Rashi, nakshatra: Nakshatra, dasha: Dasha, horary: Horary,
  profiles: Profiles, settings: Settings,
};

let activeView = "overview";
const mainEl = document.getElementById("main-content");

function renderActive() {
  const mod = SECTIONS[activeView];
  if (mod) mod.render(mainEl);
}

/* ---------------- nav ---------------- */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeView = btn.dataset.view;
    document.getElementById("view-title").textContent = btn.dataset.title || btn.textContent.trim();
    document.getElementById("view-sub").textContent = btn.dataset.sub || "";
    renderActive();
  });
});
// re-render whenever shared data changes (e.g. after Calculate)
onStoreChange(() => { renderActive(); updateSubtitleBar(); });

/* ---------------- api status ---------------- */
(async function () {
  const el = document.getElementById("apiStatus");
  const ok = await checkApiHealth();
  el.innerHTML = ok ? '<span class="dot"></span>API connected' : '<span class="dot off"></span>API unreachable';
})();

/* ---------------- entry popover (birth details menu) ---------------- */
const entryTrigger = document.getElementById("entry-trigger");
const entryPopover = document.getElementById("entry-popover");

function openPopover() { entryPopover.classList.add("open"); entryTrigger.classList.add("open"); }
function closePopover() { entryPopover.classList.remove("open"); entryTrigger.classList.remove("open"); }

entryTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  entryPopover.classList.contains("open") ? closePopover() : openPopover();
});
document.addEventListener("click", (e) => {
  if (!entryPopover.contains(e.target) && e.target !== entryTrigger) closePopover();
});
entryPopover.addEventListener("click", (e) => e.stopPropagation());

/* ---------------- top bar bindings ---------------- */
const nameInput = document.getElementById("tb-name");
const dateInput = document.getElementById("tb-date");
const timeInput = document.getElementById("tb-time");
const latInput = document.getElementById("tb-lat");
const lngInput = document.getElementById("tb-lng");
const tzInput = document.getElementById("tb-tz");
const cityInput = document.getElementById("tb-city");
const citySuggest = document.getElementById("city-suggest");

nameInput.addEventListener("input", () => setName(nameInput.value));
[dateInput, timeInput, latInput, lngInput, tzInput].forEach(inp => {
  inp.addEventListener("change", syncBirthFromInputs);
});

function syncBirthFromInputs() {
  setBirth({
    date: dateInput.value,
    time: normTime(timeInput.value),
    tz_offset_hours: tzInput.value === "" ? null : parseFloat(tzInput.value),
    latitude: latInput.value === "" ? null : parseFloat(latInput.value),
    longitude: lngInput.value === "" ? null : parseFloat(lngInput.value),
  });
}

/* ---------------- city auto search ---------------- */
let cityDebounce = null;
cityInput.addEventListener("input", () => {
  clearTimeout(cityDebounce);
  const q = cityInput.value;
  if (q.trim().length < 2) { citySuggest.style.display = "none"; return; }
  cityDebounce = setTimeout(async () => {
    const results = await geocodeCity(q);
    if (!results.length) { citySuggest.style.display = "none"; return; }
    citySuggest.innerHTML = results.map((r, i) => {
      const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
      return `<div class="city-opt" data-i="${i}">${label}</div>`;
    }).join("");
    citySuggest.style.display = "block";
    citySuggest.querySelectorAll(".city-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        const r = results[parseInt(opt.dataset.i, 10)];
        applyCity(r);
        citySuggest.style.display = "none";
      });
    });
  }, 300);
});
document.addEventListener("click", (e) => {
  if (!citySuggest.contains(e.target) && e.target !== cityInput) citySuggest.style.display = "none";
});

function applyCity(r) {
  const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  cityInput.value = label;
  setCityLabel(label);
  latInput.value = r.latitude.toFixed(4);
  lngInput.value = r.longitude.toFixed(4);
  if (r.timezone) {
    const offset = tzOffsetHours(dateInput.value || "2000-01-01", timeInput.value || "12:00:00", r.timezone);
    if (offset !== null) tzInput.value = offset;
  }
  syncBirthFromInputs();
}

/* ---------------- subtitle bar ---------------- */
function updateSubtitleBar() {
  const b = getBirth();
  const bar = document.getElementById("subtitle-bar");
  if (!b.date) { bar.style.display = "none"; return; }
  const parts = [];
  if (getName()) parts.push(getName());
  parts.push(b.date);
  if (b.time) parts.push(b.time.slice(0,5));
  if (getCityLabel()) parts.push(getCityLabel());
  if (b.latitude !== null && !isNaN(b.latitude)) parts.push(`${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}`);
  if (b.tz_offset_hours !== null && !isNaN(b.tz_offset_hours)) parts.push(`UTC ${b.tz_offset_hours >= 0 ? '+' : ''}${b.tz_offset_hours}h`);
  bar.textContent = parts.join("  ·  ");
  bar.style.display = "block";
}

/* ---------------- calculate ---------------- */
document.getElementById("tb-calc").addEventListener("click", async () => {
  syncBirthFromInputs();
  const btn = document.getElementById("tb-calc");
  const payload = getBirth();
  if (!isBirthValid()) { alert("Please fill in date, time, latitude, longitude and timezone offset (or search a city)."); return; }

  btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Calculating…`;
  try {
    const chart = await callApi("/chart/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setChart(chart);

    const qs = new URLSearchParams(payload).toString();
    const sig = await callApi("/significators/?" + qs);
    setSignificators(sig.significators);

    try {
      const dasha = await callApi("/dasha/?" + new URLSearchParams({ ...payload, levels: 2, num_cycles: 1 }).toString());
      setDasha(dasha.mahadashas);
    } catch (e) { /* non-fatal: dasha section can still be computed on demand */ }
    closePopover();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = "Calculate ✦";
  }
});

/* ---------------- sidebar profile controls ---------------- */
const profileSelect = document.getElementById("profile-select");

async function refreshProfileDropdown() {
  try {
    const data = await callApi("/profile/");
    profileSelect.innerHTML = '<option value="">— select saved profile —</option>' +
      data.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  } catch (e) { /* silent */ }
}
window.addEventListener("profiles-changed", refreshProfileDropdown);

profileSelect.addEventListener("change", async (e) => {
  if (!e.target.value) return;
  try {
    const data = await callApi("/profile/" + e.target.value);
    const bd = data.profile.birth_data;
    setName(data.profile.name);
    nameInput.value = data.profile.name;
    dateInput.value = bd.date;
    timeInput.value = bd.time.slice(0,5);
    tzInput.value = bd.tz_offset_hours;
    latInput.value = bd.latitude;
    lngInput.value = bd.longitude;
    cityInput.value = "";
    setCityLabel("");
    syncBirthFromInputs();
    document.getElementById("tb-calc").click();
  } catch (err) { alert(err.message); }
});

document.getElementById("sb-save").addEventListener("click", async () => {
  syncBirthFromInputs();
  const payload = getBirth();
  if (!isBirthValid()) { alert("Fill in birth details at the top first."); return; }
  const name = nameInput.value || prompt("Name for this profile?");
  if (!name) return;
  setName(name);
  try {
    await callApi("/profile/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, birth_data: payload }) });
    refreshProfileDropdown();
  } catch (err) { alert(err.message); }
});

document.getElementById("sb-del").addEventListener("click", async () => {
  if (!profileSelect.value) { alert("Select a profile from the dropdown first."); return; }
  if (!confirm("Delete the selected profile?")) return;
  try {
    await callApi("/profile/" + profileSelect.value, { method: "DELETE" });
    refreshProfileDropdown();
  } catch (err) { alert(err.message); }
});

/* ---------------- defaults + boot ---------------- */
(function seed() {
  dateInput.value = "1990-05-21";
  timeInput.value = "14:35:00";
  tzInput.value = "5.5";
  latInput.value = "28.6139";
  lngInput.value = "77.2090";
  syncBirthFromInputs();
  refreshProfileDropdown();
  renderActive();
})();
