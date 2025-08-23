// [C4-STEP-2] Spielzustand für 7x6 Raster + Highlight Steuerung

import { setHighlight } from './board.js';

let boardState = null; // 2D-Array [row][col]
let boardObject = null;

export function initGame(board) {
  boardObject = board;
  boardState = Array.from({ length: board.userData.rows }, () =>
    Array(board.userData.cols).fill(0)
  );
}

export function getBoardState() {
  return boardState;
}

export function getBoardObject() {
  return boardObject;
}

// Highlight Spalte setzen
export function highlightColumn(colIndex) {
  if (!boardObject) return;
  setHighlight(boardObject, colIndex);
}
