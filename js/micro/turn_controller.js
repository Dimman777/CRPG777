// TurnController — manages the toggle between real-time exploration and
// grid-based turn mode.
//
// Turn sequence:
//   PLAYER turn  → player presses WASD once (one tile move) or waits
//   FOLLOWERS    → each follower takes one tile step toward their slot, in order
//   → back to PLAYER turn
//
// All characters snap to tile centres when turn mode is entered.

import { isStepPassableCrossChunk, isClimbableCrossChunk, getHeightStepCost, isOccupied } from './tile_utils.js';
import { CHUNK_SIZE }             from './micro_grid.js';
import { MOVEMENT_STATE }         from './stamina_state.js';
import { getMoveBaseCost, getTerrainCost } from '../data/movement_costs.js';

// ── Run candidates — Chebyshev-2 ring with one intermediate tile each ──────────
// Cardinal / diagonal: mid is the exact midpoint.
// In-between: mid is on the primary axis (the larger of |dx|,|dz|).
const RUN_CANDIDATES = [
  // Cardinal (4)
  { dx: 0, dz:-2, mx: 0, mz:-1 },
  { dx: 0, dz: 2, mx: 0, mz: 1 },
  { dx: 2, dz: 0, mx: 1, mz: 0 },
  { dx:-2, dz: 0, mx:-1, mz: 0 },
  // Diagonal (4)
  { dx: 2, dz:-2, mx: 1, mz:-1 },
  { dx: 2, dz: 2, mx: 1, mz: 1 },
  { dx:-2, dz:-2, mx:-1, mz:-1 },
  { dx:-2, dz: 2, mx:-1, mz: 1 },
  // In-between (8) — primary-axis intermediate
  { dx: 1, dz:-2, mx: 0, mz:-1 },
  { dx:-1, dz:-2, mx: 0, mz:-1 },
  { dx: 1, dz: 2, mx: 0, mz: 1 },
  { dx:-1, dz: 2, mx: 0, mz: 1 },
  { dx: 2, dz:-1, mx: 1, mz: 0 },
  { dx: 2, dz: 1, mx: 1, mz: 0 },
  { dx:-2, dz:-1, mx:-1, mz: 0 },
  { dx:-2, dz: 1, mx:-1, mz: 0 },
];

// ── Sprint candidates — Chebyshev-3 ring with two intermediate tiles each ──────
// Cone: ±30° (narrower than Run's ±45°).
// Each entry: { dx, dz, mx1, mz1, mx2, mz2 }
const SPRINT_CANDIDATES = [
  // Cardinal — straight 3-tile
  { dx: 0, dz:-3, mx1: 0, mz1:-1, mx2: 0, mz2:-2 },
  { dx: 0, dz: 3, mx1: 0, mz1: 1, mx2: 0, mz2: 2 },
  { dx: 3, dz: 0, mx1: 1, mz1: 0, mx2: 2, mz2: 0 },
  { dx:-3, dz: 0, mx1:-1, mz1: 0, mx2:-2, mz2: 0 },
  // Diagonal — 3 diagonal steps
  { dx: 3, dz:-3, mx1: 1, mz1:-1, mx2: 2, mz2:-2 },
  { dx:-3, dz:-3, mx1:-1, mz1:-1, mx2:-2, mz2:-2 },
  { dx: 3, dz: 3, mx1: 1, mz1: 1, mx2: 2, mz2: 2 },
  { dx:-3, dz: 3, mx1:-1, mz1: 1, mx2:-2, mz2: 2 },
  // 1-off cardinal (~18.4° from cardinal) — within ±30° cone
  { dx: 1, dz:-3, mx1: 0, mz1:-1, mx2: 1, mz2:-2 },
  { dx:-1, dz:-3, mx1: 0, mz1:-1, mx2:-1, mz2:-2 },
  { dx: 1, dz: 3, mx1: 0, mz1: 1, mx2: 1, mz2: 2 },
  { dx:-1, dz: 3, mx1: 0, mz1: 1, mx2:-1, mz2: 2 },
  { dx: 3, dz:-1, mx1: 1, mz1: 0, mx2: 2, mz2:-1 },
  { dx: 3, dz: 1, mx1: 1, mz1: 0, mx2: 2, mz2: 1 },
  { dx:-3, dz:-1, mx1:-1, mz1: 0, mx2:-2, mz2:-1 },
  { dx:-3, dz: 1, mx1:-1, mz1: 0, mx2:-2, mz2: 1 },
  // 1-off diagonal (~18.4° from diagonal) — within ±30° cone
  { dx: 2, dz:-3, mx1: 1, mz1:-1, mx2: 2, mz2:-2 },
  { dx: 3, dz:-2, mx1: 1, mz1:-1, mx2: 2, mz2:-2 },
  { dx:-2, dz:-3, mx1:-1, mz1:-1, mx2:-2, mz2:-2 },
  { dx:-3, dz:-2, mx1:-1, mz1:-1, mx2:-2, mz2:-2 },
  { dx: 2, dz: 3, mx1: 1, mz1: 1, mx2: 2, mz2: 2 },
  { dx: 3, dz: 2, mx1: 1, mz1: 1, mx2: 2, mz2: 2 },
  { dx:-2, dz: 3, mx1:-1, mz1: 1, mx2:-2, mz2: 2 },
  { dx:-3, dz: 2, mx1:-1, mz1: 1, mx2:-2, mz2: 2 },
];

export const TURN_STATE = Object.freeze({
  REALTIME:  'realtime',
  PLAYER:    'player',    // waiting for a single WASD input from the player
  FOLLOWERS: 'followers', // followers moving one at a time with a short delay
});

const FOLLOWER_STEP_DELAY = 0.30; // seconds between each follower's move

export class TurnController {
  constructor() {
    this._state              = TURN_STATE.REALTIME;
    this._followerIdx        = 0;
    this._stepTimer          = 0;
    this._roundNumber        = 1;
    this._playerRanLastTurn  = false; // momentum flag — restricts action choices next turn
    this.onStateChange       = null;  // () => void — called on every state transition
    // Optional override: (followerIdx, player, grid) => void.
    // When set, TurnController delegates follower movement to the caller
    // instead of using its built-in simple logic.
    this.onFollowerTurn      = null;
  }

  get isActive()           { return this._state !== TURN_STATE.REALTIME; }
  get state()              { return this._state; }
  get followerIndex()      { return this._followerIdx; }
  get roundNumber()        { return this._roundNumber; }
  get playerRanLastTurn()  { return this._playerRanLastTurn; }

  // ── Public API ────────────────────────────────────────────────────────────

  // Toggle turn mode on / off.  Snaps all characters to tile centres on entry.
  toggle(player, followers, chunkRenderer) {
    if (!this.isActive) {
      this._enter(player, followers, chunkRenderer);
    } else {
      this._exit();
    }
  }

  // Called by Game when WASD is pressed during the player's turn.
  // dx / dz are the raw camera-relative direction components; this method
  // rounds them to the nearest integer tile step.
  // followers — current follower list, used for character collision.
  // Returns true if the move was accepted.
  playerMove(dx, dz, player, grid, chunkRenderer, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;

    const sx = Math.round(dx);
    const sz = Math.round(dz);
    if (sx === 0 && sz === 0) return false;

    const tileX = Math.floor(player.px);
    const tileZ = Math.floor(player.py);
    const tx = tileX + sx;
    const tz = tileZ + sz;

    const fromX = Math.floor(player.px), fromZ = Math.floor(player.py);
    if (!isStepPassableCrossChunk(fromX, fromZ, tx, tz, grid, neighborGrids)) return false;
    // Block movement into a tile occupied by any follower
    if (followers.some(f => Math.floor(f.px) === tx && Math.floor(f.py) === tz)) return false;

    // Move player
    player.px = tx + 0.5;
    player.py = tz + 0.5;
    const len = Math.hypot(sx, sz);
    player.legAngle = Math.atan2(sx / len, sz / len);
    player.headingX = sx / len;
    player.headingZ = sz / len;
    player.refresh(chunkRenderer);

    if (player.staminaState) {
      const base    = getMoveBaseCost('move');
      const tileIdx = tz * CHUNK_SIZE + tx;
      const terrain = getTerrainCost(grid?.ground?.[tileIdx]);
      const height  = getHeightStepCost(fromX, fromZ, tx, tz, grid);
      player.staminaState.applyMoveCost(
        base.cardio  + terrain.cardio  + height.cardio,
        base.fatigue + terrain.fatigue + height.fatigue,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.MOVE);
    }

    this._playerRanLastTurn = false; // a 1-tile move breaks any momentum
    this._beginFollowerTurns();
    return true;
  }

  // Returns the single tile directly ahead of the player if it is climbable (1.0–2.5 m higher).
  // Restricted to the faced tile so the click handler doesn't need to hit-test a cliff face.
  // Each entry: { tx, tz }.  Pure query — no state changes.
  getClimbTargets(player, grid, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return [];
    const ptx = Math.floor(player.px);
    const ptz = Math.floor(player.py);
    const sx  = Math.round(Math.sin(player.legAngle));
    const sz  = Math.round(Math.cos(player.legAngle));
    if (sx === 0 && sz === 0) return [];
    const tx = ptx + sx, tz = ptz + sz;
    if (!isClimbableCrossChunk(ptx, ptz, tx, tz, grid, neighborGrids)) return [];
    if (followers.some(f => Math.floor(f.px) === tx && Math.floor(f.py) === tz)) return [];
    return [{ tx, tz }];
  }

  // Move the player to a climbable tile — must be in getClimbTargets().
  playerClimbTo(player, grid, chunkRenderer, tx, tz, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;
    const targets = this.getClimbTargets(player, grid, followers, neighborGrids);
    if (!targets.find(t => t.tx === tx && t.tz === tz)) return false;
    const fromX = Math.floor(player.px), fromZ = Math.floor(player.py);
    player.px = tx + 0.5;
    player.py = tz + 0.5;
    const rdx = tx - fromX, rdz = tz - fromZ;
    const rlen = Math.hypot(rdx, rdz);
    if (rlen > 0) {
      player.legAngle = Math.atan2(rdx / rlen, rdz / rlen);
      player.headingX = rdx / rlen;
      player.headingZ = rdz / rlen;
    }
    player.refresh(chunkRenderer);
    if (player.staminaState) {
      const base    = getMoveBaseCost('climb');
      const tileIdx = tz * CHUNK_SIZE + tx;
      const terrain = getTerrainCost(grid?.ground?.[tileIdx]);
      player.staminaState.applyMoveCost(
        base.cardio  + terrain.cardio,
        base.fatigue + terrain.fatigue,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.MOVE);
    }
    this._playerRanLastTurn = false; // climbing breaks running momentum
    this._beginFollowerTurns();
    return true;
  }

  // Returns tiles at 2 and 3 steps forward for a gradual stop (momentum deceleration).
  // Stops building the list as soon as a tile in the path is blocked.
  // Each entry: { tx, tz, dist }.
  getStopGradualTiles(player, grid, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return [];
    const stepX = Math.round(Math.sin(player.legAngle));
    const stepZ = Math.round(Math.cos(player.legAngle));
    if (stepX === 0 && stepZ === 0) return [];
    const results = [];
    let prevX = Math.floor(player.px), prevZ = Math.floor(player.py);
    for (let dist = 1; dist <= 3; dist++) {
      const tx = Math.floor(player.px) + stepX * dist;
      const tz = Math.floor(player.py) + stepZ * dist;
      if (!isStepPassableCrossChunk(prevX, prevZ, tx, tz, grid, neighborGrids)) break;
      if (followers.some(f => Math.floor(f.px) === tx && Math.floor(f.py) === tz)) break;
      if (dist >= 2) results.push({ tx, tz, dist });
      prevX = tx; prevZ = tz;
    }
    return results;
  }

  // Move the player to a gradual-stop tile (dist 2 or 3) from getStopGradualTiles().
  // Applies stop stamina cost proportional to distance and ends the player's turn.
  playerStopTo(player, grid, chunkRenderer, tx, tz, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;
    const tiles = this.getStopGradualTiles(player, grid, followers, neighborGrids);
    const tile  = tiles.find(t => t.tx === tx && t.tz === tz);
    if (!tile) return false;
    const fromX = Math.floor(player.px), fromZ = Math.floor(player.py);
    player.px = tx + 0.5;
    player.py = tz + 0.5;
    const rdx = tx - fromX, rdz = tz - fromZ;
    const rlen = Math.hypot(rdx, rdz);
    if (rlen > 0) {
      player.legAngle = Math.atan2(rdx / rlen, rdz / rlen);
      player.headingX = rdx / rlen;
      player.headingZ = rdz / rlen;
    }
    player.refresh(chunkRenderer);
    if (player.staminaState) {
      const base = getMoveBaseCost('stop');
      player.staminaState.applyMoveCost(
        base.cardio  * tile.dist,
        base.fatigue * tile.dist,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.STOP);
    }
    this._playerRanLastTurn = false;
    this._beginFollowerTurns();
    return true;
  }

  // Run the player to a specific tile (tx, tz) — must be in the current getRunTargets() set.
  // Returns true if the run was executed.
  playerRunTo(player, grid, chunkRenderer, tx, tz, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;
    const targets = this.getRunTargets(player, grid, followers, neighborGrids);
    const target  = targets.find(t => t.tx === tx && t.tz === tz);
    if (!target) return false;
    const fromX = Math.floor(player.px);
    const fromZ = Math.floor(player.py);
    player.px = tx + 0.5;
    player.py = tz + 0.5;
    const rdx = tx - fromX, rdz = tz - fromZ;
    const rlen = Math.hypot(rdx, rdz);
    if (rlen > 0) {
      player.legAngle = Math.atan2(rdx / rlen, rdz / rlen);
      player.headingX = rdx / rlen;
      player.headingZ = rdz / rlen;
    }
    player.refresh(chunkRenderer);

    if (player.staminaState) {
      const base   = getMoveBaseCost('run');
      const midIdx = target.midZ * CHUNK_SIZE + target.midX;
      const dstIdx = tz          * CHUNK_SIZE + tx;
      const midT   = getTerrainCost(grid?.ground?.[midIdx]);
      const dstT   = getTerrainCost(grid?.ground?.[dstIdx]);
      const midH   = getHeightStepCost(fromX,         fromZ,         target.midX, target.midZ, grid);
      const dstH   = getHeightStepCost(target.midX, target.midZ, tx, tz, grid);
      player.staminaState.applyMoveCost(
        base.cardio  + midT.cardio  + dstT.cardio  + midH.cardio  + dstH.cardio,
        base.fatigue + midT.fatigue + dstT.fatigue + midH.fatigue + dstH.fatigue,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.RUN);
    }

    this._playerRanLastTurn = true;
    this._beginFollowerTurns();
    return true;
  }

  // Returns all passable run destinations within ±45° of the player's current facing.
  // Each entry: { midX, midZ, tx, tz }.  Pure query — no state changes.
  getRunTargets(player, grid, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return [];
    const faceDX  = Math.sin(player.legAngle);
    const faceDZ  = Math.cos(player.legAngle);
    const ptx     = Math.floor(player.px);
    const ptz     = Math.floor(player.py);
    const minDot  = Math.cos(Math.PI / 4) - 0.001; // ±45° arc threshold
    const results = [];

    for (const c of RUN_CANDIDATES) {
      const len = Math.hypot(c.dx, c.dz);
      const dot = (c.dx / len) * faceDX + (c.dz / len) * faceDZ;
      if (dot < minDot) continue;

      const midX = ptx + c.mx, midZ = ptz + c.mz;
      const dstX = ptx + c.dx, dstZ = ptz + c.dz;
      if (!isStepPassableCrossChunk(ptx,  ptz,  midX, midZ, grid, neighborGrids)) continue;
      if (!isStepPassableCrossChunk(midX, midZ, dstX, dstZ, grid, neighborGrids)) continue;
      if (followers.some(f => {
        const fx = Math.floor(f.px), fz = Math.floor(f.py);
        return (fx === midX && fz === midZ) || (fx === dstX && fz === dstZ);
      })) continue;

      results.push({ midX, midZ, tx: dstX, tz: dstZ });
    }
    return results;
  }

  // Returns all passable sprint destinations within ±30° of the player's current facing.
  // Each entry: { mid1X, mid1Z, mid2X, mid2Z, tx, tz }.  Pure query.
  getSprintTargets(player, grid, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return [];
    const faceDX = Math.sin(player.legAngle);
    const faceDZ = Math.cos(player.legAngle);
    const ptx    = Math.floor(player.px);
    const ptz    = Math.floor(player.py);
    const minDot = Math.cos(Math.PI / 6) - 0.001; // ±30° arc threshold
    const results = [];

    for (const c of SPRINT_CANDIDATES) {
      const len = Math.hypot(c.dx, c.dz);
      const dot = (c.dx / len) * faceDX + (c.dz / len) * faceDZ;
      if (dot < minDot) continue;

      const m1x = ptx + c.mx1, m1z = ptz + c.mz1;
      const m2x = ptx + c.mx2, m2z = ptz + c.mz2;
      const dstX = ptx + c.dx, dstZ = ptz + c.dz;
      if (!isStepPassableCrossChunk(ptx, ptz, m1x, m1z, grid, neighborGrids)) continue;
      if (!isStepPassableCrossChunk(m1x, m1z, m2x, m2z, grid, neighborGrids)) continue;
      if (!isStepPassableCrossChunk(m2x, m2z, dstX, dstZ, grid, neighborGrids)) continue;
      if (followers.some(f => {
        const fx = Math.floor(f.px), fz = Math.floor(f.py);
        return (fx === m1x && fz === m1z) || (fx === m2x && fz === m2z)
            || (fx === dstX && fz === dstZ);
      })) continue;

      results.push({ mid1X: m1x, mid1Z: m1z, mid2X: m2x, mid2Z: m2z, tx: dstX, tz: dstZ });
    }
    return results;
  }

  // Sprint the player to a specific tile — must be in the current getSprintTargets() set.
  playerSprintTo(player, grid, chunkRenderer, tx, tz, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;
    const targets = this.getSprintTargets(player, grid, followers, neighborGrids);
    const target  = targets.find(t => t.tx === tx && t.tz === tz);
    if (!target) return false;
    const fromX = Math.floor(player.px), fromZ = Math.floor(player.py);
    player.px = tx + 0.5;
    player.py = tz + 0.5;
    const rdx = tx - fromX, rdz = tz - fromZ;
    const rlen = Math.hypot(rdx, rdz);
    if (rlen > 0) {
      player.legAngle = Math.atan2(rdx / rlen, rdz / rlen);
      player.headingX = rdx / rlen;
      player.headingZ = rdz / rlen;
    }
    player.refresh(chunkRenderer);

    if (player.staminaState) {
      const base = getMoveBaseCost('sprint');
      const m1idx = target.mid1Z * CHUNK_SIZE + target.mid1X;
      const m2idx = target.mid2Z * CHUNK_SIZE + target.mid2X;
      const dstIdx = tz          * CHUNK_SIZE + tx;
      const m1T = getTerrainCost(grid?.ground?.[m1idx]);
      const m2T = getTerrainCost(grid?.ground?.[m2idx]);
      const dstT = getTerrainCost(grid?.ground?.[dstIdx]);
      const m1H = getHeightStepCost(fromX,         fromZ,         target.mid1X, target.mid1Z, grid);
      const m2H = getHeightStepCost(target.mid1X, target.mid1Z, target.mid2X, target.mid2Z, grid);
      const dH  = getHeightStepCost(target.mid2X, target.mid2Z, tx, tz, grid);
      player.staminaState.applyMoveCost(
        base.cardio  + m1T.cardio  + m2T.cardio  + dstT.cardio  + m1H.cardio  + m2H.cardio  + dH.cardio,
        base.fatigue + m1T.fatigue + m2T.fatigue + dstT.fatigue + m1H.fatigue + m2H.fatigue + dH.fatigue,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.SPRINT);
    }

    this._playerRanLastTurn = true;
    this._beginFollowerTurns();
    return true;
  }

  // Best sprint target in current facing direction (convenience wrapper).
  getSprintTarget(player, grid, followers = [], neighborGrids = null) {
    const all = this.getSprintTargets(player, grid, followers, neighborGrids);
    if (!all.length) return null;
    const faceDX = Math.sin(player.legAngle), faceDZ = Math.cos(player.legAngle);
    let best = all[0], bestDot = -Infinity;
    for (const t of all) {
      const dx = t.tx - Math.floor(player.px), dz = t.tz - Math.floor(player.py);
      const len = Math.hypot(dx, dz);
      const dot = (dx / len) * faceDX + (dz / len) * faceDZ;
      if (dot > bestDot) { bestDot = dot; best = t; }
    }
    return best;
  }

  // Single-best convenience wrapper (used by stop-highlight and follower AI).
  getRunTarget(player, grid, followers = [], neighborGrids = null) {
    const all = this.getRunTargets(player, grid, followers, neighborGrids);
    if (!all.length) return null;
    const faceDX = Math.sin(player.legAngle);
    const faceDZ = Math.cos(player.legAngle);
    let best = all[0], bestDot = -Infinity;
    for (const t of all) {
      const dx = t.tx - Math.floor(player.px), dz = t.tz - Math.floor(player.py);
      const len = Math.hypot(dx, dz);
      const dot = (dx / len) * faceDX + (dz / len) * faceDZ;
      if (dot > bestDot) { bestDot = dot; best = t; }
    }
    return best;
  }

  // Move the player 2 tiles forward in their current leg-facing direction.
  // Facing is preserved — this represents a sprint, not a pivot.
  // Returns true if the run was executed.
  playerRun(player, grid, chunkRenderer, followers = [], neighborGrids = null) {
    if (this._state !== TURN_STATE.PLAYER) return false;
    const target = this.getRunTarget(player, grid, followers, neighborGrids);
    if (!target) return false;
    const fromX = Math.floor(player.px);
    const fromZ = Math.floor(player.py);
    player.px = target.tx + 0.5;
    player.py = target.tz + 0.5;
    // Update facing to match actual movement direction (matters for in-between tiles).
    const rdx = target.tx - fromX, rdz = target.tz - fromZ;
    const rlen = Math.hypot(rdx, rdz);
    if (rlen > 0) {
      player.legAngle = Math.atan2(rdx / rlen, rdz / rlen);
      player.headingX = rdx / rlen;
      player.headingZ = rdz / rlen;
    }
    player.refresh(chunkRenderer);

    if (player.staminaState) {
      const base   = getMoveBaseCost('run');
      const midIdx = target.midZ * CHUNK_SIZE + target.midX;
      const dstIdx = target.tz   * CHUNK_SIZE + target.tx;
      const midT   = getTerrainCost(grid?.ground?.[midIdx]);
      const dstT   = getTerrainCost(grid?.ground?.[dstIdx]);
      const midH   = getHeightStepCost(fromX, fromZ, target.midX, target.midZ, grid);
      const dstH   = getHeightStepCost(target.midX, target.midZ, target.tx, target.tz, grid);
      player.staminaState.applyMoveCost(
        base.cardio  + midT.cardio  + dstT.cardio  + midH.cardio  + dstH.cardio,
        base.fatigue + midT.fatigue + dstT.fatigue + midH.fatigue + dstH.fatigue,
      );
      player.staminaState.setMovementState(MOVEMENT_STATE.RUN);
    }

    this._playerRanLastTurn = true; // running builds momentum
    this._beginFollowerTurns();
    return true;
  }

  // Skip the current turn-taker without moving.
  // followerCount is required when skipping a follower to detect end-of-round.
  pass(followerCount = 0, player = null) {
    if (this._state === TURN_STATE.PLAYER) {
      player?.staminaState?.setMovementState(MOVEMENT_STATE.REST);
      this._playerRanLastTurn = false; // stopping breaks momentum
      this._beginFollowerTurns();
    } else if (this._state === TURN_STATE.FOLLOWERS) {
      this._followerIdx++;
      if (this._followerIdx >= followerCount) {
        this._completeTurn();
      } else {
        this._stepTimer = 0; // fire on the very next tick
        this._notify();
      }
    }
  }

  // Call once per frame while turn mode is active.
  // Advances follower turns with a timed delay between each one.
  tick(dt, followers, player, grid, chunkRenderer, neighborGrids = null) {
    if (this._state !== TURN_STATE.FOLLOWERS) return;

    this._stepTimer -= dt;
    if (this._stepTimer > 0) return;

    if (followers.length === 0 || this._followerIdx >= followers.length) {
      this._completeTurn();
      return;
    }

    let moved;
    if (this.onFollowerTurn) {
      moved = this.onFollowerTurn(this._followerIdx, player, grid, neighborGrids);
    } else {
      moved = this._moveFollower(followers[this._followerIdx], player, grid, followers);
    }
    this._followerIdx++;
    // If the follower didn't (or couldn't) move, use a shorter delay before the next one
    this._stepTimer = moved ? FOLLOWER_STEP_DELAY : FOLLOWER_STEP_DELAY * 0.25;
    this._notify();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _enter(player, followers, chunkRenderer) {
    this._snapToTile(player);
    player.refresh(chunkRenderer);
    for (const f of followers) this._snapToTile(f);

    this._state       = TURN_STATE.PLAYER;
    this._roundNumber = 1;
    this._notify();
  }

  _exit() {
    this._state             = TURN_STATE.REALTIME;
    this._playerRanLastTurn = false;
    this._notify();
  }

  _beginFollowerTurns() {
    this._state       = TURN_STATE.FOLLOWERS;
    this._followerIdx = 0;
    this._stepTimer   = FOLLOWER_STEP_DELAY * 0.5; // brief pause before first follower moves
    this._notify();
  }

  _completeTurn() {
    this._roundNumber++;
    this._state       = TURN_STATE.PLAYER;
    this._followerIdx = 0;
    this._notify();
  }

  // Simple formation-following: move one tile toward the player if not adjacent.
  _moveFollower(f, player, grid, allFollowers) {
    const fTileX = Math.floor(f.px);
    const fTileZ = Math.floor(f.py);
    const pTileX = Math.floor(player.px);
    const pTileZ = Math.floor(player.py);

    const rawDx = pTileX - fTileX;
    const rawDz = pTileZ - fTileZ;
    if (Math.hypot(rawDx, rawDz) < 1.5) return; // already adjacent — no move needed

    const sx = rawDx === 0 ? 0 : (rawDx > 0 ? 1 : -1);
    const sz = rawDz === 0 ? 0 : (rawDz > 0 ? 1 : -1);

    // Prefer diagonal, then cardinal X, then cardinal Z
    const candidates = [];
    if (sx !== 0 && sz !== 0) candidates.push([sx, sz]);
    if (sx !== 0)             candidates.push([sx, 0]);
    if (sz !== 0)             candidates.push([0, sz]);

    for (const [cx, cz] of candidates) {
      const tx = fTileX + cx, tz = fTileZ + cz;
      if (!isStepPassableCrossChunk(fTileX, fTileZ, tx, tz, grid, null)) continue;
      if (tx === pTileX && tz === pTileZ)                 continue; // don't stand on player
      if (isOccupied(tx, tz, allFollowers, f))            continue;

      f.px = tx + 0.5;
      f.py = tz + 0.5;
      const len = Math.hypot(cx, cz);
      f.legAngle = Math.atan2(cx / len, cz / len);
      f.headingX = cx / len;
      f.headingZ = cz / len;
      if (f.staminaState) {
        const tIdx    = tz * CHUNK_SIZE + tx;
        const terrain = getTerrainCost(grid?.ground?.[tIdx]);
        const base    = getMoveBaseCost('move');
        const height  = getHeightStepCost(fTileX, fTileZ, tx, tz, grid);
        f.staminaState.applyMoveCost(
          base.cardio  + terrain.cardio  + height.cardio,
          base.fatigue + terrain.fatigue + height.fatigue,
        );
      }
      return true;
    }
    return false; // blocked / already adjacent
  }

  _snapToTile(entity) {
    entity.px = Math.floor(entity.px) + 0.5;
    entity.py = Math.floor(entity.py) + 0.5;
  }

  _notify() {
    if (this.onStateChange) this.onStateChange();
  }
}
