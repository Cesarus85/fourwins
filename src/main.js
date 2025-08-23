// [C4-STEP-1] AR Bootstrap + Reticle (fix) + Brett-Platzierung

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.1/examples/jsm/webxr/ARButton.js';

import { setupAR, updateHitTest, getReticle, onFirstSelect } from './ar.js';
import { createBoardPlaceholder } from './board.js';

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

  // Szene & Kamera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);

  // AR vorbereiten (Reticle + Hit-Test)
  setupAR(renderer, scene);

  // AR-Button
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: []
  });
  document.body.appendChild(button);

  // Erstes Select platziert das Brett an der Reticle-Pose
  onFirstSelect(renderer, () => {
  if (boardPlaced) return;
  const ret = getReticle();
  if (!ret || !ret.visible) return;

  boardRoot = createBoardPlaceholder();
  boardRoot.position.copy(ret.position);

  // Brett-Ausrichtung erzwingen: Y-Achse hoch
  boardRoot.quaternion.set(0, 0, 0, 1);

  boardRoot.position.y += 0.005; // leicht angehoben
  scene.add(boardRoot);

  ret.visible = false;

  boardPlaced = true;
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = 'Brett platziert. Weiter mit Schritt 2: Raster & Eingaben.';
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
