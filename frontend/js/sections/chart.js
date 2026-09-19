// sections/chart.js -- North Indian diamond-grid chart + planet/cusp tables.
import { getChart, getName, getSignificators } from "../state.js";
import {
  degToSign, PLANET_ABBR, houseOfLongitude, isCombust,
  SIGN_LORDS, SIGN_QUALITY, QUALITY_COLOR, SIGNS,
  PLANET_TATVA, TATVA_COLOR, getDignity, DIGNITY_COLOR,
} from "../helpers.js";
import { pbadge, dignityTag, chip, HOUSE_INFO } from "../ui.js";

// Classic North Indian house layout on a 4x4 grid (row,col), house 1
// always top-center, running clockwise. The middle 2x2 block is the
// decorative name/date panel, not a house.
const NI_LAYOUT = {
  "2":[0,0], "1":[0,1], "12":[0,2], "11":[0,3],
  "3":[1,0],                       "10":[1,3],
  "4":[2,0],                       "9":[2,3],
  "5":[3,0], "6":[3,1], "7":[3,2], "8":[3,3],
};

export function render(container) {
  const chart = getChart();
  if (!chart) {
    container.innerHTML = `<div class="empty-box"><h3>No chart calculated</h3><p>Fill in the birth details above and press Calculate.</p></div>`;
    return;
  }

  const cusps = chart.houses.cusps;
  const asc = chart.houses.ascendant;
  const planets = chart.positions.planets;

  const byHouse = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = [];
  planets.forEach(p => byHouse[houseOfLongitude(p.longitude, cusps)].push(p));
  const byName = Object.fromEntries(planets.map(p => [p.name, p]));

  const sun = planets.find(p => p.name === "Sun");
  const sunLon = sun ? sun.longitude : null;
  const combustSet = new Set(
    planets.filter(p => p.name !== "Sun" && sunLon !== null && isCombust(p.name, p.longitude, sunLon)).map(p => p.name)
  );

  // Densest house drives a shared font-scale so a stellium (up to all 8-9
  // planets stacked in one house) never breaks out of its cell -- every
  // cell scales together so the chart still reads as one consistent grid.
  const maxOccupancy = Math.max(1, ...Object.values(byHouse).map(a => a.length));
  const plScale = Math.max(0.45, Math.min(1, 5 / maxOccupancy));

  let cells = "";
  const houseInfo = {};
  for (const [h, [r, c]] of Object.entries(NI_LAYOUT)) {
    const cuspSign = cusps[h].kp.sign;
    const isAsc = h === "1";
    const hp = byHouse[h];
    const pls = hp.map(p => {
      const sd = degToSign(p.longitude);
      const isCmb = combustSet.has(p.name);
      const title = `${p.name} · ${sd.text} · House ${h}${p.is_retrograde ? ' · Retrograde' : ''}${isCmb ? ' · Combust' : ''}`;
      const flags = `${p.is_retrograde ? '<sup class="flag-r">R</sup>' : ''}${isCmb ? '<sup class="flag-c">C</sup>' : ''}`;
      return `<span class="pl" title="${title}">${PLANET_ABBR[p.name] || p.name.slice(0,2)}${flags}</span>`;
    }).join("");
    cells += `<div class="ni-cell${isAsc ? ' asc-house' : ''}${hp.length >= 4 ? ' crowded' : ''}" data-house="${h}" style="grid-row:${r+1}; grid-column:${c+1};">
      <span class="hnum">${h}</span>
      <span class="sign">${cuspSign}<sup class="signno">${SIGNS.indexOf(cuspSign) + 1}</sup></span>
      <div class="planets" style="--pl-scale:${plScale};">${pls}</div>
    </div>`;

    houseInfo[h] = {
      sign: cuspSign,
      rasiLord: SIGN_LORDS[cuspSign] || "—",
      starLord: cusps[h].kp.star_lord,
      subLord: cusps[h].kp.sub_lord,
      nakshatra: cusps[h].kp.nakshatra,
      pada: cusps[h].kp.pada,
      planets: hp,
    };
  }

  const name = getName() || "Chart";
  const sig = getSignificators();

  // Center box shows the birth summary by default; clicking any house
  // cell swaps it to that house's Rasi/Star/Sub lord detail, and
  // clicking the center box again returns to the default view.
  const defaultCenterHtml = () => `
    <div class="nm">${name}</div>
    <div class="dt">${chart.input.date}<br>${chart.input.time}</div>
    <div class="lg">Lagna ${degToSign(asc).sign}</div>
    <div class="ni-hint">Tap a house for details</div>`;

  const houseCenterHtml = (h) => {
    const info = houseInfo[h];
    const pillFor = (name) => {
      const p = byName[name];
      const isCmb = p ? combustSet.has(name) : false;
      const flags = p ? `${p.is_retrograde ? '<sup class="flag-r">R</sup>' : ''}${isCmb ? '<sup class="flag-c">C</sup>' : ''}` : '';
      return `<span class="pill">${PLANET_ABBR[name] || name}${flags}</span>`;
    };
    const plHtml = info.planets.length
      ? info.planets.map(p => pillFor(p.name)).join("")
      : `<span class="dv">None</span>`;
    const sigList = sig ? (sig[h]?.all || []) : [];
    const sigHtml = sigList.length
      ? sigList.map(n => `<span class="pill">${PLANET_ABBR[n] || n}</span>`).join("")
      : `<span class="dv">${sig ? "None" : "Not computed"}</span>`;
    return `
      <div class="nm">House ${h} <span class="ni-sub-sign">· ${info.sign}</span></div>
      <div class="ni-detail">
        <div><span class="dl">Star Lord</span><span class="dv">${info.starLord}</span></div>
        <div><span class="dl">Sub Lord</span><span class="dv">${info.subLord}</span></div>
        <div><span class="dl">Nakshatra</span><span class="dv">${info.nakshatra} · pada ${info.pada}</span></div>
        <div class="ni-row-pills"><span class="dl">Planets</span><span class="dv ni-pill-value">${plHtml}</span></div>
        <div class="ni-row-pills"><span class="dl">Significators</span><span class="dv ni-pill-value">${sigHtml}</span></div>
      </div>`;
  };

  const chartHtml = `
    <div class="ni-chart">
      ${cells}
      <div class="ni-center">
        ${defaultCenterHtml()}
      </div>
    </div>`;

  const planetRows = planets.map(p => {
    const sd = degToSign(p.longitude);
    const isCmb = combustSet.has(p.name);
    const dignity = getDignity(p.name, p.longitude);
    return `<tr>
      <td class="sticky-col"><span class="tcell-name">${pbadge(p.name)}<span>${p.name}${p.is_retrograde ? '<span class="retro-flag">R</span>' : ''}${isCmb ? '<span class="combust-flag">C</span>' : ''}</span></span></td>
      <td class="mono">${sd.text}</td>
      <td><span class="pill">H${houseOfLongitude(p.longitude, cusps)}</span></td>
      <td class="mono">${p.speed.toFixed(3)}°/d</td>
      <td>${dignityTag(dignity)}</td>
    </tr>`;
  }).join("");

  const cuspRows = Object.keys(cusps).sort((a,b)=>a-b).map(h => {
    const sd = degToSign(cusps[h].longitude);
    const info = HOUSE_INFO[h] || {};
    return `<tr><td class="sticky-col"><b class="tbl-h">${h}</b> <span class="sub">${info.name || ''}</span></td><td>${sd.sign}</td><td class="mono">${sd.text}</td><td><span class="pill">${cusps[h].kp.star_lord}</span></td><td><span class="pill gold">${cusps[h].kp.sub_lord}</span></td></tr>`;
  }).join("");

  // ---------- instant analysis: everything below is derived purely from
  // data already on the chart object, so it's free (no extra API calls). ----------
  const retroList = planets.filter(p => p.is_retrograde);
  const combustList = planets.filter(p => combustSet.has(p.name));
  const ownSignList = planets.filter(p => SIGN_LORDS[degToSign(p.longitude).sign] === p.name);

  const houseCounts = {};
  for (let h = 1; h <= 12; h++) houseCounts[h] = byHouse[h].length;
  const vacantHouses = Object.values(houseCounts).filter(c => c === 0).length;
  const maxHouse = Object.entries(houseCounts).reduce((a, b) => b[1] > a[1] ? b : a, ["1", 0]);

  const elemTally = { Fire: 0, Earth: 0, Water: 0, Air: 0, Ether: 0 };
  const qualTally = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  const dignityTally = { "Exalted": 0, "Moolatrikona": 0, "Own Sign": 0, "Friendly Sign": 0, "Neutral Sign": 0, "Enemy Sign": 0, "Debilitated": 0 };
  planets.forEach(p => {
    const sign = degToSign(p.longitude).sign;
    elemTally[PLANET_TATVA[p.name]] = (elemTally[PLANET_TATVA[p.name]] || 0) + 1;
    qualTally[SIGN_QUALITY[sign]] = (qualTally[SIGN_QUALITY[sign]] || 0) + 1;
    dignityTally[getDignity(p.name, p.longitude)]++;
  });
  const total = planets.length || 1;
  const exaltedCount = dignityTally["Exalted"];
  const debilitatedCount = dignityTally["Debilitated"];

  const barGroup = (tally, colorMap) => Object.entries(tally).map(([label, n]) => `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(n/total*100).toFixed(1)}%; background:${colorMap[label]};"></div></div>
      <span class="bar-count">${n}</span>
    </div>`).join("");

  const houseStrip = Array.from({length:12}, (_, i) => i+1).map(h => {
    const n = houseCounts[h];
    const level = n === 0 ? 0 : Math.min(n, 4);
    return `<div class="hocc-cell lvl${level}${String(h)===maxHouse[0] && n>0 ? ' peak' : ''}" title="House ${h}: ${n} planet${n===1?'':'s'}">
      <span class="hocc-h">${h}</span><span class="hocc-n">${n || ''}</span>
    </div>`;
  }).join("");

  const chipRow = `
    <div class="chip-row">
      ${chip(retroList.length, "Retrograde")}
      ${chip(combustList.length, "Combust", combustList.length ? "warn" : "")}
      ${chip(ownSignList.length, "In own sign", ownSignList.length ? "good" : "")}
      ${chip(exaltedCount, "Exalted", exaltedCount ? "good" : "")}
      ${chip(debilitatedCount, "Debilitated", debilitatedCount ? "warn" : "")}
      ${chip(vacantHouses, "Vacant houses")}
      ${chip("H" + maxHouse[0], "Most occupied (" + maxHouse[1] + ")")}
    </div>`;

  const instantAnalysisHtml = `
    <div class="panel instant-panel">
      <h3><span class="mk">◆</span>Instant analysis</h3>
      ${chipRow}
      <div class="ia-cols">
        <div class="ia-col">
          <div class="ia-subhead">House occupancy</div>
          <div class="hocc-strip">${houseStrip}</div>
        </div>
        <div class="ia-col">
          <div class="ia-subhead">Element balance (Panchatattva)</div>
          ${barGroup(elemTally, TATVA_COLOR)}
        </div>
        <div class="ia-col">
          <div class="ia-subhead">Quality balance</div>
          ${barGroup(qualTally, QUALITY_COLOR)}
        </div>
        <div class="ia-col">
          <div class="ia-subhead">Dignity balance</div>
          ${barGroup(Object.fromEntries(Object.entries(dignityTally).filter(([,n]) => n > 0)), DIGNITY_COLOR)}
        </div>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="top-grid">
      <div class="panel kp-chart-panel"><h3><span class="mk">◆</span>KP Chart</h3>${chartHtml}</div>
      <div>
        <div class="stat-strip">
          <div><div class="k">Ascendant</div><div class="v">${degToSign(asc).text}</div></div>
          <div><div class="k">Midheaven</div><div class="v">${degToSign(chart.houses.mc).text}</div></div>
          <div><div class="k">Ayanamsa</div><div class="v">${chart.positions.ayanamsa.toFixed(4)}°</div></div>
          <div><div class="k">Julian day (UT)</div><div class="v">${chart.positions.julian_day_ut.toFixed(3)}</div></div>
        </div>
        ${instantAnalysisHtml}
      </div>
    </div>
    <div class="analysis-grid">
      <div class="panel"><h3><span class="mk">◆</span>Planets</h3>
        <div class="tbl-scroll"><table class="wide-table">
          <thead><tr><th class="sticky-col">Planet</th><th>Position</th><th>House</th><th>Speed</th><th>Dignity</th></tr></thead>
          <tbody>${planetRows}</tbody>
        </table></div>
      </div>
      <div class="panel"><h3><span class="mk">◆</span>House cusps</h3>
        <div class="tbl-scroll"><table class="wide-table">
          <thead><tr><th class="sticky-col">House</th><th>Sign</th><th>Cusp</th><th>Star lord</th><th>Sub lord</th></tr></thead>
          <tbody>${cuspRows}</tbody>
        </table></div>
      </div>
    </div>
    <p class="sub an-note">Dignity is judged sign-by-sign (exaltation, own sign, moolatrikona, friendly, neutral, enemy, debilitation) — a quick read on how comfortably each planet sits, before the KP sub-lord chain decides what it actually delivers.</p>
  `;

  // Wire up house-click interactivity: clicking a house cell swaps the
  // center box to that house's Sign/Star/Sub lord detail; clicking the
  // center box again returns to the default birth-summary view.
  const centerEl = container.querySelector(".ni-center");
  if (centerEl) {
    container.querySelectorAll(".ni-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        centerEl.innerHTML = houseCenterHtml(cell.dataset.house);
        centerEl.classList.add("detail-mode");
      });
    });
    centerEl.addEventListener("click", () => {
      centerEl.innerHTML = defaultCenterHtml();
      centerEl.classList.remove("detail-mode");
    });
  }
}
