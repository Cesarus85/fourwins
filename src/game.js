// [C4-STEP-6] Game State + KI (aus 5b) + Reset/Undo + Events für SFX/Haptik

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
const history = [];      // Stack von Zügen: {row,col,player,mesh}

const aiOptions = { mode: 'minimax', depth: 5, timeMs: 350 };
const aiEnabled = true;
let aiTimer = 0;
const aiDelayS = 0.35;
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
  history.length = 0;
  emit({ type: 'turn', player: currentPlayer });
}

export function onGameEvent(fn) { if (typeof fn === 'function') listeners.push(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch {} } }

export function getBoardObject()  { return boardObj; }
export function getBoardState()   { return boardState; }
export function getCurrentPlayer(){ return currentPlayer; }
export function isGameOver()      { return gameOver; }
export function getAiOptions()    { return { ...aiOptions }; }
export function setAiOptions(o) {
  if (!o) return;
  if (o.mode)   aiOptions.mode = o.mode;
  if (o.depth!=null)  aiOptions.depth = Math.max(1, o.depth|0);
  if (o.timeMs!=null) aiOptions.timeMs = Math.max(50, o.timeMs|0);
  emit({ type:'ai_options', options: getAiOptions() });
}

// Highlight: während KI-Zug ausblenden
export function highlightColumn(colIndex) {
  if (!boardObj) return;
  if (gameOver || currentPlayer === 2) { setHighlight(boardObj, null); return; }
  setHighlight(boardObj, colIndex);
}

export function nextFreeRow(col) {
  for (let r = 0; r < rows; r++) if (boardState[r][col] === 0) return r;
  return -1;
}

export function placeDiscHuman(col) {
  if (!boardObj || gameOver || busy || currentPlayer !== 1) {
    if (currentPlayer !== 1) emit({ type: 'invalid', reason: 'not_your_turn' });
    return false;
  }
  return placeDisc(col, 1);
}

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

  // Historie (für Undo)
  history.push({ row, col, player, mesh: disc });

  emit({ type: 'place', player, row, col });
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
        emit({ type:'landed', player:d.player, row:d.row, col:d.col });
        postMoveResolve(d.row, d.col, d.player);
      }
    }
  }

  // KI-Zug einplanen
  if (!gameOver && !busy && aiEnabled && currentPlayer === 2) {
    if (!aiPending) {
      aiPending = true; aiTimer = aiDelayS; emit({ type: 'ai_turn' });
    } else {
      aiTimer -= dt;
      if (aiTimer <= 0) {
        const col = chooseAiMove(boardState, aiOptions);
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

// ===== Reset & Undo ===========================================================
export function resetGame() {
  // aktive Animationen abbrechen
  activeDrops.length = 0; busy = false; aiPending = false; aiTimer = 0; gameOver = false;

  // alle Discs aus Szene entfernen
  for (const mv of history) {
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
  }
  history.length = 0;

  // BoardState leeren
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) boardState[r][c] = 0;
  movesCount = 0; currentPlayer = 1;
  emit({ type:'reset' });
  emit({ type:'turn', player: currentPlayer });
}

export function undo(count = 1) {
  if (busy) return false;
  let undone = 0;
  while (count-- > 0 && history.length > 0) {
    const mv = history.pop();
    // falls letzte Animation gerade geplant wäre → sicherstellen, dass sauber zurückgesetzt ist
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
    if (boardState[mv.row][mv.col] !== 0) {
      boardState[mv.row][mv.col] = 0;
      movesCount = Math.max(0, movesCount - 1);
      currentPlayer = mv.player; // nach Undo ist wieder der Spieler dran, der diesen Zug gemacht hatte
      undone++;
    }
  }
  if (undone > 0) {
    gameOver = false; aiPending = false; aiTimer = 0;
    emit({ type:'undo', count:undone });
    emit({ type:'turn', player: currentPlayer });
    return true;
  }
  return false;
}
