// ChunkGenerator — builds a 64×64 MicroGrid from one MacroCell and its neighbours.
//
// Usage:
//   const gen  = new ChunkGenerator(worldSeed);
//   const grid = gen.generate(macroMap, macroX, macroY);
//
// Design notes:
//   • Elevation is seamless across chunk borders because all noise is sampled
//     in world-space coordinates (macroX + tx/64), not chunk-local coords.
//   • The macro terrain-rank gradient is blended 70/30 with detail noise.
//   • Ground type and obstacle are chosen by per-tile hashes — no RNG stream.
//   • Border tiles (edge ring, 1 tile wide) are kept obstacle-free so that
//     chunk transitions never have abrupt wall-to-wall obstacle lines.

import { CHUNK_SIZE, MicroGrid }                            from './micro_grid.js';
import { chunkNoiseSeed, worldDetailNoise, worldMicroNoise, tileHash } from './chunk_noise.js';
import { TERRAIN_RANK, GROUND, OBSTACLE,
         OBSTACLE_BLOCKS,
         getGroundPalette, getObstacleRule,
         getStampRule }                             from '../data/micro_tile_data.js';
import { SettlementGen }                            from './settlement_gen.js';

// ---- Unit vectors for each slope direction ----------------------------------
// Used to project tile position onto the slope axis for intrinsic-tilt elevation.
const SLOPE_VECS = {
  E:   [ 1,      0     ], W:  [-1,      0     ],
  N:   [ 0,     -1     ], S:  [ 0,      1     ],
  NE:  [ 0.707, -0.707 ], NW: [-0.707, -0.707 ],
  SE:  [ 0.707,  0.707 ], SW: [-0.707,  0.707 ],
  flat:[ 0,      0     ],
};

// How much elevation change (0→1 scale) is added by intrinsic tilt across
// the full chunk width.  0 = no intrinsic tilt, 0.45 = very steep.
const INTRINSIC_AMP = {
  hills:         0.10,
  mountain:      0.16,
  steep_mountain:0.22,
  peak:          0.14,
};

// River tile flags stored in grid.river[]
const RIVER_BED    = 1;
const RIVER_BANK   = 2;
const RIVER_RAPIDS = 3;

// ---- Slope direction from a 2D rank gradient --------------------------------
const OCTANT_DIRS = [
  { name: 'E',  minA: -22.5,  maxA:  22.5 },
  { name: 'NE', minA: -67.5,  maxA: -22.5 },
  { name: 'N',  minA: -112.5, maxA: -67.5 },
  { name: 'NW', minA: -157.5, maxA: -112.5},
  { name: 'SW', minA:  112.5, maxA:  157.5},
  { name: 'S',  minA:   67.5, maxA:  112.5},
  { name: 'SE', minA:   22.5, maxA:   67.5},
];

function angleToOctant(deg) {
  for (const d of OCTANT_DIRS) {
    if (deg >= d.minA && deg < d.maxA) return d.name;
  }
  return 'W'; // covers ±157.5–180
}

function rankOf(cell) {
  return (cell ? TERRAIN_RANK[cell.terrain] : null) ?? TERRAIN_RANK.flat;
}

// Terrain height quantisation — continuous elevation snapped to discrete steps.
// With ELEVATION_SCALE=10 (chunk_renderer), each level = 0.5 world units:
//   1 level difference = 0.5 wu (step onto)
//   2 levels           = 1.0 wu (easy climb)
//   3 levels           = 1.5 wu (athletic climb)
//   4+ levels          = 2.0+ wu (professional / wall)
export const ELEV_LEVELS = 20;

// ---- ChunkGenerator ---------------------------------------------------------
export class ChunkGenerator {
  constructor(worldSeed) {
    this._nSeed = chunkNoiseSeed(worldSeed >>> 0);
    // Keyed "mx,my:exitBit" → min river-bed elevation at that chunk edge.
    // Populated after each chunk is built; consumed by downstream chunks.
    this._riverEdgeElevCache = new Map();
  }

  generate(macroMap, mx, my, overrides = null) {
    const cell = macroMap.get(mx, my);
    if (!cell) return null;

    // Collect 8 neighbours (null at map boundary)
    const nbr = {};
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        nbr[`${dx},${dy}`] = macroMap.get(mx + dx, my + dy);
      }
    }

    const grid = new MicroGrid(mx, my);
    this._computeSlope(grid, cell, nbr);

    if (cell.settlementType && cell.settlementType !== 'ruins') {
      this._buildSettlementChunk(grid, cell, nbr);
    } else if (cell.isFarmland) {
      this._buildFarmlandChunk(grid, cell, nbr);
    } else if (cell.isDock) {
      this._buildDockChunk(grid, cell, nbr);
    } else {
      this._buildElevation(grid, cell, nbr);
      this._buildRiver(grid, cell, nbr);
      this._classifyGround(grid, cell, nbr);
      this._placeObstacles(grid, cell, nbr);
      this._placeStamps2x2(grid, cell);
    }

    this._buildPassability(grid);

    // Apply per-tile overrides on top of procedural output.
    if (overrides) {
      const patches = overrides.getChunk(mx, my);
      if (patches) {
        let needsPassability = false;
        for (const [idx, patch] of patches) {
          if (patch.ground     !== undefined) grid.ground[idx]     = patch.ground;
          if (patch.obstacle   !== undefined) { grid.obstacle[idx] = patch.obstacle; needsPassability = true; }
          if (patch.variant    !== undefined) grid.variant[idx]    = patch.variant;
          if (patch.elevation  !== undefined) grid.elevation[idx]  = patch.elevation;
        }
        if (needsPassability) this._buildPassability(grid);
      }
    }

    return grid;
  }

  // --------------------------------------------------------------------------
  // Slope direction (stored on grid for render/combat, also used in elevation)
  // --------------------------------------------------------------------------
  _computeSlope(grid, cell, nbr) {
    const cr  = rankOf(cell);
    const rN  = rankOf(nbr['0,-1'])  ?? cr;
    const rS  = rankOf(nbr['0,1'])   ?? cr;
    const rE  = rankOf(nbr['1,0'])   ?? cr;
    const rW  = rankOf(nbr['-1,0'])  ?? cr;
    const dx  = rE - rW;  // positive → east is higher
    const dy  = rS - rN;  // positive → south is higher
    const mag = Math.sqrt(dx * dx + dy * dy);
    grid.slopeMag = mag;
    if (mag < 0.5) { grid.slopeDir = 'flat'; return; }
    // atan2 in standard math coords (right=0°, down=+90°)
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    grid.slopeDir = angleToOctant(deg);
  }

  // --------------------------------------------------------------------------
  // Elevation — seamless bilinear macro gradient + world-space detail noise
  // --------------------------------------------------------------------------
  _buildElevation(grid, cell, nbr) {
    const S     = CHUNK_SIZE;
    const nSeed = this._nSeed;

    // Macro-scale noise amplitude (worldDetailNoise, features 1–4 cells wide)
    const noiseAmp = {
      ocean: 0.01, shallow_shore: 0.03, steep_shore: 0.03,
      flat: 0.12, hills: 0.22, mountain: 0.32,
      steep_mountain: 0.40, peak: 0.42,
    }[cell.terrain] ?? 0.08;

    // Micro-scale noise amplitude (worldMicroNoise, features 16–32 tiles wide)
    // Drives the rolling undulations visible within a single chunk.
    const microAmp = {
      flat: 0.08, hills: 0.20, mountain: 0.32,
      steep_mountain: 0.40, peak: 0.35,
    }[cell.terrain] ?? 0.04;

    // Intrinsic directional tilt — hills/mountains slope throughout the cell,
    // not only at terrain-type transitions.
    const intrinsicAmp = INTRINSIC_AMP[cell.terrain] ?? 0;

    // Slope vector: use the computed macro-rank direction, or derive a
    // per-cell hash direction when the macro gradient is flat (same terrain
    // type on all sides) so the terrain still rolls meaningfully.
    let svx, svy;
    if (grid.slopeDir !== 'flat') {
      [svx, svy] = SLOPE_VECS[grid.slopeDir];
    } else if (intrinsicAmp > 0) {
      // Stable direction from cell position hash
      const ang = tileHash(grid.macroX + 0.5, grid.macroY + 0.5, nSeed, 5) * Math.PI * 2;
      svx = Math.cos(ang);
      svy = Math.sin(ang);
    } else {
      svx = svy = 0;
    }

    // 4 corner elevations — each corner is the average of the 4 sharing macro
    // cells' raw elevation floats (0→1).  Using cell.elevation directly keeps
    // the 3D gradient in sync with the h: value shown in the location panel so
    // that h:47 always looks taller than h:46.
    // Adjacent chunks share 2 corners and therefore agree on the shared edge.
    //
    // Water/shore cells are capped so land neighbours cannot pull water tiles up:
    //   ocean         → max effective elevation 0.05  (nearly flat seabed)
    //   shallow_shore → max effective elevation 0.09  (half a regular land step)
    //   steep_shore   → max effective elevation 0.06  (half a regular land step)
    const WATER_ELEV_CAP = { ocean: 0.05, shallow_shore: 0.09, steep_shore: 0.06 };
    const elev01 = (c) => {
      const e = c?.elevation ?? 0;
      const cap = WATER_ELEV_CAP[c?.terrain];
      return cap !== undefined ? Math.min(e, cap) : e;
    };
    const ce  = elev01(cell);
    const corners = {
      tl: (ce + elev01(nbr['-1,0']) + elev01(nbr['0,-1']) + elev01(nbr['-1,-1'])) / 4,
      tr: (ce + elev01(nbr['1,0'])  + elev01(nbr['0,-1']) + elev01(nbr['1,-1']))  / 4,
      bl: (ce + elev01(nbr['-1,0']) + elev01(nbr['0,1'])  + elev01(nbr['-1,1']))  / 4,
      br: (ce + elev01(nbr['1,0'])  + elev01(nbr['0,1'])  + elev01(nbr['1,1']))   / 4,
    };

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        // World-space position for seamless noise
        const wx = grid.macroX + (tx + 0.5) / S;
        const wy = grid.macroY + (ty + 0.5) / S;

        // Bilinear macro gradient (70%)
        const fx   = tx / (S - 1), fy = ty / (S - 1);
        const grad = corners.tl * (1-fx) * (1-fy)
                   + corners.tr *    fx  * (1-fy)
                   + corners.bl * (1-fx) *    fy
                   + corners.br *    fx  *    fy;

        // Two noise layers: macro (large rolling features) + micro (within-chunk roughness)
        const detail = worldDetailNoise(wx, wy, nSeed);
        const micro  = worldMicroNoise (wx, wy, nSeed);

        // Intrinsic tilt: project tile position onto slope axis, range ≈ [-0.5, 0.5]
        const tiltT = (fx - 0.5) * svx + (fy - 0.5) * svy;

        // Macro gradient 70% drives the base height.  Noise layers add variation
        // centred on 0 so they texture the terrain without shifting average elevation
        // or fighting the macro gradient direction.
        const elev = grad * 0.70
                   + (detail - 0.5) * noiseAmp
                   + (micro  - 0.5) * microAmp
                   + tiltT  * intrinsicAmp;
        let clamped = Math.max(0, Math.min(1, elev));
        // Hard cap for water/shore so no tile ever appears elevated above sea level.
        const elevCap = WATER_ELEV_CAP[cell.terrain];
        if (elevCap !== undefined) clamped = Math.min(clamped, elevCap);
        grid.elevation[ty * S + tx] = Math.round(clamped * ELEV_LEVELS) / ELEV_LEVELS;
      }
    }
  }

  // --------------------------------------------------------------------------
  // River — traces a water channel through the chunk along the macro riverMask path.
  //
  // Water surface model (per-chunk flat water):
  //   riverZ = max(0, minTileElev - 2 levels)
  //
  // Upstream constraint (prevents uphill flow):
  //   If riverZ > upstreamZ  → lower riverZ to upstreamZ (can't flow uphill).
  //   If riverZ < upstreamZ  → mark entry-border tiles as RIVER_RAPIDS (water drops in).
  //
  // All RIVER_BED tiles in the chunk are set to the same flat riverZ elevation.
  // RIVER_BANK tiles keep their natural terrain elevation (forms the channel walls).
  // --------------------------------------------------------------------------
  _buildRiver(grid, cell, nbr) {
    if (!cell.riverMask) return;
    const S    = CHUNK_SIZE;
    const mask = cell.riverMask; // N=1 E=2 S=4 W=8

    // Edge midpoints: fixed so neighbouring chunks always agree at the shared border
    const edgePts = [];
    if (mask & 1) edgePts.push({ x: 32, y:  0, nbrKey: '0,-1'  });
    if (mask & 2) edgePts.push({ x: 63, y: 32, nbrKey: '1,0'   });
    if (mask & 4) edgePts.push({ x: 32, y: 63, nbrKey: '0,1'   });
    if (mask & 8) edgePts.push({ x:  0, y: 32, nbrKey: '-1,0'  });
    if (edgePts.length === 0) return;

    const RIVER_HALF = 5.0;  // half-width of water channel in tiles
    const BANK_HALF  = 8.0;  // additional half-width for the bank zone

    // Control point at chunk centre — ensures cross-chunk edge tangents stay
    // perpendicular, eliminating kinks at chunk boundaries.
    const ctrlX = 32, ctrlY = 32;

    const riverDist = new Float32Array(S * S).fill(9999);
    const R     = Math.ceil(RIVER_HALF + BANK_HALF + 1);
    const STEPS = 150;
    const nSeed = this._nSeed;

    const tracePath = (x0, y0, x1, y1) => {
      for (let s = 0; s <= STEPS; s++) {
        const t  = s / STEPS;
        const bx = (1-t)*(1-t)*x0 + 2*(1-t)*t*ctrlX + t*t*x1;
        const by = (1-t)*(1-t)*y0 + 2*(1-t)*t*ctrlY + t*t*y1;
        for (let ty = Math.max(0, Math.floor(by)-R); ty <= Math.min(S-1, Math.ceil(by)+R); ty++) {
          for (let tx = Math.max(0, Math.floor(bx)-R); tx <= Math.min(S-1, Math.ceil(bx)+R); tx++) {
            const d = Math.hypot(tx + 0.5 - bx, ty + 0.5 - by);
            if (d < riverDist[ty*S+tx]) riverDist[ty*S+tx] = d;
          }
        }
      }
    };

    // Straight-through cells meander with a hash-displaced S-bend.
    const hasWE  = (mask & 0b1010) === 0b1010 && !(mask & 0b0101);
    const hasNS  = (mask & 0b0101) === 0b0101 && !(mask & 0b1010);
    const WIGGLE = 10;

    if (edgePts.length === 1) {
      tracePath(edgePts[0].x, edgePts[0].y, 32, 32);
    } else if (hasWE) {
      const midY = Math.round(32 + (tileHash(grid.macroX + 0.5, grid.macroY + 0.5, nSeed, 6) - 0.5) * WIGGLE * 2);
      tracePath( 0, 32, 32, midY);
      tracePath(32, midY, 63, 32);
    } else if (hasNS) {
      const midX = Math.round(32 + (tileHash(grid.macroX + 0.5, grid.macroY + 0.5, nSeed, 6) - 0.5) * WIGGLE * 2);
      tracePath(32,  0, midX, 32);
      tracePath(midX, 32, 32, 63);
    } else {
      for (let a = 0; a < edgePts.length; a++)
        for (let b = a + 1; b < edgePts.length; b++)
          tracePath(edgePts[a].x, edgePts[a].y, edgePts[b].x, edgePts[b].y);
    }

    // ── Mark RIVER_BED and RIVER_BANK tiles (no elevation changes yet) ────────
    // Per-tile world-space noise makes the bank edge organically ragged.
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i = ty * S + tx;
        const d = riverDist[i];
        if (d > RIVER_HALF + BANK_HALF + 1.5) continue;
        const wx = grid.macroX + (tx + 0.5) / S;
        const wy = grid.macroY + (ty + 0.5) / S;
        const wn = (tileHash(wx, wy, nSeed, 9) - 0.5) * 2.0; // ±1 tile edge wobble
        const rh = RIVER_HALF + wn;
        if (d <= rh) {
          grid.river[i] = RIVER_BED;
        } else if (d <= rh + BANK_HALF) {
          grid.river[i] = RIVER_BANK;
        }
      }
    }

    // ── Compute chunk minimum elevation (all tiles) ───────────────────────────
    let chunkMin = Infinity;
    for (let i = 0; i < S * S; i++) {
      if (grid.elevation[i] < chunkMin) chunkMin = grid.elevation[i];
    }
    if (!isFinite(chunkMin)) chunkMin = 0;

    // River water surface sits 2 elevation levels below the chunk's minimum tile.
    // This guarantees the water is always recessed into the terrain.
    const TWO_LEVELS = 2 / ELEV_LEVELS;
    let riverZ = Math.max(0, chunkMin - TWO_LEVELS);
    riverZ = Math.round(riverZ * ELEV_LEVELS) / ELEV_LEVELS; // snap to grid

    // ── Upstream constraint ───────────────────────────────────────────────────
    // Find the highest riverZ among all upstream neighbours (handles confluences).
    // If this chunk's riverZ is higher than the upstream, water would flow uphill
    // — clamp it down.  If it's lower, the water drops in from above: mark the
    // entry border as rapids.
    const mx = grid.macroX, my = grid.macroY;
    const downDir   = cell.riverDownDir ?? 0;
    const entryBits = mask & ~downDir; // bitmask of entry (incoming) edges
    const UP_COORD  = { 1: [mx, my-1], 2: [mx+1, my], 4: [mx, my+1], 8: [mx-1, my] };

    // Neighbour key → nbr lookup key for each cardinal entry direction
    const UP_NBR_KEY = { 1: '0,-1', 2: '1,0', 4: '0,1', 8: '-1,0' };

    // Noise amplitude tables (same values as _buildElevation) used for estimation
    const NOISE_AMP  = { flat:0.12, hills:0.22, mountain:0.32, steep_mountain:0.40, peak:0.42 };
    const MICRO_AMP  = { flat:0.08, hills:0.20, mountain:0.32, steep_mountain:0.40, peak:0.35 };

    let upstreamZ = null;
    for (const bit of [1, 2, 4, 8]) {
      if (!(entryBits & bit)) continue;
      const [ux, uy] = UP_COORD[bit];

      // Primary: runtime cache — populated when the upstream chunk was generated.
      const cached = this._riverEdgeElevCache.get(`${ux},${uy}:surface`);
      if (cached !== undefined) {
        upstreamZ = upstreamZ === null ? cached : Math.max(upstreamZ, cached);
        continue;
      }

      // Fallback: upstream chunk not yet generated.  Estimate its riverZ from
      // the macro cell data so generation order cannot produce uphill steps.
      // We use the expected chunk minimum: elevation*0.70 minus average noise
      // reduction.  This estimate errs slightly low (conservative) — the cost
      // is an occasional unnecessary rapids marker, but never a step-up.
      const upCell = nbr[UP_NBR_KEY[bit]];
      if (upCell?.riverMask) {
        const na  = NOISE_AMP[upCell.terrain]  ?? 0.08;
        const ma  = MICRO_AMP[upCell.terrain]  ?? 0.04;
        const estMin   = Math.max(0, upCell.elevation * 0.70 - (na + ma) * 0.5);
        const estRiverZ = Math.max(0, estMin - TWO_LEVELS);
        upstreamZ = upstreamZ === null ? estRiverZ : Math.max(upstreamZ, estRiverZ);
      }
    }

    let rapidsAtEntry = false;
    if (upstreamZ !== null) {
      if (riverZ > upstreamZ) {
        // This chunk is higher — lower its surface to match so water does not flow uphill.
        riverZ = Math.round(upstreamZ * ELEV_LEVELS) / ELEV_LEVELS;
      } else if (riverZ < upstreamZ) {
        // This chunk is lower — water drops as it enters; place rapids at the entry border.
        rapidsAtEntry = true;
      }
    }

    // ── Apply flat riverZ to all RIVER_BED tiles; rapids at entry border ──────
    const EDGE_BAND = 8;
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i = ty * S + tx;
        if (grid.river[i] !== RIVER_BED) continue;
        // Determine if this tile is in the entry-edge band
        const atEntry = rapidsAtEntry && (
          ((entryBits & 1) && ty <  EDGE_BAND) ||
          ((entryBits & 2) && tx >= S - EDGE_BAND) ||
          ((entryBits & 4) && ty >= S - EDGE_BAND) ||
          ((entryBits & 8) && tx <  EDGE_BAND)
        );
        grid.river[i]     = atEntry ? RIVER_RAPIDS : RIVER_BED;
        grid.elevation[i] = riverZ;
      }
    }

    // ── Cache this chunk's river surface for downstream neighbours ────────────
    this._riverEdgeElevCache.set(`${mx},${my}:surface`, riverZ);
    for (const bit of [1, 2, 4, 8]) {
      if (downDir & bit) this._riverEdgeElevCache.set(`${mx},${my}:${bit}`, riverZ);
    }

    // ── Spring marker at river sources ────────────────────────────────────────
    // A source has no entry edges (all river mask bits point downstream).
    if ((mask & ~downDir) === 0) {
      let bestI = -1, bestD = Infinity;
      for (let ty = 0; ty < S; ty++) {
        for (let tx = 0; tx < S; tx++) {
          const i = ty * S + tx;
          if (grid.river[i] === RIVER_BED) {
            const d = Math.hypot(tx + 0.5 - 32, ty + 0.5 - 32);
            if (d < bestD) { bestD = d; bestI = i; }
          }
        }
      }
      if (bestI >= 0) grid.obstacle[bestI] = OBSTACLE.SPRING;
    }
  }

  // --------------------------------------------------------------------------
  // Ground type — weighted palette pick via per-tile hash.
  // Near chunk edges a probabilistic blend zone mixes this cell's palette with
  // the neighbour's so biome changes are never a hard straight line.
  // --------------------------------------------------------------------------
  _classifyGround(grid, cell, nbr) {
    const S       = CHUNK_SIZE;
    const nSeed   = this._nSeed;
    const BAND    = 8; // tile-width of the blend zone on each edge

    const palette = getGroundPalette(cell.terrain, cell.moistureZone);
    const total   = palette.reduce((s, e) => s + e.w, 0);

    // Inline weighted pick from any palette
    const pickGround = (pal, roll) => {
      const tot = pal.reduce((a, e) => a + e.w, 0);
      let cum = 0;
      for (const entry of pal) {
        cum += entry.w / tot;
        if (roll < cum) return entry.g;
      }
      return pal[pal.length - 1].g;
    };

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const wx   = grid.macroX + (tx + 0.5) / S;
        const wy   = grid.macroY + (ty + 0.5) / S;
        const roll = tileHash(wx, wy, nSeed, 0);   // purpose 0 = ground type

        // ── Blend zone: find the neighbour with the highest blend weight ──
        // Blending is ONE-DIRECTIONAL: land cells may blend toward a shore/water
        // neighbour, but shore/water cells never blend toward land.  This prevents
        // land-palette tiles from appearing inside shore/ocean chunks.
        // Shore/water neighbours also use a half-width band (4 tiles vs 8).
        const SHORE_TERRAINS = new Set(['ocean', 'shallow_shore', 'steep_shore']);
        const cellIsWater = SHORE_TERRAINS.has(cell.terrain);
        let blendFactor = 0, blendCell = null;

        if (!cellIsWater) {
          const bandFor = (nbrKey) => SHORE_TERRAINS.has(nbr[nbrKey]?.terrain) ? BAND / 2 : BAND;
          const checkEdge = (dist, nbrKey) => {
            const b = bandFor(nbrKey);
            const f = Math.max(0, (b - dist) / b);
            if (f > blendFactor && nbr[nbrKey]) { blendFactor = f; blendCell = nbr[nbrKey]; }
          };
          checkEdge(tx,         '-1,0'); // west edge
          checkEdge(S - 1 - tx, '1,0'); // east edge
          checkEdge(ty,         '0,-1'); // north edge
          checkEdge(S - 1 - ty, '0,1'); // south edge
        }

        // Use a separate hash to decide whether to sample from the neighbour
        let useNeighbour = false;
        if (blendFactor > 0 && blendCell) {
          const blendRoll = tileHash(wx, wy, nSeed, 3); // purpose 3 = blend decision
          useNeighbour = blendRoll < blendFactor;
        }

        // ── Ground selection ──────────────────────────────────────────────
        const elev      = grid.elevation[ty * S + tx];
        const activeCell = useNeighbour ? blendCell : cell;
        let ground;

        if (activeCell.terrain === 'ocean') {
          // Ocean is always water; deeper where lower
          ground = elev < 0.03 ? GROUND.DEEP_WATER : GROUND.SHALLOW_WATER;
        } else if (activeCell.terrain === 'shallow_shore') {
          // Shore transitions: lowest tiles are shallow water, rest are beach/mud
          ground = elev < 0.08 ? GROUND.SHALLOW_WATER
                 : pickGround(getGroundPalette('shallow_shore', activeCell.moistureZone), roll);
        } else if (activeCell.terrain === 'steep_shore') {
          ground = elev < 0.06 ? GROUND.SHALLOW_WATER
                 : pickGround(getGroundPalette('steep_shore', activeCell.moistureZone), roll);
        } else if (elev > 0.90 && (activeCell.terrain === 'mountain' ||
                                    activeCell.terrain === 'steep_mountain' ||
                                    activeCell.terrain === 'peak')) {
          ground = GROUND.SNOW;
        } else if (useNeighbour) {
          ground = pickGround(getGroundPalette(blendCell.terrain, blendCell.moistureZone), roll);
        } else {
          ground = pickGround(palette, roll);
        }

        // ── Tidepool / puddle fix ─────────────────────────────────────────
        // Any non-ocean tile that ended up with water ground type above the
        // waterline (from a palette pick that included SHALLOW_WATER, or from
        // the shore blend zone) becomes mud or wet sand instead — reads as a
        // damp hollow / tidepool rather than floating water.
        // Uses cell.terrain (the actual chunk terrain), not activeCell, because
        // activeCell may be the shore neighbour in the blend zone.
        if ((ground === GROUND.SHALLOW_WATER || ground === GROUND.DEEP_WATER)
            && cell.terrain !== 'ocean' && elev > 0.08) {
          const mz = cell.moistureZone;
          ground = (mz === 'desert' || mz === 'arid') ? GROUND.WET_SAND : GROUND.MUD;
        }

        // ── River override ────────────────────────────────────────────────
        // River flags were stamped by _buildRiver (after elevation carving).
        // They always win over the biome palette, even inside blend zones.
        const rv = grid.river[ty * S + tx];
        if (rv === RIVER_RAPIDS) {
          ground = GROUND.RAPIDS;
        } else if (rv === RIVER_BED) {
          ground = GROUND.SHALLOW_WATER;
        } else if (rv === RIVER_BANK) {
          const mz = cell.moistureZone;
          ground = (mz === 'desert' || mz === 'arid') ? GROUND.WET_SAND : GROUND.MUD;
        }

        const variantRoll = tileHash(wx, wy, nSeed, 1);
        const i = ty * S + tx;
        grid.ground[i]  = ground;
        grid.variant[i] = Math.floor(variantRoll * 16);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Obstacle placement — hash-based with biome blending at chunk borders.
  // Near edges, tiles probabilistically adopt the neighbour's obstacle rule
  // so vegetation density transitions naturally across biome boundaries.
  // --------------------------------------------------------------------------
  _placeObstacles(grid, cell, nbr) {
    const S     = CHUNK_SIZE;
    const nSeed = this._nSeed;
    const BAND  = 8; // tile-width of the blend zone (matches ground blend)

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        // Keep a 1-tile clear ring at every edge for clean transitions.
        if (tx === 0 || tx === S-1 || ty === 0 || ty === S-1) continue;

        const i = ty * S + tx;
        const g = grid.ground[i];
        if (g === GROUND.DEEP_WATER || g === GROUND.SHALLOW_WATER ||
            g === GROUND.RAPIDS     || g === GROUND.SNOW) continue;

        // River bank: reeds and tall grass only, boosted density
        if (grid.river[i] === RIVER_BANK) {
          const broll = tileHash(grid.macroX + (tx + 0.5) / S, grid.macroY + (ty + 0.5) / S, nSeed, 2);
          if (broll < 0.40) {
            grid.obstacle[i] = broll < 0.22 ? OBSTACLE.REED : OBSTACLE.TALL_GRASS;
          }
          continue;
        }

        const wx = grid.macroX + (tx + 0.5) / S;
        const wy = grid.macroY + (ty + 0.5) / S;

        // Blend zone: pick the neighbour with the highest blend weight.
        // One-directional: shore/water cells never blend toward land.
        // Shore/water neighbours use a half-width band.
        const SHORE_TERRAINS_OBS = new Set(['ocean', 'shallow_shore', 'steep_shore']);
        let blendFactor = 0, blendCell = null;
        if (!SHORE_TERRAINS_OBS.has(cell.terrain)) {
          const checkEdge = (dist, key) => {
            const b = SHORE_TERRAINS_OBS.has(nbr[key]?.terrain) ? BAND / 2 : BAND;
            const f = Math.max(0, (b - dist) / b);
            if (f > blendFactor && nbr[key]) { blendFactor = f; blendCell = nbr[key]; }
          };
          checkEdge(tx - 1,     '-1,0');
          checkEdge(S - 2 - tx, '1,0');
          checkEdge(ty - 1,     '0,-1');
          checkEdge(S - 2 - ty, '0,1');
        }

        // Decide which biome rule to use for this tile
        let activeCell = cell;
        if (blendFactor > 0 && blendCell) {
          const blendRoll = tileHash(wx, wy, nSeed, 4); // purpose 4 = obstacle blend
          if (blendRoll < blendFactor) activeCell = blendCell;
        }

        const rule = getObstacleRule(activeCell.terrain, activeCell.moistureZone, activeCell.vegetation);
        if (!rule.density || !rule.obstacles.length) continue;

        const roll = tileHash(wx, wy, nSeed, 2); // purpose 2 = obstacle
        if (roll < rule.density) {
          const obsCount = rule.obstacles.length;
          const pick     = Math.floor((roll / rule.density) * obsCount);
          grid.obstacle[i] = rule.obstacles[Math.min(pick, obsCount - 1)];
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2×2 stamp placement — Boulder Clusters and Rock Outcrops as geological
  // features.  Only placed at even-coordinate origins so stamps never overlap.
  // Uses tileHash purpose 7 (not used by any other pass).
  // --------------------------------------------------------------------------
  _placeStamps2x2(grid, cell) {
    const rule = getStampRule(cell.terrain);
    if (!rule || !rule.density || !rule.obstacles.length) return;

    const S     = CHUNK_SIZE;
    const nSeed = this._nSeed;

    // Iterate even origins; keep both tiles of the stamp inside the clear border ring
    // (border ring = 1 tile, so valid origin range: 2 … S-3 inclusive)
    for (let ty = 2; ty <= S - 3; ty += 2) {
      for (let tx = 2; tx <= S - 3; tx += 2) {
        const wx   = grid.macroX + (tx + 1.0) / S; // centre of the 2×2 block
        const wy   = grid.macroY + (ty + 1.0) / S;
        const roll = tileHash(wx, wy, nSeed, 7);   // purpose 7 = 2×2 stamp
        if (roll >= rule.density) continue;

        // Skip if any of the 4 tiles is water/snow or already has an obstacle
        let blocked = false;
        for (let dy = 0; dy <= 1 && !blocked; dy++) {
          for (let dx = 0; dx <= 1 && !blocked; dx++) {
            const i = (ty + dy) * S + (tx + dx);
            if (grid.obstacle[i] !== OBSTACLE.NONE) { blocked = true; break; }
            const g = grid.ground[i];
            if (g === GROUND.DEEP_WATER || g === GROUND.SHALLOW_WATER ||
                g === GROUND.RAPIDS     || g === GROUND.SNOW) { blocked = true; break; }
          }
        }
        if (blocked) continue;

        // Pick obstacle type from the rule list
        const pick = Math.floor((roll / rule.density) * rule.obstacles.length);
        const obs  = rule.obstacles[Math.min(pick, rule.obstacles.length - 1)];

        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            grid.obstacle[(ty + dy) * S + (tx + dx)] = obs;
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Passability — precomputed from obstacle blocking table
  // --------------------------------------------------------------------------
  _buildPassability(grid) {
    const N = CHUNK_SIZE * CHUNK_SIZE;
    for (let i = 0; i < N; i++) {
      const g = grid.ground[i];
      const o = grid.obstacle[i];
      grid.passable[i] = (
        g !== GROUND.DEEP_WATER &&
        g !== GROUND.RAPIDS &&
        OBSTACLE_BLOCKS[o] === 0
      ) ? 1 : 0;
    }
  }

  // --------------------------------------------------------------------------
  // Settlement chunk: build the river corridor first so the settlement
  // generator can design around it, then apply ground/obstacle for river tiles.
  // --------------------------------------------------------------------------
  _buildSettlementChunk(grid, cell, nbr) {
    if (!this._settlementGen) this._settlementGen = new SettlementGen(this._nSeed);
    if (cell.riverMask) this._buildRiver(grid, cell, nbr);
    this._settlementGen.generate(grid, cell);
    if (cell.riverMask) {
      this._applyRiverOverlay(grid, cell);
      this._settlementGen.applyRiverBridge(grid, cell);
    }
  }

  // --------------------------------------------------------------------------
  // Farmland chunk
  // --------------------------------------------------------------------------
  _buildFarmlandChunk(grid, cell, nbr) {
    if (!this._settlementGen) this._settlementGen = new SettlementGen(this._nSeed);
    if (cell.riverMask) this._buildRiver(grid, cell, nbr);
    this._settlementGen.generateFarmland(grid, cell);
    if (cell.riverMask) {
      this._applyRiverOverlay(grid, cell);
      this._settlementGen.applyRiverBridge(grid, cell);
    }
  }

  // --------------------------------------------------------------------------
  // Dock chunk
  // --------------------------------------------------------------------------
  _buildDockChunk(grid, cell, nbr) {
    if (!this._settlementGen) this._settlementGen = new SettlementGen(this._nSeed);
    if (cell.riverMask) this._buildRiver(grid, cell, nbr);
    this._settlementGen.generateDock(grid, cell);
    if (cell.riverMask) {
      this._applyRiverOverlay(grid, cell);
      this._settlementGen.applyRiverBridge(grid, cell);
    }
  }

  // --------------------------------------------------------------------------
  // River overlay — translates grid.river[] flags into ground/obstacle,
  // overriding whatever the settlement/farmland/dock generator placed.
  // Called after the settlement generator so the river always wins visually,
  // but the generator has already seen the flags and avoided placing hard
  // structures across the channel.
  // --------------------------------------------------------------------------
  _applyRiverOverlay(grid, cell) {
    const S  = CHUNK_SIZE;
    const mz = cell.moistureZone ?? 'temperate';
    for (let i = 0; i < S * S; i++) {
      const rv = grid.river[i];
      if (!rv) continue;
      if (rv === RIVER_RAPIDS) {
        grid.ground[i]   = GROUND.RAPIDS;
        grid.obstacle[i] = OBSTACLE.NONE;
      } else if (rv === RIVER_BED) {
        grid.ground[i]   = GROUND.SHALLOW_WATER;
        grid.obstacle[i] = OBSTACLE.NONE;
      } else if (rv === RIVER_BANK) {
        grid.ground[i]   = (mz === 'desert' || mz === 'arid') ? GROUND.WET_SAND : GROUND.MUD;
        grid.obstacle[i] = OBSTACLE.NONE;
      }
    }
  }
}
