// [C4-STEP-3] Board (Alpha-Maske) + Helpers für Zell-Positionen & Discs

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export const COLS = 7;
export const ROWS = 6;

// Abmessungen (m)
const BOARD_W = 0.70;         // Breite Lochfläche
const BOARD_H = 0.45;         // Höhe  Lochfläche
const BOARD_Z = -0.15;        // Z-Position der Lochfläche
const BASE_THICK = 0.02;      // Dicke Basis
const FRAME_THICK = 0.02;     // Dicke Rahmenleisten
const FRAME_DEPTH = 0.03;     // Tiefe Rahmenleisten

// Layout
const MARGIN_X = 0.06;        // Innenrand X
const MARGIN_Y = 0.06;        // Innenrand Y
const HOLE_RADIUS_WORLD = 0.04;   // sichtbarer Lochradius

// Disc
const DISC_RADIUS = HOLE_RADIUS_WORLD * 0.92;
const DISC_THICK_Z = 0.012;       // Dicke entlang Z
const DISC_Z = BOARD_Z - 0.010;   // leicht hinter der Frontfläche (sichtbar durch Löcher)

// Alpha-Canvas
const CANVAS_W = 1400;
const CANVAS_H = 900;

export function createBoard() {
  const g = new THREE.Group();
  g.name = 'C4_Board_Alpha';

  // 1) Basis
  {
    const geom = new THREE.BoxGeometry(BOARD_W, BASE_THICK, 0.35);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.1, roughness: 0.85 });
    const base = new THREE.Mesh(geom, mat);
    base.position.y = BASE_THICK * 0.5;
    g.add(base);

    const edges = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6b7280 }));
    edgeLine.position.copy(base.position);
    g.add(edgeLine);
  }

  // 2) Frontfläche mit Alpha-Löchern
  const alphaTex = makeAlphaMaskTexture();
  {
    const wallGeom = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const wallMat  = new THREE.MeshStandardMaterial({
      color: 0x374151,
      metalness: 0.05,
      roughness: 0.9,
      transparent: true,
      alphaMap: alphaTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeom, wallMat);
    wall.position.set(0, BOARD_H * 0.5 + BASE_THICK, BOARD_Z + 0.001);
    g.add(wall);
  }

  // 3) Rahmen
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.05, roughness: 0.9 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH), mat);
    top.position.set(0, BASE_THICK + BOARD_H + FRAME_THICK * 0.5, BOARD_Z);
    g.add(top);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH), mat);
    bottom.position.set(0, BASE_THICK - FRAME_THICK * 0.5, BOARD_Z);
    g.add(bottom);

    const left = new THREE.Mesh(new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH), mat);
    left.position.set(-BOARD_W * 0.5 - FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    g.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH), mat);
    right.position.set(BOARD_W * 0.5 + FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    g.add(right);
  }

  // 4) Spalten-Collider
  const colliders = [];
  {
    const usableW = BOARD_W - 2 * MARGIN_X;
    const colW = usableW / COLS;
    for (let c = 0; c < COLS; c++) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(colW, BOARD_H + FRAME_THICK, 0.36),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      const centerX = -BOARD_W * 0.5 + MARGIN_X + colW * 0.5 + c * colW;
      col.position.set(centerX, BASE_THICK + BOARD_H * 0.5, -0.02);
      col.userData = { colIndex: c, type: 'c4_col' };
      g.add(col);
      colliders.push(col);
    }
  }

  // 5) Highlight-Schiene
  const highlight = (() => {
    const usableW = BOARD_W - 2 * MARGIN_X;
    const colW = usableW / COLS;
    const geom = new THREE.BoxGeometry(colW * 1.05, 0.02, 0.38);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, BASE_THICK + BOARD_H + 0.05, -0.02);
    mesh.visible = false;
    g.add(mesh);
    return mesh;
  })();

  // Layout in userData
  g.userData = {
    cols: COLS,
    rows: ROWS,
    colliders,
    highlight,
    layout: {
      marginX: MARGIN_X,
      marginY: MARGIN_Y,
      usableW: BOARD_W - 2 * MARGIN_X,
      usableH: BOARD_H - 2 * MARGIN_Y,
      width: BOARD_W,
      height: BOARD_H,
      baseThick: BASE_THICK,
      boardZ: BOARD_Z
    }
  };

  return g;
}

export function setHighlight(board, colIndex) {
  if (!board) return;
  const { cols, highlight, layout } = board.userData;
  if (colIndex == null || colIndex < 0 || colIndex >= cols) { highlight.visible = false; return; }
  const colW = layout.usableW / cols;
  const x = -layout.width * 0.5 + layout.marginX + colW * 0.5 + colIndex * colW;
  highlight.position.x = x;
  highlight.visible = true;
}

// --- NEW: Helper-APIs für Spielsteine & Zellkoordinaten ----------------------

export function cellLocalCenter(board, col, row) {
  const { cols, rows, layout } = board.userData;
  const colW = layout.usableW / cols;
  const rowH = layout.usableH / rows;

  const x = -layout.width * 0.5 + layout.marginX + colW * 0.5 + col * colW;
  const y = layout.baseThick + layout.marginY + rowH * (row + 0.5);
  const z = DISC_Z; // hinter der Frontfläche
  return new THREE.Vector3(x, y, z);
}

export function spawnYLocal(board) {
  const { layout } = board.userData;
  return layout.baseThick + layout.height + 0.20; // 20 cm über Oberkante
}

export function createDiscMesh(playerId = 1) {
  const color = playerId === 1 ? 0xffd100 : 0xff3b30; // Gelb / Rot
  const geom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICK_Z, 48);
  const mat  = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 });
  const m = new THREE.Mesh(geom, mat);
  // Z-Achse als "Dicke" → Zylinder-Achse von Y auf Z drehen:
  m.rotation.x = Math.PI / 2;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

// === Alpha-Textur (Löcher) erzeugen =========================================
function makeAlphaMaskTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';

  const marginU = MARGIN_X / BOARD_W;
  const marginV = MARGIN_Y / BOARD_H;
  const usableU = 1 - 2 * marginU;
  const usableV = 1 - 2 * marginV;

  const rU = HOLE_RADIUS_WORLD / BOARD_W;
  const rV = HOLE_RADIUS_WORLD / BOARD_H;
  const rPx = Math.min(rU * CANVAS_W, rV * CANVAS_H) * 0.98;

  const colW_U = usableU / COLS;
  const rowH_V = usableV / ROWS;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const centerU = marginU + colW_U * (c + 0.5);
      const centerV = marginV + rowH_V * (r + 0.5);
      const xPx = centerU * CANVAS_W;
      const yPx = (1 - centerV) * CANVAS_H;
      ctx.beginPath();
      ctx.arc(xPx, yPx, rPx, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
