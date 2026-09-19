// helpers.js -- pure formatting functions and static (non-computed)
// zodiac reference tables. No API calls live here.

export const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

// Classical sign rulerships -- fixed astronomical/astrological fact,
// used only for display (e.g. Rashi Analysis), independent of the API.
export const SIGN_LORDS = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon", Leo:"Sun",
  Virgo:"Mercury", Libra:"Venus", Scorpio:"Mars", Sagittarius:"Jupiter",
  Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter",
};

export const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
  "Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati",
];

export const PLANET_ABBR = {Sun:"Su",Moon:"Mo",Mars:"Ma",Mercury:"Me",Jupiter:"Ju",Venus:"Ve",Saturn:"Sa",Rahu:"Ra",Ketu:"Ke"};

// Naam Akshar (Namakaran) -- the 108 traditional naming syllables, four
// per nakshatra (one per pada), used to suggest a baby/given-name's
// starting letter from the Moon's nakshatra + pada at birth.
// [English transliteration, Devanagari] per pada, indexed 0-3.
export const NAAM_AKSHAR = {
  "Ashwini":            [["Chu","चू"], ["Che","चे"], ["Cho","चो"], ["La","ला"]],
  "Bharani":            [["Li","ली"],  ["Lu","लू"],  ["Le","ले"],  ["Lo","लो"]],
  "Krittika":           [["A","अ"],    ["Ee","ई"],   ["U","उ"],    ["E","ए"]],
  "Rohini":             [["O","ओ"],    ["Vaa","वा"], ["Vee","वी"], ["Vu","वु"]],
  "Mrigashira":         [["Ve","वे"],  ["Vo","वो"],  ["Kaa","का"], ["Kee","की"]],
  "Ardra":              [["Ku","कू"],  ["Gha","घ"],  ["Ing","ङ"],  ["Chha","छ"]],
  "Punarvasu":          [["Ke","के"],  ["Ko","को"],  ["Haa","हा"], ["Hee","ही"]],
  "Pushya":             [["Hu","हू"],  ["He","हे"],  ["Ho","हो"],  ["Daa","डा"]],
  "Ashlesha":           [["Dee","डी"], ["Doo","डू"], ["De","डे"],  ["Do","डो"]],
  "Magha":              [["Maa","मा"], ["Mee","मी"], ["Moo","मू"], ["Me","मे"]],
  "Purva Phalguni":     [["Mo","मो"],  ["Taa","टा"], ["Tee","टी"], ["Too","टू"]],
  "Uttara Phalguni":    [["Te","टे"],  ["To","टो"],  ["Paa","पा"], ["Pee","पी"]],
  "Hasta":              [["Poo","पू"], ["Sha","ष"],  ["Na","ण"],   ["Tha","ठ"]],
  "Chitra":             [["Pe","पे"],  ["Po","पो"],  ["Ra","रा"],  ["Ri","री"]],
  "Swati":              [["Ru","रू"],  ["Re","रे"],  ["Ro","रो"],  ["Ta","ता"]],
  "Vishakha":           [["Ti","ती"],  ["Tu","तू"],  ["Te","ते"],  ["To","तो"]],
  "Anuradha":           [["Na","ना"],  ["Ni","नी"],  ["Nu","नू"],  ["Ne","ने"]],
  "Jyeshtha":           [["No","नो"],  ["Ya","या"],  ["Yi","यी"],  ["Yu","यू"]],
  "Mula":               [["Ye","ये"],  ["Yo","यो"],  ["Bhaa","भा"],["Bhee","भी"]],
  "Purva Ashadha":      [["Bhoo","भू"],["Dhaa","धा"],["Phaa","फा"],["Dha","ढ"]],
  "Uttara Ashadha":     [["Bhe","भे"], ["Bho","भो"], ["Jaa","जा"], ["Jee","जी"]],
  "Shravana":           [["Khee","खी"],["Khoo","खू"],["Khe","खे"], ["Kho","खो"]],
  "Dhanishtha":         [["Gaa","गा"], ["Gee","गी"], ["Gu","गु"],  ["Ge","गे"]],
  "Shatabhisha":        [["Go","गो"],  ["Saa","सा"], ["See","सी"], ["Soo","सू"]],
  "Purva Bhadrapada":   [["Se","से"],  ["So","सो"],  ["Daa","दा"], ["Dee","दी"]],
  "Uttara Bhadrapada":  [["Doo","दू"], ["Tha","थ"],  ["Jha","झ"],  ["Yna","ञ"]],
  "Revati":             [["De","दे"],  ["Do","दो"],  ["Cha","च"],  ["Chee","ची"]],
};

// Returns { letters: [[en,hi],...4], padaIndex: 0-3 } for a nakshatra
// name + 1-based pada, or null if the nakshatra isn't recognized.
export function getNaamAkshar(nakshatraName, pada) {
  const row = NAAM_AKSHAR[nakshatraName];
  if (!row || !pada) return null;
  const padaIndex = Math.min(Math.max(pada, 1), 4) - 1;
  return { letters: row, padaIndex };
}

// Element / quality (modality) per sign -- static classical mapping,
// used only for the at-a-glance distribution bars in Chart analysis.
export const SIGN_ELEMENT = {
  Aries:"Fire", Leo:"Fire", Sagittarius:"Fire",
  Taurus:"Earth", Virgo:"Earth", Capricorn:"Earth",
  Gemini:"Air", Libra:"Air", Aquarius:"Air",
  Cancer:"Water", Scorpio:"Water", Pisces:"Water",
};
export const SIGN_QUALITY = {
  Aries:"Cardinal", Cancer:"Cardinal", Libra:"Cardinal", Capricorn:"Cardinal",
  Taurus:"Fixed", Leo:"Fixed", Scorpio:"Fixed", Aquarius:"Fixed",
  Gemini:"Mutable", Virgo:"Mutable", Sagittarius:"Mutable", Pisces:"Mutable",
};
export const ELEMENT_COLOR = {Fire:"#bb4b3f", Earth:"#2f8f5b", Air:"#a9762c", Water:"#324876"};
export const QUALITY_COLOR = {Cardinal:"#a9762c", Fixed:"#324876", Mutable:"#2f8f5b"};

// Panchatattva (5 classical elements) per PLANET rather than per sign --
// the standard Vedic elemental-balance mapping used for a horoscope's
// 5-element distribution (as opposed to the 4-element sign mapping
// above, which is the Western-style fire/earth/air/water-sign split).
export const PLANET_TATVA = {
  Mercury:"Earth",
  Moon:"Water", Venus:"Water",
  Sun:"Fire", Mars:"Fire",
  Saturn:"Air", Rahu:"Air",
  Jupiter:"Ether", Ketu:"Ether",
};
export const TATVA_COLOR = {Fire:"#bb4b3f", Earth:"#2f8f5b", Air:"#a9762c", Water:"#324876", Ether:"#7a5ca0"};

// ---------- Dignity (classical Parashari) ----------
// Exaltation / debilitation signs. Rahu/Ketu figures follow the
// commonly-cited Parashari convention (Rahu exalted Taurus / debilitated
// Scorpio, Ketu the reverse) -- some traditions instead use Gemini/
// Sagittarius, so treat these two as the more common of two conventions.
export const EXALTATION = {
  Sun:"Aries", Moon:"Taurus", Mars:"Capricorn", Mercury:"Virgo",
  Jupiter:"Cancer", Venus:"Pisces", Saturn:"Libra",
  Rahu:"Taurus", Ketu:"Scorpio",
};
export const DEBILITATION = {
  Sun:"Libra", Moon:"Scorpio", Mars:"Cancer", Mercury:"Pisces",
  Jupiter:"Capricorn", Venus:"Virgo", Saturn:"Aries",
  Rahu:"Scorpio", Ketu:"Taurus",
};
// Moolatrikona sign + the degree range within it (BPHS); Rahu/Ketu have
// no classically-defined moolatrikona and are omitted.
export const MOOLATRIKONA = {
  Sun:{sign:"Leo", from:0, to:20},
  Moon:{sign:"Taurus", from:4, to:30},
  Mars:{sign:"Aries", from:0, to:12},
  Mercury:{sign:"Virgo", from:16, to:20},
  Jupiter:{sign:"Sagittarius", from:0, to:10},
  Venus:{sign:"Libra", from:0, to:15},
  Saturn:{sign:"Aquarius", from:0, to:20},
};
// Naisargika Maitri (natural friendship) table, classical BPHS -- only
// defined for the 7 classical grahas; Rahu/Ketu's friendships are too
// inconsistent across traditions to state as settled fact, so they're
// left out and get a plain "neutral" dignity read instead.
export const NATURAL_FRIENDSHIP = {
  Sun:     {friend:["Moon","Mars","Jupiter"], enemy:["Venus","Saturn"]},
  Moon:    {friend:["Sun","Mercury"], enemy:[]},
  Mars:    {friend:["Sun","Moon","Jupiter"], enemy:["Mercury"]},
  Mercury: {friend:["Sun","Venus"], enemy:["Moon"]},
  Jupiter: {friend:["Sun","Moon","Mars"], enemy:["Mercury","Venus"]},
  Venus:   {friend:["Mercury","Saturn"], enemy:["Sun","Moon"]},
  Saturn:  {friend:["Mercury","Venus"], enemy:["Sun","Moon","Mars"]},
};
export const DIGNITY_COLOR = {
  "Exalted":"#2f8f5b", "Moolatrikona":"#2f8f5b", "Own Sign":"#2f8f5b",
  "Friendly Sign":"#a9762c", "Neutral Sign":"#69748a",
  "Enemy Sign":"#bb4b3f", "Debilitated":"#bb4b3f",
};

// Classical dignity of a planet at a given longitude: Exalted >
// Debilitated > Moolatrikona > Own Sign > Friendly/Neutral/Enemy Sign
// (by natural friendship toward that sign's lord) > Neutral (Rahu/Ketu
// in a sign they don't rule and aren't exalted/debilitated in).
export function getDignity(planetName, longitude) {
  const sd = degToSign(longitude);
  const sign = sd.sign;
  const degInSign = sd.deg + sd.min / 60 + sd.sec / 3600;

  if (EXALTATION[planetName] === sign) return "Exalted";
  if (DEBILITATION[planetName] === sign) return "Debilitated";

  const moola = MOOLATRIKONA[planetName];
  if (moola && sign === moola.sign && degInSign >= moola.from && degInSign < moola.to) return "Moolatrikona";

  if (SIGN_LORDS[sign] === planetName) return "Own Sign";

  const signLord = SIGN_LORDS[sign];
  const friendship = NATURAL_FRIENDSHIP[planetName];
  if (friendship && signLord) {
    if (friendship.friend.includes(signLord)) return "Friendly Sign";
    if (friendship.enemy.includes(signLord)) return "Enemy Sign";
    return "Neutral Sign";
  }
  return "Neutral Sign";
}

// Rough combustion orbs (degrees from the Sun), classical values -- for
// an at-a-glance flag only, not a substitute for a real combustion rule.
export const COMBUST_ORB = {Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15};

export function degToSign(lon) {
  const norm = ((lon % 360) + 360) % 360;
  const signIdx = Math.floor(norm / 30);
  const inSign = norm - signIdx * 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  const s = Math.round(((inSign - d) * 60 - m) * 60);
  return { sign: SIGNS[signIdx], deg: d, min: m, sec: s, text: `${SIGNS[signIdx].slice(0,3)} ${d}°${String(m).padStart(2,"0")}'` };
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }); }
  catch (e) { return iso; }
}

// Calendar-accurate breakdown of the span from `start` to `end` (Date or
// ISO string), counting whole years, then months, then days, then the
// leftover clock time -- i.e. "from 0 to n" the way a calendar actually
// ticks, not a flat divide-by-365.25.
export function calendarSpan(start, end) {
  let a = new Date(start), b = new Date(end);
  let neg = false;
  if (b < a) { const t = a; a = b; b = t; neg = true; }
  let y = b.getFullYear() - a.getFullYear();
  let mo = b.getMonth() - a.getMonth();
  let d = b.getDate() - a.getDate();
  let h = b.getHours() - a.getHours();
  let mi = b.getMinutes() - a.getMinutes();
  let s = b.getSeconds() - a.getSeconds();
  if (s < 0) { s += 60; mi--; }
  if (mi < 0) { mi += 60; h--; }
  if (h < 0) { h += 24; d--; }
  if (d < 0) { d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); mo--; }
  if (mo < 0) { mo += 12; y--; }
  return { years: y, months: mo, days: d, hours: h, minutes: mi, seconds: s, negative: neg };
}

// "5y 3m 12d 4h 22m 10s" -- every unit always shown (per request: full
// breakdown from the start of a period through to its end).
export function fmtSpanFull(span) {
  return `${span.years}y ${span.months}m ${span.days}d ${span.hours}h ${span.minutes}m ${span.seconds}s`;
}

// Compact variant that drops leading zero units, for tight spaces --
// e.g. a period that's only "4h 22m 10s" long doesn't need "0y 0m 0d".
export function fmtSpanCompact(span) {
  const parts = [];
  const units = [["y", span.years], ["m", span.months], ["d", span.days], ["h", span.hours], ["min", span.minutes], ["s", span.seconds]];
  let started = false;
  units.forEach(([label, n]) => {
    if (n !== 0) started = true;
    if (started) parts.push(`${n}${label}`);
  });
  return parts.length ? parts.join(" ") : "0s";
}

export function normTime(t) {
  if (!t) return "00:00:00";
  return t.length === 5 ? t + ":00" : t;
}

// Which house (1-12) a longitude falls in, given the enriched cusps
// object from /chart/ ({ "1": {longitude, kp}, ... }).
export function houseOfLongitude(lon, cusps) {
  const norm = ((lon % 360) + 360) % 360;
  for (let h = 1; h <= 12; h++) {
    const start = ((cusps[String(h)].longitude % 360) + 360) % 360;
    const nextH = h === 12 ? 1 : h + 1;
    const end = ((cusps[String(nextH)].longitude % 360) + 360) % 360;
    if (start <= end) { if (norm >= start && norm < end) return h; }
    else { if (norm >= start || norm < end) return h; }
  }
  return 1;
}

export function isCombust(planetName, planetLon, sunLon) {
  const orb = COMBUST_ORB[planetName];
  if (!orb) return false;
  let diff = Math.abs(planetLon - sunLon) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff <= orb;
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
