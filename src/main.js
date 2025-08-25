// [C4-STEP-6 + SAVE-FIX] Step 6 Logik + verlässliches Speichern/Laden + Export/Import

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoard } from './board.js';
import {
  initGame, update as updateGame, onGameEvent,
  setAiOptions, getAiOptions, resetGame, undo,
  exportSnapshot, importSnapshot, getMyPlayer
} from './game.js';
import { setupInput, updateInput } from './input.js';

import { setSfxEnabled, sfxPlace, sfxLanded, sfxInvalid, sfxWin, sfxDraw, sfxTurnAI, ensureAudio } from './sfx.js';
import { setHapticsEnabled, buzzSelect, buzzLanded, buzzWin, buzzInvalid } from './haptics.js';

import * as storage from './storage.js';
import { initDropdown, setDropdownValue, initNetControls } from './ui.js';
import { onMessage as onNetMessage } from './net.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;
let resultSign = null;
let lastTs = 0;

let SFX = true, HAP = true, SHADOWS = false;

init();
animate();

function showResultSign(text, color) {
  if (!boardRoot) return;
  if (resultSign) {
    scene.remove(resultSign);
    resultSign.material?.map?.dispose?.();
    resultSign.material?.dispose?.();
    resultSign.geometry?.dispose?.();
    resultSign = null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(0.6, 0.3);
  resultSign = new THREE.Mesh(geometry, material);
  resultSign.position.copy(boardRoot.position);
  resultSign.position.y += 0.35;
  resultSign.quaternion.copy(camera.quaternion);
  scene.add(resultSign);
}

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = SHADOWS;
  document.body.appendChild(renderer.domElement);

  renderer.xr.addEventListener('sessionend', () => {
    if (boardRoot) {
      scene.remove(boardRoot);
      resetGame();
      boardRoot = null;
    }
    if (resultSign) {
      scene.remove(resultSign);
      resultSign.material?.map?.dispose?.();
      resultSign.material?.dispose?.();
      resultSign.geometry?.dispose?.();
      resultSign = null;
    }
    boardPlaced = false;
    const ret = getReticle();
    if (ret) ret.visible = true;
  });

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

  // AR-Button mit DOM-Overlay
  const btn = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.getElementById('hud') }
  });
  document.body.appendChild(btn);

  wireUiControls();
  initStoreStatus();

  // Game-Events -> HUD + SFX/Haptik
  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    const session = renderer.xr.getSession?.();
    const aiOn = getAiOptions().enabled;

    switch (ev.type) {
      case 'turn':
        if (hint) hint.textContent = ev.player === 1
          ? `Gelb ist dran${aiOn ? ' (Du)' : ''} – visiere eine Spalte & drücke Select.`
          : aiOn ? 'Rot (KI) ist dran.' : 'Rot ist dran – visiere eine Spalte & drücke Select.';
        if (ev.player === 2 && aiOn) { if (SFX) sfxTurnAI(); }
        break;
      case 'ai_turn':
        if (hint) hint.textContent = 'Rot (KI) denkt …';
        break;
      case 'place':
        if (SFX) sfxPlace(); if (HAP) buzzSelect(session); break;
      case 'landed':
        if (SFX) sfxLanded(); if (HAP) buzzLanded(session); break;
      case 'win':
        if (hint) hint.textContent = ev.player === 1
          ? 'Gelb gewinnt! 🎉'
          : aiOn ? 'Rot (KI) gewinnt! 🤖🏆' : 'Rot gewinnt! 🏆';
        if (SFX) sfxWin(); if (HAP) buzzWin(session);
        {
          const me = getMyPlayer();
          const winLocal = ev.player === me;
          showResultSign(winLocal ? 'Du hast gewonnen!' : 'Du hast verloren!', winLocal ? 'green' : 'red');
          setTimeout(() => renderer.xr.getSession()?.end(), 2500);
        }
        break;
      case 'draw':
        if (hint) hint.textContent = 'Unentschieden – keine freien Felder.';
        if (SFX) sfxDraw();
        showResultSign('Unentschieden', '#666');
        setTimeout(() => renderer.xr.getSession()?.end(), 2500);
        break;
      case 'invalid':
        if (hint) hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        if (SFX) sfxInvalid(); if (HAP) buzzInvalid(session); break;
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

  const elOpp   = document.getElementById('opponent');
  const elMode  = document.getElementById('aiMode');
  const elDepth = document.getElementById('aiDepth');
  const elTime  = document.getElementById('aiTime');

  const elSfx   = document.getElementById('chkSfx');
  const elHap   = document.getElementById('chkHap');
  const elShad  = document.getElementById('chkShadows');

  const elSave  = document.getElementById('btnSave');
  const elLoad  = document.getElementById('btnLoad');
  const elClear = document.getElementById('btnClear');

  const elExport = document.getElementById('btnExport');
  const elImport = document.getElementById('btnImport');
  const elFile   = document.getElementById('fileImport');

  elReset?.addEventListener('click', () => resetGame());
  elUndo1?.addEventListener('click', () => undo(1));
  elUndo2?.addEventListener('click', () => undo(2));

  elOpp  && initDropdown(elOpp,  { onChange: val => setAiOptions({ enabled: val === 'ai' }) });
  elMode && initDropdown(elMode, { onChange: val => setAiOptions({ mode: val }) });
  elDepth&& initDropdown(elDepth,{ onChange: val => setAiOptions({ depth: parseInt(val, 10) }) });
  elTime && initDropdown(elTime, { onChange: val => setAiOptions({ timeMs: parseInt(val, 10) }) });

  elSfx?.addEventListener('change', () => { SFX = elSfx.checked; setSfxEnabled(SFX); if (SFX) ensureAudio(); });
  elHap?.addEventListener('change', () => { HAP = elHap.checked; setHapticsEnabled(HAP); });
  elShad?.addEventListener('change', () => {
    SHADOWS = elShad.checked;
    if (renderer) renderer.shadowMap.enabled = SHADOWS;
  });

  // Speichern
  elSave?.addEventListener('click', () => {
    const ok = storage.save(collectPersistData());
    notify(ok ? 'Gespeichert.' : 'Speichern fehlgeschlagen: ' + (storage.lastError() || ''));
  });

  // Laden
  elLoad?.addEventListener('click', () => {
    const ok = loadFromStorage();
    notify(ok ? 'Geladen.' : 'Kein Speicherstand gefunden (oder nicht verfügbar).');
  });

  // Löschen
  elClear?.addEventListener('click', () => {
    const ok = storage.clear();
    notify(ok ? 'Speicherstand gelöscht.' : 'Konnte Speicher nicht leeren: ' + (storage.lastError() || ''));
  });

  // Export/Import
  elExport?.addEventListener('click', () => {
    const blob = storage.toBlob(collectPersistData());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vier-gewinnt-ar-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    notify('Export erstellt.');
  });

  elImport?.addEventListener('click', () => elFile?.click());
  elFile?.addEventListener('change', async () => {
    const file = elFile.files?.[0];
    if (!file) return;
    try {
      const obj = await storage.fromFile(file);
      applyLoadedObject(obj);
      notify('Import erfolgreich.');
    } catch (e) {
      notify('Import fehlgeschlagen: ' + (e?.message || e));
    } finally {
      elFile.value = '';
    }
  });

  initNetControls();

  onNetMessage(msg => {
    if (msg.type === 'disconnect') notify('Verbindung getrennt.');
  });
}

function initStoreStatus() {
  const ok = storage.isAvailable();
  const el = document.getElementById('storeStatus');
  if (el) {
    el.textContent = ok ? 'Speicher: OK (localStorage)' : 'Speicher: nicht verfügbar – nutze Export/Import';
  }
  if (!ok) console.warn('localStorage nicht verfügbar:', storage.lastError());
}

// Snapshot zusammenstellen (Einstellungen + Pose + Spiel)
function collectPersistData() {
  const ai = getAiOptions();
  const pose = boardRoot ? {
    position: boardRoot.position.toArray(),
    quaternion: boardRoot.quaternion.toArray()
  } : null;
  return {
    options: {
      sfx: SFX,
      haptics: HAP,
      shadows: SHADOWS,
      aiEnabled: ai.enabled,
      aiMode: ai.mode,
      aiDepth: ai.depth,
      aiTime: ai.timeMs
    },
    board: pose,
    game: exportSnapshot()
  };
}

// Laden aus localStorage (wenn verfügbar)
function loadFromStorage() {
  const st = storage.load();
  if (!st) return false;
  return applyLoadedObject(st);
}

// Gemeinsamer Apply-Pfad (für Load & Import)
function applyLoadedObject(st) {
  // Optionen anwenden
  SFX = !!st.options?.sfx; setSfxEnabled(SFX);
  HAP = !!st.options?.haptics; setHapticsEnabled(HAP);
  SHADOWS = !!st.options?.shadows; if (renderer) renderer.shadowMap.enabled = SHADOWS;
  const nextAi = {};
  if (st.options?.aiMode) nextAi.mode = st.options.aiMode;
  if (st.options?.aiDepth != null) nextAi.depth = parseInt(st.options.aiDepth, 10);
  if (st.options?.aiTime  != null) nextAi.timeMs = parseInt(st.options.aiTime, 10);
  if (st.options?.aiEnabled != null) nextAi.enabled = !!st.options.aiEnabled;
  if (Object.keys(nextAi).length) {
    setAiOptions(nextAi);
    const elOpp   = document.getElementById('opponent');
    const elMode  = document.getElementById('aiMode');
    const elDepth = document.getElementById('aiDepth');
    const elTime  = document.getElementById('aiTime');
    if (elOpp && nextAi.enabled != null) setDropdownValue(elOpp, nextAi.enabled ? 'ai' : 'human');
    if (elMode && nextAi.mode) setDropdownValue(elMode, nextAi.mode);
    if (elDepth && nextAi.depth != null) setDropdownValue(elDepth, String(nextAi.depth));
    if (elTime && nextAi.timeMs != null) setDropdownValue(elTime, String(nextAi.timeMs));
  }

  // Brett sicherstellen
  if (!boardPlaced) {
    boardRoot = createBoard();
    scene.add(boardRoot);
    initGame(boardRoot);
    boardPlaced = true;
    const ret = getReticle(); if (ret) ret.visible = false;
  }

  // Pose wiederherstellen (wenn vorhanden)
  if (st.board?.position && st.board?.quaternion) {
    boardRoot.position.fromArray(st.board.position);
    boardRoot.quaternion.fromArray(st.board.quaternion);
  }

  // Spielzustand importieren
  if (st.game) importSnapshot(st.game);

  return true;
}

function notify(msg) {
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = msg;
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
  if (resultSign) resultSign.quaternion.copy(camera.quaternion);

  renderer.render(scene, camera);
}