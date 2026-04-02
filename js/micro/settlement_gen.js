// settlement_gen.js — Procedural tile layout for settlement chunks.
//
// Each macro cell in a settlement footprint is assigned a district type
// (core / res / econ / mil / civ / edge) by WorldPopulator.
// This module generates the 64×64 tile pattern for that district.
//
// Visual approach:
//   • Flat elevation (±0.2 levels micro-noise) so the 3D renderer
//     shows clean, traversable floors.
//   • COBBLESTONE / PACKED_EARTH for roads, plazas, and building floors.
//   • Building walls = perimeter tiles with LARGE_ROCK obstacle (impassable)
//     over STONE / ROCKY_EARTH ground.  The 3D renderer will show those
//     tile edges as raised wall faces if neighbouring floor tiles are lower,
//     but even without elevation delta the obstacle ring is enough to
//     communicate "building" to the player.
//   • Doors = 2-tile gap in one wall, ground tile, no obstacle.

import { CHUNK_SIZE }                                     from './micro_grid.js';
import { worldMicroNoise, tileHash }                      from './chunk_noise.js';
import { GROUND, OBSTACLE, getGroundPalette }             from '../data/micro_tile_data.js';

const S           = CHUNK_SIZE;   // 64
const ELEV_LEVELS = 20;

const {
  COBBLESTONE, PACKED_EARTH, STONE, ROCKY_EARTH, EARTH,
  GRASS, DRY_EARTH, DRY_GRASS, MUD, SCREE,
  WET_SAND, SHALLOW_WATER, DEEP_WATER,
} = GROUND;

const {
  NONE, PEBBLE, SMALL_ROCK, LARGE_ROCK, BOULDER,
  DEAD_SHRUB, SHRUB, DENSE_SHRUB, TALL_GRASS, REED,
} = OBSTACLE;

// ─────────────────────────────────────────────────────────────────────────────

export class SettlementGen {
  constructor(nSeed) {
    this._nSeed = nSeed;
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  generate(grid, cell) {
    const family   = cell.settlementFamily   ?? 'rsv';
    const district = cell.settlementDistrict ?? 'edge';
    const type     = cell.settlementType     ?? 'village';
    const sizeTier = cell.sizeTier           ?? 'ex';

    // Use the stamped base elevation (shared across all footprint cells) so
    // adjacent district chunks sit at the same height with no visible step.
    const baseElev  = Math.round(
      (cell.settlementBaseElev ?? cell.elevation ?? 0.3) * ELEV_LEVELS
    ) / ELEV_LEVELS;
    const palette   = getGroundPalette(cell.terrain, cell.moistureZone);
    const biomeTile = palette[0]?.g ?? EARTH;

    this._flattenElev(grid, baseElev);
    this._fill(grid, biomeTile, NONE);

    const isUrban    = ['crt', 'mnv', 'prt', 'rvt', 'rmt'].includes(family);
    const isHighland = ['hft', 'gat', 'mit'].includes(family);
    const isCity     = type === 'city';

    const roadTile  = (isUrban || isCity) ? COBBLESTONE : PACKED_EARTH;
    const wallGnd   = isHighland ? ROCKY_EARTH : STONE;
    const floorGnd  = isUrban   ? COBBLESTONE : PACKED_EARTH;

    // Spine road width scales with size tier so larger settlements have
    // visibly wider through-roads.  All variants keep centre at cx/cy so
    // neighbouring chunks always connect seamlessly.
    const spineW = { mh: 5, sd: 5, dn: 5, ex: 3, ba: 3 }[sizeTier] ?? 3;
    const cx = S >> 1, cy = S >> 1;
    this._road(grid, cx, 0,     cx, S - 1, spineW, roadTile);  // N–S spine
    this._road(grid, 0,  cy, S - 1, cy,   spineW, roadTile);  // E–W spine

    switch (district) {
      case 'core': this._core(grid, family, type, sizeTier, isUrban, isHighland,
                               roadTile, wallGnd, floorGnd, biomeTile); break;
      case 'res':  this._residential(grid, family, sizeTier, isUrban, roadTile,
                               wallGnd, floorGnd, biomeTile); break;
      case 'econ': this._economic(grid, family, isUrban,
                               roadTile, wallGnd, floorGnd, biomeTile); break;
      case 'mil':  this._military(grid, roadTile, wallGnd); break;
      case 'civ':  this._civic(grid, sizeTier, isUrban, roadTile, wallGnd, floorGnd, biomeTile); break;
      default:     this._edge(grid, roadTile, biomeTile); break;
    }

    // If a river runs through this chunk, add a stone embankment along the bank
    // edge so the settlement looks like it was built up to the water intentionally.
    this._riverEmbankment(grid, roadTile);

    // Strip any accidental scatter from hard-surface ground types.
    // Parade grounds, drill squares, mining yards, and building wall bases
    // (wallGnd = STONE/ROCKY_EARTH) must stay bare; only LARGE_ROCK walls are kept.
    for (let i = 0; i < S * S; i++) {
      const g = grid.ground[i];
      if ((g === COBBLESTONE || g === PACKED_EARTH || g === STONE ||
           g === ROCKY_EARTH || g === SCREE        || g === DRY_EARTH) &&
          grid.obstacle[i] !== LARGE_ROCK) {
        grid.obstacle[i] = NONE;
      }
    }
  }

  // Paint a 2-tile cobblestone/packed-earth embankment on every land tile that
  // directly borders a river-bed tile.  This gives the appearance that the
  // settlement deliberately paved its riverfront rather than having the river
  // cut randomly through existing buildings.
  _riverEmbankment(grid, roadTile) {
    // First pass: find all tiles adjacent to RIVER_BED that are not river tiles.
    const quay = new Uint8Array(S * S);
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        if (grid.river[ty * S + tx]) continue;  // already river
        // Check 4-neighbours for RIVER_BED (flag value 1)
        let borderingBed = false;
        if (ty > 0    && grid.river[(ty-1)*S+tx] === 1) borderingBed = true;
        if (ty < S-1  && grid.river[(ty+1)*S+tx] === 1) borderingBed = true;
        if (tx > 0    && grid.river[ty*S+(tx-1)] === 1) borderingBed = true;
        if (tx < S-1  && grid.river[ty*S+(tx+1)] === 1) borderingBed = true;
        if (borderingBed) quay[ty * S + tx] = 1;
      }
    }
    // Second pass: widen by one tile (so the embankment is 2 tiles wide).
    const quay2 = new Uint8Array(S * S);
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        if (quay[ty * S + tx]) { quay2[ty * S + tx] = 1; continue; }
        if (grid.river[ty * S + tx]) continue;
        if (ty > 0    && quay[(ty-1)*S+tx]) { quay2[ty*S+tx] = 1; continue; }
        if (ty < S-1  && quay[(ty+1)*S+tx]) { quay2[ty*S+tx] = 1; continue; }
        if (tx > 0    && quay[ty*S+(tx-1)]) { quay2[ty*S+tx] = 1; continue; }
        if (tx < S-1  && quay[ty*S+(tx+1)]) { quay2[ty*S+tx] = 1; continue; }
      }
    }
    // Apply: paint quay tiles as the road surface, clear any obstacles.
    for (let i = 0; i < S * S; i++) {
      if (!quay2[i] || grid.river[i]) continue;
      grid.ground[i]   = roadTile;
      grid.obstacle[i] = NONE;
    }
  }

  // Called from chunk_gen AFTER _applyRiverOverlay so the bridge tiles are painted
  // last and are not overwritten by the river ground-type pass.
  // Paints the N-S and E-W spine roads over river-bed tiles at bank elevation,
  // creating a visible cobblestone/packed-earth bridge crossing the channel.
  applyRiverBridge(grid, cell) {
    const family  = cell.settlementFamily ?? 'rsv';
    const type    = cell.settlementType   ?? 'village';
    const isUrban = ['crt', 'mnv', 'prt', 'rvt', 'rmt'].includes(family);
    const roadTile  = (isUrban || type === 'city') ? COBBLESTONE : PACKED_EARTH;
    const baseElev  = Math.round(
      (cell.settlementBaseElev ?? cell.elevation ?? 0.3) * ELEV_LEVELS
    ) / ELEV_LEVELS;
    const cx = S >> 1;  // 32

    for (let ty = 0; ty < S; ty++) {
      const i = ty * S + cx;
      if (grid.river[i] === 1 || grid.river[i] === 3) {
        grid.ground[i]     = roadTile;
        grid.obstacle[i]   = NONE;
        grid.elevation[i]  = baseElev;
      }
    }
    for (let tx = 0; tx < S; tx++) {
      const i = cx * S + tx;
      if (grid.river[i] === 1 || grid.river[i] === 3) {
        grid.ground[i]     = roadTile;
        grid.obstacle[i]   = NONE;
        grid.elevation[i]  = baseElev;
      }
    }
  }

  // ── Elevation helpers ──────────────────────────────────────────────────────

  _flattenElev(grid, base) {
    const ns = this._nSeed;
    for (let ty = 0; ty < S; ty++)
      for (let tx = 0; tx < S; tx++) {
        // Preserve elevation carved by _buildRiver (river bed / bank tiles)
        if (grid.river[ty * S + tx]) continue;
        const micro = worldMicroNoise(
          grid.macroX + (tx + 0.5) / S,
          grid.macroY + (ty + 0.5) / S, ns
        ) * (0.4 / ELEV_LEVELS);
        grid.elevation[ty * S + tx] =
          Math.round(Math.max(0, Math.min(1, base + micro)) * ELEV_LEVELS) / ELEV_LEVELS;
      }
  }

  // ── Tile helpers ───────────────────────────────────────────────────────────

  _fill(grid, gnd, obs) {
    for (let i = 0; i < S * S; i++) {
      // Preserve river flags stamped by _buildRiver before this generator ran.
      // Ground/obstacle for those tiles will be written by _applyRiverOverlay.
      if (grid.river[i]) continue;
      grid.ground[i]   = gnd;
      grid.obstacle[i] = obs;
    }
  }

  _set(grid, x, y, gnd, obs = NONE) {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const i = y * S + x;
    // Never paint over river-bed or rapids — those tiles belong to the channel.
    // Bank tiles (RIVER_BANK = 2) can be paved to form a riverside quay.
    if (grid.river[i] === 1 || grid.river[i] === 3) return;
    grid.ground[i]   = gnd;
    grid.obstacle[i] = obs;
  }

  // Returns the fraction of tiles in the rect [x, y, w, h] that are river-bed or
  // rapids.  Used to decide whether to skip building placement in the channel.
  _riverCoverage(grid, x, y, w, h) {
    let total = 0, river = 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || tx >= S || ty < 0 || ty >= S) continue;
        total++;
        const rv = grid.river[ty * S + tx];
        if (rv === 1 || rv === 3) river++;
      }
    }
    return total > 0 ? river / total : 0;
  }

  _rect(grid, x, y, w, h, gnd, obs = NONE) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        this._set(grid, x + dx, y + dy, gnd, obs);
  }

  // Axis-aligned road band.  Roads are painted over whatever is there.
  _road(grid, x0, y0, x1, y1, w, tile) {
    const half = (w - 1) >> 1;
    if (x0 === x1) {
      const yA = Math.min(y0, y1), yB = Math.max(y0, y1);
      for (let y = yA; y <= yB; y++)
        for (let dx = -half; dx <= half + (w % 2 === 0 ? 1 : 0); dx++)
          this._set(grid, x0 + dx, y, tile, NONE);
    } else {
      const xA = Math.min(x0, x1), xB = Math.max(x0, x1);
      for (let x = xA; x <= xB; x++)
        for (let dy = -half; dy <= half + (w % 2 === 0 ? 1 : 0); dy++)
          this._set(grid, x, y0 + dy, tile, NONE);
    }
  }

  // Place a building: wall ring of LARGE_ROCK + interior floor + door gap.
  // doorSide: 'N'|'S'|'E'|'W'  doorPos: tile along that side (0-indexed from left/top)
  _building(grid, bx, by, bw, bh, wallGnd, floorGnd, doorSide = 'S', doorPos = null) {
    if (bw < 4 || bh < 4) return;
    // Skip if more than a quarter of the building footprint falls inside the river
    // channel — a building with missing wall segments looks broken.
    if (this._riverCoverage(grid, bx, by, bw, bh) > 0.25) return;
    if (doorPos === null) doorPos = Math.floor((doorSide === 'N' || doorSide === 'S' ? bw : bh) / 2) - 1;

    // Interior floor
    this._rect(grid, bx + 1, by + 1, bw - 2, bh - 2, floorGnd, NONE);

    // North wall
    for (let dx = 0; dx < bw; dx++) this._set(grid, bx + dx, by,          wallGnd, LARGE_ROCK);
    // South wall
    for (let dx = 0; dx < bw; dx++) this._set(grid, bx + dx, by + bh - 1, wallGnd, LARGE_ROCK);
    // West wall (excluding corners)
    for (let dy = 1; dy < bh - 1; dy++) this._set(grid, bx,          by + dy, wallGnd, LARGE_ROCK);
    // East wall (excluding corners)
    for (let dy = 1; dy < bh - 1; dy++) this._set(grid, bx + bw - 1, by + dy, wallGnd, LARGE_ROCK);

    // Door gap (2 tiles wide)
    const dp0 = Math.max(1, Math.min(doorPos,       (doorSide === 'N' || doorSide === 'S' ? bw : bh) - 3));
    const dp1 = dp0 + 1;
    switch (doorSide) {
      case 'S':
        this._set(grid, bx + dp0, by + bh - 1, floorGnd, NONE);
        this._set(grid, bx + dp1, by + bh - 1, floorGnd, NONE);
        break;
      case 'N':
        this._set(grid, bx + dp0, by, floorGnd, NONE);
        this._set(grid, bx + dp1, by, floorGnd, NONE);
        break;
      case 'E':
        this._set(grid, bx + bw - 1, by + dp0, floorGnd, NONE);
        this._set(grid, bx + bw - 1, by + dp1, floorGnd, NONE);
        break;
      case 'W':
        this._set(grid, bx, by + dp0, floorGnd, NONE);
        this._set(grid, bx, by + dp1, floorGnd, NONE);
        break;
    }
  }

  // Scatter passable natural decoration in a rectangle, skipping road/floor tiles.
  _scatter(grid, x, y, w, h, density, obs = null) {
    const ns = this._nSeed;
    const passable = [PEBBLE, SMALL_ROCK, SHRUB, TALL_GRASS, DEAD_SHRUB];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || tx >= S || ty < 0 || ty >= S) continue;
        const i = ty * S + tx;
        const g = grid.ground[i];
        if (g === COBBLESTONE || g === PACKED_EARTH || g === STONE ||
            g === ROCKY_EARTH || g === SCREE    || g === DRY_EARTH) continue;
        if (grid.obstacle[i] === LARGE_ROCK) continue;
        const h1 = tileHash(grid.macroX + (tx + 0.5) / S, grid.macroY + (ty + 0.5) / S, ns, 40);
        if (h1 < density) {
          const pick = tileHash(grid.macroX + tx / S, grid.macroY + ty / S, ns, 41);
          grid.obstacle[i] = obs ?? passable[Math.floor(pick * passable.length)];
        }
      }
    }
  }

  // ── Core district ──────────────────────────────────────────────────────────

  _core(grid, family, type, sizeTier, isUrban, isHighland, roadTile, wallGnd, floorGnd, biomeTile) {
    if (family === 'hft' || family === 'gat') {
      this._coreFort(grid, roadTile, wallGnd);
      return;
    }
    if (family === 'sht') {
      this._coreShrine(grid, roadTile, wallGnd, biomeTile);
      return;
    }
    if (family === 'rsv') {
      this._coreVillage(grid, roadTile, wallGnd, floorGnd, biomeTile);
      return;
    }
    this._coreUrban(grid, sizeTier, roadTile, wallGnd, floorGnd);
  }

  // Market town / river town / crossing town core.
  // Plaza and road scale with sizeTier so a major hub looks unmistakably
  // larger than an established base.
  _coreUrban(grid, sizeTier, roadTile, wallGnd, floorGnd) {
    const cx = S >> 1;   // 32
    const cy = S >> 1;

    // Road and plaza scale by tier.
    const roadW  = { mh: 7, sd: 6, dn: 6, ex: 5, ba: 4 }[sizeTier] ?? 5;
    const plazaR = { mh: 12, sd: 10, dn: 9, ex: 8, ba: 6 }[sizeTier] ?? 8;
    this._road(grid, cx, 0, cx, S - 1, roadW, roadTile);
    this._road(grid, 0, cy, S - 1, cy, roadW, roadTile);

    this._rect(grid, cx - plazaR, cy - plazaR, plazaR * 2, plazaR * 2, roadTile, NONE);

    // Well/market post at centre
    this._set(grid, cx, cy, roadTile, PEBBLE);

    // Corner buildings — larger tiers get bigger, more numerous buildings.
    const margin  = 3;
    const quadMax = cx - plazaR - margin;
    if (quadMax >= 6) {
      const bw = Math.min(quadMax - 1, { mh: 20, sd: 18, dn: 18, ex: 16, ba: 12 }[sizeTier] ?? 16);
      const bh = Math.min(quadMax - 1, { mh: 18, sd: 16, dn: 16, ex: 14, ba: 10 }[sizeTier] ?? 14);
      const dp = Math.floor(bw / 2) - 1;

      this._building(grid, margin, margin,             bw, bh, wallGnd, floorGnd, 'S', dp);  // NW
      this._building(grid, S-margin-bw, margin,        bw, bh, wallGnd, floorGnd, 'S', dp);  // NE
      this._building(grid, margin, S-margin-bh,        bw, bh, wallGnd, floorGnd, 'N', dp);  // SW
      this._building(grid, S-margin-bw, S-margin-bh,   bw, bh, wallGnd, floorGnd, 'N', dp);  // SE

      // Major hub and dense tiers also pack mid-side buildings between the plaza
      // and the corner buildings, giving the impression of a packed urban core.
      if (sizeTier === 'mh' || sizeTier === 'sd' || sizeTier === 'dn') {
        const midW = 8, midH = Math.min(quadMax - 1, 10);
        const midX = cx - midW / 2;
        // North mid buildings
        if (midH >= 5) {
          this._building(grid, Math.floor(midX), margin, midW, midH, wallGnd, floorGnd, 'S', 3);
          // South
          this._building(grid, Math.floor(midX), S-margin-midH, midW, midH, wallGnd, floorGnd, 'N', 3);
        }
      }
    }
  }

  // Village green: packed-earth square + path cross + central well + 4 cottages
  _coreVillage(grid, roadTile, wallGnd, floorGnd, biomeTile) {
    const cx = S >> 1;
    const cy = S >> 1;

    // Narrow paths (3 tiles)
    this._road(grid, cx, 0, cx, S - 1, 3, roadTile);
    this._road(grid, 0, cy, S - 1, cy, 3, roadTile);

    // Open green square (12×12)
    const gr = 6;
    this._rect(grid, cx - gr, cy - gr, gr * 2, gr * 2, biomeTile, NONE);

    // Well at centre
    this._set(grid, cx, cy, roadTile, PEBBLE);

    // 4 cottages — one per quadrant
    const margin = 3, pad = gr + 3;
    const bw = 10, bh = 10;
    const dp = Math.floor(bw / 2) - 1;

    this._building(grid, margin, margin,           bw, bh, wallGnd, floorGnd, 'S', dp);  // NW
    this._building(grid, S-margin-bw, margin,      bw, bh, wallGnd, floorGnd, 'S', dp);  // NE
    this._building(grid, margin, S-margin-bh,      bw, bh, wallGnd, floorGnd, 'N', dp);  // SW
    this._building(grid, S-margin-bw, S-margin-bh, bw, bh, wallGnd, floorGnd, 'N', dp);  // SE
  }

  // Fort / garrison core: drill square + barracks + armory
  _coreFort(grid, roadTile, wallGnd) {
    const cx = S >> 1;

    // Gate road from south
    this._road(grid, cx, 38, cx, S - 1, 5, roadTile);

    // Drill square (stone floor, upper half)
    this._rect(grid, 6, 4, 52, 28, ROCKY_EARTH, NONE);

    // Barracks — large building, lower half
    this._building(grid, 4, 36, 38, 20, wallGnd, STONE, 'N', 18);

    // Armory — smaller, east side
    this._building(grid, 46, 36, 14, 16, wallGnd, STONE, 'N', 6);

    // Watchtower corner accents (small raised squares)
    const cornerObs = [BOULDER, BOULDER, BOULDER, BOULDER];
    [[4,4],[S-9,4],[4,S-9],[S-9,S-9]].forEach(([x,y]) =>
      this._rect(grid, x, y, 5, 5, wallGnd, NONE));
  }

  // Shrine town core: sacred precinct + temple + garden
  _coreShrine(grid, roadTile, wallGnd, biomeTile) {
    const cx = S >> 1;
    const cy = S >> 1;

    // Path cross (narrow, 3 tiles)
    this._road(grid, cx, 0, cx, S - 1, 3, roadTile);
    this._road(grid, 0, cy, S - 1, cy, 3, roadTile);

    // Sacred open area (GRASS regardless of biome)
    this._rect(grid, cx - 14, cy - 16, 28, 26, GRASS, NONE);

    // Temple building (centred in upper half of sacred area)
    this._building(grid, cx - 9, cy - 15, 18, 16, wallGnd, COBBLESTONE, 'S', 8);

    // Offering stones around temple
    this._scatter(grid, cx - 14, cy - 16, 28, 26, 0.07, SMALL_ROCK);

    // Gardens along south path
    this._rect(grid, cx - 10, cy + 8, 20, 8, GRASS, NONE);
  }

  // ── Residential district ───────────────────────────────────────────────────

  _residential(grid, family, sizeTier, isUrban, roadTile, wallGnd, floorGnd, biomeTile) {
    const cx      = S >> 1;
    const laneY   = 32;
    const laneW   = { mh: 5, sd: 4, dn: 4, ex: isUrban ? 4 : 3, ba: 3 }[sizeTier] ?? (isUrban ? 4 : 3);
    const laneHalf = Math.ceil(laneW / 2);

    // Through-road (E-W main) + N/S stubs
    this._road(grid, 0, laneY, S - 1, laneY, laneW, roadTile);
    this._road(grid, cx, 0, cx, laneY - laneHalf - 1, 2, roadTile);  // N stub
    this._road(grid, cx, laneY + laneHalf + 1, cx, S - 1, 2, roadTile);  // S stub

    // Building rows: north band (y 2 to laneY-laneHalf-4) and south band
    const northY  = 3;
    const northH  = laneY - laneHalf - 4 - northY;  // ~22 for laneY=32
    const southY  = laneY + laneHalf + 3;
    const southH  = S - southY - 3;                  // ~22

    // Denser tiers pack more buildings by shrinking lot width and gap.
    const lotW    = { mh: 8, sd: 8, dn: 9, ex: isUrban ? 10 : 12, ba: 12 }[sizeTier] ?? (isUrban ? 10 : 12);
    const gap     = { mh: 1, sd: 1, dn: 2, ex: isUrban ? 2 : 3,   ba: 3  }[sizeTier] ?? (isUrban ? 2 : 3);
    const lotH    = Math.min(northH, { mh: 18, sd: 16, dn: 16, ex: isUrban ? 16 : 14, ba: 12 }[sizeTier] ?? 14);
    const buildW  = lotW;
    const buildH  = Math.min(lotH, 14);
    const dp      = Math.floor(buildW / 2) - 1;

    // North row — door faces south, positioned near the lane
    // South row — door faces north
    const northBldY = northY + (northH - buildH);  // flush to lane side
    const southBldY = southY;

    // Horizontal positions: avoid N-S stub road (x ≈ cx ± 1)
    const stubX0 = cx - 1, stubX1 = cx + 1;
    let x = 3;
    while (x + buildW <= S - 3) {
      // Skip if this lot spans the N-S stub road
      const overlapsStub = (x < stubX1 + 1) && (x + buildW > stubX0);
      if (!overlapsStub) {
        this._building(grid, x, northBldY, buildW, buildH, wallGnd, floorGnd, 'S', dp);
        if (southBldY + buildH <= S - 2)
          this._building(grid, x, southBldY, buildW, buildH, wallGnd, floorGnd, 'N', dp);
      }
      x += buildW + gap;
    }

    // Light garden scatter between buildings and road
    this._scatter(grid, 0, northY, S, northH - buildH, 0.05);
    this._scatter(grid, 0, southY + buildH, S, southH - buildH, 0.05);
  }

  // ── Economic district ──────────────────────────────────────────────────────

  _economic(grid, family, isUrban, roadTile, wallGnd, floorGnd, biomeTile) {
    const cx = S >> 1;

    // Access road from south + E-W cross road
    this._road(grid, cx, cx, cx, S - 1, 5, roadTile);
    this._road(grid, 0, cx, S - 1, cx, 3, roadTile);

    // Determine building mix by family
    const isMining  = family === 'mit';
    const isPort    = family === 'prt';
    const isRiver   = family === 'rvt';

    if (isMining) {
      // Mining: ore shed (large) + processing building
      this._building(grid, 4,  4,  36, 22, wallGnd, floorGnd, 'S', 17);
      this._building(grid, 44, 4,  16, 16, wallGnd, ROCKY_EARTH, 'S', 7);
      // Rocky yard
      this._rect(grid, 4, 28, 52, 4, SCREE, NONE);
      this._scatter(grid, 4, 26, 52, 6, 0.18, SMALL_ROCK);
    } else if (isPort || isRiver) {
      // Port / river: warehouse (wide) + dock shed
      this._building(grid, 4,  4,  40, 20, wallGnd, floorGnd, 'S', 19);
      this._building(grid, 48, 4,  12, 14, wallGnd, floorGnd, 'S', 5);
      // Quay loading area
      this._rect(grid, 4, 26, 54, 4, roadTile, NONE);
      this._scatter(grid, 4, 26, 54, 4, 0.12, PEBBLE);
    } else {
      // Standard: stable / cart yard (large) + workshop (medium)
      // Large building: stable / cartyard
      this._building(grid, 4,  4,  32, 22, wallGnd, floorGnd, 'S', 15);
      // Open yard
      this._rect(grid, 4, 27, 32, 5, biomeTile, NONE);
      this._scatter(grid, 4, 27, 32, 5, 0.10, PEBBLE);
      // Workshop east side
      this._building(grid, 40, 4,  20, 16, wallGnd, floorGnd, 'S', 9);
      // Granary / storage behind workshop
      this._building(grid, 40, 24, 14, 10, wallGnd, floorGnd, 'S', 6);
    }
  }

  // ── Military district ──────────────────────────────────────────────────────

  _military(grid, roadTile, wallGnd) {
    const cx = S >> 1;

    // Gate road
    this._road(grid, cx, cx, cx, S - 1, 4, roadTile);

    // Parade ground
    this._rect(grid, 4, 4, 56, 28, ROCKY_EARTH, NONE);

    // Barracks (long southern building)
    this._building(grid, 4, 36, 36, 20, wallGnd, STONE, 'N', 17);

    // Armory (east)
    this._building(grid, 44, 36, 16, 16, wallGnd, STONE, 'N', 7);

    // Watchtower stubs at north corners
    this._rect(grid, 4,      4, 6, 6, wallGnd, NONE);
    this._rect(grid, S - 10, 4, 6, 6, wallGnd, NONE);
  }

  // ── Civic / religious district ─────────────────────────────────────────────

  _civic(grid, sizeTier, isUrban, roadTile, wallGnd, floorGnd, biomeTile) {
    const cx = S >> 1;

    // Through-road — wider in larger settlements
    const rdW = { mh: 6, sd: 5, dn: 5, ex: 4, ba: 3 }[sizeTier] ?? 4;
    this._road(grid, cx, 0, cx, S - 1, rdW, roadTile);

    // Approach plaza — scales with tier
    const plW = { mh: 36, sd: 32, dn: 28, ex: 28, ba: 20 }[sizeTier] ?? 28;
    const plH = { mh: 12, sd: 10, dn: 8,  ex: 8,  ba: 6  }[sizeTier] ?? 8;
    this._rect(grid, cx - plW / 2, 28, plW, plH, roadTile, NONE);

    // Main civic building — larger in bigger settlements
    const bldW = { mh: 36, sd: 32, dn: 28, ex: 28, ba: 20 }[sizeTier] ?? 28;
    const bldH = { mh: 26, sd: 24, dn: 22, ex: 22, ba: 16 }[sizeTier] ?? 22;
    this._building(grid, cx - bldW / 2, 4, bldW, bldH, wallGnd,
      isUrban ? COBBLESTONE : PACKED_EARTH, 'S', Math.floor(bldW / 2) - 1);

    // Side outbuildings — added for dn/sd/mh tiers
    if (sizeTier === 'mh' || sizeTier === 'sd' || sizeTier === 'dn') {
      this._building(grid, 2,      36, 14, 16, wallGnd, floorGnd, 'E', 6);
      this._building(grid, S - 16, 36, 14, 16, wallGnd, floorGnd, 'W', 6);
    } else {
      this._building(grid, 2,      36, 12, 14, wallGnd, floorGnd, 'E', 6);
      this._building(grid, S - 14, 36, 12, 14, wallGnd, floorGnd, 'W', 6);
    }

    // Garden between outbuildings
    this._rect(grid, 16, 38, S - 32, 10, biomeTile, NONE);
    this._scatter(grid, 16, 38, S - 32, 10, 0.08);
  }

  // ── Farmland chunk ─────────────────────────────────────────────────────────
  //
  // Four large crop plots divided by spine roads, with furrow-line paths inside
  // each plot.  A cottage and barn are placed in opposite corners.
  // Spine roads connect seamlessly to adjacent settlement and farmland chunks.

  generateFarmland(grid, cell) {
    const baseElev = Math.round(
      (cell.farmlandBaseElev ?? cell.elevation ?? 0.3) * ELEV_LEVELS
    ) / ELEV_LEVELS;
    const palette   = getGroundPalette(cell.terrain, cell.moistureZone);
    const biomeTile = palette[0]?.g ?? EARTH;
    const isMoist   = ['temperate', 'wet'].includes(cell.moistureZone ?? '');

    this._flattenFarmElev(grid, baseElev);
    this._fill(grid, biomeTile, NONE);

    const cx = S >> 1, cy = S >> 1;   // 32
    const pathTile = PACKED_EARTH;

    // Spine roads (connect to neighbours — same centre as settlement chunks)
    this._road(grid, cx, 0,     cx, S - 1, 3, pathTile);
    this._road(grid, 0,  cy, S - 1, cy,   3, pathTile);

    // Four crop quadrants.  Road is 3 wide centred on cx/cy → occupies cx-1..cx+1.
    const westX  = 0,        westW  = cx - 1;          // 0..30
    const eastX  = cx + 2,   eastW  = S - eastX;       // 33..63
    const northY = 0,        northH = cy - 1;
    const southY = cy + 2,   southH = S - southY;

    const ns     = this._nSeed;
    const fieldA = isMoist ? GRASS     : EARTH;     // pasture / ploughed
    const fieldB = isMoist ? EARTH     : DRY_EARTH; // ploughed / fallow
    const fieldC = isMoist ? DRY_GRASS : EARTH;     // fallow / second-crop

    // Assign a crop type to each quadrant via hash so adjacent chunks vary
    const cropFor = (qx, qy) => {
      const h = tileHash(
        grid.macroX + (qx + 0.5) / S,
        grid.macroY + (qy + 0.5) / S, ns, 60
      );
      return h < 0.40 ? fieldA : h < 0.75 ? fieldB : fieldC;
    };

    const quadrants = [
      [westX, northY, westW, northH],   // NW
      [eastX, northY, eastW, northH],   // NE
      [westX, southY, westW, southH],   // SW
      [eastX, southY, eastW, southH],   // SE
    ];
    for (const [qx, qy, qw, qh] of quadrants) {
      const crop = cropFor(qx + qw / 2, qy + qh / 2);
      this._rect(grid, qx, qy, qw, qh, crop, NONE);
      // Furrow lines: two 1-tile PACKED_EARTH tracks divide each plot into thirds
      for (let s = 1; s <= 2; s++) {
        const furrowY = qy + Math.floor(qh * s / 3);
        this._road(grid, qx, furrowY, qx + qw - 1, furrowY, 1, pathTile);
      }
    }

    // Light hedge scatter on GRASS / EARTH plots (DRY_EARTH / DRY_GRASS excluded by _scatter)
    this._scatter(grid, 0, 0, S, S, 0.03, SHRUB);

    // ── Cottage and barn ───────────────────────────────────────────────────
    // Corners are in the outermost ~14 tiles on each axis — safely clear of
    // the cx/cy roads and of each other (opposite corners).
    const bldgCorners = [
      [3,  3 ],   // NW
      [49, 3 ],   // NE
      [3,  49],   // SW
      [49, 49],   // SE
    ];

    const ch = tileHash(grid.macroX + 0.25, grid.macroY + 0.25, ns, 62);
    const cottageIdx = Math.floor(ch * 4);
    const [cBx, cBy] = bldgCorners[cottageIdx];
    this._building(grid, cBx, cBy, 10, 8, STONE, PACKED_EARTH, 'S', 4);

    // Barn goes in the opposite corner so the two never overlap
    if (ch < 0.80) {
      const [bBx, bBy] = bldgCorners[(cottageIdx + 2) % 4];
      this._building(grid, bBx, bBy, 14, 10, STONE, PACKED_EARTH, 'S', 6);
    }

    // Cleanup: strip any stray scatter from hard-surface ground
    for (let i = 0; i < S * S; i++) {
      const g = grid.ground[i];
      if ((g === COBBLESTONE || g === PACKED_EARTH || g === STONE ||
           g === ROCKY_EARTH || g === SCREE        || g === DRY_EARTH) &&
          grid.obstacle[i] !== LARGE_ROCK) {
        grid.obstacle[i] = NONE;
      }
    }
  }

  // ── Dock chunk ─────────────────────────────────────────────────────────────
  //
  // Shore cell adjacent to a settlement footprint becomes a dock.
  // Normalized coordinate system: ny=0 = land side, ny=63 = water side.
  // A toReal() transform maps normalized coords to real tile coords for all
  // four possible orientations (landDir N/S/E/W).
  //
  // Layout (in normalized space):
  //   ny  0..19  — shore approach: WET_SAND/MUD + buildings
  //   ny 20..34  — dock platform: COBBLESTONE, lateral spine road at ny=32
  //   ny 35..63  — open water: DEEP_WATER (impassable)
  //   Piers: STONE tiles bridging from ny≈30 into water, raised to DOCK_E
  //
  // Fishing dock: two 3-wide piers + sheds + net markers
  // Trading dock: one 8-wide pier + warehouse + customs office + cargo scatter

  generateDock(grid, cell) {
    const landDir  = cell.dockLandDir ?? 'N';
    const dockType = cell.dockType    ?? 'fishing';
    const isMoist  = ['temperate', 'wet'].includes(cell.moistureZone ?? '');
    const cx       = S >> 1;   // 32

    // Normalized → real transform (ny=0 = land edge of the chunk)
    const toReal = (nx, ny) => ({
      N: [nx,       ny      ],
      S: [nx,       S-1-ny  ],
      W: [ny,       nx      ],
      E: [S-1-ny,   nx      ],
    })[landDir];

    const setN = (nx, ny, gnd, obs = NONE) => {
      if (nx < 0 || nx >= S || ny < 0 || ny >= S) return;
      const [tx, ty] = toReal(nx, ny);
      this._set(grid, tx, ty, gnd, obs);
    };

    const rectN = (nx, ny, nw, nh, gnd, obs = NONE) => {
      for (let dy = 0; dy < nh; dy++)
        for (let dx = 0; dx < nw; dx++) setN(nx+dx, ny+dy, gnd, obs);
    };

    // Building in normalised space — door faces dock (south wall = ny+bnh-1)
    const buildN = (bnx, bny, bnw, bnh, wallGnd, floorGnd) => {
      if (bnw < 4 || bnh < 4) return;
      rectN(bnx+1, bny+1, bnw-2, bnh-2, floorGnd, NONE);
      for (let dx = 0; dx < bnw; dx++) {
        setN(bnx+dx, bny,        wallGnd, LARGE_ROCK);
        setN(bnx+dx, bny+bnh-1, wallGnd, LARGE_ROCK);
      }
      for (let dy = 1; dy < bnh-1; dy++) {
        setN(bnx,        bny+dy, wallGnd, LARGE_ROCK);
        setN(bnx+bnw-1, bny+dy, wallGnd, LARGE_ROCK);
      }
      const dp = Math.floor(bnw/2) - 1;
      setN(bnx+dp,   bny+bnh-1, floorGnd, NONE);  // door gap
      setN(bnx+dp+1, bny+bnh-1, floorGnd, NONE);
    };

    // ── Elevation ────────────────────────────────────────────────────────────
    const LAND_E  = 2 / ELEV_LEVELS;  // 0.10 — shore approach
    const DOCK_E  = 1 / ELEV_LEVELS;  // 0.05 — platform & pier surface
    const WATER_E = 0;                 // 0.00 — open sea

    for (let ny = 0; ny < S; ny++) {
      const e = ny < 20 ? LAND_E : ny < 35 ? DOCK_E : WATER_E;
      for (let nx = 0; nx < S; nx++) {
        const [tx, ty] = toReal(nx, ny);
        grid.elevation[ty*S+tx] = e;
        grid.river[ty*S+tx]     = 0;
      }
    }

    // ── Base ground ──────────────────────────────────────────────────────────
    const shoreTile = isMoist ? MUD : WET_SAND;
    rectN(0,  0, S, 20, shoreTile,   NONE);  // shore approach
    rectN(0, 20, S, 15, COBBLESTONE, NONE);  // dock platform
    rectN(0, 35, S, 29, DEEP_WATER,  NONE);  // open water (impassable)

    // ── Roads ────────────────────────────────────────────────────────────────
    // Land spine: 3-wide COBBLESTONE from shore edge to dock platform end.
    // Connects this chunk to the settlement chunk on the land side.
    for (let ny = 0; ny <= 34; ny++)
      for (let dx = -1; dx <= 1; dx++) setN(cx+dx, ny, COBBLESTONE, NONE);

    // Lateral spine through dock platform — connects east/west shore neighbours.
    for (let nx = 0; nx < S; nx++) setN(nx, cx, COBBLESTONE, NONE); // ny=32

    // ── Pier builder ─────────────────────────────────────────────────────────
    // Piers root in the dock platform and extend into open water.
    // Water-zone pier tiles get their elevation overridden to DOCK_E so they
    // appear as raised stone walkways above the sea surface.
    const pier = (px, pw, py_start, py_end) => {
      for (let ny = py_start; ny <= py_end; ny++) {
        for (let dx = 0; dx < pw; dx++) {
          setN(px+dx, ny, STONE, NONE);
          if (ny >= 35) {
            const [tx, ty] = toReal(px+dx, ny);
            grid.elevation[ty*S+tx] = DOCK_E;
          }
        }
      }
    };

    // ── Dock-type layout ─────────────────────────────────────────────────────

    if (dockType === 'fishing') {
      // Shore buildings
      buildN( 2, 2, 14, 12, STONE, PACKED_EARTH);  // fishing shack
      buildN(48, 2, 14, 10, STONE, PACKED_EARTH);  // net storage shed

      // Barrel/bollard row at loading strip
      for (let nx = 20; nx < 44; nx += 6) setN(nx, 19, COBBLESTONE, SMALL_ROCK);

      // Two narrow piers — offset either side of the centre road
      pier(cx - 14, 3, 30, 54);
      pier(cx + 10, 3, 30, 54);

      // Mooring posts at pier tips
      for (let dx = 0; dx < 3; dx++) {
        setN(cx-14+dx, 53, STONE, SMALL_ROCK);
        setN(cx+10+dx, 53, STONE, SMALL_ROCK);
      }

      // Reed/net markers floating beside pier ends
      for (let nx = cx-18; nx <= cx-12; nx++) setN(nx, 56, DEEP_WATER, REED);
      for (let nx = cx+ 8; nx <= cx+14; nx++) setN(nx, 56, DEEP_WATER, REED);

    } else {  // trading

      // Shore buildings
      buildN( 2, 2, 36, 14, STONE, COBBLESTONE);  // warehouse
      buildN(42, 2, 20, 12, STONE, COBBLESTONE);  // customs / harbour office

      // One wide central pier
      pier(cx - 4, 8, 30, 58);

      // Cargo crates flanking pier on dock platform
      for (let nx = 4; nx <= cx-6; nx += 5)  setN(nx, 26, COBBLESTONE, SMALL_ROCK);
      for (let nx = cx+5; nx <= S-5; nx += 5) setN(nx, 26, COBBLESTONE, SMALL_ROCK);
      // Heavy cargo near pier base
      setN(cx-5, 33, COBBLESTONE, BOULDER);
      setN(cx+4, 33, COBBLESTONE, BOULDER);

      // Mooring posts at pier end corners
      setN(cx-4, 58, STONE, SMALL_ROCK);
      setN(cx+3, 58, STONE, SMALL_ROCK);
    }

    // No scatter call — obstacle placement is manual and intentional.
    // No generic cleanup needed (we never called _scatter here).
  }

  _flattenFarmElev(grid, base) {
    // Gentler noise than settlement (1.0 vs 0.4 levels) — farmland rolls gently
    // but is never as rough as wilderness terrain.
    const ns = this._nSeed;
    for (let ty = 0; ty < S; ty++)
      for (let tx = 0; tx < S; tx++) {
        // Preserve elevation carved by _buildRiver
        if (grid.river[ty * S + tx]) continue;
        const micro = worldMicroNoise(
          grid.macroX + (tx + 0.5) / S,
          grid.macroY + (ty + 0.5) / S, ns
        ) * (1.0 / ELEV_LEVELS);
        grid.elevation[ty * S + tx] =
          Math.round(Math.max(0, Math.min(1, base + micro)) * ELEV_LEVELS) / ELEV_LEVELS;
      }
  }

  // ── Edge / transition district ─────────────────────────────────────────────

  _edge(grid, roadTile, biomeTile) {
    const cx = S >> 1;
    const cy = S >> 1;

    // Road stubs (connect to adjacent chunks)
    this._road(grid, cx, 0,      cx, cy, 3, roadTile);
    this._road(grid, 0,  cy, cx, cy, 3, roadTile);

    // One small edge building
    this._building(grid, 3, 3, 10, 10, STONE, PACKED_EARTH, 'S', 4);

    // Natural vegetation scatter that increases away from road
    const ns = this._nSeed;
    const obs = [PEBBLE, SMALL_ROCK, SHRUB, TALL_GRASS, DEAD_SHRUB, DENSE_SHRUB];
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i = ty * S + tx;
        if (grid.obstacle[i] === LARGE_ROCK) continue;
        const g = grid.ground[i];
        if (g === COBBLESTONE || g === PACKED_EARTH || g === STONE ||
            g === ROCKY_EARTH || g === SCREE    || g === DRY_EARTH) continue;

        const distFromRoad = Math.min(
          Math.abs(tx - cx), Math.abs(ty - cy)
        );
        const density = 0.05 + (distFromRoad / S) * 0.22;
        const h = tileHash(grid.macroX + (tx + 0.5) / S, grid.macroY + (ty + 0.5) / S, ns, 50);
        if (h < density) {
          const p = tileHash(grid.macroX + tx / S, grid.macroY + ty / S, ns, 51);
          grid.obstacle[i] = obs[Math.floor(p * obs.length)];
        }
      }
    }
  }
}
