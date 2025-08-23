// [C4-STEP-1] WebXR Hit-Test + Reticle (flach auf Boden) + einmaliges Select

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

let xrRefSpace = null;
let hitTestSource = null;
let viewerSpace = null;

let reticle = null;
let firstSelectBound = false;

// Hilfs-Quaternion für "flach legen" (XZ-Ebene)
const _axisX = new THREE.Vector3(1, 0, 0);
const _qFlat = new THREE.Quaternion().setFromAxisAngle(_axisX, -Math.PI / 2);

export function setupAR(renderer, scene) {
  // Reticle: grüner Ring, der flach auf erkannten Flächen liegt
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.08, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
  );
  // WICHTIG: Matrix automatisch aus Position/Rotation/Scale aktualisieren lassen
  reticle.matrixAutoUpdate = true;
  reticle.visible = false;
  scene.add(reticle);

  renderer.xr.addEventListener('sessionstart', async () => {
    const session = renderer.xr.getSession();
    xrRefSpace = await session.requestReferenceSpace('local');
    viewerSpace = await session.requestReferenceSpace('viewer');

    // Hit-Test-Quelle anfordern
    if (session.requestHitTestSource) {
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    }

    // Falls eine neue Session gestartet wird, darf onFirstSelect erneut binden
    firstSelectBound = false;
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

  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const hit = results[0];
    const pose = hit.getPose(xrRefSpace);
    if (pose) {
      reticle.visible = true;

      // Pose-Matrix dekomponieren in pos/quat/scale
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);

      // Reticle flach auf die Fläche drehen
      reticle.quaternion.multiply(_qFlat);
    }
  } else {
    reticle.visible = false;
  }
}

export function getReticle() {
  return reticle;
}

// Führt cb genau einmal (erstes Select in der Session) aus
export function onFirstSelect(renderer, cb) {
  if (firstSelectBound) return;
  firstSelectBound = true;

  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    const once = () => {
      try { cb?.(); } finally {
        session.removeEventListener('select', once);
      }
    };
    session.addEventListener('select', once);
  });
}
