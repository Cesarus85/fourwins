// UI-Lock: XR-Selects während DOM-Interaktion kurzzeitig ignorieren
export const ui = {
  lockUntil: 0,
  isLocked() { return performance.now() < this.lockUntil; },
  lock(ms=400) { this.lockUntil = performance.now() + ms; }
};

export function bindUiLock(root) {
  if (!root) return;
  const arm = () => ui.lock(500); // etwas großzügiger
  root.addEventListener('pointerdown', arm, true);
  root.addEventListener('pointerup', arm, true);
  root.addEventListener('click', arm, true);
  root.addEventListener('touchstart', arm, true);
  root.addEventListener('touchend', arm, true);
}
