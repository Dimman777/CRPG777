// PlayerState — serializable player position, movement, and input state.
// No Three.js dependency.  Consumed by PlayerView for rendering.

import { CHUNK_SIZE } from './micro_grid.js';

const PLAYER_SPEED   = 7;      // tiles per second
const PLAYER_HEIGHT  = 2.0;    // total visual height (legs + torso + head)

export class PlayerState {
  constructor() {
    this.px          = 32.5; // tile-space X
    this.py          = 32.5; // tile-space Z
    this.worldY      = 0;
    this.legAngle    = 0;    // driven by movement (radians)
    this.torsoOffset = 0;    // player-controlled; +/-pi/4 from legAngle
    this.headOffset  = 0;    // always 0 for player; set automatically in followers
    this.headingX    = 0;    // last non-zero movement X — used by follower formation
    this.headingZ    = 1;    // last non-zero movement Z

    this._headLookTarget = 0;
    this._headLookTimer  = Math.random() * 3 + 1.5; // cosmetic, non-deterministic OK

    // Input state — written externally by InputController or game.js
    this._keys = { w: false, a: false, s: false, d: false };

    // Mouse-driven movement — set externally each frame; cleared on mouse-up.
    this._mouseDx          = 0;
    this._mouseDz          = 0;
    this._mouseSpeedFactor = 0;
  }

  // Place at the centre of tile (tx, ty) and snap to terrain elevation.
  place(tx, ty, elevationFn) {
    this.px = tx + 0.5;
    this.py = ty + 0.5;
    this.worldY = elevationFn ? elevationFn(this.px, this.py) + PLAYER_HEIGHT / 2 : 0;
  }

  // Recompute worldY from current position (call after chunk transition).
  refreshElevation(elevationFn) {
    if (elevationFn) this.worldY = elevationFn(this.px, this.py) + PLAYER_HEIGHT / 2;
  }

  // Convenience: accept a ChunkRenderer and extract the elevation function.
  // Used by turn_controller and other game.js code that has a renderer reference.
  refresh(chunkRenderer) {
    if (chunkRenderer) {
      this.worldY = chunkRenderer.elevationAt(this.px, this.py) + PLAYER_HEIGHT / 2;
    }
  }

  get position() { return { x: this.px, y: this.worldY, z: this.py }; }

  keyDown(key) { if (key in this._keys) this._keys[key] = true;  }
  keyUp(key)   { if (key in this._keys) this._keys[key] = false; }

  setMouseMove(dx, dz, speedFactor) {
    this._mouseDx = dx; this._mouseDz = dz; this._mouseSpeedFactor = speedFactor;
  }
  clearMouseMove() {
    this._mouseDx = 0; this._mouseDz = 0; this._mouseSpeedFactor = 0;
  }

  // Z key — toggle torso left (-45 from legs) / back to centre.
  rotateFacingLeft() {
    this.torsoOffset = this.torsoOffset < -0.1 ? 0 : -Math.PI / 4;
  }
  // C key — toggle torso right (+45 from legs) / back to centre.
  rotateFacingRight() {
    this.torsoOffset = this.torsoOffset > 0.1 ? 0 : Math.PI / 4;
  }

  // Move for one frame; returns 'none' | 'north' | 'south' | 'east' | 'west'
  // when the player crosses a chunk boundary.
  // azimuthDeg — camera azimuth so WASD maps to screen directions.
  // grid — MicroGrid (for passability), may be null.
  // elevationFn — (tx, ty) => worldHeight, may be null.
  update(dt, grid, elevationFn, azimuthDeg = 45) {
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

    // Axis-separated collision
    let xMoved = false, zMoved = false;

    if (newX < 0 || newX >= S) {
      this.px = newX; xMoved = true;
    } else {
      const itx = Math.floor(newX);
      const itz = Math.max(0, Math.min(S - 1, Math.floor(this.py)));
      if (!grid || grid.passable[itz * S + itx]) { this.px = newX; xMoved = true; }
    }

    if (newZ < 0 || newZ >= S) {
      this.py = newZ; zMoved = true;
    } else {
      const itx = Math.max(0, Math.min(S - 1, Math.floor(this.px)));
      const itz = Math.floor(newZ);
      if (!grid || grid.passable[itz * S + itx]) { this.py = newZ; zMoved = true; }
    }

    // Diagonal squeeze
    if (!xMoved && !zMoved && Math.abs(dx) > 0.001 && Math.abs(dz) > 0.001) {
      const diagX = Math.floor(newX);
      const diagZ = Math.floor(newZ);
      if (diagX >= 0 && diagX < S && diagZ >= 0 && diagZ < S &&
          (!grid || grid.passable[diagZ * S + diagX])) {
        this.px = newX;
        this.py = newZ;
      }
    }

    // Head look — cosmetic, uses Math.random() intentionally
    this._headLookTimer -= dt;
    if (this._headLookTimer <= 0) {
      const r = Math.random();
      if (r < 0.40) {
        this._headLookTarget = 0;
      } else {
        const side = r < 0.70 ? -1 : 1;
        this._headLookTarget = side * (Math.PI / 8 + Math.random() * Math.PI / 8);
      }
      this._headLookTimer = 3 + Math.random() * 5;
    }
    const hdiff = this._headLookTarget - this.headOffset;
    if (Math.abs(hdiff) < 0.001) {
      this.headOffset = this._headLookTarget;
    } else {
      this.headOffset += Math.sign(hdiff) * Math.min(Math.abs(hdiff), 1.2 * dt);
    }

    // Snap to terrain
    this.refreshElevation(elevationFn);

    if (this.px < 0)  return 'west';
    if (this.px >= S) return 'east';
    if (this.py < 0)  return 'north';
    if (this.py >= S) return 'south';
    return 'none';
  }
}
