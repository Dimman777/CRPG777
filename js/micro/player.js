// Player — three-part body (legs / torso / head), each an independent octagonal
// prism with a dark facing indicator.
//
// Legs always face the movement direction.
// Torso is offset ±45° from legs, toggled by Z / C.
// Head offset is 0 for the player (auto-set by conversations in followers).
//
// Axis-separated tile collision.  Reports chunk-edge transitions.

import * as THREE from 'three';
import { CHUNK_SIZE } from './micro_grid.js';

const PLAYER_SPEED   = 7;      // tiles per second
const PLAYER_RADIUS  = 0.375;  // leg & torso radius
const HEAD_RADIUS    = 0.24;   // head is noticeably smaller
const LEG_H          = 0.75;
const TORSO_H        = 0.80;
const HEAD_H         = 0.45;
const PLAYER_HEIGHT  = LEG_H + TORSO_H + HEAD_H; // 2.0

// Build an octagonal prism with a dark facing panel on the front face (+Z local).
// Geometry is rotated π/8 so a flat face aligns with +Z.
function makeOctPrism(scene, radius, height, color) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1, false);
  geo.rotateY(Math.PI / 8);
  const mat  = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;

  const faceW    = 2 * Math.sin(Math.PI / 8) * radius;
  const faceDist = Math.cos(Math.PI / 8) * radius;
  const indGeo   = new THREE.BoxGeometry(faceW, height * 1.01, 0.04);
  const indMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const indicator = new THREE.Mesh(indGeo, indMat);
  indicator.position.set(0, 0, faceDist + 0.02);
  mesh.add(indicator);

  scene.add(mesh);
  return mesh;
}

function disposeMesh(scene, mesh) {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  for (const child of mesh.children) {
    child.geometry.dispose();
    child.material.dispose();
  }
}

export class Player {
  constructor(scene) {
    this._scene = scene;
    this._keys  = { w: false, a: false, s: false, d: false };

    const C = 0xff8844; // orange
    this._legMesh   = makeOctPrism(scene, PLAYER_RADIUS, LEG_H,   C);
    this._torsoMesh = makeOctPrism(scene, PLAYER_RADIUS, TORSO_H, C);
    this._headMesh  = makeOctPrism(scene, HEAD_RADIUS,   HEAD_H,  C);

    this.px          = 32.5; // tile-space X
    this.py          = 32.5; // tile-space Z
    this.worldY      = 0;
    this.legAngle    = 0;    // driven by movement (radians)
    this.torsoOffset = 0;    // player-controlled; ±π/4 from legAngle
    this.headOffset  = 0;    // always 0 for player; set automatically in followers
    this.headingX    = 0;    // last non-zero movement X — used by follower formation
    this.headingZ    = 1;    // last non-zero movement Z

    this._headLookTarget = 0;
    this._headLookTimer  = Math.random() * 3 + 1.5; // random start so it's not instant

    // Mouse-driven movement — set externally each frame; cleared on mouse-up.
    this._mouseDx          = 0;
    this._mouseDz          = 0;
    this._mouseSpeedFactor = 0;
  }

  // Place at the centre of tile (tx, ty) and snap to terrain elevation.
  place(tx, ty, chunkRenderer) {
    this.px = tx + 0.5;
    this.py = ty + 0.5;
    this.refresh(chunkRenderer);
  }

  // Reposition and re-orient all three parts (call after changing px/py or angles).
  refresh(chunkRenderer) {
    const baseY = chunkRenderer ? chunkRenderer.elevationAt(this.px, this.py) : 0;
    this.worldY = baseY + PLAYER_HEIGHT / 2;

    this._legMesh.position.set(  this.px, baseY + LEG_H * 0.5,                             this.py);
    this._torsoMesh.position.set(this.px, baseY + LEG_H + TORSO_H * 0.5,                   this.py);
    this._headMesh.position.set( this.px, baseY + LEG_H + TORSO_H + HEAD_H * 0.5,          this.py);

    const torsoAngle = this.legAngle + this.torsoOffset;
    const headAngle  = torsoAngle    + this.headOffset;
    this._legMesh.rotation.y   = this.legAngle;
    this._torsoMesh.rotation.y = torsoAngle;
    this._headMesh.rotation.y  = headAngle;
  }

  // Z key — toggle torso left (−45° from legs) / back to centre.
  rotateFacingLeft() {
    this.torsoOffset = this.torsoOffset < -0.1 ? 0 : -Math.PI / 4;
  }

  // C key — toggle torso right (+45° from legs) / back to centre.
  rotateFacingRight() {
    this.torsoOffset = this.torsoOffset > 0.1 ? 0 : Math.PI / 4;
  }

  keyDown(key) { if (key in this._keys) this._keys[key] = true;  }
  keyUp(key)   { if (key in this._keys) this._keys[key] = false; }

  // Set a mouse-driven movement vector (dx, dz normalised; speedFactor 0–1).
  // Call each frame while the mouse button is held; call clearMouseMove() on release.
  setMouseMove(dx, dz, speedFactor) {
    this._mouseDx          = dx;
    this._mouseDz          = dz;
    this._mouseSpeedFactor = speedFactor;
  }

  clearMouseMove() {
    this._mouseDx = 0; this._mouseDz = 0; this._mouseSpeedFactor = 0;
  }

  get position() { return { x: this.px, y: this.worldY, z: this.py }; }

  // Move for one frame; returns 'none' | 'north' | 'south' | 'east' | 'west'
  // when the player crosses a chunk boundary.
  // azimuthDeg — camera azimuth so WASD maps to screen directions.
  update(dt, grid, chunkRenderer, azimuthDeg = 45) {
    const S  = CHUNK_SIZE;
    const az = azimuthDeg * Math.PI / 180;
    const fwdX = -Math.sin(az), fwdZ = -Math.cos(az);
    const rgtX =  Math.cos(az), rgtZ = -Math.sin(az);

    // Mouse input takes priority over WASD when active.
    let dx = 0, dz = 0, speedFactor = 1;
    if (this._mouseDx !== 0 || this._mouseDz !== 0) {
      dx = this._mouseDx;
      dz = this._mouseDz;
      speedFactor = this._mouseSpeedFactor;
    } else {
      if (this._keys.w) { dx += fwdX; dz += fwdZ; }
      if (this._keys.s) { dx -= fwdX; dz -= fwdZ; }
      if (this._keys.a) { dx -= rgtX; dz -= rgtZ; }
      if (this._keys.d) { dx += rgtX; dz += rgtZ; }
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0.001) { dx /= len; dz /= len; } else { dx = 0; dz = 0; }
    }

    if (dx !== 0 || dz !== 0) {
      this.headingX = dx;
      this.headingZ = dz;
      this.legAngle = Math.atan2(dx, dz);
    }

    const step = PLAYER_SPEED * speedFactor * dt;
    const newX = this.px + dx * step;
    const newZ = this.py + dz * step;

    // Axis-separated collision — each axis checked independently.
    // Track whether each axis actually moved (false = blocked by an obstacle).
    let xMoved = false, zMoved = false;

    // X axis — allow out-of-bounds (triggers chunk transition)
    if (newX < 0 || newX >= S) {
      this.px = newX; xMoved = true;
    } else {
      const itx = Math.floor(newX);
      const itz = Math.max(0, Math.min(S - 1, Math.floor(this.py)));
      if (!grid || grid.passable[itz * S + itx]) { this.px = newX; xMoved = true; }
    }

    // Z axis
    if (newZ < 0 || newZ >= S) {
      this.py = newZ; zMoved = true;
    } else {
      const itx = Math.max(0, Math.min(S - 1, Math.floor(this.px)));
      const itz = Math.floor(newZ);
      if (!grid || grid.passable[itz * S + itx]) { this.py = newZ; zMoved = true; }
    }

    // Diagonal squeeze: if moving diagonally and both in-bounds axes were blocked,
    // allow the move when the diagonal tile itself is passable (gap between obstacles).
    if (!xMoved && !zMoved && Math.abs(dx) > 0.001 && Math.abs(dz) > 0.001) {
      const diagX = Math.floor(newX);
      const diagZ = Math.floor(newZ);
      if (diagX >= 0 && diagX < S && diagZ >= 0 && diagZ < S &&
          (!grid || grid.passable[diagZ * S + diagX])) {
        this.px = newX;
        this.py = newZ;
      }
    }

    // Head look — occasionally glance left or right, independent of torso
    this._headLookTimer -= dt;
    if (this._headLookTimer <= 0) {
      const r = Math.random();
      if (r < 0.40) {
        this._headLookTarget = 0;
      } else {
        const side = r < 0.70 ? -1 : 1;
        this._headLookTarget = side * (Math.PI / 8 + Math.random() * Math.PI / 8); // π/8–π/4
      }
      this._headLookTimer = 3 + Math.random() * 5; // 3–8 s between looks
    }
    const hdiff = this._headLookTarget - this.headOffset;
    if (Math.abs(hdiff) < 0.001) {
      this.headOffset = this._headLookTarget;
    } else {
      this.headOffset += Math.sign(hdiff) * Math.min(Math.abs(hdiff), 1.2 * dt);
    }

    this.refresh(chunkRenderer);

    if (this.px < 0)  return 'west';
    if (this.px >= S) return 'east';
    if (this.py < 0)  return 'north';
    if (this.py >= S) return 'south';
    return 'none';
  }

  dispose() {
    disposeMesh(this._scene, this._legMesh);
    disposeMesh(this._scene, this._torsoMesh);
    disposeMesh(this._scene, this._headMesh);
  }
}
