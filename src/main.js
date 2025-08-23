// [C4-STEP-6 DOM FIX] DOM Overlay + Custom Dropdowns + UI-Lock

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

import { initDropdown, setDropdownValue, getDropdownValue } from './ui.js';
import { bindUiLock } from './overlay.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;

let lastTs = 0;
let SFX = true, HAP = true, SHADOWS = false;

init();
animate();

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

  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    const session = renderer.xr.getSession?.();

    switch (ev.type) {
      case 'turn':
        if (hint) hint.textContent = ev.player === 1
          ? 'Gelb ist dran (Du) – visiere eine Spalte & drücke Select.'
          : 'Rot (KI) ist dran.';
        if (ev.player === 2 && SFX) sfxTurnAI();
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
        if (SFX) sfxWin(); if (HAP) buzzWin(session); break;
      case 'draw':
        if (hint) hint.textContent = 'Unentschieden – keine freien Felder.';
        if (SFX) sfxDraw(); break;
      case 'invalid':
        if (hint) hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        if (SFX) sfxInvalid(); if (HAP) buzzInvalid(session); break;
      case 'reset':
        if (hint) hint.textContent = 'Neues Spiel. Gelb beginnt.'; break;
      case 'undo':
        if (hint) hint.textContent = `Undo (${ev.count}).`; break;
    }
  });

  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    ensureAudio();

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

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

  const elMode  = document.getElementById('ddMode');
  const elDepth = document.getElementById('ddDepth');
  const elTime  = document.getElementById('ddTime');

  const elSfx   = document.getElementById('chkSfx');
  const elHap   = document.getElementById('chkHap');
  const elShad  = document.getElementById('chkShadows');

  elReset?.addEventListener('click', () => resetGame());
  elUndo1?.addEventListener('click', () => undo(1));
  elUndo2?.addEventListener('click', () => undo(2));

  // Dropdown-Init + Änderungen weiterreichen
  initDropdown(elMode, {
    onChange: (val) => setAiOptions({ mode: val })
  });
  initDropdown(elDepth, {
    onChange: (val) => setAiOptions({ depth: parseInt(val, 10) })
  });
  initDropdown(elTime, {
    onChange: (val) => setAiOptions({ timeMs: parseInt(val, 10) })
  });

  // Aktuelle AI-Optionen ins UI spiegeln
  const ai = getAiOptions();
  setDropdownValue(elMode,  ai.mode);
  setDropdownValue(elDepth, String(ai.depth));
  setDropdownValue(elTime,  String(ai.timeMs));

  elSfx?.addEventListener('change', () => {
    const on = elSfx.checked; setSfxEnabled(on);
  });
  elHap?.addEventListener('change', () => {
    const on = elHap.checked; setHapticsEnabled(on);
  });
  elShad?.addEventListener('change', () => {
    SHADOWS = elShad.checked;
    if (renderer) renderer.shadowMap.enabled = SHADOWS;
  });
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
    updateHitTest(renderer, frame);
  } else {
    updateInput(frame);
    updateGame(dt);
  }

  renderer.render(scene, camera);
}
