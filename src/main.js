// [C4-STEP-6] AR + Schatten umschaltbar + HUD + SFX/Haptik + Reset/Undo + KI-Optionen

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoard } from './board.js';
import {
  initGame, update as updateGame, onGameEvent,
  setAiOptions, getAiOptions, resetGame, undo
} from './game.js';
import { setupInput, updateInput } from './input.js';

import { setSfxEnabled, sfxPlace, sfxLanded, sfxInvalid, sfxWin, sfxDraw, sfxTurnAI, ensureAudio } from './sfx.js';
import { setHapticsEnabled, buzzSelect, buzzLanded, buzzWin, buzzInvalid } from './haptics.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;
let lastTs = 0;

// UI state
let SFX = true, HAP = true, SHADOWS = false;

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = SHADOWS; // per Toggle
  document.body.appendChild(renderer.domElement);

  // Szene & Kamera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Licht (Hemi + optional Directional für Schatten)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemi);

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

  // AR-Button
  const btn = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: [] });
  document.body.appendChild(btn);

  // HUD Controls
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
      case 'reset':
        if (hint) hint.textContent = 'Neues Spiel. Gelb beginnt.';
        break;
      case 'undo':
        if (hint) hint.textContent = `Undo (${ev.count}).`;
        break;
      case 'ai_options':
        // optional: anzeigen
        break;
    }
  });

  // Platzierung des Boards per erstem Select
  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    // Erstes User-Event -> Audio freischalten
    ensureAudio();

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

    // Ausrichtung zum Nutzer (Yaw)
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
    boardRoot.quaternion.copy(yawOnly);

    // Schattenumschaltung anwenden
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

  // initiale Optionen in UI spiegeln
  const ai = getAiOptions();
  if (elMode)  elMode.value  = ai.mode;
  if (elDepth) elDepth.value = String(ai.depth);
  if (elTime)  elTime.value  = String(ai.timeMs);
  if (elSfx)   elSfx.checked = SFX;
  if (elHap)   elHap.checked = HAP;
  if (elShad)  elShad.checked= SHADOWS;
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
