// [C4-STEP-5] HUD-Texts aktualisiert (KI-Hinweise), Rest wie zuvor

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
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));

  setupAR(renderer, scene);
  setupInput(renderer, camera);

  document.body.appendChild(ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: []
  }));

  onGameEvent((ev) => {
    const hint = document.getElementById('hint');
    if (!hint) return;

    switch (ev.type) {
      case 'turn':
        hint.textContent = ev.player === 1
          ? 'Gelb ist dran (Du) – visiere eine Spalte und drücke Select.'
          : 'Rot (KI) ist dran.';
        break;
      case 'ai_turn':
        hint.textContent = 'Rot (KI) denkt …';
        break;
      case 'win':
        hint.textContent = ev.player === 1 ? 'Gelb gewinnt! 🎉' : 'Rot (KI) gewinnt! 🤖🏆';
        break;
      case 'draw':
        hint.textContent = 'Unentschieden – keine freien Felder.';
        break;
      case 'invalid':
        hint.textContent = ev.reason === 'column_full'
          ? 'Spalte ist voll – wähle eine andere.'
          : 'Bitte warte – du bist nicht dran.';
        break;
    }
  });

  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));
    boardRoot.quaternion.copy(yawOnly);

    scene.add(boardRoot);
    initGame(boardRoot);

    ret.visible = false;
    boardPlaced = true;

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert. Gelb beginnt – visiere eine Spalte und drücke Select.';
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
    updateInput(frame);
    updateGame(dt);
  }

  renderer.render(scene, camera);
}
