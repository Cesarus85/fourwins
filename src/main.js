// [C4-STEP-2] AR Bootstrap + Brett mit 7x6 Raster + Highlight

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoard } from './board.js';
import { initGame } from './game.js';

let renderer, scene, camera;
let boardPlaced = false;
let boardRoot = null;

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);

  // AR
  setupAR(renderer, scene);

  // AR-Button
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: []
  });
  document.body.appendChild(button);

  // Brett bei erstem Select platzieren
  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const ret = getReticle();
    if (!ret || !ret.visible) return;

    boardRoot = createBoard();
    boardRoot.position.copy(ret.position);
    boardRoot.position.y += 0.005;

    // Kamera-Yaw übernehmen, damit das Brett zu dir zeigt
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, euler.y, 0, 'YXZ')
    );
    boardRoot.quaternion.copy(yawOnly);

    scene.add(boardRoot);

    initGame(boardRoot);

    ret.visible = false;
    boardPlaced = true;

    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert! Raster sichtbar. Nächster Schritt: Eingaben & Steine.';
  });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(_timestamp, frame) {
  if (!boardPlaced) {
    updateHitTest(renderer, frame);
  }
  renderer.render(scene, camera);
}
