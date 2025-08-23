// [C4-STEP-2] Vier Gewinnt Brett mit 7x6 Raster und Spalten-Collider

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const COLS = 7;
const ROWS = 6;

export function createBoard() {
  const group = new THREE.Group();

  // Basisplatte
  const baseGeom = new THREE.BoxGeometry(0.7, 0.02, 0.35);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = 0.01;
  group.add(base);

  // Rückwand (Brett mit Löchern)
  const wallGeom = new THREE.BoxGeometry(0.7, 0.45, 0.02);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
  const wall = new THREE.Mesh(wallGeom, wallMat);
  wall.position.set(0, 0.24, -0.15);
  group.add(wall);

  // Raster-Löcher (nur optisch)
  const holeRadius = 0.04;
  const xSpacing = 0.1;  // ~70cm / 7 Spalten
  const ySpacing = 0.07; // ~42cm / 6 Reihen

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(holeRadius, 32),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      hole.position.set(
        (c - (COLS - 1) / 2) * xSpacing,
        0.07 + r * ySpacing,
        -0.14 // leicht vor der Wand
      );
      hole.rotation.y = Math.PI; // nach vorne zeigen
      group.add(hole);
    }
  }

  // Collider für jede Spalte (unsichtbare Boxen)
  const colliders = [];
  for (let c = 0; c < COLS; c++) {
    const colGeom = new THREE.BoxGeometry(0.1, 0.45, 0.35);
    const colMat = new THREE.MeshBasicMaterial({ visible: false });
    const col = new THREE.Mesh(colGeom, colMat);
    col.position.set((c - (COLS - 1) / 2) * xSpacing, 0.24, 0);
    col.userData = { colIndex: c };
    group.add(col);
    colliders.push(col);
  }

  // Highlight-Marker (grüne Linie)
  const highlightGeom = new THREE.BoxGeometry(0.12, 0.02, 0.37);
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
  const highlight = new THREE.Mesh(highlightGeom, highlightMat);
  highlight.position.set(0, 0.46, 0);
  highlight.visible = false;
  group.add(highlight);

  group.userData = {
    colliders,
    highlight,
    cols: COLS,
    rows: ROWS
  };

  group.name = 'C4_Board';
  return group;
}

export function setHighlight(board, colIndex) {
  if (!board) return;
  const { highlight } = board.userData;
  if (colIndex === null || colIndex < 0) {
    highlight.visible = false;
    return;
  }
  highlight.visible = true;
  const xSpacing = 0.1;
  highlight.position.x = (colIndex - (board.userData.cols - 1) / 2) * xSpacing;
}
