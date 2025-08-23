// [C4-STEP-5] Game State + KI-Integration (Zugwechsel, Denken, Drop)

import { setHighlight, cellLocalCenter, createDiscMesh, spawnYLocal } from './board.js';
import { chooseAiMove } from './ai.js';

let boardObj = null;
let boardState = null;
let cols = 7, rows = 6;

let currentPlayer = 1;   // 1 = Gelb (Du), 2 = Rot (KI)
let movesCount = 0;
let gameOver = false;
let busy = false;

const activeDrops = [];
const listeners = [];

const aiEnabled = true;
let aiTimer = 0;         // „Denk“-Verzögerung
const aiDelayS = 0.35;   // kleine Pause für Natürlichkeit
let aiPending = false;

export function initGame(board) {
  boardObj = board;
  cols = board.userData.cols;
  rows = board.userData.rows;
  boardState = Array.from({ length: rows }, () => Array(cols).fill(0));
  currentPlayer = 1;
  movesCount = 0;
  gameOver = false;
  busy = false;
  aiTimer = 0;
  aiPending = false;
  activeDrops.length = 0;
  emit({ type: 'turn', player: currentPlayer });
}

export function onGameEvent(fn) { if (typeof fn === 'function') listeners.push(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch {} } }

export function getBoardObject() { return boardObj; }
export function getBoardState()  { return boardState; }
export function getCurrentPlayer(){ return currentPlayer; }
export function isGameOver()     { return gameOver; }

// Highlight: während KI-Zug ausblenden
export function highlightColumn(colIndex) {
  if (!boardObj) return;
  if (gameOver || currentPlayer === 2) { setHighlight(boardObj, null); return; }
  setHighlight(boardObj, colIndex);
}

// freie Zeile suchen
export function nextFreeRow(col) {
  for (let r = 0; r < rows; r++) if (boardState[r][col] === 0) return r;
  return -1;
}

// Spielersetzung (nur wenn Spieler 1 dran)
export function placeDiscHuman(col) {
  if (!boardObj || gameOver || busy || currentPlayer !== 1) {
    if (currentPlayer !== 1) emit({ type: 'invalid', reason: 'not_your_turn' });
    return false;
  }
  return placeDisc(col, 1);
}

// Interne Routine für beide Spieler
function placeDisc(col, player) {
  if (col < 0 || col >= cols) return false;
  const row = nextFreeRow(col);
  if (row < 0) { emit({ type: 'invalid', reason: 'column_full', col }); return false; }

  boardState[row][col] = player;
  movesCount++;

  const disc = createDiscMesh(player);
  boardObj.add(disc);

  const target = cellLocalCenter(boardObj, col, row);
  const startY = spawnYLocal(boardObj);
  disc.position.set(target.x, startY, target.z);

  queueDrop({ mesh: disc, targetY: target.y, row, col, player });
  busy = true;
  return true;
}

function queueDrop(drop) { activeDrops.push({ ...drop, vy: 0.0 }); }

export function update(dt) {
  // Animationen
  if (activeDrops.length > 0) {
    const g = -3.0, maxVy = -2.2;
    for (let i = activeDrops.length - 1; i >= 0; i--) {
      const d = activeDrops[i];
      d.vy = Math.max(d.vy + g * dt, maxVy);
      d.mesh.position.y += d.vy * dt;
      if (d.mesh.position.y <= d.targetY) {
        d.mesh.position.y = d.targetY;
        activeDrops.splice(i, 1);
        postMoveResolve(d.row, d.col, d.player);
      }
    }
  }

  // KI-Zug triggern, sobald dran & nicht beschäftigt
  if (!gameOver && !busy && aiEnabled && currentPlayer === 2) {
    if (!aiPending) {
      aiPending = true;
      aiTimer = aiDelayS;
      emit({ type: 'ai_turn' }); // HUD: „KI denkt…“
    } else {
      aiTimer -= dt;
      if (aiTimer <= 0) {
        const col = chooseAiMove(boardState);
        const chosen = (col >= 0) ? col : firstValidCol();
        placeDisc(chosen, 2);
        aiPending = false;
      }
    }
  }
}

function firstValidCol() {
  for (let c = 0; c < cols; c++) if (nextFreeRow(c) !== -1) return c;
  return -1;
}

// Nach einem gesetzten Stein: Sieg/Remis/Turn
function postMoveResolve(row, col, player) {
  if (checkWinAt(row, col, player)) {
    gameOver = true; busy = false;
    emit({ type: 'win', player, row, col });
    return;
  }
  if (movesCount >= rows * cols) {
    gameOver = true; busy = false;
    emit({ type: 'draw' });
    return;
  }

  currentPlayer = (player === 1) ? 2 : 1;
  busy = false;
  emit({ type: 'turn', player: currentPlayer });
}

// Gewinnprüfung (lokal auf boardState)
function checkWinAt(row, col, player) {
  if (countLine(row, col, 0, 1, player) >= 4) return true;
  if (countLine(row, col, 1, 0, player) >= 4) return true;
  if (countLine(row, col, 1, 1, player) >= 4) return true;
  if (countLine(row, col, 1, -1, player) >= 4) return true;
  return false;
}

function countLine(row, col, dr, dc, player) {
  let total = 1;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && boardState[r][c] === player) { total++; r += dr; c += dc; }
  r = row - dr; c = col - dc;
  while (inBounds(r, c) && boardState[r][c] === player) { total++; r -= dr; c -= dc; }
  return total;
}

function inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; }
