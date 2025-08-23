// [C4-STEP-7] Einfache Persistenz per localStorage
const KEY = 'c4ar:state:v1';

export function save(data) {
  try {
    const payload = { version: 1, time: Date.now(), ...data };
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.version !== 1) return null;
    return obj;
  } catch {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch {}
}