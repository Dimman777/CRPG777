import { MacroMap }  from './macro_map.js';
import { MacroCell } from './macro_cell.js';
import { TERRAIN, MOISTURE_ZONE, VEGETATION } from '../data/terrain_data.js';

// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, min, max)   { return min + Math.floor(rng() * (max - min + 1)); }
function rngBetween(rng, lo, hi) { return lo + rng() * (hi - lo); }
function dist(x1, y1, x2, y2)   { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }

// ─── Hash-based value noise ───────────────────────────────────────────────────

function hashVal(x, y, nSeed) {
  const v = Math.sin(x * 127.1 + y * 311.7 + nSeed * 74.2) * 43758.5453;
  return v - Math.floor(v);
}

function noiseAt(x, y, nSeed, scale) {
  const ix = Math.floor(x / scale), iy = Math.floor(y / scale);
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

// Dir8 helpers
const DIR8 = [
  { name: 'E',  dx:  1, dy:  0 },
  { name: 'NE', dx:  1, dy: -1 },
  { name: 'N',  dx:  0, dy: -1 },
  { name: 'NW', dx: -1, dy: -1 },
  { name: 'W',  dx: -1, dy:  0 },
  { name: 'SW', dx: -1, dy:  1 },
  { name: 'S',  dx:  0, dy:  1 },
  { name: 'SE', dx:  1, dy:  1 },
];

// Cardinal bitmask for riverMask/riverDownDir compatibility (N=1,E=2,S=4,W=8)
const CARD_BIT = { N: 1, E: 2, S: 4, W: 8 };

function angleToDir8(deg) {
  // deg in [-180,180] from atan2(dy,dx) — right=0, down=+90
  const d = ((deg % 360) + 360) % 360; // 0–360
  const names = ['E','NE','N','NW','W','SW','S','SE'];
  return names[Math.round(d / 45) % 8];
}

// ─── World Generator ─────────────────────────────────────────────────────────

export class WorldGen {
  constructor(options = {}) {
    this.mapWidth   = options.mapWidth   ?? 640;
    this.mapHeight  = options.mapHeight  ?? 480;
    this.numFaults  = options.numFaults  ?? 0;
    this.edgeMargin = options.edgeMargin ?? 40;
    this.landFrac   = options.landFrac   ?? 0.44;
  }

  generate(seed = Date.now()) {
    const rng   = makeRng(seed);
    const nSeed = (rng() * 99999) | 0;

    // Phase 1: Landmass height field
    const { heights, peaks, centers } = this._buildHeightMap(rng, nSeed);

    // The height field has a bimodal distribution: interior ocean cells sit at exactly
    // h=0 (never touched by generation), while land cells form a continuous distribution
    // above 0.  If ≥oceanFrac of cells are at h=0 the raw percentile returns 0, which
    // makes `hv < waterLevel` never true and every cell becomes land.
    // Fix: clamp to a small positive floor so h=0 cells satisfy `hv < waterLevel`.
    const rawWL = this._percentile(heights, 1 - this.landFrac);
    const waterLevel = rawWL > 1e-6 ? rawWL : 1e-6;
    console.log(`[WorldGen] seed=${seed} size=${this.mapWidth}×${this.mapHeight} waterLevel=${waterLevel.toFixed(6)} targetLand=${(this.landFrac*100).toFixed(0)}%`);

    // Phase 2: Structural regions
    const structRegions = this._buildStructuralRegions(heights, peaks, centers, waterLevel, nSeed);

    // Phase 3: Elevation derivatives (slope magnitude, slopeDir, reliefStrength)
    const { slopes, slopeDirs, relief } = this._computeElevationDerivatives(heights);

    // Phase 4: Temperature and rainfall
    const { temperature, rainfall } = this._buildClimate(heights, slopes, waterLevel, nSeed);

    // Phase 5: Hydrology (D8 flow, accumulation, watersheds, rivers, lakes)
    const hydro = this._buildHydrology(heights, rainfall, waterLevel, rng);

    // Assemble final MacroMap
    const map = this._assembleCells(
      heights, slopes, slopeDirs, relief,
      waterLevel, structRegions,
      temperature, rainfall,
      hydro
    );

    // Phase 6: Coast classification
    this._classifyCoasts(map);

    // Diagnostic: log actual land/ocean split and river counts
    let _oceanN = 0, _landN = 0, _riverN = 0;
    map.forEach(c => {
      if (c.terrain === 'ocean') _oceanN++; else _landN++;
      if (c.riverClass && c.riverClass !== 'none') _riverN++;
    });
    const _tot = _oceanN + _landN;
    console.log(`[WorldGen] ocean=${_oceanN}(${(_oceanN/_tot*100).toFixed(1)}%) land=${_landN}(${(_landN/_tot*100).toFixed(1)}%) rivers=${_riverN}`);

    return map;
  }

  // ── Phase 1: Height Map ───────────────────────────────────────────────────
  //
  //  1. Continent centres (biased toward map interior)
  //  2. Mountain peaks clustered near centres + ridge connections
  //  3. Radial elevation rings from each peak, noise-perturbed
  //  4. Continental shelf around each centre
  //  5. Small isolated islets
  //  6. Smooth twice (3×3 box)
  //  7. Secondary peak system in open ocean
  //  8. Fault lines
  //  9. Edge falloff (cubic, runs last)
  // 10. Normalise

  _buildHeightMap(rng, nSeed) {
    const { mapWidth: W, mapHeight: H, edgeMargin: M } = this;
    const h = new Array(W * H).fill(0);

    // 1 — Continent centres
    const CONT_MARGIN = M + 10;
    const centers = [];
    const numContinents = rngInt(rng, 5, 7);

    for (let c = 0; c < numContinents; c++) {
      let cx, cy, att = 0;
      do {
        const bx = W * 0.5 + (rng() - 0.5) * W * 0.35;
        const by = H * 0.5 + (rng() - 0.5) * H * 0.35;
        const t  = Math.min(1, att / 80);
        const rx = CONT_MARGIN + rng() * (W - CONT_MARGIN * 2);
        const ry = CONT_MARGIN + rng() * (H - CONT_MARGIN * 2);
        cx = Math.max(CONT_MARGIN, Math.min(W - CONT_MARGIN, rx*(1-t*0.5) + bx*t*0.5)) | 0;
        cy = Math.max(CONT_MARGIN, Math.min(H - CONT_MARGIN, ry*(1-t*0.5) + by*t*0.5)) | 0;
        att++;
      } while (att < 150 && centers.some(cc => dist(cc.x, cc.y, cx, cy) < 55));
      centers.push({ x: cx, y: cy });
    }

    // 2 — Mountain peaks
    const peaks = [];
    const numPeaksTarget = 22 + rngInt(rng, 0, 12);

    for (let tries = 0; tries < numPeaksTarget * 4 && peaks.length < numPeaksTarget; tries++) {
      const cc = centers[(rng() * centers.length) | 0];
      const px = Math.max(M + 2, Math.min(W - M - 2, cc.x + rngBetween(rng, -45, 45))) | 0;
      const py = Math.max(M + 2, Math.min(H - M - 2, cc.y + rngBetween(rng, -35, 35))) | 0;
      if (peaks.some(p => dist(p.x, p.y, px, py) < 12)) continue;
      peaks.push({ x: px, y: py });
      h[py * W + px] = 1.0;
    }

    // 3 — Ridge connections
    for (let i = 0; i < peaks.length; i++) {
      const sorted = peaks
        .filter((_, j) => j !== i)
        .sort((a, b) => dist(peaks[i].x, peaks[i].y, a.x, a.y)
                      - dist(peaks[i].x, peaks[i].y, b.x, b.y));
      const connections = 1 + (rng() > 0.4 ? 1 : 0);
      for (let c = 0; c < Math.min(connections, sorted.length); c++) {
        const tgt = sorted[c];
        const d   = dist(peaks[i].x, peaks[i].y, tgt.x, tgt.y);
        if (d > 75) continue;
        const steps = (d * 1.5) | 0;
        for (let s = 0; s <= steps; s++) {
          const t  = s / steps;
          const lx = (peaks[i].x + (tgt.x - peaks[i].x) * t + rngBetween(rng, -4.5, 4.5)) | 0;
          const ly = (peaks[i].y + (tgt.y - peaks[i].y) * t + rngBetween(rng, -4.5, 4.5)) | 0;
          if (lx >= 0 && ly >= 0 && lx < W && ly < H)
            h[ly * W + lx] = Math.max(h[ly * W + lx], 0.82 + rng() * 0.18);
        }
      }
    }

    // 4 — Radial rings
    for (const pk of peaks) {
      const mountainR = 4 + rngInt(rng, 0, 5);
      const hillR     = mountainR + 6 + rngInt(rng, 0, 9);
      const plainR    = hillR     + 10 + rngInt(rng, 0, 20);
      const totalR    = plainR    + 6;

      for (let dy = -totalR; dy <= totalR; dy++) {
        for (let dx = -totalR; dx <= totalR; dx++) {
          const nx = pk.x + dx, ny = pk.y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const d  = dist(pk.x, pk.y, nx, ny);
          const nd = d + noiseAt(nx * 3, ny * 3, nSeed + pk.x, 8) * 6.5 - 3.25;
          let e = 0;
          if      (nd <= mountainR) e = 0.70 + rng() * 0.25;
          else if (nd <= hillR)     e = 0.45 + (hillR - nd) / (hillR - mountainR) * 0.25;
          else if (nd <= plainR)    e = 0.18 + (plainR - nd) / (plainR - hillR)   * 0.27;
          else if (nd <= totalR)    e = 0.08 + (totalR - nd) / (totalR - plainR)  * 0.10;
          h[ny * W + nx] = Math.max(h[ny * W + nx], e);
        }
      }
    }

    // 5 — Continental shelves
    for (const cc of centers) {
      const shelfR = 55 + rngInt(rng, 0, 40);
      for (let dy = -shelfR; dy <= shelfR; dy++) {
        for (let dx = -shelfR; dx <= shelfR; dx++) {
          const nx = cc.x + dx, ny = cc.y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const d  = dist(cc.x, cc.y, nx, ny);
          const nd = d + noiseAt(nx*2, ny*2, nSeed + cc.x + cc.y*100, 15) * 12 - 6;
          if (nd < shelfR)
            h[ny * W + nx] = Math.max(h[ny * W + nx], 0.16 * (1 - nd / shelfR));
        }
      }
    }

    // 6 — Isolated islets
    const numIslets = rngInt(rng, 3, 6);
    for (let i = 0; i < numIslets; i++) {
      let ix = (W / 2) | 0, iy = (H / 2) | 0;
      for (let att = 0; att < 200; att++) {
        ix = (M + 4 + rng() * (W - M * 2 - 8)) | 0;
        iy = (M + 4 + rng() * (H - M * 2 - 8)) | 0;
        if (centers.every(cc => dist(cc.x, cc.y, ix, iy) > 90)) break;
      }
      const isletR  = 6 + rngInt(rng, 0, 12);
      const iAngle  = rng() * Math.PI;
      const iElong  = rngBetween(rng, 2.0, 3.5);
      const cosA    = Math.cos(iAngle);
      const sinA    = Math.sin(iAngle);
      const scanR   = (isletR * iElong + 6) | 0;
      for (let dy = -scanR; dy <= scanR; dy++) {
        for (let dx = -scanR; dx <= scanR; dx++) {
          const nx = ix + dx, ny = iy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const along = dx * cosA + dy * sinA;
          const perp  = -dx * sinA + dy * cosA;
          const d     = Math.sqrt(along*along + (perp*iElong)*(perp*iElong));
          const nd    = d + noiseAt(nx*3, ny*3, nSeed + i*700 + 12000, 5) * isletR * 0.65;
          if (nd < isletR)
            h[ny * W + nx] = Math.max(h[ny * W + nx], 0.20 * (1 - nd / isletR) + 0.14);
        }
      }
    }

    // 7 — Smooth twice
    for (let pass = 0; pass < 2; pass++) {
      const sm = new Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let sum = h[y*W+x] * 2, cnt = 2;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x+dx, ny = y+dy;
              if (nx >= 0 && ny >= 0 && nx < W && ny < H) { sum += h[ny*W+nx]; cnt++; }
            }
          }
          sm[y*W+x] = sum / cnt;
        }
      }
      for (let i = 0; i < W*H; i++) h[i] = sm[i];
    }

    // 8 — Secondary peaks in open ocean
    {
      const sorted = Float32Array.from(h).sort();
      const roughWL = sorted[Math.floor((1 - this.landFrac) * sorted.length)];
      const MIN_FROM_LAND = 14;
      const oceanCandidates = [];
      for (let y = M + 2; y < H - M - 2; y += 3) {
        for (let x = M + 2; x < W - M - 2; x += 3) {
          if (h[y*W+x] >= roughWL) continue;
          let nearLand = false;
          outer: for (let dy = -MIN_FROM_LAND; dy <= MIN_FROM_LAND; dy++) {
            for (let dx = -MIN_FROM_LAND; dx <= MIN_FROM_LAND; dx++) {
              const nx = x+dx, ny = y+dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              if (h[ny*W+nx] >= roughWL) { nearLand = true; break outer; }
            }
          }
          if (!nearLand) oceanCandidates.push({ x, y });
        }
      }
      const numSecondary = rngInt(rng, 10, 18);
      const secPlaced    = [];
      const MIN_SEC_D2   = 22 * 22;
      for (let tries = 0; tries < numSecondary * 25 && secPlaced.length < numSecondary; tries++) {
        if (!oceanCandidates.length) break;
        const cand = oceanCandidates[(rng() * oceanCandidates.length) | 0];
        const tooClose = secPlaced.some(p => {
          const dx = p.x-cand.x, dy = p.y-cand.y;
          return dx*dx + dy*dy < MIN_SEC_D2;
        });
        if (!tooClose) secPlaced.push(cand);
      }
      const currentMax = h.reduce((mx, v) => v > mx ? v : mx, 0);
      for (const pk of secPlaced) {
        const fullHeight = rng() < 0.4;
        const hillR  = fullHeight ? 4 + rngInt(rng, 0, 5) : rngInt(rng, 1, 5);
        const plainR = hillR + (fullHeight ? 6 + rngInt(rng, 0, 10) : rngInt(rng, 4, 8));
        const totalR = plainR + 5;
        const peakTop  = fullHeight
          ? currentMax * rngBetween(rng, 0.72, 0.88)
          : roughWL + 0.30 + rng() * 0.18;
        const plainBot = fullHeight ? roughWL + 0.10 : roughWL + 0.05;
        const iAngle = rng() * Math.PI;
        const iElong = rngBetween(rng, 1.8, 3.2);
        const cosA   = Math.cos(iAngle);
        const sinA   = Math.sin(iAngle);
        const scanR  = (totalR * Math.ceil(iElong) + 2) | 0;
        for (let dy = -scanR; dy <= scanR; dy++) {
          for (let dx = -scanR; dx <= scanR; dx++) {
            const nx = pk.x+dx, ny = pk.y+dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const along = dx*cosA + dy*sinA;
            const perp  = -dx*sinA + dy*cosA;
            const d     = Math.sqrt(along*along + (perp*iElong)*(perp*iElong));
            const nd    = d + noiseAt(nx*3, ny*3, nSeed + pk.x + pk.y*997, 7) * 5.0 - 2.5;
            let e = 0;
            if      (nd <= hillR)  e = peakTop;
            else if (nd <= plainR) e = plainBot + (plainR-nd)/(plainR-hillR) * (peakTop - plainBot);
            else if (nd <= totalR) e = roughWL  + (totalR-nd)/(totalR-plainR) * (plainBot - roughWL);
            if (e > h[ny*W+nx]) h[ny*W+nx] = e;
          }
        }
      }
    }

    // 9 — Fault lines
    this._applyFaultLines(h, rng);

    // 10 — Edge falloff
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ed = Math.min(x, y, W-1-x, H-1-y);
        if (ed < M) { const f = ed / M; h[y*W+x] *= f * f * f; }
      }
    }

    // Normalise
    const arr = new Float32Array(h);
    this._normalise(arr);
    return { heights: arr, peaks, centers };
  }

  // ── Fault Lines ──────────────────────────────────────────────────────────

  _applyFaultLines(h, rng) {
    const { mapWidth: W, mapHeight: H } = this;
    for (let f = 0; f < this.numFaults; f++) {
      const cx    = rngBetween(rng, W * 0.18, W * 0.82);
      const cy    = rngBetween(rng, H * 0.18, H * 0.82);
      const angle = rng() * Math.PI;
      const nx    = -Math.sin(angle);
      const ny    =  Math.cos(angle);
      const isRift = rng() < 0.35;
      if (isRift) {
        const halfWidth = rngBetween(rng, 5, 18);
        const dropAmt   = rngBetween(rng, 0.22, 0.48);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const d = Math.abs((x-cx)*nx + (y-cy)*ny);
            if (d >= halfWidth) continue;
            const t = d / halfWidth;
            h[y*W+x] -= dropAmt * (1 - t*t*(3-2*t));
          }
        }
      } else {
        const displacement = rngBetween(rng, 0.20, 0.42);
        const rampWidth    = rngBetween(rng, 2, 6);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const d = (x-cx)*nx + (y-cy)*ny;
            let delta;
            if (Math.abs(d) <= rampWidth) {
              const t = (d / rampWidth + 1) * 0.5;
              delta = (t*t*(3-2*t) - 0.5) * displacement;
            } else {
              delta = (d > 0 ? 0.5 : -0.5) * displacement;
            }
            h[y*W+x] += delta;
          }
        }
      }
    }
  }

  // ── Phase 2: Structural Regions ──────────────────────────────────────────
  //
  // Assigns each land cell a broad structural fingerprint that drives elevation
  // refinement and biome placement.  Ocean cells are left as 'ocean'.

  _buildStructuralRegions(heights, peaks, centers, waterLevel, nSeed) {
    const { mapWidth: W, mapHeight: H } = this;
    // region codes: 0=plain 1=uplands 2=mountain_belt 3=plateau 4=basin 5=coastal_plain 6=old_eroded
    const regions = new Uint8Array(W * H); // default 0 = plain

    // BFS ocean-distance to distinguish coast vs interior
    const oceanDist = new Int32Array(W * H).fill(-1);
    const queue = [];
    for (let i = 0; i < W*H; i++) {
      if (heights[i] < waterLevel) { oceanDist[i] = 0; queue.push(i); }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi];
      const x = idx % W, y = (idx / W) | 0;
      const d = oceanDist[idx];
      for (const { dx, dy } of DIR8) {
        const nx = x+dx, ny = y+dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny*W+nx;
        if (oceanDist[ni] === -1) { oceanDist[ni] = d+1; queue.push(ni); }
      }
    }

    // Pass 1: mountain belts — radial influence zones around peak clusters
    for (const pk of peaks) {
      const beltR   = 16;
      const uplandsR = 36;
      for (let dy = -uplandsR; dy <= uplandsR; dy++) {
        for (let dx = -uplandsR; dx <= uplandsR; dx++) {
          const nx = pk.x + dx, ny = pk.y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (heights[ny*W+nx] < waterLevel) continue;
          const d = dist(pk.x, pk.y, nx, ny);
          const ni = ny*W+nx;
          if (d <= beltR && regions[ni] < 2) regions[ni] = 2;       // mountain_belt
          else if (d <= uplandsR && regions[ni] < 1) regions[ni] = 1; // uplands
        }
      }
    }

    // Pass 2: plateau — high land with low local slope
    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const idx = y*W+x;
        if (heights[idx] < waterLevel) continue;
        if (regions[idx] === 2) continue; // already mountain belt
        const hv = heights[idx];
        // Rough slope (central differences)
        const gdx = (heights[y*W+(x+1)] - heights[y*W+(x-1)]) * 0.5;
        const gdy = (heights[(y+1)*W+x] - heights[(y-1)*W+x]) * 0.5;
        const s   = Math.sqrt(gdx*gdx + gdy*gdy);
        if (hv > waterLevel + (1 - waterLevel) * 0.45 && s < 0.025) {
          regions[idx] = 3; // plateau
        }
      }
    }

    // Pass 3: coastal plains — low land close to coast
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        if (heights[idx] < waterLevel) continue;
        if (regions[idx] !== 0) continue;
        const hv = heights[idx];
        const od = oceanDist[idx];
        if (od >= 0 && od <= 8 && hv < waterLevel + (1 - waterLevel) * 0.22) {
          regions[idx] = 5; // coastal_plain
        }
      }
    }

    // Pass 4: basins — enclosed low land far from ocean (local minimum pockets)
    // Simple proxy: low elevation, moderate ocean distance, surrounded by higher land
    for (let y = 2; y < H-2; y++) {
      for (let x = 2; x < W-2; x++) {
        const idx = y*W+x;
        if (heights[idx] < waterLevel) continue;
        if (regions[idx] !== 0) continue;
        const hv  = heights[idx];
        const od  = oceanDist[idx];
        if (od < 15 || hv > waterLevel + (1 - waterLevel) * 0.30) continue;
        // Check that most 8-neighbors are higher
        let higherCnt = 0;
        for (const { dx, dy } of DIR8) {
          const nx = x+dx, ny = y+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (heights[ny*W+nx] > hv + 0.04) higherCnt++;
        }
        if (higherCnt >= 5) regions[idx] = 4; // basin
      }
    }

    // Pass 5: old eroded interior — high but flat land far from mountains
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        if (heights[idx] < waterLevel) continue;
        if (regions[idx] !== 0) continue;
        const hv  = heights[idx];
        const od  = oceanDist[idx];
        // Far from coast, moderately elevated, but not in mountain belt
        if (od >= 30 && hv > waterLevel + (1 - waterLevel) * 0.28
            && hv < waterLevel + (1 - waterLevel) * 0.55) {
          const noise = noiseAt(x, y, nSeed + 9000, 60);
          if (noise > 0.55) regions[idx] = 6; // old_eroded
        }
      }
    }

    return regions;
  }

  // ── Phase 3: Elevation Derivatives ──────────────────────────────────────

  _computeElevationDerivatives(heights) {
    const { mapWidth: W, mapHeight: H } = this;
    const slopes    = new Float32Array(W * H);
    const slopeDirs = new Array(W * H).fill('flat');
    const relief    = new Float32Array(W * H);

    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const gdx = (heights[y*W+(x+1)] - heights[y*W+(x-1)]) * 0.5;
        const gdy = (heights[(y+1)*W+x] - heights[(y-1)*W+x]) * 0.5;
        const mag = Math.sqrt(gdx*gdx + gdy*gdy);
        slopes[y*W+x] = mag;
        if (mag > 0.005) {
          const deg = Math.atan2(gdy, gdx) * 180 / Math.PI;
          slopeDirs[y*W+x] = angleToDir8(deg);
        }
      }
    }
    this._normalise(slopes);

    // Relief = local elevation range in a 5×5 window
    for (let y = 2; y < H-2; y++) {
      for (let x = 2; x < W-2; x++) {
        let mn = Infinity, mx = -Infinity;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const v = heights[(y+dy)*W+(x+dx)];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
        }
        relief[y*W+x] = mx - mn;
      }
    }
    this._normalise(relief);

    return { slopes, slopeDirs, relief };
  }

  // ── Phase 4: Temperature and Rainfall ────────────────────────────────────
  //
  // Temperature: latitude band + elevation penalty
  // Rainfall:    ocean proximity + prevailing westerly wind + mountain rain shadow

  _buildClimate(heights, slopes, waterLevel, nSeed) {
    const { mapWidth: W, mapHeight: H } = this;
    const temperature = new Float32Array(W * H);
    const rainfall    = new Float32Array(W * H);

    // Precompute BFS ocean distance (fast uint16 pass)
    const oceanDist = new Uint16Array(W * H).fill(65535);
    const q = [];
    for (let i = 0; i < W*H; i++) {
      if (heights[i] < waterLevel) { oceanDist[i] = 0; q.push(i); }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const idx = q[qi]; const x = idx % W, y = (idx / W) | 0;
      const d = oceanDist[idx];
      for (const { dx, dy } of DIR8) {
        const nx = x+dx, ny = y+dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny*W+nx;
        if (oceanDist[ni] > d+1) { oceanDist[ni] = d+1; q.push(ni); }
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        const hv  = heights[idx];
        const od  = oceanDist[idx];

        // Temperature: peaks at equator (y=H/2), cold toward poles
        const latFactor  = 1.0 - 2.0 * Math.abs(y / H - 0.5);
        const elevPen    = Math.max(0, hv - waterLevel) / (1 - waterLevel) * 0.55;
        const maritimeMod = Math.max(0, 1 - od / 35) * 0.08;
        temperature[idx] = Math.max(0, Math.min(1, latFactor * 0.85 + 0.15 - elevPen + maritimeMod));

        // Rainfall
        // Base ocean proximity — west coast bias (prevailing westerlies from west)
        const odFactor = Math.max(0, 1.0 - od / 80.0) * 0.50;

        // Prevailing wind from west: scan left (westward) for blocking mountain
        let rainShadow = 0;
        const scanLimit = Math.min(x, 50);
        for (let sx = 1; sx <= scanLimit; sx++) {
          const wh = heights[y*W+(x-sx)];
          if (wh >= waterLevel && wh > hv + 0.08) {
            // Mountain to the west blocks rain
            rainShadow = Math.min(0.45, rainShadow + 0.09 * (wh - hv));
            break;
          }
        }

        // Windward boost: if this cell is on western slope of a mountain chain
        let windwardBoost = 0;
        if (hv >= waterLevel && x + 1 < W) {
          const ehv = heights[y*W+(x+1)]; // cell to east
          if (ehv > hv + 0.05) windwardBoost = 0.12; // rising terrain to east = windward
        }

        // Latitude moisture bands (tropics wet, subtropics dry, temperate moderate)
        const lat = Math.abs(y / H - 0.5) * 2; // 0=equator,1=pole
        const latMoist = lat < 0.20 ? 0.20        // wet tropics
                       : lat < 0.38 ? -0.15       // dry subtropics
                       : lat < 0.65 ? 0.05        // temperate
                       : -0.05;                   // subarctic/subantarctic

        // Noise
        const noiseVal = noiseAt(x, y, nSeed + 5000, 55) * 0.22
                       + noiseAt(x, y, nSeed + 6000, 25) * 0.12;

        rainfall[idx] = Math.max(0, Math.min(1,
          odFactor + windwardBoost + latMoist + noiseVal - rainShadow
        ));
      }
    }

    return { temperature, rainfall };
  }

  // ── Phase 5: Hydrology ───────────────────────────────────────────────────
  //
  // 1. BFS ocean distance
  // 2. Depression filling (priority-flood lite)
  // 3. D8 flow direction (steepest descent)
  // 4. Flow accumulation (topological sort by elevation)
  // 5. Watershed assignment
  // 6. River classification
  // 7. River surface elevation (monotonic downstream)
  // 8. Lake identification (large sinks above threshold)

  _buildHydrology(heights, rainfall, waterLevel, rng) {
    const { mapWidth: W, mapHeight: H } = this;
    const N = W * H;

    // ── 5.1 BFS ocean distance ──────────────────────────────────────────────
    const oceanDist = new Int32Array(N).fill(-1);
    const queue = [];
    for (let i = 0; i < N; i++) {
      if (heights[i] < waterLevel) { oceanDist[i] = 0; queue.push(i); }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi]; const x = idx % W, y = (idx / W) | 0;
      const d = oceanDist[idx];
      for (const { dx, dy } of DIR8) {
        const nx = x+dx, ny = y+dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny*W+nx;
        if (oceanDist[ni] === -1) { oceanDist[ni] = d+1; queue.push(ni); }
      }
    }

    // ── 5.2 Depression filling ──────────────────────────────────────────────
    // Modified priority-flood: raise small land pits so they drain.
    // Large basins (many upstream cells) are left as-is and become lakes later.
    const filled = Float32Array.from(heights);
    for (let iter = 0; iter < 8; iter++) {
      let changed = false;
      for (let y = 1; y < H-1; y++) {
        for (let x = 1; x < W-1; x++) {
          const idx = y*W+x;
          if (filled[idx] < waterLevel) continue; // skip ocean
          let hasLower = false;
          let minNeighbor = Infinity;
          for (const { dx, dy } of DIR8) {
            const nv = filled[(y+dy)*W+(x+dx)];
            if (nv < filled[idx]) hasLower = true;
            if (nv < minNeighbor) minNeighbor = nv;
          }
          if (!hasLower && minNeighbor < Infinity) {
            // Only fill small pits — if neighbors are all land and close in height
            const isSmallPit = minNeighbor >= waterLevel &&
                               (minNeighbor - filled[idx]) < 0.04;
            if (isSmallPit) { filled[idx] = minNeighbor + 0.001; changed = true; }
          }
        }
      }
      if (!changed) break;
    }

    // ── 5.3 D8 Flow Direction ───────────────────────────────────────────────
    // Steepest descent; tie-break toward lower ocean distance.
    const downDir = new Array(N).fill(null); // null = no outlet (pit or ocean)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        if (filled[idx] < waterLevel) continue; // ocean cells don't flow

        let bestDir  = null;
        let bestDrop = -Infinity;
        let bestOD   = Infinity;

        for (const dir of DIR8) {
          const nx = x + dir.dx, ny = y + dir.dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni   = ny*W+nx;
          const nv   = filled[ni];
          const drop = filled[idx] - nv;
          // Cardinal steps have drop; diagonal effective drop is drop/sqrt(2)
          const effDrop = (dir.dx !== 0 && dir.dy !== 0) ? drop / 1.414 : drop;

          if (nv < waterLevel) {
            // Can drain into ocean — strong preference
            if (bestDrop < 999) { bestDrop = 999; bestDir = dir; bestOD = 0; }
            continue;
          }

          if (effDrop > bestDrop || (effDrop === bestDrop && oceanDist[ni] < bestOD)) {
            bestDrop = effDrop;
            bestDir  = dir;
            bestOD   = oceanDist[ni];
          }
        }

        // Only assign flow if there is actual descent or drainage toward ocean
        if (bestDir && (bestDrop > 0 || bestDrop === 999)) {
          downDir[idx] = bestDir;
        }
      }
    }

    // ── 5.4 Flow Accumulation (topological sort by elevation) ───────────────
    const flowAccum = new Float32Array(N);

    // Each land cell contributes 1 unit * its rainfall weight
    for (let i = 0; i < N; i++) {
      if (filled[i] >= waterLevel) flowAccum[i] = Math.max(0.1, rainfall[i]);
    }

    // Sort land cells highest → lowest elevation so upstream always processed first
    const landIndices = [];
    for (let i = 0; i < N; i++) if (filled[i] >= waterLevel) landIndices.push(i);
    landIndices.sort((a, b) => filled[b] - filled[a]);

    for (const idx of landIndices) {
      if (!downDir[idx]) continue;
      const x  = idx % W, y = (idx / W) | 0;
      const nx = x + downDir[idx].dx, ny = y + downDir[idx].dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny*W+nx;
      if (filled[ni] >= waterLevel) flowAccum[ni] += flowAccum[idx];
    }

    // ── 5.5 Watershed IDs + drainsToOcean flag ──────────────────────────────
    // BFS upstream from cells that drain directly to ocean.
    // Every cell touched by this BFS is in a connected ocean-draining watershed.
    // Cells left unvisited after the BFS are in closed basins.
    const watershedId   = new Int32Array(N).fill(-1);
    const drainsToOcean = new Uint8Array(N); // 1 = confirmed path to ocean
    let nextWatershed   = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        if (filled[idx] < waterLevel) continue;
        if (!downDir[idx]) continue;
        const nx = x + downDir[idx].dx, ny = y + downDir[idx].dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && filled[ny*W+nx] < waterLevel) {
          if (watershedId[idx] === -1) {
            const wid = nextWatershed++;
            const wq  = [idx];
            watershedId[idx]   = wid;
            drainsToOcean[idx] = 1;
            for (let wi = 0; wi < wq.length; wi++) {
              const cidx = wq[wi];
              const cx = cidx % W, cy = (cidx / W) | 0;
              for (const dir of DIR8) {
                const ux = cx - dir.dx, uy = cy - dir.dy;
                if (ux < 0 || uy < 0 || ux >= W || uy >= H) continue;
                const ui = uy*W+ux;
                if (watershedId[ui] !== -1) continue;
                if (filled[ui] < waterLevel) continue;
                if (downDir[ui] && downDir[ui].dx === dir.dx && downDir[ui].dy === dir.dy) {
                  watershedId[ui]   = wid;
                  drainsToOcean[ui] = 1;
                  wq.push(ui);
                }
              }
            }
          }
        }
      }
    }
    // Closed-basin cells get a unique watershed ID but drainsToOcean stays 0
    for (let i = 0; i < N; i++) {
      if (filled[i] >= waterLevel && watershedId[i] === -1)
        watershedId[i] = nextWatershed++;
    }

    // ── 5.6 River Classification ─────────────────────────────────────────────
    // Only classify cells that confirmed drain to ocean — this prevents isolated
    // closed-basin pools from appearing as disconnected river dots.
    const mapCells = W * H;
    const CREEK_T  = mapCells * 0.00006;
    const STREAM_T = mapCells * 0.00025;
    const RIVER_T  = mapCells * 0.001;
    const MAJOR_T  = mapCells * 0.004;

    const riverClass = new Array(N).fill('none');
    for (let i = 0; i < N; i++) {
      if (filled[i] < waterLevel || !drainsToOcean[i]) continue;
      const fa = flowAccum[i];
      if      (fa >= MAJOR_T)  riverClass[i] = 'major_river';
      else if (fa >= RIVER_T)  riverClass[i] = 'river';
      else if (fa >= STREAM_T) riverClass[i] = 'stream';
      else if (fa >= CREEK_T)  riverClass[i] = 'creek';
    }

    // ── 5.7 River surface elevation (monotonic downstream) ───────────────────
    const riverSurfaceZ = new Float32Array(N).fill(-1);

    // Seed sources (cells where riverClass != 'none' and no upstream river cell)
    // Build upstream count first
    const upstreamRiverCount = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (riverClass[i] === 'none') continue;
      if (!downDir[i]) continue;
      const x = i % W, y = (i / W) | 0;
      const nx = x + downDir[i].dx, ny = y + downDir[i].dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny*W+nx;
      if (riverClass[ni] !== 'none') upstreamRiverCount[ni]++;
    }

    // ── Peak source limiter ───────────────────────────────────────────────────
    // Many small tributaries starting at every peak makes the world look
    // over-watered.  Reduce sources at peak / steep-mountain elevation to
    // TARGET_PEAK_SOURCES by walking each excess source's flow path downstream
    // and clearing river classification until a confluence is reached
    // (a cell that is also fed by another surviving river branch).
    {
      const TARGET_PEAK_SOURCES = 3 + ((rng() * 3) | 0);          // 3–5
      const PEAK_THRESH = waterLevel + (1 - waterLevel) * 0.88;    // peak + steep-mountain

      const peakSources = [];
      for (let i = 0; i < N; i++) {
        if (riverClass[i] === 'none')  continue;
        if (upstreamRiverCount[i] > 0) continue;  // not a source
        if (filled[i] < PEAK_THRESH)   continue;  // below peak band
        peakSources.push(i);
      }

      // Seed-deterministic shuffle so the kept sources vary with world seed
      for (let i = peakSources.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [peakSources[i], peakSources[j]] = [peakSources[j], peakSources[i]];
      }

      for (let s = TARGET_PEAK_SOURCES; s < peakSources.length; s++) {
        let cur = peakSources[s];
        while (cur >= 0 && riverClass[cur] !== 'none') {
          // Another river still feeds this cell — leave it and stop pruning
          if (upstreamRiverCount[cur] > 0) break;
          riverClass[cur] = 'none';
          const cx = cur % W, cy = (cur / W) | 0;
          if (!downDir[cur]) break;
          const dnx = cx + downDir[cur].dx, dny = cy + downDir[cur].dy;
          if (dnx < 0 || dny < 0 || dnx >= W || dny >= H) break;
          const dni = dny * W + dnx;
          upstreamRiverCount[dni] = Math.max(0, upstreamRiverCount[dni] - 1);
          cur = riverClass[dni] !== 'none' ? dni : -1;
        }
      }
    }

    // Process river cells highest elevation first (sources)
    const riverIndices = landIndices.filter(i => riverClass[i] !== 'none');
    for (const idx of riverIndices) {
      const x = idx % W, y = (idx / W) | 0;
      if (riverSurfaceZ[idx] < 0) riverSurfaceZ[idx] = filled[idx];
      if (!downDir[idx]) continue;
      const nx = x + downDir[idx].dx, ny = y + downDir[idx].dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny*W+nx;
      if (riverClass[ni] === 'none') continue;
      const myZ = riverSurfaceZ[idx];
      const proposed = Math.min(filled[ni], myZ - 0.001);
      if (riverSurfaceZ[ni] < 0 || proposed < riverSurfaceZ[ni]) {
        riverSurfaceZ[ni] = Math.max(waterLevel, proposed);
      }
    }
    // Fill any river cell not reached
    for (let i = 0; i < N; i++) {
      if (riverClass[i] !== 'none' && riverSurfaceZ[i] < 0) {
        riverSurfaceZ[i] = filled[i];
      }
    }

    // ── 5.8 Lake identification ──────────────────────────────────────────────
    // Cells where downDir is null (no valid downhill) and not ocean = lake sink candidates.
    // Group connected sinks. Large groups = lakes.
    const lakeId  = new Int32Array(N).fill(-1);
    let nextLake  = 0;
    const LAKE_MIN_FA = RIVER_T * 2; // needs significant inflow to warrant a lake

    for (let i = 0; i < N; i++) {
      if (filled[i] < waterLevel) continue;
      if (downDir[i]) continue; // has outlet
      if (flowAccum[i] < LAKE_MIN_FA) continue; // too small
      if (lakeId[i] !== -1) continue;
      // BFS connected sink cells
      const lid = nextLake++;
      const lq  = [i];
      lakeId[i] = lid;
      for (let li = 0; li < lq.length; li++) {
        const cidx = lq[li];
        const cx = cidx % W, cy = (cidx / W) | 0;
        for (const { dx, dy } of DIR8) {
          const nx = cx+dx, ny = cy+dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny*W+nx;
          if (lakeId[ni] !== -1 || filled[ni] < waterLevel || downDir[ni]) continue;
          if (Math.abs(filled[ni] - filled[cidx]) < 0.03) {
            lakeId[ni] = lid;
            lq.push(ni);
          }
        }
      }
    }

    return {
      oceanDist, downDir, flowAccum, watershedId, riverClass,
      riverSurfaceZ, lakeId, filledHeights: filled,
    };
  }

  // ── Cell Assembly ─────────────────────────────────────────────────────────

  _assembleCells(heights, slopes, slopeDirs, relief, waterLevel,
                 structRegions, temperature, rainfall, hydro) {
    const { mapWidth: W, mapHeight: H } = this;
    const { oceanDist, downDir, flowAccum, watershedId,
            riverClass, riverSurfaceZ, lakeId, filledHeights } = hydro;

    const REGION_NAMES = ['plain','uplands','mountain_belt','plateau','basin','coastal_plain','old_eroded'];
    const map = new MacroMap(W, H);
    const L   = waterLevel;
    const dL  = 1 - waterLevel;
    const N   = W * H;

    // ── Pre-pass: build cardinal river connection bits via diagonal decomposition ──
    // For each river cell, determine exactly which cardinal edges the river crosses.
    // Cardinal downstream (N/E/S/W): connect directly to that neighbor.
    // Diagonal downstream (NE/SE/SW/NW): decompose via the lower-elevation of the two
    //   possible intermediate cardinal cells, then connect cardinally to that cell.
    // This prevents false connections between rivers that happen to flow in similar
    // directions but aren't actually part of the same drainage path.
    const cardBits = new Uint8Array(N); // cardinal in/out bits per cell

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        if (riverClass[idx] === 'none') continue;
        const dd = downDir[idx];
        if (!dd) continue;

        if (dd.dy === 0 || dd.dx === 0) {
          // Pure cardinal — direct connection
          const outBit = dd.dx > 0 ? CARD_BIT.E : dd.dx < 0 ? CARD_BIT.W
                       : dd.dy > 0 ? CARD_BIT.S : CARD_BIT.N;
          const inBit  = dd.dx > 0 ? CARD_BIT.W : dd.dx < 0 ? CARD_BIT.E
                       : dd.dy > 0 ? CARD_BIT.N : CARD_BIT.S;
          cardBits[idx] |= outBit;
          const ni = (y + dd.dy) * W + (x + dd.dx);
          if (ni >= 0 && ni < N) cardBits[ni] |= inBit;
        } else {
          // Diagonal: decompose via lower-elevation intermediate cardinal cell.
          // Two candidates: go E/W first → (x+dx, y), or go N/S first → (x, y+dy)
          const ax = x + dd.dx, ay = y;           // E/W-first intermediate
          const bx = x,          by = y + dd.dy;  // N/S-first intermediate
          const ha = (ax >= 0 && ax < W) ? filledHeights[ay*W+ax] : Infinity;
          const hb = (by >= 0 && by < H) ? filledHeights[by*W+bx] : Infinity;
          const useEW = ha <= hb;
          const imx   = useEW ? ax : bx;
          const imy   = useEW ? ay : by;
          if (imx < 0 || imy < 0 || imx >= W || imy >= H) continue;
          const ni    = imy*W + imx;
          const outBit = useEW ? (dd.dx > 0 ? CARD_BIT.E : CARD_BIT.W)
                                : (dd.dy > 0 ? CARD_BIT.S : CARD_BIT.N);
          const inBit  = useEW ? (dd.dx > 0 ? CARD_BIT.W : CARD_BIT.E)
                                : (dd.dy > 0 ? CARD_BIT.N : CARD_BIT.S);
          cardBits[idx] |= outBit;
          cardBits[ni]  |= inBit;
        }
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y*W+x;
        const hv  = heights[idx];
        const s   = slopes[idx];

        // ── Terrain classification (unchanged logic) ────────────────────────
        let terrain;
        if      (hv < L)              terrain = TERRAIN.OCEAN;
        else if (hv < L + dL*0.10)    terrain = s > 0.45 ? TERRAIN.STEEP_SHORE : TERRAIN.SHALLOW_SHORE;
        else if (hv < L + dL*0.35)    terrain = TERRAIN.FLAT;
        else if (hv < L + dL*0.58)    terrain = TERRAIN.HILLS;
        else if (hv < L + dL*0.78)    terrain = s > 0.52 ? TERRAIN.STEEP_MOUNTAIN : TERRAIN.MOUNTAIN;
        else if (hv < L + dL*0.94)    terrain = TERRAIN.STEEP_MOUNTAIN;
        else                           terrain = s < 0.65 ? TERRAIN.PEAK : TERRAIN.STEEP_MOUNTAIN;

        // ── Moisture zone (derived from rainfall — keeps chunk_gen compat) ──
        const rf = rainfall[idx];
        let moistureZone;
        if      (rf < 0.18) moistureZone = MOISTURE_ZONE.DESERT;
        else if (rf < 0.32) moistureZone = MOISTURE_ZONE.ARID;
        else if (rf < 0.50) moistureZone = MOISTURE_ZONE.DRY;
        else if (rf < 0.70) moistureZone = MOISTURE_ZONE.TEMPERATE;
        else                moistureZone = MOISTURE_ZONE.WET;

        // ── Vegetation (elevation + rainfall) ─────────────────────────────
        const elevPenalty = { flat: 0, shallow_shore: 0.15, hills: 0.12,
          mountain: 0.32, steep_mountain: 0.70, peak: 1.0,
          steep_shore: 1.0, ocean: 1.0 }[terrain] ?? 0;
        const adj = rf - elevPenalty;
        let vegetation;
        if      (adj < 0.15) vegetation = VEGETATION.NONE;
        else if (adj < 0.48) vegetation = VEGETATION.LIGHT;
        else                 vegetation = VEGETATION.DENSE;

        // ── Terrain region from struct regions ────────────────────────────
        const rc = structRegions[idx];
        const terrainRegion = terrain === TERRAIN.OCEAN ? 'ocean'
          : terrain === TERRAIN.SHALLOW_SHORE || terrain === TERRAIN.STEEP_SHORE ? 'coast'
          : REGION_NAMES[rc] ?? 'plain';

        // ── Water type ────────────────────────────────────────────────────
        let waterType = 'none';
        if (terrain === TERRAIN.OCEAN)                              waterType = 'ocean';
        else if (terrain === TERRAIN.SHALLOW_SHORE ||
                 terrain === TERRAIN.STEEP_SHORE)                   waterType = 'coast';
        else if (lakeId[idx] !== -1)                               waterType = 'lake';
        else if (riverClass[idx] !== 'none')                       waterType = 'river';

        // ── riverMask / riverDownDir (backward compat bitmask) ───────────
        // Use the pre-computed cardBits which correctly decomposes diagonals.
        const riverMask     = riverClass[idx] !== 'none' ? cardBits[idx] : 0;
        // riverDownDir = the single outflow bit (highest set bit that points downstream)
        let riverDownDirBits = 0;
        if (riverMask && riverClass[idx] !== 'none') {
          const dd = downDir[idx];
          if (dd) {
            // Pick the cardinal bit matching the downstream direction
            if (dd.dx > 0 && (riverMask & CARD_BIT.E)) riverDownDirBits = CARD_BIT.E;
            else if (dd.dx < 0 && (riverMask & CARD_BIT.W)) riverDownDirBits = CARD_BIT.W;
            else if (dd.dy > 0 && (riverMask & CARD_BIT.S)) riverDownDirBits = CARD_BIT.S;
            else if (dd.dy < 0 && (riverMask & CARD_BIT.N)) riverDownDirBits = CARD_BIT.N;
            // Fallback: if diagonal cardinal out-bit isn't in mask, pick first set bit
            if (!riverDownDirBits) {
              if (riverMask & CARD_BIT.E) riverDownDirBits = CARD_BIT.E;
              else if (riverMask & CARD_BIT.S) riverDownDirBits = CARD_BIT.S;
              else if (riverMask & CARD_BIT.W) riverDownDirBits = CARD_BIT.W;
              else if (riverMask & CARD_BIT.N) riverDownDirBits = CARD_BIT.N;
            }
          }
        }

        // ── riverFloorElev (backward compat) ─────────────────────────────
        const riverFloorElev = riverClass[idx] !== 'none'
          ? Math.max(0, (riverSurfaceZ[idx] >= 0 ? riverSurfaceZ[idx] : hv) - 0.25)
          : null;

        // ── biome region ──────────────────────────────────────────────────
        const biomeRegion = moistureZone === MOISTURE_ZONE.DESERT ? 'desert'
          : moistureZone === MOISTURE_ZONE.ARID                   ? 'arid'
          : terrainRegion === 'mountain_belt'                      ? 'highland'
          : terrainRegion === 'basin'                              ? 'basin'
          : vegetation === VEGETATION.DENSE                        ? 'forest'
          : moistureZone === MOISTURE_ZONE.WET                    ? 'wetland'
          : 'temperate';

        // ── reliefStrength (0–100 int) ────────────────────────────────────
        const reliefStrength = Math.round(relief[idx] * 100);

        map.set(x, y, new MacroCell({
          terrain,
          moistureZone,
          vegetation,
          elevation:   hv,
          slope:       s,
          terrainRegion,
          biomeRegion,
          reliefStrength,
          slopeDir:    slopeDirs[idx],
          waterType,
          oceanDistance: Math.max(0, oceanDist[idx]),
          downstreamDir: downDir[idx]?.name ?? null,
          flowAccum:   flowAccum[idx],
          watershedId: watershedId[idx],
          riverClass:  riverClass[idx],
          riverSurfaceZ: riverSurfaceZ[idx] >= 0 ? riverSurfaceZ[idx] : null,
          lakeId:      lakeId[idx] >= 0 ? lakeId[idx] : null,
          rainfall:    Math.round(rf * 100),
          temperature: Math.round(temperature[idx] * 100),
          riverMask,
          riverDownDir: riverDownDirBits,
          riverFloorElev,
        }));
      }
    }

    // Shore topology cleanup (same as before)
    this._cleanShoreTopology(map, slopes);

    return map;
  }

  // ── Shore Topology Cleanup ────────────────────────────────────────────────

  _cleanShoreTopology(map, slopes) {
    const { mapWidth: W } = this;

    // Trim shallow_shore to 1 cell thick
    map.forEach((cell, x, y) => {
      if (cell.terrain !== TERRAIN.SHALLOW_SHORE) return;
      const bordersOcean = map.neighbors4(x, y).some(n => n.cell?.terrain === TERRAIN.OCEAN);
      if (!bordersOcean) {
        cell.terrain   = TERRAIN.FLAT;
        cell.waterType = 'none';
      }
    });

    // Diagonal ocean contact fix
    map.forEach((cell, x, y) => {
      if (cell.terrain === TERRAIN.OCEAN ||
          cell.terrain === TERRAIN.SHALLOW_SHORE ||
          cell.terrain === TERRAIN.STEEP_SHORE) return;
      const cardinals = map.neighbors4(x, y).map(n => n.cell?.terrain);
      const cardinalHasWater = cardinals.some(t =>
        t === TERRAIN.OCEAN || t === TERRAIN.SHALLOW_SHORE || t === TERRAIN.STEEP_SHORE);
      if (cardinalHasWater) return;
      const diagonalHasOcean = map.neighbors8(x, y)
        .filter(n => Math.abs(n.x - x) === 1 && Math.abs(n.y - y) === 1)
        .some(n => n.cell?.terrain === TERRAIN.OCEAN);
      if (diagonalHasOcean) {
        const s = slopes[y * this.mapWidth + x];
        cell.terrain   = s > 0.45 ? TERRAIN.STEEP_SHORE : TERRAIN.SHALLOW_SHORE;
        cell.waterType = 'coast';
      }
    });
  }

  // ── Phase 6: Coast Classification ────────────────────────────────────────

  _classifyCoasts(map) {
    map.forEach((cell, x, y) => {
      if (cell.terrain !== TERRAIN.SHALLOW_SHORE && cell.terrain !== TERRAIN.STEEP_SHORE) return;

      const isRiverMouth = map.neighbors8(x, y)
        .some(n => n.cell?.riverClass && n.cell.riverClass !== 'none'
               && n.cell.terrain === TERRAIN.OCEAN);
      if (isRiverMouth) { cell.coastType = 'delta'; return; }

      const isMarsh = map.neighbors4(x, y)
        .some(n => n.cell?.moistureZone === 'wet' && n.cell.slope < 0.2);
      if (isMarsh && cell.slope < 0.2) { cell.coastType = 'marsh'; return; }

      if (cell.terrain === TERRAIN.STEEP_SHORE || cell.slope > 0.55) {
        cell.coastType = 'cliff';
      } else if (cell.slope > 0.30) {
        cell.coastType = 'rocky';
      } else {
        // Check for bay enclosure: ocean neighbors < 4 sides exposed
        const exposedOceanSides = map.neighbors4(x, y)
          .filter(n => n.cell?.terrain === TERRAIN.OCEAN).length;
        cell.coastType = exposedOceanSides <= 1 ? 'sheltered_bay' : 'beach';
      }

      // Update waterType for coastline cells
      cell.waterType = 'coast';
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  _normalise(arr) {
    let min = Infinity, max = -Infinity;
    for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] - min) / range;
  }

  _percentile(arr, pct) {
    const sorted = Float32Array.from(arr).sort();
    return sorted[Math.floor(pct * (sorted.length - 1))];
  }
}
