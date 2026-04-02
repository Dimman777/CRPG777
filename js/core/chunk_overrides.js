// ChunkOverrides — sparse per-tile patch store for pre-generated maps.
//
// Stores only the tiles that differ from procedural generation.
// Keyed "mx,my" → Map<tileIdx, {ground?, obstacle?, variant?}>
//
// Usage:
//   const ov = new ChunkOverrides();
//   ov.set(10, 5, 32, 16, { ground: GROUND.COBBLESTONE });
//   const patches = ov.getChunk(10, 5);   // Map or null
//   const json    = ov.toJSON();           // for save_load
//   ov.fromJSON(json);

import { CHUNK_SIZE } from '../micro/micro_grid.js';

export class ChunkOverrides {
  constructor() {
    // Map<"mx,my", Map<tileIdx, {ground?,obstacle?,variant?}>>
    this._data = new Map();
  }

  _key(mx, my) { return `${mx},${my}`; }

  // Paint one tile.  patch = { ground?, obstacle?, variant? } — only provided keys are overridden.
  set(mx, my, tx, ty, patch) {
    const k = this._key(mx, my);
    if (!this._data.has(k)) this._data.set(k, new Map());
    const idx      = ty * CHUNK_SIZE + tx;
    const existing = this._data.get(k).get(idx) ?? {};
    this._data.get(k).set(idx, { ...existing, ...patch });
  }

  // Return the patches Map for a chunk, or null if none.
  getChunk(mx, my) {
    return this._data.get(this._key(mx, my)) ?? null;
  }

  // Remove a single tile override — reverts it back to procedural output.
  clearTile(mx, my, tx, ty) {
    const k = this._key(mx, my);
    if (!this._data.has(k)) return;
    this._data.get(k).delete(ty * CHUNK_SIZE + tx);
    if (this._data.get(k).size === 0) this._data.delete(k);
  }

  // Remove all overrides for an entire chunk.
  clearChunk(mx, my) {
    this._data.delete(this._key(mx, my));
  }

  // Returns true if any overrides exist for the given chunk.
  hasChunk(mx, my) {
    const m = this._data.get(this._key(mx, my));
    return m != null && m.size > 0;
  }

  // Total number of overridden tiles across all chunks.
  get totalTiles() {
    let n = 0;
    for (const m of this._data.values()) n += m.size;
    return n;
  }

  // Serialise to a plain object suitable for JSON.stringify.
  toJSON() {
    const out = {};
    for (const [key, patches] of this._data) {
      const obj = {};
      for (const [idx, patch] of patches) obj[idx] = patch;
      out[key] = obj;
    }
    return out;
  }

  // Restore from the output of toJSON().
  fromJSON(json) {
    this._data.clear();
    if (!json || typeof json !== 'object') return;
    for (const [key, obj] of Object.entries(json)) {
      const m = new Map();
      for (const [idx, patch] of Object.entries(obj)) m.set(Number(idx), patch);
      this._data.set(key, m);
    }
  }
}
