// [C4-STEP-4] AR Bootstrap + Board-Platzierung + Input/Animation + HUD-Events

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoard } from './board.js';
import { initGame, update as updateGame, onGameEvent } from './game.js';
import { setupInput, updateInput } from './input.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;
let lastTs = 0;

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Szene & Kamera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Licht
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));

  // AR & Input
  setupAR(renderer, scene);
  setupInput(renderer, camera);

  // AR-Button
  document.body.appendChild(ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: []
  }));

  // Game-Events -> HUD-Text
  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    if (!hint) return;

    switch (ev.type) {
      case 'turn':
        hint.textContent = ev.player === 1 ? 'Gelb ist dran (Du) – wähle eine Spalte.' : 'Rot ist dran – wähle eine Spalte.';
        break;
      case 'win':
        hint.textContent = ev.player === 1 ? 'Gelb gewinnt! 🎉' : 'Rot gewinnt! 🎉';
        break;
      case 'draw':
        hint.textContent = 'Unentschieden – keine freien Felder mehr.';
        break;
      case 'invalid':
        hint.textContent = 'Spalte ist voll – wähle eine andere.';
        break;
    }
  });

  // Platzierung des Boards per erstem Select
  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

    // Ausrichtung zum Nutzer (Yaw)
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
    boardRoot.quaternion.copy(yawOnly);

    scene.add(boardRoot);
    initGame(boardRoot);

    ret.visible = false;
    boardPlaced = true;

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert. Gelb beginnt – visiere eine Spalte an und drücke Select.';
  });

  window.addEventListener('resize', onWindowResize);
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
    updateInput(frame);   // Raycast -> Highlight / Select
    updateGame(dt);       // Drop-Animation + Win/Draw
  }

  renderer.render(scene, camera);
}
