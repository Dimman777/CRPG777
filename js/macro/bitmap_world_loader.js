// Loads a MacroMap from three hand-painted bitmap files:
//
//   altitude.png  — greyscale (R channel used)
//     0–100   → ocean
//     101–120 → shallow_shore (beach / tidal flat)
//     121–155 → flat
//     156–185 → hills
//     186–215 → mountain
//     216–235 → steep_mountain
//     236–255 → peak
//     Any shallow_shore cell adjacent to land ≥ 186 auto-upgrades to steep_shore (cliffs).
//
//   climate.png   — colour (matched to nearest palette entry)
//     #2090FF  River
//     #C8A050  Hot Desert         (moistureZone=desert,    temp=90)
//     #C0B860  Warm Arid Scrub    (moistureZone=arid,      temp=70)
//     #90B030  Savanna / Steppe   (moistureZone=dry,       temp=65)
//     #40A040  Temperate          (moistureZone=temperate, temp=55)
//     #10C060  Tropical Rainforest(moistureZone=wet,       temp=80)
//     #809060  Cool Dry Upland    (moistureZone=dry,       temp=38)
//     #407060  Cool Temperate     (moistureZone=temperate, temp=38)
//     #305050  Cold Taiga         (moistureZone=wet,       temp=25)
//     #8090A0  Tundra             (moistureZone=arid,      temp=15)
//     #C8D8E0  Polar / Ice        (moistureZone=desert,    temp=5 )
//
//   cover.png     — greyscale (R channel used)
//     0–84    → vegetation none  (bare)
//     85–170  → vegetation light
//     171–255 → vegetation dense

import { MacroMap }  from './macro_map.js';
import { MacroCell } from './macro_cell.js';

// ── Climate palette ───────────────────────────────────────────────────────────
export const CLIMATE_PALETTE = [
  { hex: '#2090FF', type: 'river' },
  { hex: '#C8A050', type: 'climate', moistureZone: 'desert',    temperature: 90 },
  { hex: '#C0B860', type: 'climate', moistureZone: 'arid',      temperature: 70 },
  { hex: '#90B030', type: 'climate', moistureZone: 'dry',       temperature: 65 },
  { hex: '#40A040', type: 'climate', moistureZone: 'temperate', temperature: 55 },
  { hex: '#10C060', type: 'climate', moistureZone: 'wet',       temperature: 80 },
  { hex: '#809060', type: 'climate', moistureZone: 'dry',       temperature: 38 },
  { hex: '#407060', type: 'climate', moistureZone: 'temperate', temperature: 38 },
  { hex: '#305050', type: 'climate', moistureZone: 'wet',       temperature: 25 },
  { hex: '#8090A0', type: 'climate', moistureZone: 'arid',      temperature: 15 },
  { hex: '#C8D8E0', type: 'climate', moistureZone: 'desert',    temperature: 5  },
];

// Pre-parse to {r,g,b} for fast distance matching
const _palette = CLIMATE_PALETTE.map(e => {
  const v = parseInt(e.hex.slice(1), 16);
  return { ...e, r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
});

function nearestClimate(r, g, b) {
  let best = _palette[0], bestDist = Infinity;
  for (const e of _palette) {
    const d = (r - e.r) ** 2 + (g - e.g) ** 2 + (b - e.b) ** 2;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

// ── Altitude helpers ──────────────────────────────────────────────────────────
function altToTerrain(v) {
  if (v <= 100) return 'ocean';
  if (v <= 120) return 'shallow_shore';
  if (v <= 155) return 'flat';
  if (v <= 185) return 'hills';
  if (v <= 215) return 'mountain';
  if (v <= 235) return 'steep_mountain';
  return 'peak';
}

function altToElevation(v) {
  if (v <= 100) return 0;
  if (v <= 120) return (v - 100) / 20 * 0.15;      // 0 – 0.15
  return 0.15 + (v - 121) / 134 * 0.85;            // 0.15 – 1.0
}

// ── Cover helper ──────────────────────────────────────────────────────────────
function coverToVeg(v) {
  if (v <= 84)  return 'none';
  if (v <= 170) return 'light';
  return 'dense';
}

// ── Slope from altitude pixels ────────────────────────────────────────────────
function slopeAt(pixels, W, H, x, y) {
  const pix = (cx, cy) => {
    const bx = Math.max(0, Math.min(W - 1, cx));
    const by = Math.max(0, Math.min(H - 1, cy));
    return pixels[(by * W + bx) * 4];
  };
  const gx = (pix(x + 1, y) - pix(x - 1, y)) / 510;
  const gy = (pix(x, y + 1) - pix(x, y - 1)) / 510;
  return Math.min(1, Math.sqrt(gx * gx + gy * gy) * 5);
}

// ── Cardinal river bitmask ────────────────────────────────────────────────────
const CARD_BIT = { N: 1, E: 2, S: 4, W: 8 };

// ─────────────────────────────────────────────────────────────────────────────
export class BitmapWorldLoader {

  // Load from URL strings (relative paths work if served from same origin / file://)
  async loadFromUrls(altUrl, climateUrl, coverUrl) {
    const [altData, climData, covData] = await Promise.all([
      this._urlToImageData(altUrl),
      this._urlToImageData(climateUrl),
      this._urlToImageData(coverUrl),
    ]);
    return this._buildMap(altData, climData, covData);
  }

  // Load from File objects (from <input type="file"> or drag-drop)
  async loadFromFiles(altFile, climFile, covFile) {
    const [altData, climData, covData] = await Promise.all([
      this._fileToImageData(altFile),
      this._fileToImageData(climFile),
      this._fileToImageData(covFile),
    ]);
    return this._buildMap(altData, climData, covData);
  }

  // ── Image loading helpers ────────────────────────────────────────────────────

  _urlToImageData(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(this._imgToImageData(img));
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  _fileToImageData(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(this._imgToImageData(img));
      };
      img.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      img.src = objectUrl;
    });
  }

  _imgToImageData(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // ── Map assembly ─────────────────────────────────────────────────────────────

  _buildMap(altData, climData, covData) {
    const W = altData.width, H = altData.height;
    const ap = altData.data; // altitude pixels (RGBA)

    // Bilinear sample helper — samples another ImageData at logical map coords (x,y)
    const sampleR = (imgData, x, y) => {
      const sw = imgData.width, sh = imgData.height;
      const sx = Math.round(x / (W - 1) * (sw - 1));
      const sy = Math.round(y / (H - 1) * (sh - 1));
      return imgData.data[(Math.min(sh - 1, sy) * sw + Math.min(sw - 1, sx)) * 4];
    };
    const sampleRGB = (imgData, x, y) => {
      const sw = imgData.width, sh = imgData.height;
      const sx = Math.round(x / (W - 1) * (sw - 1));
      const sy = Math.round(y / (H - 1) * (sh - 1));
      const i  = (Math.min(sh - 1, sy) * sw + Math.min(sw - 1, sx)) * 4;
      return [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]];
    };

    // ── Pass 1: per-cell classification ──────────────────────────────────────
    const terrainArr  = new Array(W * H);
    const elevArr     = new Float32Array(W * H);
    const climArr     = new Array(W * H);
    const vegArr      = new Array(W * H);
    const isRiver     = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const av  = ap[idx * 4]; // R channel of greyscale altitude image

        terrainArr[idx] = altToTerrain(av);
        elevArr[idx]    = altToElevation(av);

        const [cr, cg, cb] = sampleRGB(climData, x, y);
        const entry = nearestClimate(cr, cg, cb);
        if (entry.type === 'river') {
          isRiver[idx]  = 1;
          climArr[idx]  = { moistureZone: 'temperate', temperature: 55 };
        } else {
          climArr[idx]  = { moistureZone: entry.moistureZone, temperature: entry.temperature };
        }

        const cv = sampleR(covData, x, y);
        vegArr[idx] = coverToVeg(cv);
      }
    }

    // ── Pass 2: upgrade shallow_shore → steep_shore adjacent to steep land ────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (terrainArr[idx] !== 'shallow_shore') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (ap[(ny * W + nx) * 4] >= 186) {
            terrainArr[idx] = 'steep_shore';
            break;
          }
        }
      }
    }

    // ── Pass 3: river connectivity bitmask ───────────────────────────────────
    const riverMaskArr  = new Uint8Array(W * H);
    const riverClassArr = new Array(W * H).fill('none');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!isRiver[idx]) continue;
        riverClassArr[idx] = 'stream';
        const dirs = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];
        for (const [dx, dy, bit] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && isRiver[ny * W + nx]) {
            riverMaskArr[idx] |= CARD_BIT[bit];
          }
        }
      }
    }

    // ── Assemble MacroMap ────────────────────────────────────────────────────
    const map = new MacroMap(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx     = y * W + x;
        const terrain = terrainArr[idx];
        const cl      = climArr[idx];
        const mz      = terrain === 'ocean' || terrain === 'steep_shore' ? 'temperate' : cl.moistureZone;
        const veg     = terrain === 'ocean' || terrain === 'steep_shore' ? 'none' : vegArr[idx];
        const slope   = slopeAt(ap, W, H, x, y);
        const rainfall =
          mz === 'wet'       ? 80
          : mz === 'temperate' ? 55
          : mz === 'dry'       ? 30
          : mz === 'arid'      ? 15
          : 5; // desert

        map.set(x, y, new MacroCell({
          terrain,
          moistureZone:  mz,
          vegetation:    veg,
          elevation:     elevArr[idx],
          slope,
          riverMask:     riverMaskArr[idx],
          riverClass:    riverClassArr[idx],
          rainfall,
          temperature:   cl.temperature,
          terrainRegion: terrain,
          biomeRegion:   terrain,
        }));
      }
    }

    return map;
  }
}
