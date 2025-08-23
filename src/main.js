// [C4-STEP-7 FIX] Reticle/Placement: Auto-Laden toggelbar + "Neu platzieren" Modus

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoard } from './board.js';
import {
  initGame, update as updateGame, onGameEvent,
  setAiOptions, getAiOptions, resetGame, undo,
  exportSnapshot, importSnapshot
} from './game.js';
import { setupInput, updateInput } from './input.js';

import { setSfxEnabled, sfxPlace, sfxLanded, sfxInvalid, sfxWin, sfxDraw, sfxTurnAI, ensureAudio } from './sfx.js';
import { setHapticsEnabled, buzzSelect, buzzLanded, buzzWin, buzzInvalid } from './haptics.js';

import { initDropdown, setDropdownValue } from './ui.js';
import { bindUiLock } from './overlay.js';
import * as storage from './storage.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;

let lastTs = 0;
let SFX = true, HAP = true, SHADOWS = false;
let AUTOLOAD = false;                 // <-- neu: standardmäßig AUS
let placementMode = null;             // 'reposition' | null

init();
animate();

// ---------- Persist Helpers ----------
function collectPersistData() {
  const ai = getAiOptions();
  const pose = boardRoot ? {
    position: boardRoot.position.toArray(),
    quaternion: boardRoot.quaternion.toArray()
  } : null;

  return {
    options: {
      sfx: SFX, haptics: HAP, shadows: SHADOWS,
      aiMode: ai.mode, aiDepth: ai.depth, aiTime: ai.timeMs,
      autoload: AUTOLOAD
    },
    board: pose,
    game: exportSnapshot()
  };
}
function saveNow() { storage.save(collectPersistData()); }

function applyStoredOptions(opts = {}) {
  SFX = !!opts.sfx;
  HAP = !!opts.haptics;
  SHADOWS = !!opts.shadows;
  AUTOLOAD = !!opts.autoload;

  setSfxEnabled(SFX);
  setHapticsEnabled(HAP);
  if (renderer) renderer.shadowMap.enabled = SHADOWS;

  // KI-Optionen (falls vorhanden)
  const nextAi = {};
  if (opts.aiMode) nextAi.mode = opts.aiMode;
  if (opts.aiDepth != null) nextAi.depth = parseInt(opts.aiDepth, 10);
  if (opts.aiTime  != null) nextAi.timeMs = parseInt(opts.aiTime, 10);
  if (Object.keys(nextAi).length) setAiOptions(nextAi);
}

function tryAutoLoad() {
  const st = storage.load();
  if (!st) return false;
  applyStoredOptions(st.options);

  // Nur laden, wenn Auto-Laden aktiv
  if (!AUTOLOAD) return false;

  if (!boardPlaced) {
    boardRoot = createBoard();
    scene.add(boardRoot);
    initGame(boardRoot);
    boardPlaced = true;

    // Pose + Game
    if (st.board?.position && st.board?.quaternion) {
      boardRoot.position.fromArray(st.board.position);
      boardRoot.quaternion.fromArray(st.board.quaternion);
    }
    if (st.game) importSnapshot(st.game);

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Gespeichertes Spiel geladen. Du kannst weiterspielen.';
    const ret = getReticle(); if (ret) ret.visible = false;
    return true;
  } else {
    if (st.game) importSnapshot(st.game);
    return true;
  }
}

// ---------- Init ----------
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = SHADOWS;
  renderer.domElement.style.zIndex = 0;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(0.8, 1.4, 0.6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.01;
  dir.shadow.camera.far = 5.0;
  dir.shadow.radius = 2.5;
  scene.add(dir);

  setupAR(renderer, scene);
  setupInput(renderer, camera);

  const hud = document.getElementById('hud');
  const btn = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: hud || document.body }
  });
  document.body.appendChild(btn);

  bindUiLock(hud);
  wireUiControls();

  // Optionen vorab aus Storage lesen (ohne zu laden)
  const st = storage.load();
  if (st?.options) applyStoredOptions(st.options);
  // UI nachziehen (Checkboxen etc.)
  reflectUiToggles();

  // Auto-Load (nur wenn aktiv)
  renderer.xr.addEventListener('sessionstart', () => {
    setTimeout(() => { if (!boardPlaced) tryAutoLoad(); }, 120);
  });

  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    const session = renderer.xr.getSession?.();

    switch (ev.type) {
      case 'turn':
        if (hint) hint.textContent = ev.player === 1
          ? 'Gelb ist dran (Du) – visiere eine Spalte & drücke Select.'
          : 'Rot (KI) ist dran.';
        if (ev.player === 2 && SFX) sfxTurnAI();
        saveNow();
        break;
      case 'ai_turn':
        if (hint) hint.textContent = 'Rot (KI) denkt …';
        break;
      case 'place':
        if (SFX) sfxPlace(); if (HAP) buzzSelect(session); break;
      case 'landed':
        if (SFX) sfxLanded(); if (HAP) buzzLanded(session); break;
      case 'win':
        if (hint) hint.textContent = ev.player === 1 ? 'Gelb gewinnt! 🎉' : 'Rot (KI) gewinnt! 🤖🏆';
        if (SFX) sfxWin(); if (HAP) buzzWin(session); saveNow(); break;
      case 'draw':
        if (hint) hint.textContent = 'Unentschieden – keine freien Felder.';
        if (SFX) sfxDraw(); saveNow(); break;
      case 'invalid':
        if (hint) hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        if (SFX) sfxInvalid(); if (HAP) buzzInvalid(session); break;
      case 'reset':
      case 'undo':
      case 'ai_options':
        saveNow();
        break;
    }
  });

  // Platzierung & Reposition über denselben Select-Handler
  onFirstSelect(renderer, () => {
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    ensureAudio();

    if (placementMode === 'reposition' && boardRoot) {
      // bestehendes Brett umsetzen
      boardRoot.visible = true;
      boardRoot.position.copy(ret.position);
      alignYawToCamera(boardRoot);
      const hint = document.getElementById('hint');
      if (hint) hint.textContent = 'Brett neu platziert. Weiter geht’s!';
      placementMode = null;
      ret.visible = false;
      boardPlaced = true;
      saveNow(); // neue Pose sichern
      return;
    }

    if (boardPlaced) return; // Falls bereits platziert (Sicherheitsgurt)

    // NEU-PLATZIERUNG
    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    alignYawToCamera(boardRoot);

    renderer.shadowMap.enabled = SHADOWS;

    scene.add(boardRoot);
    initGame(boardRoot);

    ret.visible = false;
    boardPlaced = true;

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert. Gelb beginnt – visiere eine Spalte & drücke Select.';

    saveNow(); // Pose + leerer State
  });

  window.addEventListener('resize', onWindowResize);
}

function alignYawToCamera(obj) {
  obj.position.y += 0.005;
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
  obj.quaternion.copy(yawOnly);
}

function wireUiControls() {
  const elReset = document.getElementById('btnReset');
  const elUndo1 = document.getElementById('btnUndo1');
  const elUndo2 = document.getElementById('btnUndo2');
  const elRepl  = document.getElementById('btnReposition');

  const elMode  = document.getElementById('ddMode');
  const elDepth = document.getElementById('ddDepth');
  const elTime  = document.getElementById('ddTime');

  const elSfx   = document.getElementById('chkSfx');
  const elHap   = document.getElementById('chkHap');
  const elShad  = document.getElementById('chkShadows');
  const elAuto  = document.getElementById('chkAutoLoad');

  // Persist Buttons (falls noch nicht im HTML vorhanden wurden sie in Step 7 dynamisch ergänzt)
  let elSave = document.getElementById('btnSave');
  let elLoad = document.getElementById('btnLoad');
  let elClear = document.getElementById('btnClear');
  if (!elSave || !elLoad || !elClear) {
    const row = document.createElement('div');
    row.className = 'row wrap';
    row.innerHTML = `
      <button id="btnSave" class="btn">Speichern</button>
      <button id="btnLoad" class="btn">Laden</button>
      <button id="btnClear" class="btn">Löschen</button>
    `;
    document.querySelector('#hud .controls')?.appendChild(row);
    elSave = row.querySelector('#btnSave');
    elLoad = row.querySelector('#btnLoad');
    elClear = row.querySelector('#btnClear');
  }

  elReset?.addEventListener('click', () => { resetGame(); saveNow(); });
  elUndo1?.addEventListener('click', () => { undo(1); saveNow(); });
  elUndo2?.addEventListener('click', () => { undo(2); saveNow(); });

  // Neu platzieren: Reticle zurückholen ohne Spielstand zu verlieren
  elRepl?.addEventListener('click', () => {
    const hint = document.getElementById('hint');
    if (!boardRoot) return;
    placementMode = 'reposition';
    boardPlaced = false;            // -> Hit-Test läuft wieder
    boardRoot.visible = false;      // bis neu positioniert
    if (hint) hint.textContent = 'Ziele auf die Fläche → Select setzt das Brett neu.';
  });

  // Dropdown-Init + Änderungen weiterreichen
  initDropdown(elMode,  { onChange: (val) => { setAiOptions({ mode: val }); saveNow(); } });
  initDropdown(elDepth, { onChange: (val) => { setAiOptions({ depth: parseInt(val, 10) }); saveNow(); } });
  initDropdown(elTime,  { onChange: (val) => { setAiOptions({ timeMs: parseInt(val, 10) }); saveNow(); } });

  const ai = getAiOptions();
  setDropdownValue(elMode,  ai.mode);
  setDropdownValue(elDepth, String(ai.depth));
  setDropdownValue(elTime,  String(ai.timeMs));

  elSfx?.addEventListener('change', () => { SFX = elSfx.checked; setSfxEnabled(SFX); saveNow(); });
  elHap?.addEventListener('change', () => { HAP = elHap.checked; setHapticsEnabled(HAP); saveNow(); });
  elShad?.addEventListener('change', () => {
    SHADOWS = elShad.checked;
    if (renderer) renderer.shadowMap.enabled = SHADOWS;
    saveNow();
  });
  elAuto?.addEventListener('change', () => {
    AUTOLOAD = elAuto.checked;
    saveNow();
  });

  // Persist Buttons
  elSave?.addEventListener('click', () => saveNow());
  elLoad?.addEventListener('click', () => {
    const ok = tryAutoLoad(); // respektiert AUTOLOAD; hier geht's trotzdem manuell
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = ok ? 'Gespeichertes Spiel geladen.' : 'Kein Speicherstand gefunden.';
  });
  elClear?.addEventListener('click', () => {
    storage.clear();
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Speicherstand gelöscht.';
  });
}

function reflectUiToggles() {
  const elSfx  = document.getElementById('chkSfx');
  const elHap  = document.getElementById('chkHap');
  const elShad = document.getElementById('chkShadows');
  const elAuto = document.getElementById('chkAutoLoad');
  if (elSfx)  elSfx.checked  = SFX;
  if (elHap)  elHap.checked  = HAP;
  if (elShad) elShad.checked = SHADOWS;
  if (elAuto) elAuto.checked = AUTOLOAD;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(){ renderer.setAnimationLoop(render); }

function render(ts, frame) {
  const dt = (render.lastTs ? Math.min(0.05, (ts - render.lastTs) / 1000) : 0);
  render.lastTs = ts;

  if (!boardPlaced) {
    updateHitTest(renderer, frame);   // Reticle/Hit-Test aktiv
  } else {
    updateInput(frame);               // Spielinteraktion
    updateGame(dt);
  }

  renderer.render(scene, camera);
}
