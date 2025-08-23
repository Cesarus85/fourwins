// [C4-STEP-7 RETICLE-ROBUST FULL] Main entry: AR + robustes Reticle + UI + Persistenz

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

import {
  setSfxEnabled, sfxPlace, sfxLanded, sfxInvalid, sfxWin, sfxDraw, sfxTurnAI, ensureAudio
} from './sfx.js';
import { setHapticsEnabled, buzzSelect, buzzLanded, buzzWin, buzzInvalid } from './haptics.js';

import { initDropdown, setDropdownValue } from './ui.js';
import { bindUiLock } from './overlay.js';
import * as storage from './storage.js';

// ---------- Global State ----------
let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;

let lastTs = 0;
let SFX = true, HAP = true, SHADOWS = false;
let AUTOLOAD = false;           // per Checkbox steuerbar (default aus)
let placementMode = null;       // 'reposition' | null

// ---------- Bootstrap ----------
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

function saveNow() {
  storage.save(collectPersistData());
}

function applyStoredOptions(opts = {}) {
  SFX = !!opts.sfx;
  HAP = !!opts.haptics;
  SHADOWS = !!opts.shadows;
  AUTOLOAD = !!opts.autoload;

  setSfxEnabled(SFX);
  setHapticsEnabled(HAP);
  if (renderer) renderer.shadowMap.enabled = SHADOWS;

  const nextAi = {};
  if (opts.aiMode) nextAi.mode = opts.aiMode;
  if (opts.aiDepth != null) nextAi.depth = parseInt(opts.aiDepth, 10);
  if (opts.aiTime  != null) nextAi.timeMs = parseInt(opts.aiTime, 10);
  if (Object.keys(nextAi).length) setAiOptions(nextAi);
}

/**
 * Laden aus localStorage.
 * @param {object} opt
 * @param {boolean} opt.force - wenn true, lädt unabhängig vom AUTOLOAD-Flag (für "Laden"-Button)
 * @returns {boolean} true, wenn etwas geladen wurde
 */
function loadFromStorage({ force = false } = {}) {
  const st = storage.load();
  if (!st) return false;

  applyStoredOptions(st.options);

  if (!force && !AUTOLOAD) return false;

  // Brett ggf. anlegen
  if (!boardPlaced) {
    boardRoot = createBoard();
    scene.add(boardRoot);
    initGame(boardRoot);
    boardPlaced = true;
  }

  // Pose
  if (st.board?.position && st.board?.quaternion && boardRoot) {
    boardRoot.position.fromArray(st.board.position);
    boardRoot.quaternion.fromArray(st.board.quaternion);
  }

  // Spielzustand
  if (st.game) importSnapshot(st.game);

  const hint = document.getElementById('hint');
  if (hint) hint.textContent = 'Gespeichertes Spiel geladen. Du kannst weiterspielen.';

  const ret = getReticle(); if (ret) ret.visible = false;
  return true;
}

// ---------- Init ----------
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = SHADOWS;
  renderer.domElement.style.zIndex = 0;
  document.body.appendChild(renderer.domElement);

  // Scene + Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(0.8, 1.4, 0.6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.01;
  dir.shadow.camera.far = 5.0;
  dir.shadow.radius = 2.5;
  scene.add(dir);

  // AR + Input
  setupAR(renderer, scene);
  setupInput(renderer, camera);

  // ARButton mit DOM Overlay + local-floor
  const hud = document.getElementById('hud');
  const btn = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'local-floor'],
    domOverlay: { root: hud || document.body }
  });
  document.body.appendChild(btn);

  // UI Interop
  bindUiLock(hud);
  wireUiControls();

  // Optionen (ohne Laden) aus Storage ziehen, UI spiegeln
  const st = storage.load();
  if (st?.options) applyStoredOptions(st.options);
  reflectUiToggles();

  // Auto-Laden beim Sessionstart (nur wenn aktiviert)
  renderer.xr.addEventListener('sessionstart', () => {
    setTimeout(() => {
      if (!boardPlaced) loadFromStorage({ force: false });
    }, 120);
  });

  // Game Events (HUD, SFX/Haptik, Persist)
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
        if (SFX) sfxPlace();
        if (HAP) buzzSelect(session);
        break;

      case 'landed':
        if (SFX) sfxLanded();
        if (HAP) buzzLanded(session);
        break;

      case 'win':
        if (hint) hint.textContent = ev.player === 1 ? 'Gelb gewinnt! 🎉' : 'Rot (KI) gewinnt! 🤖🏆';
        if (SFX) sfxWin();
        if (HAP) buzzWin(session);
        saveNow();
        break;

      case 'draw':
        if (hint) hint.textContent = 'Unentschieden – keine freien Felder.';
        if (SFX) sfxDraw();
        saveNow();
        break;

      case 'invalid':
        if (hint) hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        if (SFX) sfxInvalid();
        if (HAP) buzzInvalid(session);
        break;

      case 'reset':
      case 'undo':
      case 'ai_options':
        saveNow();
        break;
    }
  });

  // Platzierung & Reposition via erstem Select
  onFirstSelect(renderer, () => {
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    ensureAudio();

    if (placementMode === 'reposition' && boardRoot) {
      // bestehendes Brett neu setzen
      boardRoot.visible = true;
      boardRoot.position.copy(ret.position);
      alignYawToCamera(boardRoot);

      const hint = document.getElementById('hint');
      if (hint) hint.textContent = 'Brett neu platziert. Weiter geht’s!';

      placementMode = null;
      ret.visible = false;
      boardPlaced = true;
      saveNow();
      return;
    }

    if (boardPlaced) return; // Sicherheitsgurt

    // Erstanlage
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

    saveNow();
  });

  window.addEventListener('resize', onWindowResize);
}

// ---------- UI ----------
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

  const elSave  = document.getElementById('btnSave');
  const elLoad  = document.getElementById('btnLoad');
  const elClear = document.getElementById('btnClear');

  elReset?.addEventListener('click', () => { resetGame(); saveNow(); });
  elUndo1?.addEventListener('click', () => { undo(1); saveNow(); });
  elUndo2?.addEventListener('click', () => { undo(2); saveNow(); });

  // Neu platzieren: Reticle zurückholen, Spielstand behalten
  elRepl?.addEventListener('click', () => {
    const hint = document.getElementById('hint');
    if (!boardRoot) return;
    placementMode = 'reposition';
    boardPlaced = false;       // -> Hit-Test läuft wieder, Reticle erscheint
    boardRoot.visible = false; // bis neu gesetzt
    if (hint) hint.textContent = 'Ziele auf eine Fläche → Select setzt das Brett neu.';
  });

  // Dropdowns
  initDropdown(elMode,  { onChange: (val) => { setAiOptions({ mode: val }); saveNow(); } });
  initDropdown(elDepth, { onChange: (val) => { setAiOptions({ depth: parseInt(val, 10) }); saveNow(); } });
  initDropdown(elTime,  { onChange: (val) => { setAiOptions({ timeMs: parseInt(val, 10) }); saveNow(); } });

  const ai = getAiOptions();
  setDropdownValue(elMode,  ai.mode);
  setDropdownValue(elDepth, String(ai.depth));
  setDropdownValue(elTime,  String(ai.timeMs));

  // Toggles
  elSfx?.addEventListener('change', () => { SFX = elSfx.checked; setSfxEnabled(SFX); saveNow(); });
  elHap?.addEventListener('change', () => { HAP = elHap.checked; setHapticsEnabled(HAP); saveNow(); });
  elShad?.addEventListener('change', () => {
    SHADOWS = elShad.checked;
    if (renderer) renderer.shadowMap.enabled = SHADOWS;
    saveNow();
  });
  elAuto?.addEventListener('change', () => { AUTOLOAD = elAuto.checked; saveNow(); });

  // Persist Buttons
  elSave?.addEventListener('click', () => saveNow());
  elLoad?.addEventListener('click', () => {
    const ok = loadFromStorage({ force: true });
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

  if (elSfx)  elSfx.checked = SFX;
  if (elHap)  elHap.checked = HAP;
  if (elShad) elShad.checked = SHADOWS;
  if (elAuto) elAuto.checked = AUTOLOAD;
}

// ---------- Utilities ----------
function alignYawToCamera(obj) {
  obj.position.y += 0.005;
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
  obj.quaternion.copy(yawOnly);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------- Loop ----------
function animate() { renderer.setAnimationLoop(render); }

function render(ts, frame) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;

  const needsPlacement = !boardPlaced || placementMode === 'reposition';
  if (needsPlacement) {
    updateHitTest(renderer, frame);   // robustes Reticle: Hit (grün) oder Fallback (orange)
  } else {
    updateInput(frame);
    updateGame(dt);
  }

  renderer.render(scene, camera);
}
