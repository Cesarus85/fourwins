// [C4-STEP-2] Spielzustand + Highlight API (noch keine Steine)

import { setHighlight } from './board.js';

let boardState = null;   // [row][col] 0 = leer, 1 = Spieler, 2 = KI
let boardObj = null;

export function initGame(board) {
  boardObj = board;
  const rows = board.userData.rows;
  const cols = board.userData.cols;
  boardState = Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function getBoardState()      { return boardState; }
export function getBoardObject()     { return boardObj; }
export function highlightColumn(c)   { if (boardObj) setHighlight(boardObj, c); }
