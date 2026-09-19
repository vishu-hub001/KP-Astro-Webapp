// sections/profiles.js -- list, load, and delete saved birth-data profiles.
import { callApi } from "../api.js";
import { setName, setBirth, setCityLabel } from "../state.js";

export function render(container) {
  container.innerHTML = `
    <div style="max-width:680px;">
      <div class="pf-tools" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <button class="sb-btn" id="pf-export" style="flex:none; padding:8px 16px;">Export</button>
        <button class="sb-btn" id="pf-import" style="flex:none; padding:8px 16px;">Import</button>
        <input type="file" id="pf-file" accept="application/json,.json" style="display:none;">
        <span class="sub" id="pf-status"></span>
      </div>
      <div id="pf-list"><div class="empty-box">Loading…</div></div>
    </div>`;
  const status = document.getElementById("pf-status");
  const say = (msg) => { status.textContent = msg; };

  document.getElementById("pf-export").addEventListener("click", async () => {
    try {
      const data = await callApi("/profile/");
      if (!data.profiles.length) { say("Nothing to export yet."); return; }
      const blob = new Blob([JSON.stringify({ app: "Sthira KP Astro", version: 1, exported_at: new Date().toISOString(), profiles: data.profiles }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `kp_profiles_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      say(`Exported ${data.profiles.length} profile${data.profiles.length === 1 ? "" : "s"} ✓`);
    } catch (err) { say(err.message); }
  });

  const fileInput = document.getElementById("pf-file");
  document.getElementById("pf-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;
      const res = await callApi("/profile/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profiles }) });
      say(`Imported ${res.added}, skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}${res.invalid ? `, ${res.invalid} invalid` : ""}.`);
      load();
      window.dispatchEvent(new CustomEvent("profiles-changed"));
    } catch (err) { say("Import failed: " + (err instanceof SyntaxError ? "not a valid JSON file" : err.message)); }
  });

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
