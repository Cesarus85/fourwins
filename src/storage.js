// [C4-SAVE-FIX] Persistenz-Helper: LocalStorage mit Verfügbarkeits-Check + JSON-Export

const KEY = 'c4ar:state:v1';
let _lastError = null;

export function isAvailable() {
  try {
    const k = '__c4_test__' + Math.random();
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return !!ok;
  } catch (e) {
    _lastError = String(e?.message || e);
    return false;
  }
}
export function lastError() { return _lastError; }

export function save(data) {
  try {
    const payload = { version: 1, time: Date.now(), ...data };
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    _lastError = String(e?.message || e);
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
  } catch (e) {
    _lastError = String(e?.message || e);
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); return true; }
  catch (e) { _lastError = String(e?.message || e); return false; }
}

// ------- Datei-Export/Import -------
export function toBlob(data) {
  const payload = { version: 1, time: Date.now(), ...data };
  const str = JSON.stringify(payload, null, 2);
  return new Blob([str], { type: 'application/json' });
}

export async function fromFile(file) {
  const text = await file.text();
  const obj = JSON.parse(text);
  if (!obj || (obj.version !== 1 && obj.version !== undefined)) {
    throw new Error('Ungültiges Save-Format');
  }
  return obj;
}