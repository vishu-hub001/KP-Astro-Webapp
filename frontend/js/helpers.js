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
