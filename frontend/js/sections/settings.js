// sections/settings.js -- static reference info about how this
// instance is configured (no backend settings endpoint exists).
export function render(container) {
  container.innerHTML = `
    <div class="panel">
      <h3><span class="mk">◆</span>Calculation settings</h3>
      <table><tbody>
        <tr><td>Ayanamsa</td><td>Krishnamurti (KP)</td></tr>
        <tr><td>House system</td><td>Placidus</td></tr>
        <tr><td>Dasha system</td><td>Vimshottari (120-year cycle)</td></tr>
        <tr><td>Zodiac</td><td>Sidereal</td></tr>
      </tbody></table>
      <p class="sub" style="margin-top:10px;">These are fixed by the backend (core/ephemeris.py, core/dasha_calculator.py) and aren't user-configurable in this build.</p>
    </div>
    <div class="panel">
      <h3><span class="mk">◆</span>About</h3>
      <p class="sub">Sthira is a thin client over your local KP Astro API. All calculations happen on your own machine — nothing is sent anywhere except the birth details you enter and, for city search, the place name you type (sent only to the free Open-Meteo geocoding service to resolve coordinates).</p>
    </div>
  `;
}
