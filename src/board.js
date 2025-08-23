// [C4-STEP-2] Brett mit 7x6 "Löchern", Spalten-Collider und Highlight

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export const COLS = 7;
export const ROWS = 6;

export function createBoard() {
  const g = new THREE.Group();

  // Basisplatte (70 x 35 cm)
  const baseGeom = new THREE.BoxGeometry(0.70, 0.02, 0.35);
  const baseMat  = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.1, roughness: 0.85 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = 0.01;
  g.add(base);

  // Rückwand (Brett)
  const wallGeom = new THREE.BoxGeometry(0.70, 0.45, 0.02);
  const wallMat  = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.05, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeom, wallMat);
  wall.position.set(0, 0.245, -0.15);
  g.add(wall);

  // Sichtbare "Löcher" als Kreise dicht vor der Wand (keine CSG, nur Look)
  const holeR = 0.04;
  const xStep = 0.70 / (COLS + 0.5); // etwas Rand links/rechts
  const yStep = 0.45 / (ROWS + 1);   // etwas Rand oben/unten
  const holeMat = new THREE.MeshBasicMaterial({
    color: 0x0b1020,
    side: THREE.DoubleSide,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const cx = (c - (COLS - 1) / 2) * xStep;
      const cy = 0.07 + r * yStep;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(holeR, 32), holeMat);
      hole.position.set(cx, cy, -0.139);     // knapp vor der Wand (vermeidet Z-Fighting)
      hole.rotation.y = Math.PI;             // nach vorne
      g.add(hole);
    }
  }

  // Spalten-Collider (unsichtbar)
  const colliders = [];
  for (let c = 0; c < COLS; c++) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(xStep, 0.46, 0.36),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    col.position.set((c - (COLS - 1) / 2) * xStep, 0.245, -0.02);
    col.userData = { colIndex: c, type: 'c4_col' };
    g.add(col);
    colliders.push(col);
  }

  // Deutlich sichtbares Highlight (grüne Schiene) über dem Brett
  const hlGeom = new THREE.BoxGeometry(xStep * 1.1, 0.02, 0.38);
  const hlMat  = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
  const highlight = new THREE.Mesh(hlGeom, hlMat);
  highlight.position.set(0, 0.50, -0.02);
  highlight.visible = false;
  g.add(highlight);

  // dünner Rand der Basis (optisch)
  const edges = new THREE.EdgesGeometry(baseGeom);
  const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6b7280 }));
  edgeLine.position.copy(base.position);
  g.add(edgeLine);

  g.userData = { colliders, highlight, cols: COLS, rows: ROWS, xStep, yStep };
  g.name = 'C4_Board';
  return g;
}

export function setHighlight(board, colIndex) {
  if (!board) return;
  const { highlight, cols, xStep } = board.userData;
  if (colIndex == null || colIndex < 0 || colIndex >= cols) {
    highlight.visible = false;
    return;
  }
  highlight.visible = true;
  highlight.position.x = (colIndex - (cols - 1) / 2) * xStep;
}
