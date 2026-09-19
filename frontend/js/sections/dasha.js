// sections/dasha.js -- Vimshottari dasha periods, drilled down from
// Mahadasha through Antardasha, Pratyantardasha, Sookshma Dasha and
// Prana Dasha. A full 5-level tree is huge (9^5 leaf periods), so
// rather than rendering everything at once this renders one level at
// a time with a breadcrumb trail -- tap a period to drill into its
// sub-periods, tap a crumb to jump back up.
import { callApi } from "../api.js";
import { getBirth, isBirthValid, getDasha, setDasha } from "../state.js";
import { fmtDate, calendarSpan, fmtSpanFull, fmtSpanCompact } from "../helpers.js";
import { pbadge, colorOf, chip } from "../ui.js";

// Nested-list key + display label for each level below Mahadasha, in
// order -- mirrors dasha/vimshottari.py's CHILD_KEYS.
const LEVELS = [
  { key: null,        label: "Mahadasha" },        // level 1 (the root array itself)
  { key: "bhuktis",   label: "Antardasha" },        // level 2
  { key: "antaras",   label: "Pratyantardasha" },   // level 3
  { key: "sookshmas", label: "Sookshma Dasha" },    // level 4
  { key: "pranas",    label: "Prana Dasha" },       // level 5
];

// path: array of {list, index, period} chosen at each drilled level,
// path.length == current depth (0 = looking at the Mahadasha list itself).
let path = [];
let rootTree = null;
let maxDepth = 3;
let usedCycles = 1;

function isCurrent(p, now) {
  return new Date(p.start_date) <= now && now < new Date(p.end_date);
}

export function render(container) {
  container.innerHTML = `
    <div class="panel form-panel" style="max-width:420px;">
      <div class="field-inline">
        <div class="field"><label>Depth</label>
          <select id="dasha-levels">
            <option value="1">Mahadasha only</option>
            <option value="2">+ Antardasha</option>
            <option value="3" selected>+ Pratyantardasha</option>
            <option value="4">+ Sookshma Dasha</option>
            <option value="5">+ Prana Dasha</option>
          </select>
        </div>
        <div class="field"><label>Cycles</label>
          <select id="dasha-cycles"><option value="1" selected>1</option><option value="2">2</option></select>
        </div>
      </div>
      <button class="btn-primary" id="dasha-run">Compute periods</button>
      <p class="sub" style="margin-top:8px;">Each deeper level multiplies the data by about 9x -- Prana Dasha (level 5) can take a moment to compute.</p>
      <div class="err-box" id="dasha-err" style="display:none; margin-top:10px;"></div>
    </div>
    <div id="dasha-results" style="margin-top:14px;"></div>
  `;

  const existing = getDasha();
  if (existing) {
    rootTree = existing;
    maxDepth = deepestComputed(existing);
    document.getElementById("dasha-levels").value = String(maxDepth);
    document.getElementById("dasha-cycles").value = String(usedCycles);
    path = [];
    renderNavigator();
  } else {
    document.getElementById("dasha-results").innerHTML = `<div class="empty-box"><h3>No periods yet</h3><p>Set birth details above, then compute periods.</p></div>`;
  }

  document.getElementById("dasha-run").addEventListener("click", async () => {
    const errEl = document.getElementById("dasha-err");
    errEl.style.display = "none";
    const btn = document.getElementById("dasha-run");
    const birth = getBirth();
    if (!isBirthValid()) { errEl.textContent = "Fill in birth details at the top first."; errEl.style.display = "block"; return; }
    const levels = document.getElementById("dasha-levels").value;
    const cycles = document.getElementById("dasha-cycles").value;
    const payload = { ...birth, levels, num_cycles: cycles };
    const qs = new URLSearchParams(payload).toString();
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Working…`;
    try {
      const data = await callApi("/dasha/?" + qs);
      maxDepth = parseInt(levels, 10);
      usedCycles = parseInt(cycles, 10);
      rootTree = data.mahadashas;
      path = [];
      setDasha(data.mahadashas);
      renderNavigator();
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.innerHTML = "Compute periods";
    }
  });
}

// How many levels deep a previously-computed tree actually has (so
// re-rendering after a nav change doesn't assume more than was fetched).
function deepestComputed(tree) {
  let depth = 1;
  let node = tree[0];
  for (let i = 1; i < LEVELS.length; i++) {
    const key = LEVELS[i].key;
    if (node && node[key] && node[key].length) { depth = i + 1; node = node[key][0]; }
    else break;
  }
  return depth;
}

function currentListAtPath() {
  if (path.length === 0) return rootTree;
  return path[path.length - 1].period[LEVELS[path.length].key] || [];
}

function renderNavigator() {
  const el = document.getElementById("dasha-results");
  const now = new Date();
  const depth = path.length; // 0 = viewing Mahadasha list
  const list = currentListAtPath();
  const levelDef = LEVELS[depth];

  // "Currently running" chain, computed fresh from the root every render
  // so it's independent of where the user has drilled to.
  const chain = findCurrentChain(rootTree, now);

  // Full horizon: total span covered by the whole computed tree, start
  // of the first Mahadasha through end of the last -- the "0 to n" total.
  const horizonStart = rootTree[0].start_date;
  const horizonEnd = rootTree[rootTree.length - 1].end_date;
  const horizonSpan = calendarSpan(horizonStart, horizonEnd);
  const horizonHtml = `
    <div class="chip-row dasha-horizon">
      ${chip(rootTree.length, "Mahadashas")}
      ${chip(usedCycles, usedCycles === 1 ? "Cycle" : "Cycles")}
    </div>
    <div class="dhorizon-strip">
      <span class="dl">Full horizon, ${fmtDate(horizonStart)} → ${fmtDate(horizonEnd)}</span>
      <span class="dv mono">${fmtSpanFull(horizonSpan)}</span>
    </div>`;

  const crumbsHtml = `
    <div class="dasha-crumbs">
      <button class="dasha-crumb ${depth === 0 ? "current" : ""}" data-jump="0">Mahadasha</button>
      ${path.map((p, i) => `
        <span class="dasha-crumb-sep">›</span>
        <button class="dasha-crumb ${i === path.length - 1 ? "current" : ""}" data-jump="${i + 1}">${p.period.lord}</button>
      `).join("")}
    </div>`;

  const listHtml = `
    <div class="dasha-level-label"><span class="lvln lv${Math.min(depth + 1, 5)}">${depth + 1}</span>${levelDef.label}</div>
    <div class="dlist">
      ${list.map((p, i) => {
        const childKey = LEVELS[depth + 1] ? LEVELS[depth + 1].key : null;
        const canDrill = !!(childKey && p[childKey] && p[childKey].length);
        const running = isCurrent(p, now);
        const span = calendarSpan(p.start_date, p.end_date);
        let progressHtml = "";
        if (running) {
          const total = new Date(p.end_date) - new Date(p.start_date);
          const elapsed = now - new Date(p.start_date);
          const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
          progressHtml = `<div class="dperiod-bar"><div class="dperiod-fill" style="width:${pct.toFixed(1)}%"></div></div>`;
        }
        return `
        <div class="ditem ${canDrill ? "clickable" : ""} ${running ? "active" : ""}" data-index="${i}">
          <div class="left">
            ${pbadge(p.lord)}
            <div class="dlord-col">
              <span class="lord">${p.lord}${running ? '<span class="now-tag">now</span>' : ''}</span>
              <span class="dspan mono">${fmtSpanFull(span)}</span>
            </div>
          </div>
          <div class="right">
            <span class="dates">${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}</span>
            ${canDrill ? '<span class="chev">›</span>' : ''}
          </div>
          ${progressHtml}
        </div>`;
      }).join("")}
    </div>`;

  el.innerHTML = `${horizonHtml}${chain ? renderNowStrip(chain, now) : ""}${crumbsHtml}${listHtml}`;

  document.querySelectorAll(".dasha-crumb").forEach(btn => {
    btn.addEventListener("click", () => {
      const jump = parseInt(btn.dataset.jump, 10);
      path = path.slice(0, jump);
      renderNavigator();
    });
  });

  document.querySelectorAll(".ditem.clickable").forEach(row => {
    row.addEventListener("click", () => {
      const idx = parseInt(row.dataset.index, 10);
      const period = list[idx];
      path.push({ period });
      renderNavigator();
    });
  });
}

// Walks the tree from Mahadasha down through whatever levels were
// computed, returning the chain of periods active "now" -- e.g.
// [mahadasha, antardasha, pratyantardasha] -- or null if now falls
// outside the computed span (e.g. tree covers a past-birth lifetime
// but "now" is beyond num_cycles).
function findCurrentChain(tree, now) {
  if (!tree) return null;
  const md = tree.find(p => isCurrent(p, now));
  if (!md) return null;
  const chain = [md];
  let node = md;
  for (let i = 1; i < LEVELS.length; i++) {
    const children = node[LEVELS[i].key];
    if (!children || !children.length) break;
    const match = children.find(p => isCurrent(p, now));
    if (!match) break;
    chain.push(match);
    node = match;
  }
  return chain;
}

function renderNowStrip(chain, now) {
  const deepest = chain[chain.length - 1];
  const totalSpan = calendarSpan(deepest.start_date, deepest.end_date);
  const elapsedSpan = calendarSpan(deepest.start_date, now);
  const remainingSpan = calendarSpan(now, deepest.end_date);
  const total = new Date(deepest.end_date) - new Date(deepest.start_date);
  const elapsed = now - new Date(deepest.start_date);
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));

  return `
    <div class="dasha-now">
      <div class="cap">Running now</div>
      <div class="chain">
        ${chain.map((p, i) => `
          ${i > 0 ? '<span class="sep">›</span>' : ''}
          <div class="lvl">${pbadge(p.lord, "lg")}<span class="lord">${p.lord}</span><span class="lbl">${LEVELS[i].label}</span></div>
        `).join("")}
      </div>

      <div class="dnow-bar-row">
        <div class="dperiod-bar lg"><div class="dperiod-fill" style="width:${pct.toFixed(1)}%; background:${colorOf(deepest.lord)};"></div></div>
        <span class="dnow-pct mono">${pct.toFixed(1)}%</span>
      </div>

      <div class="dnow-spans">
        <div><span class="dl">Total period (0 → n)</span><span class="dv mono">${fmtSpanFull(totalSpan)}</span></div>
        <div><span class="dl">Elapsed</span><span class="dv mono">${fmtSpanFull(elapsedSpan)}</span></div>
        <div><span class="dl">Remaining</span><span class="dv mono">${fmtSpanFull(remainingSpan)}</span></div>
      </div>

      <div class="until">${fmtDate(deepest.start_date)} → ${fmtDate(deepest.end_date)} · current period ends ${fmtDate(deepest.end_date)}</div>
    </div>`;
}
