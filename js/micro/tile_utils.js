// tile_utils.js — shared passability helpers for the micro layer.
//
// Used by turn_controller.js, follower_manager.js, and micro_world.js.

import { CHUNK_SIZE } from './micro_grid.js';

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
