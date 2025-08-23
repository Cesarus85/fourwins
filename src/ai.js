// [C4-STEP-5] Heuristische KI für Vier Gewinnt
// Strategie: 1) Sofort gewinnen, 2) Sofort blocken, 3) Heuristik (Fensterwertung + Mitte)

export function chooseAiMove(boardState) {
  const cols = boardState[0].length;
  const rows = boardState.length;
  const AI = 2, HUMAN = 1;

  const validCols = [];
  for (let c = 0; c < cols; c++) if (nextFreeRow(boardState, c) !== -1) validCols.push(c);
  if (validCols.length === 0) return -1;

  // 1) Sofortiger Gewinn
  for (const c of validCols) {
    const r = nextFreeRow(boardState, c);
    boardState[r][c] = AI;
    const win = checkWinAt(boardState, r, c, AI);
    boardState[r][c] = 0;
    if (win) return c;
  }

  // 2) Sofort blocken (Gegner würde gewinnen)
  for (const c of validCols) {
    const r = nextFreeRow(boardState, c);
    boardState[r][c] = HUMAN;
    const oppWin = checkWinAt(boardState, r, c, HUMAN);
    boardState[r][c] = 0;
    if (oppWin) return c;
  }

  // 3) Heuristik (Fensterwertung + Center)
  let bestScore = -Infinity;
  let bestCols = [];

  for (const c of validCols) {
    const r = nextFreeRow(boardState, c);
    boardState[r][c] = AI;
    const score = scorePosition(boardState, AI);
    boardState[r][c] = 0;

    if (score > bestScore) {
      bestScore = score; bestCols = [c];
    } else if (score === bestScore) {
      bestCols.push(c);
    }
  }

  // Center-Priorität in Gleichstand
  bestCols.sort((a, b) => Math.abs(a - centerCol(cols)) - Math.abs(b - centerCol(cols)));
  return bestCols[0];
}

// ================= Helpers =================

function nextFreeRow(board, col) {
  for (let r = 0; r < board.length; r++) if (board[r][col] === 0) return r;
  return -1;
}

function centerCol(cols) { return Math.floor(cols / 2); }

function scorePosition(board, player) {
  const rows = board.length, cols = board[0].length;
  const opp = (player === 1) ? 2 : 1;

  let score = 0;

  // Mitte bevorzugen
  const c0 = centerCol(cols);
  let centerCount = 0;
  for (let r = 0; r < rows; r++) if (board[r][c0] === player) centerCount++;
  score += centerCount * 6;

  // Fenster (4) horizontal/vertikal/diagonal
  // Horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += evalWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]], player, opp);
    }
  }
  // Vertikal
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - 4; r++) {
      score += evalWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]], player, opp);
    }
  }
  // Diag ↘
  for (let r = 0; r <= rows - 4; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += evalWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], player, opp);
    }
  }
  // Diag ↗
  for (let r = 3; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += evalWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]], player, opp);
    }
  }

  return score;
}

function evalWindow(window, player, opp) {
  const cntP = window.filter(v => v === player).length;
  const cntO = window.filter(v => v === opp).length;
  const cnt0 = window.filter(v => v === 0).length;

  // starke Motive
  if (cntP === 3 && cnt0 === 1) return 80;
  if (cntP === 2 && cnt0 === 2) return 10;

  if (cntO === 3 && cnt0 === 1) return -70;  // blocken
  if (cntO === 2 && cnt0 === 2) return -8;

  return 0;
}

function checkWinAt(board, row, col, player) {
  // 4 Richtungen: (0,1), (1,0), (1,1), (1,-1)
  if (countLine(board, row, col, 0, 1, player) >= 4) return true;
  if (countLine(board, row, col, 1, 0, player) >= 4) return true;
  if (countLine(board, row, col, 1, 1, player) >= 4) return true;
  if (countLine(board, row, col, 1, -1, player) >= 4) return true;
  return false;
}

function countLine(board, row, col, dr, dc, player) {
  let total = 1;

  // vorwärts
  let r = row + dr, c = col + dc;
  while (inBounds(board, r, c) && board[r][c] === player) { total++; r += dr; c += dc; }

  // rückwärts
  r = row - dr; c = col - dc;
  while (inBounds(board, r, c) && board[r][c] === player) { total++; r -= dr; c -= dc; }

  return total;
}

function inBounds(board, r, c) {
  return r >= 0 && r < board.length && c >= 0 && c < board[0].length;
}
