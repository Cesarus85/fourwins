// Custom Dropdowns für Quest DOM Overlay
// Usage: initDropdown(el, { onChange: (value,label)=>{} }); setDropdownValue(el, value)

import * as net from './net.js';
import { SERVER_HOST } from './config.js';

export function initDropdown(el, { onChange } = {}) {
  const btn  = el.querySelector('.dd-btn');
  const list = el.querySelector('.dd-list');
  if (!btn || !list) return;

  function set(value, label) {
    el.dataset.value = value;
    btn.textContent = label;
    onChange?.(value, label);
  }

  function currentLabelFor(val) {
    const li = Array.from(list.children).find(li => li.dataset.val === val) || list.children[0];
    return li ? li.textContent.trim() : '';
  }

  function open()  { el.classList.add('open'); }
  function close() { el.classList.remove('open'); }
  function toggle(){ el.classList.contains('open') ? close() : open(); }

  btn.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); });
  btn.addEventListener('click',       ev => { ev.preventDefault(); ev.stopPropagation(); toggle(); });

  for (const li of list.querySelectorAll('li')) {
    li.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); });
    li.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      set(li.dataset.val, li.textContent.trim());
      close();
    });
  }

  // Click außerhalb schließt Dropdown
  document.addEventListener('pointerdown', (ev) => {
    if (!el.contains(ev.target)) close();
  }, true);

  // Initialwert aus data-value
  const initVal = el.dataset.value || (list.querySelector('li')?.dataset.val ?? '');
  set(initVal, currentLabelFor(initVal));

  // Externe Steuerung ermöglichen
  el._setValue = (val) => set(val, currentLabelFor(val));
}

export function setDropdownValue(el, value) {
  if (el && typeof el._setValue === 'function') el._setValue(value);
}

export function getDropdownValue(el) {
  return el?.dataset?.value ?? null;
}

// --- Online-Raum UI ---------------------------------------------------------
export function initNetControls() {
  const btnCreate = document.getElementById('btnCreateRoom');
  const btnJoin   = document.getElementById('btnJoinRoom');
  const inpCode   = document.getElementById('roomCodeInput');
  const lblCode   = document.getElementById('roomCode');

  btnCreate?.addEventListener('click', async () => {
    try {
      const scheme = location.protocol === 'https:' ? 'https://' : 'http://';
      const res = await fetch(`${scheme}${SERVER_HOST}/room`, { method: 'POST' });
      const data = await res.json();
      if (lblCode) lblCode.textContent = data.code;
      net.connect(data.code);
    } catch (e) { console.error(e); }
  });

  btnJoin?.addEventListener('click', () => {
    const code = inpCode?.value?.trim();
    if (!code) return;
    if (lblCode) lblCode.textContent = code;
    net.connect(code);
  });
}
