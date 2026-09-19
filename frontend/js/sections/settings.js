// sections/settings.js -- static reference info about how this
// instance is configured (no backend settings endpoint exists).
import { AYANAMSAS, getAyanamsa, setAyanamsa } from "../api.js";

const THEMES = {
  light:  { label: "Light (default)", bg: "#eef1f6", accent: "#26365c" },
  dark:   { label: "Dark",            bg: "#0f1420", accent: "#e0a94f" },
  sepia:  { label: "Sepia",           bg: "#f3ecdf", accent: "#5a4632" },
  forest: { label: "Forest",          bg: "#edf2ee", accent: "#22483a" },
  midnight: { label: "Midnight blue", bg: "#0a0f1f", accent: "#1c2b57" },
  charcoal: { label: "Charcoal", bg: "#161616", accent: "#2a2a2a" },
  ocean: { label: "Ocean teal", bg: "#eaf4f5", accent: "#0f4c58" },
  rose: { label: "Rose", bg: "#f8eef0", accent: "#7a2e45" },
  sunset: { label: "Sunset orange", bg: "#fbf0e6", accent: "#a4471d" },
  slate: { label: "Slate grey", bg: "#e9ecef", accent: "#3b4650" },
  lavender: { label: "Lavender", bg: "#f4f1fa", accent: "#6a4fb0" },
  emerald: { label: "Emerald dark", bg: "#0b1512", accent: "#16463a" },
  royal:  { label: "Royal purple",    bg: "#f1eef7", accent: "#3d2a6b" },
};
function currentTheme() {
  try { const t = localStorage.getItem("kp_theme"); if (t in THEMES) return t; } catch (e) {}
  return "light";
}
function applyTheme(t) {
  if (t === "light") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("kp_theme", t); } catch (e) {}
}

export function render(container) {
  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>Calculation settings</h3>
      <table><tbody>
        <tr><td>Ayanamsa</td><td>
          <select id="set-ayanamsa">
            ${Object.entries(AYANAMSAS).map(([k, v]) => `<option value="${k}" ${k === getAyanamsa() ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </td></tr>
        <tr><td>House system</td><td>Placidus</td></tr>
        <tr><td>Dasha system</td><td>Vimshottari (120-year cycle)</td></tr>
        <tr><td>Zodiac</td><td>Sidereal</td></tr>
      </tbody></table>
      <p class="sub" style="margin-top:10px;">Ayanamsa is selectable and applies to every calculation (chart, dasha, significators, horary). Changing it recalculates the current chart. The other settings are fixed by the backend.</p>
    </div>
    <div class="panel">
      <h3><span class="mk">◆</span>Theme color</h3>
      <div class="theme-row" id="theme-row">
        ${Object.entries(THEMES).map(([k, t]) => `<button type="button" class="theme-opt ${k === currentTheme() ? "active" : ""}" data-theme-key="${k}"><span class="theme-sw" style="background:linear-gradient(90deg,${t.bg} 50%,${t.accent} 50%);"></span>${t.label}</button>`).join("")}
      </div>
    </div>
    <div class="panel">
      <h3><span class="mk">◆</span>About</h3>
      <p class="sub">Sthira is a thin client over your local KP Astro API. All calculations happen on your own machine — nothing is sent anywhere except the birth details you enter and, for city search, the place name you type (sent only to the free Open-Meteo geocoding service to resolve coordinates).</p>
    </div>
  `;
  document.getElementById("set-ayanamsa").addEventListener("change", (e) => {
    setAyanamsa(e.target.value);
    const calc = document.getElementById("tb-calc");
    if (calc && !calc.disabled) calc.click();
  });
  document.querySelectorAll("#theme-row .theme-opt").forEach(btn => btn.addEventListener("click", () => {
    applyTheme(btn.dataset.themeKey);
    document.querySelectorAll("#theme-row .theme-opt").forEach(b => b.classList.toggle("active", b === btn));
  }));
}
