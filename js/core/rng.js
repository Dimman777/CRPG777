// Seeded PRNG — Mulberry32 algorithm.
// Produces deterministic sequences from an integer seed.
//
// Usage:
//   const rng = new RNG(42);
//   rng.next()          → float in [0, 1)
//   rng.nextInt(1, 6)   → integer in [1, 6]
//
// For cosmetic-only randomness (head-look timers, etc.) that doesn't
// need to be reproducible, use Math.random() directly.

export class RNG {
  constructor(seed) {
    this._state = seed >>> 0;
  }

  // Returns a float in [0, 1).
  next() {
    let z = (this._state += 0x6D2B79F5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  }

  // Returns an integer in [min, max] inclusive.
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Returns the current internal state (for save/load).
  get state() { return this._state; }

  // Restore internal state (for save/load).
  set state(s) { this._state = s >>> 0; }
}

// ── Legacy exports (convenience for transition period) ───────────────
// These use a module-level default instance seeded from Date.now().
// Prefer passing an RNG instance through constructors instead.
const _default = new RNG(Date.now());
export function rand()           { return _default.next(); }
export function randInt(min, max) { return _default.nextInt(min, max); }
