// [C4-STEP-4] Game State + Turn-Handling + Win/Draw-Check + Drop-Animation

import { setHighlight, cellLocalCenter, createDiscMesh, spawnYLocal } from './board.js';

let boardObj = null;           // THREE.Group (Board)
let boardState = null;         // 2D-Array [row][col] 0=leer,1=Gelb,2=Rot
let cols = 7, rows = 6;

let currentPlayer = 1;         // 1 = Gelb (Spieler), 2 = Rot (zweiter Spieler/AI)
let movesCount = 0;
let gameOver = false;
let busy = false;              // true während Drop-Animation

const activeDrops = [];        // laufende Drops
const listeners = [];          // Game-Events

export function initGame(board) {
  boardObj = board;
  cols = board.userData.cols;
  rows = board.userData.rows;
  boardState = Array.from({ length: rows }, () => Array(cols).fill(0));
  currentPlayer = 1;
  movesCount = 0;
  gameOver = false;
  busy = false;
  activeDrops.length = 0;
  emit({ type: 'turn', player: currentPlayer });
}

export function onGameEvent(fn) {
  if (typeof fn === 'function') listeners.push(fn);
}

function emit(evt) {
  for (const fn of listeners) {
    try { fn(evt); } catch {}
  }
}

export function getBoardObject() { return boardObj; }
export function getBoardState()  { return boardState; }
export function getCurrentPlayer(){ return currentPlayer; }
export function isGameOver()     { return gameOver; }

// Highlight steuern (bei GameOver ausblenden)
export function highlightColumn(colIndex) {
  if (!boardObj) return;
  if (gameOver) { setHighlight(boardObj, null); return; }
  setHighlight(boardObj, colIndex);
}

// Nächste freie Zeile in Spalte (0 = unterste Reihe)
export function nextFreeRow(col) {
  for (let r = 0; r < rows; r++) if (boardState[r][col] === 0) return r;
  return -1;
}

// Versuch, im aktuellen Zug einen Stein in Spalte zu setzen
// Rückgabe: true bei Start der Drop-Animation, sonst false
export function placeDiscHuman(col) {
  if (!boardObj || gameOver || busy) return false;
  if (col < 0 || col >= cols) return false;

  const row = nextFreeRow(col);
  if (row < 0) {
    emit({ type: 'invalid', reason: 'column_full', col });
    return false;
  }

  // Zustand sofort reservieren
  boardState[row][col] = currentPlayer;
  movesCount++;

  // Mesh erzeugen & animieren
  const disc = createDiscMesh(currentPlayer);
  boardObj.add(disc);

  const target = cellLocalCenter(boardObj, col, row);
  const startY = spawnYLocal(boardObj);

  disc.position.set(target.x, startY, target.z);
  queueDrop({ mesh: disc, targetY: target.y, row, col, player: currentPlayer });

  busy = true; // bis Drop fertig ist, keine weiteren Züge
  return true;
}

// Drop-Queue + Animation
function queueDrop(drop) {
  activeDrops.push({
    ...drop,
    vy: 0.0
  });
}

export function update(dt) {
  if (activeDrops.length === 0) return;

  const g = -3.0;     // "Mond"-Gravitation
  const maxVy = -2.2;

  for (let i = activeDrops.length - 1; i >= 0; i--) {
    const d = activeDrops[i];
    d.vy = Math.max(d.vy + g * dt, maxVy);
    d.mesh.position.y += d.vy * dt;

    if (d.mesh.position.y <= d.targetY) {
      d.mesh.position.y = d.targetY;

      // Drop fertig
      activeDrops.splice(i, 1);

      // Nachlauf: Sieg/Remis prüfen & ggf. Turn wechseln
      postMoveResolve(d.row, d.col, d.player);
    }
  }
}

// Nach einem gesetzten Stein: Sieg/Remis/Turn
function postMoveResolve(row, col, player) {
  if (checkWinAt(row, col, player)) {
    gameOver = true;
    busy = false;
    emit({ type: 'win', player, row, col });
    return;
  }

  if (movesCount >= rows * cols) {
    gameOver = true;
    busy = false;
    emit({ type: 'draw' });
    return;
  }

  // Nächster Spieler
  currentPlayer = (player === 1) ? 2 : 1;
  busy = false;
  emit({ type: 'turn', player: currentPlayer });
}

// --------------- Gewinnprüfung -----------------------------------------------
// Prüft Linien durch (row,col) in 4 Richtungen: H, V, Diag /, Diag \
function checkWinAt(row, col, player) {
  // Horizontal (0,1)
  if (countLine(row, col, 0, 1, player) >= 4) return true;
  // Vertikal (1,0)
  if (countLine(row, col, 1, 0, player) >= 4) return true;
  // Diagonal (1,1)   ↘︎ / ↖︎
  if (countLine(row, col, 1, 1, player) >= 4) return true;
  // Diagonal (1,-1)  ↙︎ / ↗︎
  if (countLine(row, col, 1, -1, player) >= 4) return true;

  return false;
}

// Zählt zusammenhängende Steine in beiden Richtungen (dr,dc) und (-dr,-dc)
function countLine(row, col, dr, dc, player) {
  let total = 1;

  // vorwärts
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && boardState[r][c] === player) {
    total++; r += dr; c += dc;
  }

  // rückwärts
  r = row - dr; c = col - dc;
  while (inBounds(r, c) && boardState[r][c] === player) {
    total++; r -= dr; c -= dc;
  }

  return total;
}

function inBounds(r, c) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}
