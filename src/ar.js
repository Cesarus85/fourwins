// [C4-STEP-7 RETICLE-ROBUST] WebXR Hit-Test + Fallback (local-floor) + Farbcodierung
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

let xrRefSpace = null;
let xrRefSpaceType = 'local';
let hitTestSource = null;
let viewerSpace = null;

let reticle = null;
let firstSelectBound = false;

const _axisX = new THREE.Vector3(1, 0, 0);
const _qFlat = new THREE.Quaternion().setFromAxisAngle(_axisX, -Math.PI / 2);

const _origin = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();
const _camScale = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, -1);

export function setupAR(renderer, scene) {
  // Reticle (sichtbar über allem)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.085, 48),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 })
  );
  reticle.matrixAutoUpdate = true;
  reticle.visible = false;
  reticle.userData.mode = 'hit'; // 'hit' (grün) | 'gaze' (Fallback/orange)
  scene.add(reticle);

  renderer.xr.addEventListener('sessionstart', async () => {
    const session = renderer.xr.getSession();

    // Referenzraum bevorzugt 'local-floor', Fallback auf 'local'
    try {
      xrRefSpace = await session.requestReferenceSpace('local-floor');
      xrRefSpaceType = 'local-floor';
    } catch {
      xrRefSpace = await session.requestReferenceSpace('local');
      xrRefSpaceType = 'local';
    }

    viewerSpace = await session.requestReferenceSpace('viewer').catch(() => null);

    // HitTest-Quelle
    hitTestSource = null;
    if (session.requestHitTestSource && viewerSpace) {
      try {
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      } catch {
        hitTestSource = null;
      }
    }
    firstSelectBound = false;
  });

  renderer.xr.addEventListener('sessionend', () => {
    xrRefSpace = null; viewerSpace = null; hitTestSource = null;
    xrRefSpaceType = 'local';
    if (reticle) reticle.visible = false;
    firstSelectBound = false;
  });
}

export function updateHitTest(renderer, frame) {
  if (!frame || !reticle) return;

  let hadHit = false;

  // 1) Regulärer Hit-Test
  if (hitTestSource && xrRefSpace) {
    const results = frame.getHitTestResults(hitTestSource);
    if (results && results.length > 0) {
      const pose = results[0].getPose(xrRefSpace);
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
        reticle.quaternion.multiply(_qFlat); // flach auflegen
        reticle.userData.mode = 'hit';
        hadHit = true;
      }
    }
  }

  // 2) Fallback: 1.2 m vor der Kamera, auf Bodenhöhe (bei local-floor), sonst einfach vor dir
  if (!hadHit && xrRefSpace) {
    const pose = frame.getViewerPose(xrRefSpace);
    if (pose && pose.views && pose.views[0]) {
      const view = pose.views[0];
      const m = new THREE.Matrix4().fromArray(view.transform.matrix);
      m.decompose(_camPos, _camQuat, _camScale);

      _forward.set(0, 0, -1).applyQuaternion(_camQuat).normalize();
      const pos = reticle.position;
      pos.copy(_camPos).addScaledVector(_forward, 1.2);
      if (xrRefSpaceType === 'local-floor') pos.y = 0.0; // auf Boden schnappen
      reticle.quaternion.copy(_qFlat);

      reticle.visible = true;
      reticle.userData.mode = 'gaze';
      hadHit = true;
    }
  }

  // 3) Anzeige aktualisieren (Farbe je Modus)
  if (hadHit) {
    const isHit = reticle.userData.mode === 'hit';
    reticle.material.color.setHex(isHit ? 0x00ff88 : 0xffaa00);
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
      // 'screen' Eingaben vermeiden (DOM Overlay) – echtes XR-Select bevorzugen
      const src = ev?.inputSource;
      if (src && src.targetRayMode === 'screen') return;

      try { cb?.(); } finally { session.removeEventListener('select', once); }
    };
    session.addEventListener('select', once);
  });
}

