// [C4-STEP-1] Einfacher Platzhalter für das Spielbrett.
// In Schritt 2 ersetzen wir das durch das echte 7x6-Raster & Spalten.

import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

export function createBoardPlaceholder() {
  const group = new THREE.Group();

  // Bodenplatte des Bretts (70cm x 10mm)
  const baseGeom = new THREE.BoxGeometry(0.7, 0.01, 0.35);
  const baseMat  = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.1, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = 0.005; // knapp über AR-Fläche
  group.add(base);

  // Aufgeständerte Platte als Rückwand (später Raster)
  const wallGeom = new THREE.BoxGeometry(0.7, 0.45, 0.02);
  const wallMat  = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.05, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeom, wallMat);
  wall.position.set(0, 0.24, -0.15); // hinten auf der Basis
  group.add(wall);

  // Kleiner „Center“-Marker
  const markerGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.002, 24);
  const markerMat  = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const marker = new THREE.Mesh(markerGeom, markerMat);
  marker.rotation.x = Math.PI / 2;
  marker.position.set(0, 0.006, 0);
  group.add(marker);

  // Dezente Umrisslinie (nur optisch)
  const edges = new THREE.EdgesGeometry(baseGeom);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6b7280 }));
  line.position.copy(base.position);
  group.add(line);

  group.name = 'C4_BoardPlaceholder';
  return group;
}
