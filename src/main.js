// [C4-STEP-1] AR Bootstrap + Reticle + Board-Placement

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

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 20);

  // Licht (soft, AR passt die Beleuchtung an die reale Szene an)
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(light);

  // Reticle / Hit-Test vorbereiten
  setupAR(renderer, scene);

  // AR-Button
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'], // Kern für Platzierung
    optionalFeatures: []            // hand-tracking/dom-overlay später
  });
  document.body.appendChild(button);

  // Select-Handler: Erstes Select platziert das Brett an der Reticle-Position
  onFirstSelect(renderer, () => {
    if (boardPlaced) return;
    const reticle = getReticle();
    if (!reticle || !reticle.visible) return;

    // Brett (Platzhalter) erzeugen und an Reticle-Pos/Rot ablegen
    boardRoot = createBoardPlaceholder();
    boardRoot.position.setFromMatrixPosition(reticle.matrix);
    boardRoot.quaternion.setFromRotationMatrix(reticle.matrix);
    scene.add(boardRoot);

    boardPlaced = true;
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = 'Brett platziert. Nächster Schritt: Raster & Eingaben (Schritt 2).';
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

function render(timestamp, frame) {
  // Reticle & Hit-Test updaten, solange kein Brett liegt
  if (!boardPlaced) {
    updateHitTest(renderer, frame);
  }
  renderer.render(scene, camera);
}
