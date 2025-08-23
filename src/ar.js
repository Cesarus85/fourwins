// [C4-STEP-6 DOM FIX] Erstes Select ignoriert 'screen' & UI-Lock

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { ui } from './overlay.js';

let xrRefSpace = null;
let hitTestSource = null;
let viewerSpace = null;

let reticle = null;
let firstSelectBound = false;

const _axisX = new THREE.Vector3(1, 0, 0);
const _qFlat = new THREE.Quaternion().setFromAxisAngle(_axisX, -Math.PI / 2);

export function setupAR(renderer, scene) {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.085, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
  );
  reticle.matrixAutoUpdate = true;
  reticle.visible = false;
  scene.add(reticle);

  renderer.xr.addEventListener('sessionstart', async () => {
    const session = renderer.xr.getSession();
    xrRefSpace = await session.requestReferenceSpace('local');
    viewerSpace = await session.requestReferenceSpace('viewer');
    if (session.requestHitTestSource) {
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    }
    firstSelectBound = false;
  });

  renderer.xr.addEventListener('sessionend', () => {
    xrRefSpace = null; hitTestSource = null; viewerSpace = null;
    if (reticle) reticle.visible = false;
    firstSelectBound = false;
  });
}

export function updateHitTest(renderer, frame) {
  if (!frame || !hitTestSource || !xrRefSpace || !reticle) return;
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length > 0) {
    const pose = results[0].getPose(xrRefSpace);
    if (pose) {
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
      reticle.quaternion.multiply(_qFlat);
    }
  } else {
    reticle.visible = false;
  }
}

export function getReticle(){ return reticle; }

export function onFirstSelect(renderer, cb) {
  if (firstSelectBound) return;
  firstSelectBound = true;

  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();

    const once = (ev) => {
      // DOM-Interaktion / 'screen' Eingaben ignorieren
      if (ui.isLocked()) return;
      const src = ev?.inputSource;
      if (src && src.targetRayMode === 'screen') return;

      try { cb?.(); } finally { session.removeEventListener('select', once); }
    };

    session.addEventListener('select', once);
  });
}
