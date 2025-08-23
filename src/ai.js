// [C4-STEP-5b] KI: Heuristik ODER Minimax/Alpha-Beta mit Iterative Deepening & Zeitbudget
// API: chooseAiMove(boardState, { mode: 'minimax'|'heuristic', depth: 5, timeMs: 350 })
//
// - boardState ist [row][col] mit row=0 ganz unten
// - Spieler: HUMAN=1 (Gelb), AI=2 (Rot)

export function chooseAiMove(boardState, options = {}) {
  const mode   = options.mode   ?? 'minimax';   // 'heuristic' | 'minimax'
  const depth  = options.depth  ?? 5;           // maximale Suchtiefe (Ply)
  const timeMs = options.timeMs ?? 350;         // Zeitbudget in ms (nur für minimax)

  if (mode === 'heuristic') {
    return chooseHeuristic(boardState);
  } else {
    return chooseMinimax(boardState, depth, timeMs);
  }
}

// ============================================================================
// Heuristische Grund-KI (schnell)
// ============================================================================
function chooseHeuristic(board) {
  const cols = board[0].length;
  const rows = board.length;
  const AI = 2, HUMAN = 1;

  const validCols = [];
  for (let c = 0; c < cols; c++) if (nextFreeRow(board, c) !== -1) validCols.push(c);
  if (validCols.length === 0) return -1;

  // 1) Sofortiger Gewinn
  for (const c of validCols) {
    const r = nextFreeRow(board, c);
    board[r][c] = AI;
    const win = checkWinAt(board, r, c, AI);
    board[r][c] = 0;
    if (win) return c;
  }

  // 2) Sofort blocken
  for (const c of validCols) {
    const r = nextFreeRow(board, c);
    board[r][c] = HUMAN;
    const oppWin = checkWinAt(board, r, c, HUMAN);
    board[r][c] = 0;
    if (oppWin) return c;
  }

  // 3) Scoring
  let bestScore = -Infinity;
  let bestCols = [];
  for (const c of validCols) {
    const r = nextFreeRow(board, c);
    board[r][c] = AI;
    const score = scorePosition(board, AI);
    board[r][c] = 0;

    if (score > bestScore) { bestScore = score; bestCols = [c]; }
    else if (score === bestScore) bestCols.push(c);
  }

  bestCols.sort((a, b) => Math.abs(a - centerCol(cols)) - Math.abs(b - centerCol(cols)));
  return bestCols[0];
}

// ============================================================================
// Minimax + Alpha-Beta + Iterative Deepening (Zeitbudget)
// Hinweis: arbeitet direkt auf 'board' und revertiert jeden Zug
// ============================================================================
function chooseMinimax(board, maxDepth, timeMs) {
  const start = Date.now();
  const deadline = start + Math.max(50, timeMs | 0);
  const cols = board[0].length;
  const AI = 2;

  // Spaltenreihenfolge: Center-first → bessere Pruning-Qualität
  const order = centerOrder(cols);

  let bestMove = firstValidInOrder(board, order);
  if (bestMove < 0) return -1;

  let bestScore = -Infinity;
  let completedDepth = 0;

  // Iterative Deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    const res = maxNode(board, depth, -Infinity, Infinity, deadline, order);
    if (res.timedOut) break;
    completedDepth = depth;
    bestScore = res.score;
    bestMove = res.move ?? bestMove;
    // (Optional: Aspiration-Window könnte hier ergänzt werden)
  }

  // console.log('AI depth=', completedDepth, 'score=', bestScore, 'move=', bestMove);
  return bestMove;

  // --- Max (AI) ---
  function maxNode(board, depth, alpha, beta, deadline, order) {
    if (Date.now() > deadline) return { timedOut: true };

    // Terminal/Depth-Ende: aus Sicht AI bewerten
    if (depth === 0) return { score: scorePosition(board, AI), move: null, timedOut: false };

    // Generiere gültige Züge
    const moves = validMovesInOrder(board, order);
    if (moves.length === 0) return { score: 0, move: null, timedOut: false }; // Remis

    let bestLocalMove = moves[0];
    let best = -Infinity;

    for (const c of moves) {
      const r = nextFreeRow(board, c);
      board[r][c] = 2; // AI setzt

      // Sofortiger Sieg?
      if (checkWinAt(board, r, c, 2)) {
        board[r][c] = 0;
        return { score: 1_000_000 - (maxDepth - depth), move: c, timedOut: false };
      }

      const res = minNode(board, depth - 1, alpha, beta, deadline, order);
      if (res.timedOut) { board[r][c] = 0; return { timedOut: true }; }

      if (res.score > best) {
        best = res.score; bestLocalMove = c;
        alpha = Math.max(alpha, best);
      }

      board[r][c] = 0;
      if (beta <= alpha) break; // Beta-Cutoff
    }

    return { score: best, move: bestLocalMove, timedOut: false };
  }

  // --- Min (Human) ---
  function minNode(board, depth, alpha, beta, deadline, order) {
    if (Date.now() > deadline) return { timedOut: true };

    if (depth === 0) return { score: scorePosition(board, AI), move: null, timedOut: false };

    const moves = validMovesInOrder(board, order);
    if (moves.length === 0) return { score: 0, move: null, timedOut: false }; // Remis

    let worst = Infinity;

    for (const c of moves) {
      const r = nextFreeRow(board, c);
      board[r][c] = 1; // HUMAN setzt

      if (checkWinAt(board, r, c, 1)) {
        board[r][c] = 0;
        return { score: -1_000_000 + (maxDepth - depth), move: c, timedOut: false };
      }

      const res = maxNode(board, depth - 1, alpha, beta, deadline, order);
      if (res.timedOut) { board[r][c] = 0; return { timedOut: true }; }

      if (res.score < worst) {
        worst = res.score;
        beta = Math.min(beta, worst);
      }

      board[r][c] = 0;
      if (beta <= alpha) break; // Alpha-Cutoff
    }

    return { score: worst, move: null, timedOut: false };
  }
}

// ============================================================================
// Gemeinsame Helfer (Board-Utils & Scoring)
// ============================================================================
function nextFreeRow(board, col) {
  for (let r = 0; r < board.length; r++) if (board[r][col] === 0) return r;
  return -1;
}
function validMovesInOrder(board, order) {
  const res = [];
  for (const c of order) if (nextFreeRow(board, c) !== -1) res.push(c);
  return res;
}
function centerCol(cols) { return Math.floor(cols / 2); }
function centerOrder(cols) {
  const center = centerCol(cols);
  const arr = [...Array(cols).keys()];
  return arr.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}
function firstValidInOrder(board, order) {
  for (const c of order) if (nextFreeRow(board, c) !== -1) return c;
  return -1;
}

function checkWinAt(board, row, col, player) {
  if (countLine(board, row, col, 0, 1, player) >= 4) return true;
  if (countLine(board, row, col, 1, 0, player) >= 4) return true;
  if (countLine(board, row, col, 1, 1, player) >= 4) return true;
  if (countLine(board, row, col, 1, -1, player) >= 4) return true;
  return false;
}
function countLine(board, row, col, dr, dc, player) {
  let total = 1;
  let r = row + dr, c = col + dc;
  while (inBounds(board, r, c) && board[r][c] === player) { total++; r += dr; c += dc; }
  r = row - dr; c = col - dc;
  while (inBounds(board, r, c) && board[r][c] === player) { total++; r -= dr; c -= dc; }
  return total;
}
function inBounds(board, r, c) {
  return r >= 0 && r < board.length && c >= 0 && c < board[0].length;
}

// Bewertungsfunktion (wie Schritt 5, leicht justiert)
function scorePosition(board, player) {
  const rows = board.length, cols = board[0].length;
  const opp = (player === 1) ? 2 : 1;

  let score = 0;

  // Mitte bevorzugen
  const c0 = centerCol(cols);
  let centerCount = 0;
  for (let r = 0; r < rows; r++) if (board[r][c0] === player) centerCount++;
  score += centerCount * 6;

  // Fenster der Länge 4
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
function evalWindow(win, player, opp) {
  const p = win.filter(v => v === player).length;
  const o = win.filter(v => v === opp).length;
  const z = win.filter(v => v === 0).length;

  if (p === 4) return 10_000;
  if (p === 3 && z === 1) return 120;
  if (p === 2 && z === 2) return 12;

  if (o === 3 && z === 1) return -110;
  if (o === 2 && z === 2) return -10;

  return 0;
}
