// [C4-STEP-6 DOM FIX] XR-Ray-Input + Hover/Highlight + Select -> placeDiscHuman
// Ignoriert 'screen'-Selects & UI-Lock (DOM-Interaktion)

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { getBoardObject } from './game.js';
import { highlightColumn, placeDiscHuman } from './game.js';
import { ui } from './overlay.js';

let renderer = null;
let camera = null;

const raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3(0, 0, -1);
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

let hoverCol = -1;

export function setupInput(_renderer, _camera) {
  renderer = _renderer;
  camera = _camera;

  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    const onSelect = (ev) => {
      // DOM-Overlay-Interaktion? → ignorieren
      if (ui.isLocked()) return;
      const src = ev?.inputSource;
      if (src && src.targetRayMode === 'screen') return;

      if (hoverCol >= 0) placeDiscHuman(hoverCol);
    };
    session.addEventListener('select', onSelect);

    hoverCol = -1;
  });

  renderer.xr.addEventListener('sessionend', () => {
    hoverCol = -1;
  });
}

export function updateInput(frame) {
  const session = renderer?.xr?.getSession?.();
  const board = getBoardObject();
  if (!session || !board) { setHover(-1); return; }

  const refSpace = renderer.xr.getReferenceSpace();
  const colliders = board.userData?.colliders || [];
  if (colliders.length === 0) { setHover(-1); return; }

  // DOM-Interaktion aktiv? -> kein Hover ändern
  if (ui.isLocked()) { setHover(-1); return; }

  // XR-Quelle
  let gotRay = false;
  for (const src of session.inputSources) {
    if (!src || !src.targetRaySpace) continue;
    if (src.targetRayMode !== 'tracked-pointer' && src.targetRayMode !== 'gaze') continue;

    const pose = frame.getPose(src.targetRaySpace, refSpace);
    if (!pose) continue;

    const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
    m.decompose(_origin, _q, _s);
    _dir.set(0, 0, -1).applyQuaternion(_q).normalize();

    raycaster.ray.origin.copy(_origin);
    raycaster.ray.direction.copy(_dir);
    gotRay = true;
    break;
  }

  // Fallback Kamera
  if (!gotRay && camera) {
    camera.getWorldPosition(_origin);
    camera.getWorldDirection(_dir);
    raycaster.ray.origin.copy(_origin);
    raycaster.ray.direction.copy(_dir);
  }

  const hits = raycaster.intersectObjects(colliders, false);
  if (hits.length > 0) {
    const col = hits[0].object.userData?.colIndex ?? -1;
    setHover(col);
  } else {
    setHover(-1);
  }
}

function setHover(col) {
  if (hoverCol === col) return;
  hoverCol = col;
  highlightColumn(col);
}
