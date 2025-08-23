// [C4-STEP-2-C] Brett mit "echten" Löchern per Alpha-Maske (alphaMap + alphaTest)
// - Frontfläche ist eine Plane mit Alpha-Textur (Löcher = transparent).
// - Umrandung/Frame als 4 Leisten für 3D-Optik.
// - Spalten-Collider bleiben erhalten.
// - Highlight-Schiene bleibt erhalten.

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export const COLS = 7;
export const ROWS = 6;

// Board-Abmessungen (in Metern, Quest-AR-Maßstab)
const BOARD_W = 0.70;       // Breite der sichtbaren Lochfläche
const BOARD_H = 0.45;       // Höhe der sichtbaren Lochfläche
const BOARD_Z = -0.15;      // Z-Position (vorne/hinten auf der Basis)
const BASE_THICK = 0.02;    // Dicke der Bodenplatte
const FRAME_THICK = 0.02;   // Dicke des Rahmens (Leisten)
const FRAME_DEPTH = 0.03;   // Tiefe des Rahmens

// Lochlayout
const MARGIN_X = 0.06;      // linker/rechter Rand innerhalb der Lochfläche
const MARGIN_Y = 0.06;      // oberer/unterer Rand innerhalb der Lochfläche
const HOLE_RADIUS_WORLD = 0.04; // sichtbarer Kreisradius in "Welt"-Metern

// Alpha-Canvas-Auflösung im Seitenverhältnis 0.70:0.45 = 14:9
const CANVAS_W = 1400;
const CANVAS_H = 900;

export function createBoard() {
  const g = new THREE.Group();
  g.name = 'C4_Board_Alpha';

  // 1) Basisplatte
  {
    const geom = new THREE.BoxGeometry(BOARD_W, BASE_THICK, 0.35);
    const mat  = new THREE.MeshStandardMaterial({
      color: 0x1f2937, metalness: 0.1, roughness: 0.85
    });
    const base = new THREE.Mesh(geom, mat);
    base.position.y = BASE_THICK * 0.5; // auf AR-Fläche abstellen
    g.add(base);

    // kleiner Kantenrand (optisch)
    const edges = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(
      edges, new THREE.LineBasicMaterial({ color: 0x6b7280 })
    );
    edgeLine.position.copy(base.position);
    g.add(edgeLine);
  }

  // 2) Frontfläche mit Alpha-Löchern (Plane + alphaMap)
  const alphaTex = makeAlphaMaskTexture();
  {
    const wallGeom = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const wallMat  = new THREE.MeshStandardMaterial({
      color: 0x374151,
      metalness: 0.05,
      roughness: 0.9,
      transparent: true,
      alphaMap: alphaTex,
      alphaTest: 0.5,            // Pixel < 0.5 alpha werden verworfen → echte Löcher
      side: THREE.DoubleSide     // einfacher: sichtbar von vorn & hinten
    });
    const wall = new THREE.Mesh(wallGeom, wallMat);
    wall.position.set(0, BOARD_H * 0.5 + BASE_THICK, BOARD_Z + 0.001);
    // Plane blickt standardmäßig +Z; DoubleSide macht uns unabhängig von der Richtung
    g.add(wall);
  }

  // 3) Rahmen/Leisten für 3D-Optik rings um die Lochfläche
  {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2b3340, metalness: 0.05, roughness: 0.9
    });

    // Top-Leiste
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH),
      frameMat
    );
    top.position.set(0, BASE_THICK + BOARD_H + FRAME_THICK * 0.5, BOARD_Z);
    g.add(top);

    // Bottom-Leiste (über der Basis, unterer Abschluss)
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W + FRAME_THICK, FRAME_THICK, FRAME_DEPTH),
      frameMat
    );
    bottom.position.set(0, BASE_THICK - FRAME_THICK * 0.5, BOARD_Z);
    g.add(bottom);

    // Left-Leiste
    const left = new THREE.Mesh(
      new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH),
      frameMat
    );
    left.position.set(-BOARD_W * 0.5 - FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    g.add(left);

    // Right-Leiste
    const right = new THREE.Mesh(
      new THREE.BoxGeometry(FRAME_THICK, BOARD_H + FRAME_THICK * 2, FRAME_DEPTH),
      frameMat
    );
    right.position.set(BOARD_W * 0.5 + FRAME_THICK * 0.5, BASE_THICK + BOARD_H * 0.5, BOARD_Z);
    g.add(right);
  }

  // 4) Spalten-Collider (unsichtbar, für späteren Ray-Input)
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

  // 5) Highlight-Schiene (sichtbar deutlich)
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
      height: BOARD_H
    }
  };

  return g;
}

// Öffentliche API: Highlight-Position aktualisieren
export function setHighlight(board, colIndex) {
  if (!board) return;
  const { cols, highlight, layout } = board.userData;
  if (colIndex == null || colIndex < 0 || colIndex >= cols) {
    highlight.visible = false;
    return;
  }
  const colW = layout.usableW / cols;
  const x = -layout.width * 0.5 + layout.marginX + colW * 0.5 + colIndex * colW;
  highlight.position.x = x;
  highlight.visible = true;
}

// === Hilfsfunktion: Alpha-Textur (Löcher) prozedural erzeugen =================
function makeAlphaMaskTexture() {
  // Canvas passend zum Seitenverhältnis der Lochfläche
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  // Vollflächig "weiß" (opaque)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Löcher via "destination-out" (macht Bereiche transparent)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';

  // Layout in UV (0..1), dann in Pixel umrechnen
  const marginU = MARGIN_X / BOARD_W;
  const marginV = MARGIN_Y / BOARD_H;
  const usableU = 1 - 2 * marginU;
  const usableV = 1 - 2 * marginV;

  // Lochradius in UV → Pixel
  const rU = HOLE_RADIUS_WORLD / BOARD_W;
  const rV = HOLE_RADIUS_WORLD / BOARD_H;
  // Nehme den kleineren, damit der Kreis in beide Richtungen passt
  const rPx = Math.min(rU * CANVAS_W, rV * CANVAS_H) * 0.98; // 0.98 = kleiner Sicherheitssaum

  // Zellbreiten/-höhen in UV
  const colW_U = usableU / COLS;
  const rowH_V = usableV / ROWS;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const centerU = marginU + colW_U * (c + 0.5);
      const centerV = marginV + rowH_V * (r + 0.5);

      // Canvas: y nach unten → invertiere V
      const xPx = centerU * CANVAS_W;
      const yPx = (1 - centerV) * CANVAS_H;

      ctx.beginPath();
      ctx.arc(xPx, yPx, rPx, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Zurück auf Standard
  ctx.globalCompositeOperation = 'source-over';

  // In Three-Textur umwandeln
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;         // alphaMap → kein Farbraum
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
