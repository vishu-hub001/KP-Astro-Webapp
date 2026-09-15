// state.js -- one shared store for the birth-data form and the last
// computed chart/significators, so every section module sees the same
// data without passing props around.

const store = {
  birth: { date: "", time: "", tz_offset_hours: null, latitude: null, longitude: null },
  name: "",
  cityLabel: "",
  chart: null,        // last /chart/ response
  significators: null, // last /significators/ response.significators
  dasha: null,        // last /dasha/ response.mahadashas
};

const listeners = new Set();

export function onStoreChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => fn(store));
}

export function getBirth() {
  return { ...store.birth };
}

export function setBirth(partial) {
  Object.assign(store.birth, partial);
  notify();
}

export function isBirthValid() {
  const b = store.birth;
  return !!b.date && b.tz_offset_hours !== null && !isNaN(b.tz_offset_hours)
    && b.latitude !== null && !isNaN(b.latitude)
    && b.longitude !== null && !isNaN(b.longitude);
}

export function setName(name) { store.name = name; notify(); }
export function getName() { return store.name; }

export function setCityLabel(label) { store.cityLabel = label; notify(); }
export function getCityLabel() { return store.cityLabel; }

export function setChart(chart) { store.chart = chart; notify(); }
export function getChart() { return store.chart; }

export function setSignificators(sig) { store.significators = sig; notify(); }
export function getSignificators() { return store.significators; }

export function setDasha(mahadashas) { store.dasha = mahadashas; notify(); }
export function getDasha() { return store.dasha; }

export function hasChart() { return !!store.chart; }
