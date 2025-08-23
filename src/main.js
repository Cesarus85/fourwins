// [C4-STEP-6+7] Main: Schritt 6 (SFX/Haptik/Undo/Schatten/HUD) + manuelle Persistenz (Save/Load)

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

import * as storage from './storage.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;
let lastTs = 0;

let SFX = true, HAP = true, SHADOWS = false;

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = SHADOWS;
  document.body.appendChild(renderer.domElement);

  // Scene & Camera
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

  // AR & Input
  setupAR(renderer, scene);
  setupInput(renderer, camera);

  // AR-Button (ohne DOM Overlay – wie in Step 6)
  const btn = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: [] });
  document.body.appendChild(btn);

  wireUiControls();

  // Game-Events -> HUD + SFX/Haptik
  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    const session = renderer.xr.getSession?.();

    switch (ev.type) {
      case 'turn':
        if (hint) hint.textContent = ev.player === 1
          ? 'Gelb ist dran (Du) – visiere eine Spalte & drücke Select.'
          : 'Rot (KI) ist dran.';
        if (ev.player === 2) { if (SFX) sfxTurnAI(); }
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
        break;
      case 'draw':
        if (hint) hint.textContent = 'Unentschieden – keine freien Felder.';
        if (SFX) sfxDraw();
        break;
      case 'invalid':
        if (hint) hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        if (SFX) sfxInvalid();
        if (HAP) buzzInvalid(session);
        break;
    }
  });

  // Platzieren per erstem Select
  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    ensureAudio();

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

    // Yaw zur Kamera
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
    boardRoot.quaternion.copy(yawOnly);

    renderer.shadowMap.enabled = SHADOWS;

    scene.add(boardRoot);
    initGame(boardRoot);

    ret.visible = false;
    boardPlaced = true;

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert. Gelb beginnt – visiere eine Spalte & drücke Select.';
  });

  window.addEventListener('resize', onWindowResize);
}

function wireUiControls() {
  const elReset = document.getElementById('btnReset');
  const elUndo1 = document.getElementById('btnUndo1');
  const elUndo2 = document.getElementById('btnUndo2');

  const elMode  = document.getElementById('aiMode');
  const elDepth = document.getElementById('aiDepth');
  const elTime  = document.getElementById('aiTime');

  const elSfx   = document.getElementById('chkSfx');
  const elHap   = document.getElementById('chkHap');
  const elShad  = document.getElementById('chkShadows');

  const elSave  = document.getElementById('btnSave');
  const elLoad  = document.getElementById('btnLoad');
  const elClear = document.getElementById('btnClear');

  elReset?.addEventListener('click', () => resetGame());
  elUndo1?.addEventListener('click', () => undo(1));
  elUndo2?.addEventListener('click', () => undo(2));

  elMode?.addEventListener('change', () => {
    setAiOptions({ mode: elMode.value });
  });
  elDepth?.addEventListener('change', () => {
    setAiOptions({ depth: parseInt(elDepth.value, 10) });
  });
  elTime?.addEventListener('change', () => {
    setAiOptions({ timeMs: parseInt(elTime.value, 10) });
  });

  elSfx?.addEventListener('change', () => {
    SFX = elSfx.checked; setSfxEnabled(SFX); if (SFX) ensureAudio();
  });
  elHap?.addEventListener('change', () => {
    HAP = elHap.checked; setHapticsEnabled(HAP);
  });
  elShad?.addEventListener('change', () => {
    SHADOWS = elShad.checked;
    if (renderer) renderer.shadowMap.enabled = SHADOWS;
  });

  // Persistenz-Buttons
  elSave?.addEventListener('click', () => {
    const ok = storage.save(collectPersistData());
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = ok ? 'Gespeichert.' : 'Speichern fehlgeschlagen.';
  });

  elLoad?.addEventListener('click', () => {
    const ok = loadFromStorage();
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = ok ? 'Geladen.' : 'Kein Speicherstand gefunden.';
  });

  elClear?.addEventListener('click', () => {
    storage.clear();
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Speicherstand gelöscht.';
  });
}

// Snapshot zusammenstellen (Einstellungen + Pose + Spiel)
function collectPersistData() {
  const ai = getAiOptions();
  const pose = boardRoot ? {
    position: boardRoot.position.toArray(),
    quaternion: boardRoot.quaternion.toArray()
  } : null;
  return {
    options: { sfx: SFX, haptics: HAP, shadows: SHADOWS, aiMode: ai.mode, aiDepth: ai.depth, aiTime: ai.timeMs },
    board: pose,
    game: exportSnapshot()
  };
}

// Laden: Pose + Spielstand (kein Auto-Load, keine Änderung an Reticle/Hit-Test)
function loadFromStorage() {
  const st = storage.load();
  if (!st) return false;

  // Optionen anwenden
  SFX = !!st.options?.sfx; setSfxEnabled(SFX);
  HAP = !!st.options?.haptics; setHapticsEnabled(HAP);
  SHADOWS = !!st.options?.shadows; if (renderer) renderer.shadowMap.enabled = SHADOWS;
  const nextAi = {};
  if (st.options?.aiMode) nextAi.mode = st.options.aiMode;
  if (st.options?.aiDepth != null) nextAi.depth = parseInt(st.options.aiDepth, 10);
  if (st.options?.aiTime  != null) nextAi.timeMs = parseInt(st.options.aiTime, 10);
  if (Object.keys(nextAi).length) setAiOptions(nextAi);

  // Brett sicherstellen
  if (!boardPlaced) {
    boardRoot = createBoard();
    scene.add(boardRoot);
    initGame(boardRoot);
    boardPlaced = true;
    const ret = getReticle(); if (ret) ret.visible = false;
  }

  // Pose wiederherstellen
  if (st.board?.position && st.board?.quaternion) {
    boardRoot.position.fromArray(st.board.position);
    boardRoot.quaternion.fromArray(st.board.quaternion);
  }

  // Spielstand importieren
  if (st.game) importSnapshot(st.game);

  return true;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() { renderer.setAnimationLoop(render); }

function render(ts, frame) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;

  if (!boardPlaced) {
    updateHitTest(renderer, frame);
  } else {
    updateInput(frame);
    updateGame(dt);
  }

  renderer.render(scene, camera);
}