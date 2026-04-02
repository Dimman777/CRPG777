// World-space noise for chunk generation.
// Uses the same hashVal/noiseAt math as world_gen.js so the functions
// are familiar, but derives a different nSeed to avoid aliasing with
// the macro elevation noise.
//
// All coordinates passed here are WORLD-SPACE (macroX + tx/64), so
// adjacent chunks sample the same continuous field at their borders.

// Replication of world_gen.js hashVal / noiseAt (same math, separate module)
function hashVal(x, y, nSeed) {
  const v = Math.sin(x * 127.1 + y * 311.7 + nSeed * 74.2) * 43758.5453;
  return v - Math.floor(v);
}

function noiseAt(x, y, nSeed, scale) {
  const ix = Math.floor(x / scale);
  const iy = Math.floor(y / scale);
  const fx = ((x % scale) + scale) % scale / scale;
  const fy = ((y % scale) + scale) % scale / scale;
  const a  = hashVal(ix,     iy,     nSeed);
  const b  = hashVal(ix + 1, iy,     nSeed);
  const c  = hashVal(ix,     iy + 1, nSeed);
  const d  = hashVal(ix + 1, iy + 1, nSeed);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a*(1-ux)*(1-uy) + b*ux*(1-uy) + c*(1-ux)*uy + d*ux*uy;
}

// Derive micro noise seed from world seed.
// Uses a different mixing constant so micro and macro noise do not alias.
export function chunkNoiseSeed(worldSeed) {
  return (Math.imul((worldSeed ^ 0xA3C5F9B2) >>> 0, 0x9E3779B9) >>> 0);
}

// Three-octave FBM detail noise at world coordinates.
// Features span 4, 2, and 1 macro cells — always larger than a single chunk,
// so the noise never has a discontinuity within or between chunks.
export function worldDetailNoise(wx, wy, nSeed) {
  return noiseAt(wx, wy, nSeed,        4.0) * 0.50
       + noiseAt(wx, wy, nSeed + 1000, 2.0) * 0.30
       + noiseAt(wx, wy, nSeed + 2000, 1.0) * 0.20;
}

// Sub-chunk micro noise — features at 0.5 and 0.25 macro-cell scale (32–16 tiles).
// Adds within-chunk roughness that worldDetailNoise (scale 1–4) lacks at tile level.
export function worldMicroNoise(wx, wy, nSeed) {
  return noiseAt(wx, wy, nSeed + 3000, 0.50) * 0.55
       + noiseAt(wx, wy, nSeed + 4000, 0.25) * 0.45;
}

// Deterministic per-tile hash for type/variant/obstacle selection.
// `purpose` (0/1/2) offsets the hash so each use is statistically independent.
export function tileHash(wx, wy, nSeed, purpose) {
  return hashVal(
    wx * 64 + purpose * 0.31,
    wy * 64 + purpose * 0.17,
    nSeed + purpose * 3771
  );
}
