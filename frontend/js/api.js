// api.js -- thin fetch wrappers. Everything else imports from here so
// there is exactly one place that knows how to talk to the backend.

export const API = window.location.origin;

export async function callApi(path, opts) {
  const r = await fetch(API + path, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || `Request failed (${r.status})`);
  return body;
}

export async function checkApiHealth() {
  try {
    const r = await fetch(API + "/");
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Free, key-less city search (Open-Meteo geocoding). Returns
// [{name, admin1, country, latitude, longitude, timezone}, ...]
export async function geocodeCity(query) {
  if (!query || query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).map(r => ({
      name: r.name,
      admin1: r.admin1 || "",
      country: r.country || "",
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    }));
  } catch (e) {
    return [];
  }
}

// Derive the UTC offset (in hours, DST-aware) for an IANA timezone name
// at a specific local date/time, using only Intl (no extra API call).
export function tzOffsetHours(dateStr, timeStr, timeZone) {
  try {
    const naive = new Date(`${dateStr}T${timeStr || "12:00:00"}`);
    const utcString = naive.toLocaleString("en-US", { timeZone: "UTC" });
    const tzString = naive.toLocaleString("en-US", { timeZone });
    const utcDate = new Date(utcString);
    const tzDate = new Date(tzString);
    const diffHours = (tzDate - utcDate) / 3600000;
    return Math.round(diffHours * 4) / 4; // snap to nearest quarter hour
  } catch (e) {
    return null;
  }
}
