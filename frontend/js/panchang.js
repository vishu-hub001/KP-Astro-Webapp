// panchang.js -- Avakhada Chakra (birth-chart classification table) and
// Panchang (five limbs of the day) calculations, per classical Vedic/KP
// astrology. Pure functions only, derived entirely from longitudes and
// the date already on the chart -- no extra API calls.
import { SIGNS, NAKSHATRAS, SIGN_ELEMENT } from "./helpers.js";

// ---------- Varna (spiritual class), by Moon-sign element ----------
// Fire -> Kshatriya, Earth -> Vaishya, Air -> Shudra, Water -> Brahmin.
const VARNA_BY_ELEMENT = { Fire: "Kshatriya", Earth: "Vaishya", Air: "Shudra", Water: "Brahmin" };
export function getVarna(sign) {
  return VARNA_BY_ELEMENT[SIGN_ELEMENT[sign]] || "—";
}

// ---------- Vashya (dominance/temperament group), by Moon sign ----------
// Simplified whole-sign table (the classical version splits a few signs
// at their midpoint; most published Kundli summaries use this
// whole-sign form for a quick Avakhada read).
const VASHYA_BY_SIGN = {
  Aries: "Chatushpada (Quadruped)", Taurus: "Chatushpada (Quadruped)",
  Gemini: "Nara (Human)", Cancer: "Jalachar (Aquatic)",
  Leo: "Vanachar (Wild)", Virgo: "Nara (Human)",
  Libra: "Nara (Human)", Scorpio: "Keeta (Insect)",
  Sagittarius: "Nara (Human)", Capricorn: "Chatushpada (Quadruped)",
  Aquarius: "Nara (Human)", Pisces: "Jalachar (Aquatic)",
};
export function getVashya(sign) {
  return VASHYA_BY_SIGN[sign] || "—";
}

// ---------- Yoni (animal symbol), by Nakshatra ----------
const YONI_BY_NAKSHATRA = {
  Ashwini: "Horse (M)", Bharani: "Elephant (M)", Krittika: "Goat (F)",
  Rohini: "Serpent (M)", Mrigashira: "Serpent (F)", Ardra: "Dog (F)",
  Punarvasu: "Cat (F)", Pushya: "Goat (M)", Ashlesha: "Cat (M)",
  Magha: "Rat (M)", "Purva Phalguni": "Rat (F)", "Uttara Phalguni": "Cow (F)",
  Hasta: "Buffalo (F)", Chitra: "Tiger (F)", Swati: "Buffalo (M)",
  Vishakha: "Tiger (M)", Anuradha: "Deer (F)", Jyeshtha: "Deer (M)",
  Mula: "Dog (M)", "Purva Ashadha": "Monkey (F)", "Uttara Ashadha": "Mongoose (M)",
  Shravana: "Monkey (M)", Dhanishtha: "Lion (F)", Shatabhisha: "Horse (F)",
  "Purva Bhadrapada": "Lion (M)", "Uttara Bhadrapada": "Cow (M)", Revati: "Elephant (F)",
};
export function getYoni(nakshatra) {
  return YONI_BY_NAKSHATRA[nakshatra] || "—";
}

// ---------- Gana (temperament group), by Nakshatra ----------
const GANA_DEVA = new Set(["Ashwini","Mrigashira","Punarvasu","Pushya","Hasta","Swati","Anuradha","Shravana","Revati"]);
const GANA_MANUSHYA = new Set(["Bharani","Rohini","Ardra","Purva Phalguni","Uttara Phalguni","Purva Ashadha","Uttara Ashadha","Purva Bhadrapada","Uttara Bhadrapada"]);
export function getGana(nakshatra) {
  if (GANA_DEVA.has(nakshatra)) return "Deva";
  if (GANA_MANUSHYA.has(nakshatra)) return "Manushya";
  return "Rakshasa";
}

// ---------- Nadi (constitution), by Nakshatra ----------
const NADI_ADI = new Set(["Ashwini","Ardra","Punarvasu","Uttara Phalguni","Hasta","Jyeshtha","Mula","Shatabhisha","Purva Bhadrapada"]);
const NADI_MADHYA = new Set(["Bharani","Mrigashira","Pushya","Purva Phalguni","Chitra","Anuradha","Purva Ashadha","Dhanishtha","Uttara Bhadrapada"]);
export function getNadi(nakshatra) {
  if (NADI_ADI.has(nakshatra)) return "Adi (Vata)";
  if (NADI_MADHYA.has(nakshatra)) return "Madhya (Pitta)";
  return "Antya (Kapha)";
}

// ---------- Navamsa sign + Paya (metal), from Moon longitude ----------
// Navamsa divides each 30° sign into nine 3°20' parts; which sign the
// first part starts from depends on the natal sign's element (fire
// signs start their navamsa cycle from Aries, earth from Capricorn,
// air from Libra, water from Cancer).
const NAVAMSA_START = { Fire: "Aries", Earth: "Capricorn", Air: "Libra", Water: "Cancer" };
export function getNavamsaSign(longitude) {
  const norm = ((longitude % 360) + 360) % 360;
  const signIdx = Math.floor(norm / 30);
  const sign = SIGNS[signIdx];
  const degInSign = norm - signIdx * 30;
  const navamsaIdx = Math.min(8, Math.floor(degInSign / (30 / 9)));
  const startIdx = SIGNS.indexOf(NAVAMSA_START[SIGN_ELEMENT[sign]]);
  return SIGNS[(startIdx + navamsaIdx) % 12];
}
const PAYA_BY_ELEMENT = { Fire: "Gold", Earth: "Silver", Air: "Copper", Water: "Iron" };
export function getPaya(moonLongitude) {
  const navamsaSign = getNavamsaSign(moonLongitude);
  return PAYA_BY_ELEMENT[SIGN_ELEMENT[navamsaSign]] || "—";
}

// ---------- Tithi (lunar day) + Paksha ----------
const TITHI_NAMES = ["Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami","Navami","Dashami","Ekadashi","Dwadashi","Trayodashi","Chaturdashi"];
export function getTithi(moonLongitude, sunLongitude) {
  const diff = (((moonLongitude - sunLongitude) % 360) + 360) % 360;
  const idx = Math.floor(diff / 12); // 0-29
  const paksha = idx < 15 ? "Shukla (waxing)" : "Krishna (waning)";
  const within = idx % 15; // 0-14
  const name = within === 14 ? (idx < 15 ? "Purnima" : "Amavasya") : TITHI_NAMES[within];
  return { index: idx + 1, name, paksha };
}

// ---------- Yoga (27 yogas), from Sun + Moon longitude ----------
const YOGA_NAMES = [
  "Vishkambha","Priti","Ayushman","Saubhagya","Shobhana","Atiganda","Sukarma","Dhriti","Shoola",
  "Ganda","Vriddhi","Dhruva","Vyaghata","Harshana","Vajra","Siddhi","Vyatipata","Variyana",
  "Parigha","Shiva","Siddha","Sadhya","Shubha","Shukla","Brahma","Indra","Vaidhriti",
];
export function getYoga(moonLongitude, sunLongitude) {
  const sum = ((moonLongitude + sunLongitude) % 360 + 360) % 360;
  const idx = Math.floor(sum / (360 / 27));
  return YOGA_NAMES[Math.min(26, idx)];
}

// ---------- Karana (half-tithi) ----------
const MOVABLE_KARANAS = ["Bava","Balava","Kaulava","Taitila","Gara","Vanija","Vishti (Bhadra)"];
export function getKarana(moonLongitude, sunLongitude) {
  const diff = (((moonLongitude - sunLongitude) % 360) + 360) % 360;
  const k = Math.floor(diff / 6); // 0-59
  if (k === 0) return "Kimstughna";
  if (k === 57) return "Shakuni";
  if (k === 58) return "Chatushpada";
  if (k === 59) return "Naga";
  return MOVABLE_KARANAS[(k - 1) % 7];
}

// ---------- Tatva (element name), by Moon-sign element ----------
const TATVA_BY_ELEMENT = { Fire: "Agni (Fire)", Earth: "Prithvi (Earth)", Air: "Vayu (Air)", Water: "Jal (Water)" };
export function getTatva(sign) {
  return TATVA_BY_ELEMENT[SIGN_ELEMENT[sign]] || "—";
}

// ---------- Weekday (Vaar), from a YYYY-MM-DD date string ----------
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function getWeekday(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "—";
  // Local calendar-date components, not UTC parsing, so the weekday
  // matches the civil date exactly as entered (no timezone drift).
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/**
 * Build the complete Avakhada Chakra + Panchang table for a chart.
 * @param {object} chart - the /chart/ API response already on the store.
 * @returns {object} flat map of label -> value, ready to render as rows.
 */
export function getAvakhadaChakra(chart) {
  const planets = chart.positions.planets;
  const sun = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");
  if (!moon || !sun) return null;

  const moonSign = moon.kp?.sign || SIGNS[Math.floor((((moon.longitude % 360) + 360) % 360) / 30)];
  const nakshatra = moon.kp.nakshatra;
  const tithi = getTithi(moon.longitude, sun.longitude);

  return {
    "Rashi (Moon sign)": moonSign,
    "Rashi lord": undefined, // filled by caller, which already has SIGN_LORDS
    "Nakshatra": `${nakshatra} (pada ${moon.kp.pada})`,
    "Nakshatra lord": moon.kp.star_lord,
    "Varna": getVarna(moonSign),
    "Vashya": getVashya(moonSign),
    "Yoni": getYoni(nakshatra),
    "Gana": getGana(nakshatra),
    "Nadi": getNadi(nakshatra),
    "Tatva": getTatva(moonSign),
    "Paya": getPaya(moon.longitude) + " (via Navamsa)",
    "Tithi": `${tithi.name} (${tithi.paksha})`,
    "Yoga": getYoga(moon.longitude, sun.longitude),
    "Karana": getKarana(moon.longitude, sun.longitude),
    "Vaar (weekday)": getWeekday(chart.input?.date),
  };
}
