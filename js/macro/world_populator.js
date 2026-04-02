// WorldPopulator: places kingdoms, ancient sites, settlements, and POIs onto a MacroMap.
// Call after WorldGen.generate() to layer civilisation on top of terrain.
//
// Usage:
//   const populator = new WorldPopulator();
//   const worldData = populator.populate(map, seed);
//   // worldData: { kingdoms, ancientSites, pois }

import { TERRAIN } from '../data/terrain_data.js';

// ---------- RNG (Mulberry32 — matches world_gen.js) ----------
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngInt(rng, lo, hi)      { return lo + Math.floor(rng() * (hi - lo + 1)); }
function rngBetween(rng, lo, hi)  { return lo + rng() * (hi - lo); }
function pick(rng, arr)           { return arr[Math.floor(rng() * arr.length)]; }

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Name syllables ----------
const KG_PRE  = ['Val','Thorn','Az','Drem','Pel','Sun','Iron','Cold','Mor','Kar','Vel','Eld','Arm','Bel','Crest','Gal','Vor','Ral'];
const KG_SUF  = ['dris','holt','mark','hold','oria','veil','mere','watch','ford','heim','rath','mont','vale','burg','keep','march'];
const CT_PRE  = ['River','Stone','Black','White','High','Old','New','East','West','North','Red','Grey','Dark','Bright','Crow','Ember'];
const CT_SUF  = ['ford','bridge','haven','keep','gate','wick','burg','mill','field','moor','cross','well','wood','port','hollow','helm'];
const AN_PRE  = ['Aelthar','Vael','Doru','Iskar','Ulmeth','Carath','Sorvane','Aethon','Ilmar','Kelvar','Theron','Maerath','Solvar','Daeun'];
const AN_SUF  = ['','\'s Rest','\'s Fall','ath','esk','ion','ara','el','orn','is'];

function genKingdomName(rng)  { return pick(rng, KG_PRE) + pick(rng, KG_SUF); }
function genCityName(rng)     { return pick(rng, CT_PRE) + pick(rng, CT_SUF); }
function genAncientName(rng)  { return pick(rng, AN_PRE) + pick(rng, AN_SUF); }
function genFortName(rng)     { return 'Fort ' + pick(rng, KG_PRE); }

// ---------- Kingdom colours ----------
const KINGDOM_COLORS = [
  0x4477bb, 0xbb4444, 0x44aa44, 0xaaaa22,
  0xaa44aa, 0x44aaaa, 0xcc7722, 0x7744cc,
];
export const ELF_COLOR   = 0x33cc77;
export const DWARF_COLOR = 0x997733;

// ---------- Terrain traversal costs ----------
function terrainCost(terrain) {
  switch (terrain) {
    case TERRAIN.FLAT:          return 1;
    case TERRAIN.HILLS:         return 2;
    case TERRAIN.SHALLOW_SHORE: return 4;
    case TERRAIN.MOUNTAIN:      return 8;
    case TERRAIN.STEEP_MOUNTAIN:return 16;
    case TERRAIN.PEAK:          return 40;
    default:                    return 9999; // ocean, steep_shore — impassable
  }
}

function habitScore(terrain) {
  switch (terrain) {
    case TERRAIN.FLAT:  return 4;
    case TERRAIN.HILLS: return 3;
    case TERRAIN.MOUNTAIN: return 1;
    default: return 0;
  }
}

// ---------- Binary min-heap ----------
class MinHeap {
  constructor() { this._h = []; }
  get size()    { return this._h.length; }

  push(item, priority) {
    this._h.push({ item, priority });
    this._up(this._h.length - 1);
  }

  pop() {
    if (!this._h.length) return undefined;
    const top = this._h[0].item;
    const last = this._h.pop();
    if (this._h.length) { this._h[0] = last; this._down(0); }
    return top;
  }

  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._h[p].priority <= this._h[i].priority) break;
      [this._h[p], this._h[i]] = [this._h[i], this._h[p]];
      i = p;
    }
  }
  _down(i) {
    const n = this._h.length;
    for (;;) {
      let m = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this._h[l].priority < this._h[m].priority) m = l;
      if (r < n && this._h[r].priority < this._h[m].priority) m = r;
      if (m === i) break;
      [this._h[m], this._h[i]] = [this._h[i], this._h[m]];
      i = m;
    }
  }
}

// ---------- Geometry helpers ----------
function dist(x1, y1, x2, y2) { return Math.sqrt((x1-x2)**2 + (y1-y2)**2); }

// ---------- WorldPopulator ----------
export class WorldPopulator {
  populate(map, seed) {
    const rng = makeRng((seed ^ 0xDEAD1234) >>> 0);

    const scores      = this._scoreHabitability(map);
    const ancientSites = this._placeAncientSites(map, scores, rng);
    const kingdoms    = this._placeKingdoms(map, scores, ancientSites, rng);
    this._growTerritories(map, kingdoms);
    this._placeSettlements(map, kingdoms, scores, ancientSites, rng);
    const pois        = this._placePOIs(map, kingdoms, ancientSites, rng);

    return { kingdoms, ancientSites, pois };
  }

  // ----------------------------------------------------------------
  // Habitability scoring
  // ----------------------------------------------------------------
  _scoreHabitability(map) {
    const W = map.width, H = map.height;
    const scores = new Float32Array(W * H);
    const DIRS4  = [[-1,0],[1,0],[0,-1],[0,1]];

    // BFS from ocean cells → coast distance for every cell
    const coastDist = new Float32Array(W * H).fill(9999);
    const q = [];
    map.forEach((cell, x, y) => {
      if (cell?.terrain === TERRAIN.OCEAN) {
        coastDist[y*W+x] = 0;
        q.push(x, y);
      }
    });
    for (let qi = 0; qi < q.length; qi += 2) {
      const cx = q[qi], cy = q[qi+1];
      for (const [dx, dy] of DIRS4) {
        const nx = cx+dx, ny = cy+dy;
        if (!map.inBounds(nx, ny)) continue;
        const idx = ny*W+nx;
        if (coastDist[idx] < 9999) continue;
        coastDist[idx] = coastDist[cy*W+cx] + 1;
        q.push(nx, ny);
      }
    }

    // Score each land cell
    map.forEach((cell, x, y) => {
      if (!cell?.isLand()) return;
      let s = habitScore(cell.terrain);
      if (s === 0) return;

      const cd = coastDist[y*W+x];
      if      (cd <= 3)  s += 3;
      else if (cd <= 8)  s += 2;
      else if (cd <= 15) s += 1;

      if (cell.hasRiver()) s += 3;

      scores[y*W+x] = s;
    });

    return scores;
  }

  // ----------------------------------------------------------------
  // Pick N spaced points from land cells (score-weighted)
  // ----------------------------------------------------------------
  _pickSpaced(map, scores, count, minDist, minScore = 1) {
    const W = map.width;
    const cands = [];
    map.forEach((cell, x, y) => {
      if (scores[y*W+x] >= minScore) cands.push({ x, y });
    });
    // Sort descending by score, so highest-value spots are tried first
    cands.sort((a, b) => scores[b.y*W+b.x] - scores[a.y*W+a.x]);

    const picked = [];
    for (const c of cands) {
      if (picked.length >= count) break;
      if (picked.every(p => dist(p.x, p.y, c.x, c.y) >= minDist)) picked.push(c);
    }
    return picked;
  }

  // ----------------------------------------------------------------
  // Ancient sites  (pre-civilisation ruins layer)
  // ----------------------------------------------------------------
  _placeAncientSites(map, scores, rng) {
    const W     = map.width;
    const count = rngInt(rng, 9, 14);
    const spots = this._pickSpaced(map, scores, count, 22, 3);

    const types = ['ancient_capital', 'ancient_capital', 'ancient_capital',
                   'ancient_city', 'ancient_city', 'ancient_city',
                   'ancient_city', 'ancient_outpost'];

    const sites = spots.map((s, i) => ({
      id:   `anc_${i}`,
      x:    s.x, y: s.y,
      type: types[Math.min(i, types.length - 1)],
      name: genAncientName(rng),
      overlaidBySettlement: null,
    }));

    // Mark cells
    for (const site of sites) {
      const cell = map.get(site.x, site.y);
      if (cell) cell.ancientSiteType = site.type;
    }

    return sites;
  }

  // ----------------------------------------------------------------
  // Kingdoms (capitals first, territory grown later)
  // ----------------------------------------------------------------
  _placeKingdoms(map, scores, ancientSites, rng) {
    const count  = rngInt(rng, 3, 5);
    const caps   = this._pickSpaced(map, scores, count, 40, 4);

    const kingdoms = caps.map((cap, i) => ({
      id:       `k_${i}`,
      name:     genKingdomName(rng),
      capitalX: cap.x, capitalY: cap.y,
      color:    KINGDOM_COLORS[i % KINGDOM_COLORS.length],
      race:     'human',
      settlements: [],
    }));

    // Check if capital is near an ancient site (built over ruins)
    for (const k of kingdoms) {
      const nearby = ancientSites.find(s =>
        !s.overlaidBySettlement && dist(k.capitalX, k.capitalY, s.x, s.y) <= 5 && rng() < 0.5
      );
      k.builtOverAncient = nearby?.id ?? null;
      if (nearby) nearby.overlaidBySettlement = `${k.id}_capital`;
    }

    return kingdoms;
  }

  // ----------------------------------------------------------------
  // Territory expansion — simultaneous Dijkstra from all capitals
  // ----------------------------------------------------------------
  _growTerritories(map, kingdoms) {
    const W    = map.width;
    const N    = kingdoms.length;
    const dist_ = new Float32Array(W * map.height).fill(Infinity);
    const owner = new Int16Array(W * map.height).fill(-1);
    const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]];

    const heap = new MinHeap();
    kingdoms.forEach((k, i) => {
      const idx = k.capitalY * W + k.capitalX;
      dist_[idx] = 0;
      owner[idx]  = i;
      map.get(k.capitalX, k.capitalY).ownerFactionId = k.id;
      heap.push({ x: k.capitalX, y: k.capitalY, ki: i, d: 0 }, 0);
    });

    while (heap.size > 0) {
      const { x, y, ki, d } = heap.pop();
      if (d > dist_[y * W + x]) continue; // stale entry

      for (const [dx, dy] of DIRS4) {
        const nx = x+dx, ny = y+dy;
        if (!map.inBounds(nx, ny)) continue;
        const cell = map.get(nx, ny);
        if (!cell) continue;
        const cost = terrainCost(cell.terrain);
        if (cost >= 9999) continue;

        const idx     = ny * W + nx;
        const newDist = d + cost;
        if (newDist < dist_[idx]) {
          dist_[idx] = newDist;
          owner[idx]  = ki;
          cell.ownerFactionId = kingdoms[ki].id;
          heap.push({ x: nx, y: ny, ki, d: newDist }, newDist);
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Footprint: organic BFS expansion from a core cell.
  // Returns array of {x,y} where [0] is always the core.
  // Only expands onto unoccupied land (not ocean, peaks, or cells
  // already claimed by another settlement).
  // ----------------------------------------------------------------
  _buildFootprint(map, cx, cy, maxCells, rng) {
    const DIRS4   = [[-1,0],[1,0],[0,-1],[0,1]];
    const cells   = [{ x: cx, y: cy }];
    const visited = new Set([`${cx},${cy}`]);
    const queue   = [{ x: cx, y: cy }];

    while (cells.length < maxCells && queue.length > 0) {
      // Random pick from queue → irregular shape instead of strict BFS ring
      const qi = Math.floor(rng() * queue.length);
      const { x, y } = queue.splice(qi, 1)[0];

      const dirs = shuffle(rng, DIRS4);
      for (const [dx, dy] of dirs) {
        if (cells.length >= maxCells) break;
        const nx = x+dx, ny = y+dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!map.inBounds(nx, ny)) continue;
        const cell = map.get(nx, ny);
        if (!cell?.isLand()) continue;
        if (cell.terrain === TERRAIN.PEAK || cell.terrain === TERRAIN.STEEP_MOUNTAIN
            || cell.terrain === TERRAIN.STEEP_SHORE) continue;
        if (cell.settlementType) continue; // already part of another settlement
        visited.add(key);
        cells.push({ x: nx, y: ny });
        queue.push({ x: nx, y: ny });
      }
    }

    return cells;
  }

  // Mark every cell in a footprint with the given type/id.
  _stampFootprint(map, footprint, type, id) {
    for (const fc of footprint) {
      const cell = map.get(fc.x, fc.y);
      if (cell) { cell.settlementType = type; cell.settlementId = id; }
    }
  }

  // ----------------------------------------------------------------
  // Settlements: city (capital), towns, villages, forts
  //
  // Footprint sizes:
  //   capital city  — 6–10 cells
  //   town          — 3–5 cells
  //   village       — 1–2 cells
  //   fort          — 1 cell (castle only)
  //
  // footprint[0] is always the core / castle cell.
  // ----------------------------------------------------------------
  _placeSettlements(map, kingdoms, scores, ancientSites, rng) {
    const W = map.width;

    for (const k of kingdoms) {
      // --- Capital city ---
      const capId   = `${k.id}_capital`;
      const capFP   = this._buildFootprint(map, k.capitalX, k.capitalY, rngInt(rng, 6, 10), rng);
      this._stampFootprint(map, capFP, 'city', capId);
      k.settlements.push({
        id: capId, type: 'city', name: genCityName(rng),
        coreX: k.capitalX, coreY: k.capitalY,
        footprint: capFP, isCapital: true,
        builtOverAncient: k.builtOverAncient ?? null,
      });
      this._assignSettlementProfile(k.settlements[k.settlements.length - 1], map, rng);

      // Gather territory cells sorted by score for town/village placement
      const territory = [];
      map.forEach((cell, x, y) => {
        if (cell?.ownerFactionId === k.id && cell.isLand()) territory.push({ x, y });
      });
      const byScore = territory.slice().sort((a, b) => scores[b.y*W+b.x] - scores[a.y*W+a.x]);

      const placedCores = [{ x: k.capitalX, y: k.capitalY }];

      // --- Secondary cities (0–1 per kingdom) ---
      // Large kingdoms get a roughly 50% chance of having a second city-scale
      // settlement.  It must be far from the capital and sit on high-value land.
      if (rng() < 0.5) {
        const seccCands = byScore.filter(c => {
          const sc = map.get(c.x, c.y);
          if (!sc?.isLand() || sc.settlementType) return false;
          if (sc.terrain === TERRAIN.MOUNTAIN || sc.terrain === TERRAIN.STEEP_MOUNTAIN
              || sc.terrain === TERRAIN.PEAK   || sc.terrain === TERRAIN.STEEP_SHORE) return false;
          return placedCores.every(p => dist(p.x, p.y, c.x, c.y) >= 20);
        });
        if (seccCands.length > 0) {
          const c   = seccCands[0];
          const sId = `${k.id}_city_0`;
          const fp  = this._buildFootprint(map, c.x, c.y, rngInt(rng, 4, 7), rng);
          this._stampFootprint(map, fp, 'city', sId);
          k.settlements.push({
            id: sId, type: 'city', name: genCityName(rng),
            coreX: c.x, coreY: c.y,
            footprint: fp, isCapital: false, builtOverAncient: null,
          });
          this._assignSettlementProfile(k.settlements[k.settlements.length - 1], map, rng);
          placedCores.push(c);
        }
      }

      // --- Towns ---
      const townCount = rngInt(rng, 2, 4);
      let towns = 0;
      for (const c of byScore) {
        if (towns >= townCount) break;
        const cell = map.get(c.x, c.y);
        if (!cell?.isLand() || cell.settlementType) continue;
        if (placedCores.every(p => dist(p.x, p.y, c.x, c.y) >= 15)) {
          const sId  = `${k.id}_town_${towns}`;
          const fp   = this._buildFootprint(map, c.x, c.y, rngInt(rng, 3, 5), rng);
          this._stampFootprint(map, fp, 'town', sId);
          const nearAnc = ancientSites.find(s =>
            !s.overlaidBySettlement && dist(c.x, c.y, s.x, s.y) <= 4 && rng() < 0.35
          );
          if (nearAnc) nearAnc.overlaidBySettlement = sId;
          k.settlements.push({
            id: sId, type: 'town', name: genCityName(rng),
            coreX: c.x, coreY: c.y,
            footprint: fp, isCapital: false,
            builtOverAncient: nearAnc?.id ?? null,
          });
          this._assignSettlementProfile(k.settlements[k.settlements.length - 1], map, rng);
          placedCores.push(c);
          towns++;
        }
      }

      // --- Villages ---
      const villageCount = rngInt(rng, 3, 6);
      const shuffledTerr = shuffle(rng, territory);
      let villages = 0;
      for (const c of shuffledTerr) {
        if (villages >= villageCount) break;
        const cell = map.get(c.x, c.y);
        if (!cell?.isLand() || cell.settlementType) continue;
        if (cell.terrain === TERRAIN.MOUNTAIN || cell.terrain === TERRAIN.STEEP_MOUNTAIN
            || cell.terrain === TERRAIN.PEAK   || cell.terrain === TERRAIN.STEEP_SHORE) continue;
        if (placedCores.every(p => dist(p.x, p.y, c.x, c.y) >= 8)) {
          const sId = `${k.id}_village_${villages}`;
          const fp  = this._buildFootprint(map, c.x, c.y, rngInt(rng, 1, 2), rng);
          this._stampFootprint(map, fp, 'village', sId);
          k.settlements.push({
            id: sId, type: 'village', name: genCityName(rng),
            coreX: c.x, coreY: c.y,
            footprint: fp, isCapital: false, builtOverAncient: null,
          });
          this._assignSettlementProfile(k.settlements[k.settlements.length - 1], map, rng);
          placedCores.push(c);
          villages++;
        }
      }

      // --- Forts — at borders near mountain passes (single cell) ---
      const fortCount = rngInt(rng, 1, 2);
      const borderFortCands = territory.filter(c => {
        const cell = map.get(c.x, c.y);
        if (!cell?.isLand() || cell.settlementType) return false;
        if (cell.terrain === TERRAIN.PEAK || cell.terrain === TERRAIN.STEEP_MOUNTAIN) return false;
        const nearMtn = map.neighbors8(c.x, c.y).some(n =>
          n.cell?.terrain === TERRAIN.MOUNTAIN || n.cell?.terrain === TERRAIN.STEEP_MOUNTAIN
        );
        const atBorder = map.neighbors4(c.x, c.y).some(n =>
          n.cell && n.cell.ownerFactionId !== k.id
        );
        return nearMtn && atBorder;
      });
      let forts = 0;
      for (const c of shuffle(rng, borderFortCands)) {
        if (forts >= fortCount) break;
        const cell = map.get(c.x, c.y);
        if (!cell || cell.settlementType) continue;
        if (placedCores.every(p => dist(p.x, p.y, c.x, c.y) >= 12)) {
          const sId = `${k.id}_fort_${forts}`;
          this._stampFootprint(map, [c], 'fort', sId);
          k.settlements.push({
            id: sId, type: 'fort', name: genFortName(rng),
            coreX: c.x, coreY: c.y,
            footprint: [c], isCapital: false, builtOverAncient: null,
          });
          this._assignSettlementProfile(k.settlements[k.settlements.length - 1], map, rng);
          placedCores.push(c);
          forts++;
        }
      }
    }

    // Ancient sites not overlaid by any current settlement → mark as ruins
    for (const site of ancientSites) {
      if (site.overlaidBySettlement) continue;
      const cell = map.get(site.x, site.y);
      if (cell && !cell.settlementType) {
        cell.settlementType = 'ruins';
        cell.settlementId   = site.id;
      }
    }
  }

  // ----------------------------------------------------------------
  // Assign family / size tier / condition / population to a settlement.
  // Mutates the record in-place.
  // ----------------------------------------------------------------
  _assignSettlementProfile(sett, map, rng) {
    const cell     = map.get(sett.coreX, sett.coreY);
    const terrain  = cell?.terrain ?? TERRAIN.FLAT;
    const hasRiver = cell?.hasRiver?.() ?? false;

    const nbrs8 = map.neighbors8(sett.coreX, sett.coreY);
    const isCoastal = terrain === TERRAIN.SHALLOW_SHORE
      || nbrs8.some(n => n.cell?.terrain === TERRAIN.SHALLOW_SHORE
                      || n.cell?.terrain === TERRAIN.OCEAN
                      || n.cell?.terrain === TERRAIN.STEEP_SHORE);
    const nearMountain = terrain === TERRAIN.MOUNTAIN
      || terrain === TERRAIN.STEEP_MOUNTAIN
      || terrain === TERRAIN.PEAK
      || nbrs8.some(n => n.cell?.terrain === TERRAIN.MOUNTAIN
                      || n.cell?.terrain === TERRAIN.STEEP_MOUNTAIN
                      || n.cell?.terrain === TERRAIN.PEAK);
    const miningZone = terrain === TERRAIN.HILLS && nearMountain;

    // Family
    let family;
    if (sett.type === 'fort') {
      family = nearMountain ? 'hft' : 'gat';
    } else if (sett.isCapital) {
      family = isCoastal ? 'prt' : 'crt';
    } else if (sett.type === 'village') {
      if (hasRiver)        family = 'rsv';
      else if (nearMountain) family = 'rmt';
      else                 family = 'sht';
    } else {
      // town
      if (isCoastal)        family = 'prt';
      else if (hasRiver)    family = 'rvt';
      else if (miningZone)  family = 'mit';
      else if (nearMountain) family = terrain === TERRAIN.HILLS ? 'hft' : 'rmt';
      else                  family = rng() < 0.5 ? 'mnv' : 'sht';
    }

    // Size tier & population
    let sizeTier, popMin, popMax;
    if (sett.isCapital) {
      sizeTier = rng() < 0.6 ? 'sd' : 'dn';
      [popMin, popMax] = sizeTier === 'sd' ? [4000, 8000] : [1500, 4000];
    } else if (sett.type === 'city') {
      sizeTier = 'dn'; [popMin, popMax] = [1500, 4000];
    } else if (sett.type === 'town') {
      sizeTier = rng() < 0.5 ? 'ex' : 'dn';
      [popMin, popMax] = sizeTier === 'dn' ? [1500, 4000] : [500, 1500];
    } else {
      sizeTier = 'ba'; [popMin, popMax] = [100, 500];
    }
    const population = rngInt(rng, popMin, popMax);

    // Condition
    let condition;
    if (sett.type === 'fort') {
      condition = rng() < 0.6 ? 'mil' : 'fort';
    } else if (sett.builtOverAncient) {
      condition = rng() < 0.5 ? 'pros' : 'base';
    } else if (sett.isCapital) {
      condition = rng() < 0.4 ? 'pros' : 'base';
    } else {
      const roll = rng();
      if      (roll < 0.12) condition = 'pros';
      else if (roll < 0.18) condition = 'negl';
      else if (roll < 0.22) condition = 'dmg';
      else                  condition = 'base';
    }

    // Role tags
    const roleTags = [];
    if (hasRiver)             roleTags.push('river');
    if (isCoastal)            roleTags.push('coastal');
    if (nearMountain)         roleTags.push('highland');
    if (sett.isCapital)       roleTags.push('seat_of_power');
    if (sett.builtOverAncient) roleTags.push('ancient_foundation');

    sett.family     = family;
    sett.sizeTier   = sizeTier;
    sett.condition  = condition;
    sett.population = population;
    sett.roleTags   = roleTags;

    // District sequence: footprint[0] = core, subsequent cells get district types
    // based on settlement type so chunk_gen can generate appropriate layouts.
    const DISTRICT_SEQ = {
      city:    ['core', 'econ', 'res', 'civ', 'res', 'econ', 'res', 'edge', 'edge', 'edge'],
      town:    ['core', 'res',  'econ', 'res', 'edge'],
      village: ['core', 'edge'],
      fort:    ['mil'],
    };
    // All district chunks share the core cell's elevation so there are no
    // visible height steps between adjacent settlement districts.
    const coreElev = map.get(sett.coreX, sett.coreY)?.elevation ?? 0.3;

    const seq = DISTRICT_SEQ[sett.type] ?? ['core'];
    for (let i = 0; i < (sett.footprint?.length ?? 0); i++) {
      const fc      = sett.footprint[i];
      const fc_cell = map.get(fc.x, fc.y);
      if (!fc_cell) continue;
      fc_cell.settlementFamily   = family;
      fc_cell.settlementDistrict = seq[Math.min(i, seq.length - 1)];
      fc_cell.settlementBaseElev = coreElev;
      fc_cell.sizeTier           = sizeTier;
      fc_cell.condition          = condition;
    }

    // Farmland ring — flat land cells adjacent to the footprint but outside it.
    // These cells get chunk_gen routed to the farmland generator instead of
    // normal terrain so the player sees farm plots around every settlement.
    const farmLimit = { city: 10, town: 5, village: 3, fort: 1 }[sett.type] ?? 0;
    if (farmLimit > 0) {
      const footSet = new Set((sett.footprint ?? []).map(fc => `${fc.x},${fc.y}`));
      const FARMABLE = new Set([TERRAIN.FLAT, TERRAIN.HILLS]);
      const seen = new Set(footSet);
      const candidates = [];
      for (const fc of sett.footprint ?? []) {
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          const key = `${fc.x + dx},${fc.y + dy}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const nc = map.get(fc.x + dx, fc.y + dy);
          if (!nc || !FARMABLE.has(nc.terrain)) continue;
          if (nc.settlementType || nc.isFarmland) continue;
          candidates.push(nc);
        }
      }
      for (let i = 0; i < Math.min(farmLimit, candidates.length); i++) {
        candidates[i].isFarmland       = true;
        candidates[i].farmlandOf       = sett.id;
        candidates[i].farmlandBaseElev = coreElev;
      }
    }

    // Dock cells — coastal settlements only.
    // Shore cells (shallow_shore / steep_shore) adjacent to the footprint become
    // dedicated dock chunks.  Fishing docks are the default; trading families
    // get alternating fishing + trading piers.
    if (isCoastal) {
      const SHORE_T = new Set([TERRAIN.SHALLOW_SHORE, TERRAIN.STEEP_SHORE]);
      const dockLimit = { city: 4, town: 3, village: 2, fort: 1 }[sett.type] ?? 0;
      const tradingFamilies = new Set(['prt', 'crt', 'gat', 'rvt', 'mnv']);
      let dockCount = 0;

      outer:
      for (const fc of sett.footprint ?? []) {
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          if (dockCount >= dockLimit) break outer;
          const nc = map.get(fc.x + dx, fc.y + dy);
          if (!nc || !SHORE_T.has(nc.terrain)) continue;
          if (nc.settlementType || nc.isFarmland || nc.isDock) continue;
          // Direction FROM the dock cell TOWARD the settlement (land side)
          const landDir = dx === -1 ? 'E' : dx === 1 ? 'W' : dy === -1 ? 'S' : 'N';
          // Trading families get alternating dock types; others default to fishing
          const dockType = tradingFamilies.has(family) && (dockCount % 2 === 0)
            ? 'trading' : 'fishing';
          nc.isDock      = true;
          nc.dockOf      = sett.id;
          nc.dockType    = dockType;
          nc.dockLandDir = landDir;
          dockCount++;
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Points of interest: monster lairs, tribal villages, battle sites, dungeons
  // ----------------------------------------------------------------
  _placePOIs(map, kingdoms, ancientSites, rng) {
    const pois = [];

    // --- Monster lairs & tribal villages ---
    // ~1/3 of "lairs" are actually primitive tribal settlements (2-4 cell footprint)
    // under a warchief — goblins, orcs, kobolds, etc. in hills/lowlands.
    // True lairs (caves, nests) favour peaks and steep terrain.
    const wildCells = [];
    map.forEach((cell, x, y) => {
      if (!cell?.isLand() || cell.settlementType || cell.poiType) return;
      if (cell.terrain === TERRAIN.PEAK || cell.terrain === TERRAIN.STEEP_MOUNTAIN
          || cell.terrain === TERRAIN.MOUNTAIN || cell.terrain === TERRAIN.HILLS
          || cell.terrain === TERRAIN.FLAT) {
        wildCells.push({ x, y });
      }
    });
    const lairCands  = shuffle(rng, wildCells);
    const lairPlaced = [];
    const lairCount  = rngInt(rng, 15, 25);

    for (const c of lairCands) {
      if (lairPlaced.length >= lairCount) break;
      if (lairPlaced.every(p => dist(p.x, p.y, c.x, c.y) >= 10)) {
        const cell = map.get(c.x, c.y);
        if (!cell) continue;

        // Decide: tribal village (prefers hills/flat, not peaks) or true lair
        const canBeTribal = cell.terrain === TERRAIN.HILLS || cell.terrain === TERRAIN.FLAT;
        const isTribal    = canBeTribal && rng() < 0.35;

        if (isTribal) {
          // Primitive tribal settlement — small footprint, single warchief
          const tribeId  = `poi_tribe_${lairPlaced.length}`;
          const fp       = this._buildFootprint(map, c.x, c.y, rngInt(rng, 2, 4), rng);
          this._stampFootprint(map, fp, 'village', tribeId); // reuse village type so it blocks other stamps
          for (const fc of fp) {
            const fc_cell = map.get(fc.x, fc.y);
            if (fc_cell) fc_cell.poiType = 'monster_lair'; // still hostile
          }
          const tribeEntry = pick(rng, TRIBE_ENTRIES);
          pois.push({
            id:          tribeId,
            type:        'tribal_village',
            subtype:     tribeEntry.race,
            x: c.x,     y: c.y,
            footprint:   fp,
            dangerLevel: rngInt(rng, 1, 3),
            name:        tribeEntry.title + ' of ' + pick(rng, TRIBE_NAMES),
          });
        } else {
          // True lair — single cell
          cell.poiType = 'monster_lair';
          pois.push({
            id:  `poi_lair_${lairPlaced.length}`,
            type: 'monster_lair', x: c.x, y: c.y,
            dangerLevel: rngInt(rng, 1, 5),
            name: pick(rng, LAIR_NAMES) + ' ' + pick(rng, LAIR_SUFFIXES),
          });
        }

        lairPlaced.push(c);
      }
    }

    // --- Old battle sites: near kingdom borders ---
    const borderCells = [];
    map.forEach((cell, x, y) => {
      if (!cell?.isLand() || cell.settlementType || cell.poiType) return;
      const nbrs = map.neighbors4(x, y);
      const owners = new Set(nbrs.map(n => n.cell?.ownerFactionId).filter(Boolean));
      if (owners.size >= 2 || (!cell.ownerFactionId && nbrs.some(n => n.cell?.ownerFactionId))) {
        borderCells.push({ x, y });
      }
    });
    const battleCands  = shuffle(rng, borderCells);
    const battlePlaced = [];
    const battleCount  = rngInt(rng, 5, 10);
    for (const c of battleCands) {
      if (battlePlaced.length >= battleCount) break;
      if (battlePlaced.every(p => dist(p.x, p.y, c.x, c.y) >= 15)) {
        const cell = map.get(c.x, c.y);
        if (cell && !cell.poiType) cell.poiType = 'battle_site';
        pois.push({
          id:  `poi_battle_${battlePlaced.length}`,
          type: 'battle_site', x: c.x, y: c.y,
          dangerLevel: rngInt(rng, 1, 3),
          name: pick(rng, BATTLE_NAMES),
        });
        battlePlaced.push(c);
      }
    }

    // --- Dungeons: adjacent to ancient sites ---
    const dungeonCount = rngInt(rng, 4, 8);
    const dungeonPlaced = [];
    const ancShuffled = shuffle(rng, ancientSites);
    for (const site of ancShuffled) {
      if (dungeonPlaced.length >= dungeonCount) break;
      const nbrs = map.neighbors8(site.x, site.y);
      const spot = nbrs.find(n => n.cell?.isLand() && !n.cell.settlementType && !n.cell.poiType);
      if (!spot) continue;
      spot.cell.poiType = 'dungeon';
      pois.push({
        id:  `poi_dungeon_${dungeonPlaced.length}`,
        type: 'dungeon', x: spot.x, y: spot.y,
        dangerLevel: rngInt(rng, 2, 5),
        name: pick(rng, DUNGEON_NAMES),
      });
      dungeonPlaced.push(spot);
    }

    // --- Sacred sites: remote, scattered ---
    const sacredCount = rngInt(rng, 3, 6);
    const allLand = [];
    map.forEach((cell, x, y) => {
      if (cell?.isLand() && !cell.settlementType && !cell.poiType) allLand.push({ x, y });
    });
    const sacredCands  = shuffle(rng, allLand);
    const sacredPlaced = [];
    for (const c of sacredCands) {
      if (sacredPlaced.length >= sacredCount) break;
      const cell = map.get(c.x, c.y);
      if (!cell) continue;
      if (sacredPlaced.every(p => dist(p.x, p.y, c.x, c.y) >= 20)) {
        cell.poiType = 'sacred_site';
        pois.push({
          id:  `poi_sacred_${sacredPlaced.length}`,
          type: 'sacred_site', x: c.x, y: c.y,
          dangerLevel: 0,
          name: pick(rng, SACRED_NAMES),
        });
        sacredPlaced.push(c);
      }
    }

    return pois;
  }
}

// ---------- POI name tables ----------
const LAIR_NAMES    = ['Troll','Wyvern','Harpy','Spider','Undead','Minotaur','Giant','Werewolf','Manticore','Drake','Basilisk'];
const LAIR_SUFFIXES = ['Warren','Den','Roost','Nest','Cave','Aerie','Grotto','Barrow','Lair','Hold','Refuge','Pit'];
const BATTLE_NAMES  = ['Fallen Watch','Bloody Ford','Ashen Fields','The Bone Plain','Slaughter\'s End','Carrion Hill','Shattered Gate','The Weeping Moor','Raven\'s Rest','Thornfield','The Last Stand','Breach of the Veil'];
const DUNGEON_NAMES = ['The Sunken Vault','Tomb of the Unnamed King','The Forsaken Crypt','Ruins of the Deep','The Labyrinth Below','The Drowned Temple','Shadowfast Hold','The Mouldering Tower','The Sealed Archive','Reliquary of Dust'];
const SACRED_NAMES  = ['The Standing Stones','Shrine of the Pale Moon','The Whispering Grove','The Drowned Altar','Cairn of the First King','The Split Stone','The Hollow Oracle'];

// Tribal monster settlements
const TRIBE_ENTRIES = [
  { race: 'goblin',   title: 'Goblin Warren'    },
  { race: 'goblin',   title: 'Goblin Camp'       },
  { race: 'goblin',   title: 'Goblinhold'        },
  { race: 'orc',      title: 'Orc Warcamp'       },
  { race: 'orc',      title: 'Orcish Stronghold' },
  { race: 'kobold',   title: 'Kobold Burrow'     },
  { race: 'hobgoblin',title: 'Hobgoblin Fort'    },
  { race: 'gnoll',    title: 'Gnoll Pack-hold'   },
  { race: 'lizardfolk',title:'Lizardfolk Village' },
  { race: 'bugbear',  title: 'Bugbear Lair'      },
];
const TRIBE_NAMES = [
  'the Broken Tusk','the Red Eye','the Rot Fang','the Skull Crest',
  'the Mud Spine','the Iron Maw','the Scab Claw','the Dusk Howl',
  'the Bile Moon','the Carrion Crow','the Black Knuckle','the Ash Tongue',
];
