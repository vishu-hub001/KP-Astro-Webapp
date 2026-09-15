// sections/profiles.js -- list, load, and delete saved birth-data profiles.
import { callApi } from "../api.js";
import { setName, setBirth, setCityLabel } from "../state.js";

export function render(container) {
  container.innerHTML = `<div id="pf-list" style="max-width:680px;"><div class="empty-box">Loading…</div></div>`;
  load();
}

async function load() {
  const el = document.getElementById("pf-list");
  try {
    const data = await callApi("/profile/");
    if (!data.profiles.length) {
      el.innerHTML = `<div class="empty-box"><h3>No profiles saved</h3><p>Use the Save button in the sidebar to store the current birth details.</p></div>`;
      return;
    }
    el.innerHTML = data.profiles.map(p => `
      <div class="profile-row">
        <div><div class="name">${p.name}</div><div class="meta">${p.birth_data.date} · ${p.birth_data.time} · ${p.birth_data.latitude}, ${p.birth_data.longitude}</div></div>
        <div style="display:flex; gap:8px;">
          <button class="icon-btn" data-load="${p.id}">Load</button>
          <button class="icon-btn" data-del="${p.id}">Delete</button>
        </div>
      </div>
    `).join("");
    el.querySelectorAll("[data-load]").forEach(btn => btn.addEventListener("click", () => loadProfile(btn.dataset.load)));
    el.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => delProfile(btn.dataset.del)));
  } catch (err) {
    el.innerHTML = `<div class="err-box">${err.message}</div>`;
  }
}

async function loadProfile(id) {
  try {
    const data = await callApi("/profile/" + id);
    const bd = data.profile.birth_data;
    setName(data.profile.name);
    setBirth(bd);
    setCityLabel("");
    document.getElementById("tb-name").value = data.profile.name;
    document.getElementById("tb-date").value = bd.date;
    document.getElementById("tb-time").value = bd.time.slice(0,5);
    document.getElementById("tb-tz").value = bd.tz_offset_hours;
    document.getElementById("tb-lat").value = bd.latitude;
    document.getElementById("tb-lng").value = bd.longitude;
    document.getElementById("tb-city").value = "";
    document.getElementById("tb-calc").click();
  } catch (err) { alert(err.message); }
}

async function delProfile(id) {
  if (!confirm("Delete this profile?")) return;
  try {
    await callApi("/profile/" + id, { method: "DELETE" });
    load();
    window.dispatchEvent(new CustomEvent("profiles-changed"));
  } catch (err) { alert(err.message); }
}
