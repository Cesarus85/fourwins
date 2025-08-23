// [C4-STEP-6] Board (Alpha-Maske) + Shadow-Flags + Disc-Namen
import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export const COLS = 7;
export const ROWS = 6;

const BOARD_W = 0.70, BOARD_H = 0.45, BOARD_Z = -0.15;
const BASE_THICK = 0.02, FRAME_THICK = 0.02, FRAME_DEPTH = 0.03;
const MARGIN_X = 0.06, MARGIN_Y = 0.06, HOLE_RADIUS_WORLD = 0.04;

const DISC_RADIUS = HOLE_RADIUS_WORLD * 0.92;
const DISC_THICK_Z = 0.012;   // Zylinderhöhe
const DISC_Z = BOARD_Z - 0.010;

const CANVAS_W = 1400, CANVAS_H = 900;

export function createBoard() {
  const g = new THREE.Group();
  g.name = 'C4_Board_Alpha';

  // Basis (empfängt Schatten)
  {
    const geom = new THREE.BoxGeometry(BOARD_W, BASE_THICK, 0.35);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.1, roughness: 0.85 });
    const base = new THREE.Mesh(geom, mat);
    base.position.y = BASE_THICK * 0.5;
    base.receiveShadow = true;
    g.add(base);

    const edges = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6b7280 }));
    edgeLine.position.copy(base.position);
    g.add(edgeLine);
  }

  // Frontfläche (Alpha-Maske)
  const alphaTex = makeAlphaMaskTexture();
  {
    const wallGeom = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const wallMat  = new THREE.MeshStandardMaterial({
      color: 0x374151, metalness: 0.05, roughness: 0.9,
      transparent: true, alphaMap: alphaTex, alphaTest: 0.5, side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeom, wallMat);
    wall.position.set(0, BOARD_H * 0.5 + BASE_THICK, BOARD_Z + 0.001);
    // wall.receiveShadow = true; // optional: meist visuell besser ohne
    g.add(wall);
  }

  // Rahmen (empfängt Schatten)
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.05, roughness: 0.9 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH), mat);
    top.position.set(0, BASE_THICK + BOARD_H + FRAME_THICK * 0.5, BOARD_Z);
    top.receiveShadow = true; g.add(top);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH), mat);
    bottom.position.set(0, BASE_THICK - FRAME_THICK * 0.5, BOARD_Z);
    bottom.receiveShadow = true; g.add(bottom);

    const left = new THREE.Mesh(new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH), mat);
    left.position.set(-BOARD_W * 0.5 - FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    left.receiveShadow = true; g.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH), mat);
    right.position.set(BOARD_W * 0.5 + FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    right.receiveShadow = true; g.add(right);
  }

  // Spalten-Collider
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

  // Highlight-Schiene
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

  g.userData = {
    cols: COLS, rows: ROWS, colliders, highlight,
    layout: {
      marginX: MARGIN_X, marginY: MARGIN_Y,
      usableW: BOARD_W - 2 * MARGIN_X, usableH: BOARD_H - 2 * MARGIN_Y,
      width: BOARD_W, height: BOARD_H, baseThick: BASE_THICK, boardZ: BOARD_Z
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

export function cellLocalCenter(board, col, row) {
  const { cols, rows, layout } = board.userData;
  const colW = layout.usableW / cols;
  const rowH = layout.usableH / rows;
  const x = -layout.width * 0.5 + layout.marginX + colW * 0.5 + col * colW;
  const y = layout.baseThick + layout.marginY + rowH * (row + 0.5);
  const z = DISC_Z;
  return new THREE.Vector3(x, y, z);
}
export function spawnYLocal(board) { return board.userData.layout.baseThick + board.userData.layout.height + 0.20; }

export function createDiscMesh(playerId = 1) {
  const color = playerId === 1 ? 0xffd100 : 0xff3b30;
  const geom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICK_Z, 48);
  const mat  = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 });
  const m = new THREE.Mesh(geom, mat);
  m.rotation.x = Math.PI / 2;
  m.name = 'C4_Disc';
  m.castShadow = true;        // Schatten vom Stein
  return m;
}

// Alpha-Textur
function makeAlphaMaskTexture() {
  const canvas = document.createElement('canvas'); canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000000';

  const marginU = MARGIN_X / BOARD_W, marginV = MARGIN_Y / BOARD_H;
  const usableU = 1 - 2 * marginU, usableV = 1 - 2 * marginV;
  const rU = HOLE_RADIUS_WORLD / BOARD_W, rV = HOLE_RADIUS_WORLD / BOARD_H;
  const rPx = Math.min(rU * CANVAS_W, rV * CANVAS_H) * 0.98;
  const colW_U = usableU / COLS, rowH_V = usableV / ROWS;

  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const u = marginU + colW_U * (c + 0.5), v = marginV + rowH_V * (r + 0.5);
    const x = u * CANVAS_W, y = (1 - v) * CANVAS_H;
    ctx.beginPath(); ctx.arc(x, y, rPx, 0, Math.PI * 2); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace; tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
