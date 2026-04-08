// tile_utils.js — shared passability helpers for the micro layer.
//
// Used by turn_controller.js, follower_manager.js, and micro_world.js.

import { CHUNK_SIZE } from './micro_grid.js';

// Elevation constants — must match chunk_renderer.js ELEVATION_SCALE = 10 and
// chunk_gen.js ELEV_LEVELS = 20 (0.5 m per level in grid.elevation units).
export const ELEVATION_SCALE = 10;   // world metres per elevation unit
// Thresholds are set at the MIDPOINT between level boundaries (not at the boundary
// itself) to avoid Float32Array rounding causing the same N-level height difference
// to be passable from some tile pairs and impassable from others.
// 1 level = 0.5 m.  Midpoints: 0→1 = 0.25 m, 1→2 = 0.75 m, 2→3 = 1.25 m.
export const STEP_IMPASSABLE_M  = 1.25; // height diff > 1.25 m (≥ 3 levels) → cliff, impassable
const STEP_MEDIUM_M      = 0.75; // height diff > 0.75 m (≥ 2 levels) → costs extra
const STEP_SMALL_M       = 0.25; // height diff > 0.25 m (≥ 1 level)  → slight cost

/**
 * Returns true if tile (tx, tz) can be stepped on.
 * Out-of-bounds tiles return true — the caller will trigger a chunk transition.
 */
export function isPassable(tx, tz, grid) {
  if (!grid) return true;
  const S = CHUNK_SIZE;
  if (tx < 0 || tx >= S || tz < 0 || tz >= S) return true;
  return !!grid.passable[tz * S + tx];
}

/**
 * Returns the absolute height difference (world metres) between two in-bounds tiles.
 * Returns 0 if either tile is out of bounds or grid is null.
 */
export function getStepHeightDiff(fromTx, fromTz, toTx, toTz, grid) {
  if (!grid) return 0;
  const S = CHUNK_SIZE;
  if (fromTx < 0 || fromTx >= S || fromTz < 0 || fromTz >= S) return 0;
  if (toTx   < 0 || toTx   >= S || toTz   < 0 || toTz   >= S) return 0;
  return Math.abs(grid.elevation[toTz * S + toTx] - grid.elevation[fromTz * S + fromTx])
         * ELEVATION_SCALE;
}

/**
 * Returns the stamina cost modifier for a height step between two tiles.
 * { cardio: number, fatigue: number } additive to the base movement cost.
 */
export function getHeightStepCost(fromTx, fromTz, toTx, toTz, grid) {
  const diff = getStepHeightDiff(fromTx, fromTz, toTx, toTz, grid);
  if (diff >= STEP_MEDIUM_M) return { cardio: 1.0, fatigue: 1.0 }; // ≥ 2 levels (1.0–1.24 m)
  if (diff >= STEP_SMALL_M)  return { cardio: 0.3, fatigue: 0.3 }; // ≥ 1 level  (0.5–0.99 m)
  return { cardio: 0, fatigue: 0 };
}

/**
 * Returns true if the step from (fromTx, fromTz) to (toTx, toTz) is passable,
 * accounting for both obstacle/water passability AND height limits.
 *
 * Cliff rule: a height difference >= 3 elevation levels (> 1.25 m midpoint) is impassable.
 * Out-of-bounds destinations return true — chunk transition handles them.
 */
export function isStepPassable(fromTx, fromTz, toTx, toTz, grid) {
  if (!isPassable(toTx, toTz, grid)) return false;
  // Out-of-bounds → chunk transition, skip height check
  if (!grid) return true;
  const S = CHUNK_SIZE;
  if (toTx < 0 || toTx >= S || toTz < 0 || toTz >= S) return true;
  if (fromTx < 0 || fromTx >= S || fromTz < 0 || fromTz >= S) return true;
  return getStepHeightDiff(fromTx, fromTz, toTx, toTz, grid) < STEP_IMPASSABLE_M;
}

/**
 * Cross-chunk aware isStepPassable.
 *
 * neighborGrids: object keyed by direction strings like '-1,0', '1,0', '0,-1', '0,1'
 *   mapping to adjacent MicroGrid objects (same format as _collectNeighbors output).
 *
 * When toTx/toTz is in-bounds, delegates to isStepPassable (no change in behaviour).
 * When toTx/toTz is out of bounds, looks up the adjacent chunk grid, then applies
 * the same obstacle and height rules across the chunk border.
 * Returns true if the neighbor grid is not available (allows the chunk transition).
 */
export function isStepPassableCrossChunk(fromTx, fromTz, toTx, toTz, grid, neighborGrids) {
  const S = CHUNK_SIZE;
  // In-bounds destination: normal check
  if (toTx >= 0 && toTx < S && toTz >= 0 && toTz < S) {
    return isStepPassable(fromTx, fromTz, toTx, toTz, grid);
  }
  // Resolve neighbor direction and adjusted tile coords
  let dx = 0, dz = 0, adjTx = toTx, adjTz = toTz;
  if (toTx < 0)  { dx = -1; adjTx = toTx + S; }
  if (toTx >= S) { dx =  1; adjTx = toTx - S; }
  if (toTz < 0)  { dz = -1; adjTz = toTz + S; }
  if (toTz >= S) { dz =  1; adjTz = toTz - S; }
  const nbrGrid = neighborGrids?.[`${dx},${dz}`];
  if (!nbrGrid) return true; // neighbor not loaded — allow the transition
  // Obstacle / water check in neighbor
  if (!nbrGrid.passable[adjTz * S + adjTx]) return false;
  // Height check across the border.
  // Resolve the from-elevation — fromTx/fromTz may themselves be OOB when this
  // is called for the second or third step of a run/sprint whose intermediate
  // tile already crossed into a neighbouring chunk.
  let fromElev;
  if (fromTx < 0 || fromTx >= S || fromTz < 0 || fromTz >= S) {
    let fdx = 0, fdz = 0, fax = fromTx, faz = fromTz;
    if (fromTx < 0)  { fdx = -1; fax = fromTx + S; }
    if (fromTx >= S) { fdx =  1; fax = fromTx - S; }
    if (fromTz < 0)  { fdz = -1; faz = fromTz + S; }
    if (fromTz >= S) { fdz =  1; faz = fromTz - S; }
    const fromNbr = neighborGrids?.[`${fdx},${fdz}`];
    if (!fromNbr) return true; // can't verify height — allow
    fromElev = fromNbr.elevation[faz * S + fax];
  } else {
    if (!grid) return true;
    fromElev = grid.elevation[fromTz * S + fromTx];
  }
  const diff = Math.abs(nbrGrid.elevation[adjTz * S + adjTx] - fromElev) * ELEVATION_SCALE;
  return diff < STEP_IMPASSABLE_M;
}

// Height range for the Climb action — applies to both ascending and descending.
const CLIMB_MIN_M  = 1.0;   // minimum height difference to require a climb
const CLIMB_MAX_M  = 2.5;   // maximum height difference that can be climbed
const CLIMB_EPSILON = 0.02; // float32 rounding guard (~0.4% of one elevation level)

/**
 * Returns true if the player can climb between (fromTx, fromTz) and (toTx, toTz).
 * Works in both directions (ascending and descending).
 * The absolute height difference must be in [CLIMB_MIN_M, CLIMB_MAX_M].
 * Both tiles must be in-bounds and the destination must be passable.
 */
export function isClimbable(fromTx, fromTz, toTx, toTz, grid) {
  if (!grid) return false;
  const S = CHUNK_SIZE;
  if (toTx < 0 || toTx >= S || toTz < 0 || toTz >= S) return false;
  if (fromTx < 0 || fromTx >= S || fromTz < 0 || fromTz >= S) return false;
  if (!grid.passable[toTz * S + toTx]) return false;
  const diff = Math.abs(grid.elevation[toTz * S + toTx] - grid.elevation[fromTz * S + fromTx])
               * ELEVATION_SCALE;
  return diff >= CLIMB_MIN_M - CLIMB_EPSILON && diff <= CLIMB_MAX_M + CLIMB_EPSILON;
}

/**
 * Cross-chunk aware isClimbable.  Returns false when the neighbor grid is absent
 * (can't verify the surface — disallow speculative climbs).
 */
export function isClimbableCrossChunk(fromTx, fromTz, toTx, toTz, grid, neighborGrids) {
  const S = CHUNK_SIZE;
  if (toTx >= 0 && toTx < S && toTz >= 0 && toTz < S) {
    return isClimbable(fromTx, fromTz, toTx, toTz, grid);
  }
  let dx = 0, dz = 0, adjTx = toTx, adjTz = toTz;
  if (toTx < 0)  { dx = -1; adjTx = toTx + S; }
  if (toTx >= S) { dx =  1; adjTx = toTx - S; }
  if (toTz < 0)  { dz = -1; adjTz = toTz + S; }
  if (toTz >= S) { dz =  1; adjTz = toTz - S; }
  const nbrGrid = neighborGrids?.[`${dx},${dz}`];
  if (!nbrGrid) return false; // neighbor not loaded — disallow unverified climb
  if (!nbrGrid.passable[adjTz * S + adjTx]) return false;
  if (!grid) return false;
  if (fromTx < 0 || fromTx >= S || fromTz < 0 || fromTz >= S) return false;
  const diff = Math.abs(nbrGrid.elevation[adjTz * S + adjTx] - grid.elevation[fromTz * S + fromTx])
               * ELEVATION_SCALE;
  return diff >= CLIMB_MIN_M - CLIMB_EPSILON && diff <= CLIMB_MAX_M + CLIMB_EPSILON;
}

/**
 * Returns true if any follower in `followers` (other than `self`) occupies (tx, tz).
 * Pass null for `self` to check against all followers.
 */
export function isOccupied(tx, tz, followers, self = null) {
  for (const f of followers) {
    if (f === self) continue;
    if (Math.floor(f.px) === tx && Math.floor(f.py) === tz) return true;
  }
  return false;
}

/**
 * Returns true if tile (tx, tz) is passable AND not occupied.
 */
export function isFree(tx, tz, grid, followers, self = null) {
  return isPassable(tx, tz, grid) && !isOccupied(tx, tz, followers, self);
}
