// [C4-STEP-6+WIN-HIGHLIGHT] Game: Step 6 + Snapshot + Gewinn-Markierung (4er-Reihe)

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { setHighlight, cellLocalCenter, createDiscMesh, spawnYLocal } from './board.js';
import { chooseAiMove } from './ai.js';

let boardObj = null;
let boardState = null;     // [row][col] -> 0 leer, 1 Gelb, 2 Rot
let boardMeshes = null;    // [row][col] -> Disc-Mesh oder null
let cols = 7, rows = 6;

let currentPlayer = 1;     // 1 = Gelb (Du), 2 = Rot (KI)
let movesCount = 0;
let gameOver = false;
let busy = false;

const activeDrops = [];
const listeners = [];
const history = [];        // {row,col,player,mesh}

const aiOptions = { mode: 'minimax', depth: 5, timeMs: 350 };
let aiEnabled = true;
let aiTimer = 0;
const aiDelayS = 0.35;
let aiPending = false;

// Gewinn-Highlight
let winCells = null;
let highlighted = [];      // { mesh, matOld, scaleOld }
let winPulseT = 0;

export function initGame(board) {
  boardObj = board;
  cols = board.userData.cols;
  rows = board.userData.rows;
  boardState  = Array.from({ length: rows }, () => Array(cols).fill(0));
  boardMeshes = Array.from({ length: rows }, () => Array(cols).fill(null));
  currentPlayer = 1;
  movesCount = 0;
  gameOver = false;
  busy = false;
  aiTimer = 0;
  aiPending = false;
  activeDrops.length = 0;
  history.length = 0;
  clearWinHighlight();
  emit({ type: 'turn', player: currentPlayer });
}

export function onGameEvent(fn) { if (typeof fn === 'function') listeners.push(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch {} } }

export function getBoardObject()  { return boardObj; }
export function getBoardState()   { return boardState; }
export function getCurrentPlayer(){ return currentPlayer; }
export function isGameOver()      { return gameOver; }
export function getAiOptions()    { return { enabled: aiEnabled, ...aiOptions }; }
export function setAiOptions(o) {
  if (!o) return;
  if (o.mode)        aiOptions.mode = o.mode;
  if (o.depth != null)  aiOptions.depth = Math.max(1, o.depth|0);
  if (o.timeMs!= null)  aiOptions.timeMs = Math.max(50, o.timeMs|0);
  if (o.enabled != null) aiEnabled = !!o.enabled;
  emit({ type:'ai_options', options: getAiOptions() });
}

// Highlight: während KI-Zug ausblenden
export function highlightColumn(colIndex) {
  if (!boardObj) return;
  if (gameOver || (aiEnabled && currentPlayer === 2)) { setHighlight(boardObj, null); return; }
  setHighlight(boardObj, colIndex);
}

export function nextFreeRow(col) {
  for (let r = 0; r < rows; r++) if (boardState[r][col] === 0) return r;
  return -1;
}

export function placeDiscHuman(col) {
  if (!boardObj || gameOver || busy) return false;
  if (aiEnabled && currentPlayer !== 1) {
    emit({ type: 'invalid', reason: 'not_your_turn' });
    return false;
  }
  return placeDisc(col, currentPlayer);
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

  boardMeshes[row][col] = disc;
  history.push({ row, col, player, mesh: disc });

  emit({ type: 'place', player, row, col });
  queueDrop({ mesh: disc, targetY: target.y, row, col, player });
  busy = true;
  return true;
}

function queueDrop(drop) { activeDrops.push({ ...drop, vy: 0.0 }); }

export function update(dt) {
  // Animation: fallende Steine
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

  // Gewinn-Puls
  if (highlighted.length > 0) {
    winPulseT += dt;
    const s = 1.08 + Math.sin(winPulseT * 6.0) * 0.06; // leichtes Pulsieren
    for (const h of highlighted) {
      if (!h.mesh) continue;
      h.mesh.scale.set(h.scaleOld.x * s, h.scaleOld.y * s, h.scaleOld.z * s);
    }
  }

  // KI-Zug
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

function postMoveResolve(_row, _col, playerJustMoved) {
  const res = computeWinner(boardState);
  if (res) {
    gameOver = true; busy = false;
    winCells = res.cells;
    highlightWinCells(winCells);
    emit({ type: 'win', player: res.player, row: res.cells[0].r, col: res.cells[0].c });
    return;
  }

  if (movesCount >= rows * cols) {
    gameOver = true; busy = false;
    emit({ type: 'draw' });
    return;
  }

  currentPlayer = (playerJustMoved === 1) ? 2 : 1;
  busy = false;
  emit({ type: 'turn', player: currentPlayer });
}

// ===== Gewinnprüfung mit konkreten Zellen ====================================
function computeWinner(board) {
  const dirs = [
    { dr: 0, dc: 1 },  // →
    { dr: 1, dc: 0 },  // ↓
    { dr: 1, dc: 1 },  // ↘
    { dr: 1, dc: -1 }  // ↙
  ];
  for (let player = 1; player <= 2; player++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== player) continue;
        for (const { dr, dc } of dirs) {
          const cells = [{ r, c }];
          let rr = r + dr, cc = c + dc;
          while (inBounds(rr, cc) && board[rr][cc] === player) { cells.push({ r: rr, c: cc }); rr += dr; cc += dc; }
          rr = r - dr; cc = c - dc;
          while (inBounds(rr, cc) && board[rr][cc] === player) { cells.unshift({ r: rr, c: cc }); rr -= dr; cc -= dc; }
          if (cells.length >= 4) return { player, cells: cells.slice(0, 4) };
        }
      }
    }
  }
  return null;
}
function inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; }

// ===== Gewinn-Markierung ======================================================
function highlightWinCells(cells) {
  clearWinHighlight();
  if (!cells || cells.length === 0) return;
  winPulseT = 0;

  for (const { r, c } of cells) {
    const m = boardMeshes?.[r]?.[c];
    if (!m) continue;

    const matOld = m.material;
    const matNew = matOld.clone();
    if (!matNew.emissive) matNew.emissive = new THREE.Color(0x000000);
    matNew.emissiveIntensity = 0.9;
    matNew.emissive.setHex(0x22ff88);
    m.material = matNew;

    const scaleOld = m.scale.clone();
    m.scale.set(scaleOld.x * 1.12, scaleOld.y * 1.12, scaleOld.z * 1.12);

    highlighted.push({ mesh: m, matOld, scaleOld });
  }
}

function clearWinHighlight() {
  if (!highlighted.length) return;
  for (const h of highlighted) {
    try {
      if (h.mesh) {
        if (h.matOld) h.mesh.material = h.matOld;
        if (h.scaleOld) h.mesh.scale.copy(h.scaleOld);
      }
    } catch {}
  }
  highlighted.length = 0;
  winCells = null;
}

// ===== Reset & Undo ===========================================================
export function resetGame() {
  activeDrops.length = 0; busy = false; aiPending = false; aiTimer = 0; gameOver = false;
  clearWinHighlight();

  for (const mv of history) {
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
  }
  history.length = 0;

  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    boardState[r][c] = 0;
    const m = boardMeshes?.[r]?.[c];
    if (m) try { boardObj.remove(m); } catch {}
  }
  boardMeshes = Array.from({ length: rows }, () => Array(cols).fill(null));

  movesCount = 0; currentPlayer = 1;
  emit({ type:'reset' });
  emit({ type:'turn', player: currentPlayer });
}

export function undo(count = 1) {
  if (busy) return false;
  clearWinHighlight(); gameOver = false;

  let undone = 0;
  while (count-- > 0 && history.length > 0) {
    const mv = history.pop();
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
    if (boardState[mv.row][mv.col] !== 0) {
      boardState[mv.row][mv.col] = 0;
      if (boardMeshes?.[mv.row]) boardMeshes[mv.row][mv.col] = null;
      movesCount = Math.max(0, movesCount - 1);
      currentPlayer = mv.player;
      undone++;
    }
  }
  if (undone > 0) {
    aiPending = false; aiTimer = 0;
    emit({ type:'undo', count:undone });
    emit({ type:'turn', player: currentPlayer });
    return true;
  }
  return false;
}

// ===== Snapshot Export/Import (für Persistenz) ===============================
export function exportSnapshot() {
  return {
    cols, rows,
    boardState: boardState.map(row => row.slice()),
    currentPlayer,
    movesCount,
    history: history.map(({row,col,player}) => ({row,col,player})),
    gameOver,
    aiEnabled
  };
}

export function importSnapshot(snap) {
  if (!boardObj || !snap) return false;

  // Reset vorher
  activeDrops.length = 0; busy = false; aiPending = false; aiTimer = 0; gameOver = false;
  clearWinHighlight();
  for (const mv of history) {
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
  }
  history.length = 0;

  cols = snap.cols ?? cols;
  rows = snap.rows ?? rows;

  // State übernehmen
  boardState  = Array.from({ length: rows }, (_, r) =>
    (snap.boardState?.[r]?.slice?.() ?? Array(cols).fill(0))
  );
  boardMeshes = Array.from({ length: rows }, () => Array(cols).fill(null));
  currentPlayer = snap.currentPlayer ?? 1;
  movesCount = snap.movesCount ?? 0;
  gameOver = !!snap.gameOver;
  aiEnabled = snap.aiEnabled != null ? !!snap.aiEnabled : true;

  // Discs gemäß State neu aufbauen (ohne Animation)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = boardState[r][c];
      if (p === 0) continue;
      const disc = createDiscMesh(p);
      const pos = cellLocalCenter(boardObj, c, r);
      disc.position.set(pos.x, pos.y, pos.z);
      boardObj.add(disc);
      boardMeshes[r][c] = disc;
      history.push({ row: r, col: c, player: p, mesh: disc });
    }
  }

  // Gewinnstatus neu berechnen/markieren
  const res = computeWinner(boardState);
  clearWinHighlight();
  if (res) { gameOver = true; winCells = res.cells; highlightWinCells(winCells); }

  // HUD Triggern
  emit({ type: 'reset' });
  emit({ type: 'turn', player: currentPlayer });
  return true;
}