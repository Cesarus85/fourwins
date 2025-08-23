// [C4-STEP-1] WebXR Hit-Test + Reticle + Select-Once

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

let xrRefSpace = null;
let hitTestSource = null;
let viewerSpace = null;

let reticle = null;
let firstSelectBound = false;

export function setupAR(renderer, scene) {
  // Reticle: Ring, der auf gefundener Fläche liegt
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.08, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
  );
  reticle.rotation.x = -Math.PI / 2; // flach auf Boden
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  renderer.xr.addEventListener('sessionstart', async () => {
    const session = renderer.xr.getSession();
    xrRefSpace = await session.requestReferenceSpace('local');
    viewerSpace = await session.requestReferenceSpace('viewer');

    // Hit-Test-Source anfordern
    if (session.requestHitTestSource) {
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    } else if (session.requestHitTestSourceForTransientInput) {
      // (Fallback für Transient-Input – in diesem Step nicht genutzt)
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    xrRefSpace = null;
    hitTestSource = null;
    viewerSpace = null;
    if (reticle) reticle.visible = false;
    firstSelectBound = false;
  });
}

export function updateHitTest(renderer, frame) {
  if (!frame || !hitTestSource || !xrRefSpace || !reticle) return;

  const hitTestResults = frame.getHitTestResults(hitTestSource);
  if (hitTestResults.length > 0) {
    const hit = hitTestResults[0];
    const pose = hit.getPose(xrRefSpace);
    if (pose) {
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    }
  } else {
    reticle.visible = false;
  }
}

export function getReticle() {
  return reticle;
}

export function onFirstSelect(renderer, cb) {
  if (firstSelectBound) return;
  firstSelectBound = true;

  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    const once = (ev) => {
      cb?.();
      // Diesen Listener nur für das erste Select (Brett platzieren)
      session.removeEventListener('select', once);
    };
    session.addEventListener('select', once);
  });
}
