// [C4-STEP-6-FIX] Game State + robuste Gewinnprüfung (Vollscan) + Win-Highlight
// Beinhaltet: KI (aus 5b), Reset/Undo, SFX/Haptik-Events wie zuvor

import { setHighlight, cellLocalCenter, createDiscMesh, spawnYLocal } from './board.js';
import { chooseAiMove } from './ai.js';

let boardObj = null;
let boardState = null;       // [row][col] -> 0 leer, 1 Gelb, 2 Rot
let boardMeshes = null;      // [row][col] -> Mesh oder null
let cols = 7, rows = 6;

let currentPlayer = 1;       // 1 = Gelb (Du), 2 = Rot (KI)
let movesCount = 0;
let gameOver = false;
let busy = false;

const activeDrops = [];
const listeners = [];
const history = [];          // Stack: {row,col,player,mesh}

const aiOptions = { mode: 'minimax', depth: 5, timeMs: 350 };
const aiEnabled = true;
let aiTimer = 0;
const aiDelayS = 0.35;
let aiPending = false;

// Win-Highlight
let winCells = null;         // Array<{r,c}>
let highlighted = [];        // referenzen auf Meshes mit revert-Info
let lastMove = null;         // zuletzt gesetzter Stein (Mesh + Originaldaten)

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
  clearLastMoveHighlight();
  emit({ type: 'turn', player: currentPlayer });
}

export function onGameEvent(fn) { if (typeof fn === 'function') listeners.push(fn); }
function emit(evt) { for (const fn of listeners) { try { fn(evt); } catch {} } }

export function getBoardObject()   { return boardObj; }
export function getBoardState()    { return boardState; }
export function getCurrentPlayer() { return currentPlayer; }
export function isGameOver()       { return gameOver; }
export function getAiOptions()     { return { ...aiOptions }; }
export function setAiOptions(o) {
  if (!o) return;
  if (o.mode)        aiOptions.mode = o.mode;
  if (o.depth != null)  aiOptions.depth = Math.max(1, o.depth|0);
  if (o.timeMs!= null)  aiOptions.timeMs = Math.max(50, o.timeMs|0);
  emit({ type:'ai_options', options: getAiOptions() });
}

// Highlight während KI-Zug ausblenden
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

  // Mesh im Raster merken (für Win-Highlight & Undo)
  boardMeshes[row][col] = disc;

  // aktuellen Zug hervorheben
  highlightLastMove(disc);

  // Historie
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

// Nach jedem Zug: Vollscan statt nur "am gesetzten Stein"
// So vermeiden wir Edge-Cases und können klar die Gewinnzellen zurückgeben.
function postMoveResolve(_row, _col, _playerJustMoved) {
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

  currentPlayer = (_playerJustMoved === 1) ? 2 : 1;
  busy = false;
  emit({ type: 'turn', player: currentPlayer });
}

// ===== Vollscan-Gewinnprüfung mit Rückgabe der konkreten 4er-Zellen ==========
function computeWinner(board) {
  // Richtungspaare: H, V, Diag ↘, Diag ↗
  const dirs = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 }
  ];
  for (let player = 1; player <= 2; player++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== player) continue;
        for (const { dr, dc } of dirs) {
          const cells = [{ r, c }];
          // forward
          let rr = r + dr, cc = c + dc;
          while (inBounds(rr, cc) && board[rr][cc] === player) {
            cells.push({ r: rr, c: cc });
            rr += dr; cc += dc;
          }
          // backward
          rr = r - dr; cc = c - dc;
          while (inBounds(rr, cc) && board[rr][cc] === player) {
            cells.unshift({ r: rr, c: cc });
            rr -= dr; cc -= dc;
          }
          if (cells.length >= 4) {
            // gib die ersten 4 zusammenhängenden zurück (oder alle, wenn du magst)
            return { player, cells: cells.slice(0, 4) };
          }
        }
      }
    }
  }
  return null;
}

function inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; }

// ===== Win-Highlight (optisch unmissverständlich) ============================
function highlightWinCells(cells) {
  clearWinHighlight();
  if (!cells || cells.length === 0) return;

  for (const { r, c } of cells) {
    const m = boardMeshes?.[r]?.[c];
    if (!m) continue;
    // Material kopieren, damit wir Emissive ändern können ohne andere Discs zu beeinflussen
    const matOld = m.material;
    const matNew = matOld.clone();
    matNew.emissive = matNew.emissive ? matNew.emissive : { setHex:()=>{} };
    matNew.emissiveIntensity = 0.9;
    matNew.emissive?.setHex?.(0x22ff88);
    m.material = matNew;

    // leichtes Scale-Up
    const oldScale = m.scale.clone();
    m.scale.set(oldScale.x * 1.12, oldScale.y * 1.12, oldScale.z * 1.12);

    highlighted.push({ mesh: m, matOld, matNew, scaleOld: oldScale });
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
      if (h.matNew && typeof h.matNew.dispose === 'function') {
        h.matNew.dispose();
      }
    } catch {}
  }
  highlighted.length = 0;
  winCells = null;
}

function highlightLastMove(mesh) {
  clearLastMoveHighlight();
  if (!mesh) return;
  const matOld = mesh.material;
  const matNew = matOld.clone();
  matNew.emissive = matNew.emissive ? matNew.emissive : { setHex:()=>{} };
  matNew.emissiveIntensity = 0.6;
  matNew.emissive?.setHex?.(0xffffff);
  mesh.material = matNew;

  const scaleOld = mesh.scale.clone();
  mesh.scale.set(scaleOld.x * 1.1, scaleOld.y * 1.1, scaleOld.z * 1.1);

  lastMove = { mesh, matOld, scaleOld };
}

function clearLastMoveHighlight() {
  if (!lastMove) return;
  try {
    if (lastMove.matOld) lastMove.mesh.material = lastMove.matOld;
    if (lastMove.scaleOld) lastMove.mesh.scale.copy(lastMove.scaleOld);
  } catch {}
  lastMove = null;
}

// ===== Reset & Undo ===========================================================
export function resetGame() {
  // Animationen/Flags
  activeDrops.length = 0; busy = false; aiPending = false; aiTimer = 0; gameOver = false;

  // Win-Markierung zurücksetzen
  clearWinHighlight();
  clearLastMoveHighlight();

  // alle Discs entfernen
  for (const mv of history) {
    try { boardObj.remove(mv.mesh); mv.mesh.geometry?.dispose?.(); mv.mesh.material?.dispose?.(); } catch {}
  }
  history.length = 0;

  // Board leeren
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      boardState[r][c] = 0;
      const m = boardMeshes[r][c];
      if (m) try { boardObj.remove(m); } catch {}
      boardMeshes[r][c] = null;
    }
  }
  movesCount = 0; currentPlayer = 1;
  emit({ type:'reset' });
  emit({ type:'turn', player: currentPlayer });
}

export function undo(count = 1) {
  if (busy) return false;

  // Win-Markierung entfernen (falls gerade vorhanden)
  clearWinHighlight();
  clearLastMoveHighlight();
  gameOver = false;

  let undone = 0;
  while (count-- > 0 && history.length > 0) {
    const mv = history.pop();
    // Mesh weg
    try {
      boardObj.remove(mv.mesh);
      mv.mesh.geometry?.dispose?.();
      mv.mesh.material?.dispose?.();
    } catch {}
    // State zurückdrehen
    if (boardState[mv.row][mv.col] !== 0) {
      boardState[mv.row][mv.col] = 0;
      boardMeshes[mv.row][mv.col] = null;
      movesCount = Math.max(0, movesCount - 1);
      currentPlayer = mv.player; // der Spieler ist wieder am Zug, der diesen Zug gemacht hatte
      undone++;
    }
  }
  if (undone > 0) {
    aiPending = false; aiTimer = 0;
    emit({ type:'undo', count:undone });
    emit({ type:'turn', player: currentPlayer });
    // neuen letzten Zug markieren, falls vorhanden
    if (history.length > 0) highlightLastMove(history[history.length - 1].mesh);
    return true;
  }
  return false;
}
