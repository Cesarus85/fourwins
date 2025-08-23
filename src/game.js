// [C4-STEP-3] Game State + Highlight + Drop-Animation (Player 1)

import { setHighlight, cellLocalCenter, createDiscMesh, spawnYLocal } from './board.js';

let boardObj = null;           // THREE.Group (Board)
let boardState = null;         // 2D-Array [row][col] 0=leer,1=Spieler,2=KI
let activeDrops = [];          // laufende Drop-Animationen
let cols = 7, rows = 6;

export function initGame(board) {
  boardObj = board;
  cols = board.userData.cols;
  rows = board.userData.rows;
  boardState = Array.from({ length: rows }, () => Array(cols).fill(0));
  activeDrops.length = 0;
}

export function getBoardObject() { return boardObj; }
export function getBoardState()  { return boardState; }

// Highlight
export function highlightColumn(colIndex) {
  if (!boardObj) return;
  setHighlight(boardObj, colIndex);
}

// Nächste freie Zeile in einer Spalte (0 = unten)
export function nextFreeRow(col) {
  for (let r = 0; r < rows; r++) {
    if (boardState[r][col] === 0) return r;
  }
  return -1; // voll
}

// Spielerzug (nur Spieler 1 in Step 3)
export function placeDiscHuman(col) {
  if (!boardObj) return false;
  const row = nextFreeRow(col);
  if (row < 0) return false; // Spalte voll

  // Zustand sofort reservieren, damit kein doppelt-Setzen passiert
  boardState[row][col] = 1;

  // Mesh erzeugen & animiert fallen lassen
  const disc = createDiscMesh(1);
  boardObj.add(disc);

  const target = cellLocalCenter(boardObj, col, row);
  const startY = spawnYLocal(boardObj);
  disc.position.set(target.x, startY, target.z);

  queueDrop(disc, target.y, () => {
    // (Hier später Siegprüfung & KI-Zug)
    // console.log('Disc gelandet:', {row, col});
  });

  return true;
}

// Drop-Animation
function queueDrop(mesh, targetY, onDone) {
  // einfacher "Arcade-Fall": v anfangs 0, g = -3 m/s², max speed clamp
  activeDrops.push({
    mesh,
    vy: 0.0,
    targetY,
    onDone,
  });
}

export function update(dt) {
  if (activeDrops.length === 0) return;

  const g = -3.0;          // m/s² (niedrige "Mond"-Gravitation)
  const maxVy = -2.2;      // max Fallgeschwindigkeit

  for (let i = activeDrops.length - 1; i >= 0; i--) {
    const d = activeDrops[i];
    d.vy = Math.max(d.vy + g * dt, maxVy);
    d.mesh.position.y += d.vy * dt;

    if (d.mesh.position.y <= d.targetY) {
      d.mesh.position.y = d.targetY;
      // kleiner "Thump" (optional minimaler Bounce auskommentiert):
      // d.mesh.position.y = d.targetY + 0.002;

      // Animation beenden
      if (d.onDone) d.onDone();
      activeDrops.splice(i, 1);
    }
  }
}
