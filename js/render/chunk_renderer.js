// ChunkRenderer — builds Three.js geometry from a MicroGrid.
// 8×8 micro-tile grid per macro tile, conventional Lambert lighting with
// explicit vertex normals (no computeVertexNormals, no flatShading).
//
// Performance architecture:
//   Floor, wall, and grid geometries are PERSISTENT — allocated once per
//   ChunkRenderer instance and reused.  render() writes into the same typed-
//   array buffers and sets attribute.needsUpdate = true so Three.js re-uploads
//   into the EXISTING WebGL buffer rather than recreating it.
//   Index buffers are pre-filled once in the constructor (pattern never changes).
//   Wall draw count is controlled via geometry.setDrawRange().
//   Tiles whose four cardinal neighbours share the same elevation skip all
//   borderH / dHash calls — a fast path for flat terrain.
//   Only obstacle InstancedMeshes are rebuilt on each render() (varying counts).

import * as THREE from 'three';
import { CHUNK_SIZE } from '../micro/micro_grid.js';
import { GROUND_COLOR, OBSTACLE } from '../data/micro_tile_data.js';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
export const ELEVATION_SCALE = 10;

const GROUND_RGB = GROUND_COLOR.map(hex => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
]);

const OBS_GEO = [
  null,
  [0.30, 0.20, 0.30], // PEBBLE
  [0.40, 0.40, 0.40], // SMALL_ROCK
  [0.60, 1.40, 0.60], // LARGE_ROCK
  [0.80, 2.00, 0.80], // BOULDER
  [0.50, 0.50, 0.50], // DEAD_SHRUB
  [0.60, 0.70, 0.60], // SHRUB
  [0.80, 0.90, 0.80], // DENSE_SHRUB
  [0.45, 7.20, 0.45], // TREE
  [0.65, 8.80, 0.65], // DENSE_TREE
  [0.45, 6.00, 0.45], // DEAD_TREE
  [0.25, 2.00, 0.25], // CACTUS
  [0.35, 0.60, 0.35], // REED
  [0.55, 0.80, 0.55], // TALL_GRASS
  [0.40, 0.50, 0.40], // SPRING
  [1.70, 2.80, 1.70], // BOULDER_CLUSTER — 2×2 stamp
  [1.80, 1.40, 1.80], // ROCK_OUTCROP    — 2×2 stamp
];

const STAMP2X2_IDS = new Set([OBSTACLE.BOULDER_CLUSTER, OBSTACLE.ROCK_OUTCROP]);

const OBS_COLOR = [
  0x000000, 0x888866, 0x776655, 0x665544, 0x554433,
  0x997755, 0x448844, 0x336633, 0x224422, 0x113311,
  0x775533, 0xbbbb00, 0x336688, 0x558844, 0x55bbdd,
  0x443322,
  0x706860,
];

// ----------------------------------------------------------------
// Module-level obstacle geometry + material pool — created once, shared by all
// ChunkRenderers.  Eliminates per-render dispose/recreate churn that causes
// periodic GC pauses and GPU object thrash.
// ----------------------------------------------------------------
const _OBS_GEO_POOL = [];
const _OBS_MAT_POOL = [];
for (let i = 0; i < OBS_GEO.length; i++) {
  if (!OBS_GEO[i]) { _OBS_GEO_POOL.push(null); _OBS_MAT_POOL.push(null); continue; }
  const [sw, sh, sd] = OBS_GEO[i];
  _OBS_GEO_POOL.push(new THREE.BoxGeometry(sw, sh, sd));
  _OBS_MAT_POOL.push(new THREE.MeshLambertMaterial({ color: OBS_COLOR[i] }));
}

// ----------------------------------------------------------------
// Module-level geometry sizing constants
// ----------------------------------------------------------------
const _S    = CHUNK_SIZE;   // 64
const _M    = 6;            // micro-tiles per tile side  (6×6 = 36 per tile)
const _MF   = 1.0 / _M;    // 0.1667 m per micro-tile
const _ZONE = 2;            // dither border depth in micro-tiles
                            // M=6, ZONE=2 → 2 core micro-tiles per tile (same ratio as M=8, ZONE=3)

const _FQ = _S * _S * _M * _M;           // floor quads      147 456
const _FV = _FQ * 4;                      // floor vertices   589 824

// Worst-case walls per tile: each of the M*(M-1)*2 adjacent micro-tile pairs
// could produce one wall quad.
const _MAX_WQ = _S * _S * _M * (_M - 1) * 2;  // 245 760

// Grid line segments: (M-1)*2 interior + 2 boundary per tile, plus two closing edges
const _GRID_SEGS = _S * _S * ((_M - 1) * 2 + 2) + _S * 2;  // 49 280

// ----------------------------------------------------------------
// Module-level floor normal attribute — shared across all instances.
// Every floor quad is horizontal so its normal is always (0,1,0).
// Pre-filled once at module load; the single BufferAttribute object is
// shared across all ChunkRenderer floor geometries (Three.js uploads it
// to the GPU once and re-uses the same WebGL buffer for every geometry).
// ----------------------------------------------------------------
const _floorNrmArray = new Float32Array(_FV * 3);
for (let i = 1; i < _floorNrmArray.length; i += 3) _floorNrmArray[i] = 1.0;
const _FLOOR_NRM_ATTR = new THREE.BufferAttribute(_floorNrmArray, 3);

// Per-tile zone colour scratch — written once per tile, read by 64 micro-tiles.
const _ZC = new Float32Array(27); // 9 zones × 3 channels
const ZC_CORE=0, ZC_N=3, ZC_S=6, ZC_W=9, ZC_E=12;
const ZC_NW=15, ZC_NE=18, ZC_SW=21, ZC_SE=24;

// Per-tile corner height/colour scratch — (M+1)×(M+1) shared corner grid.
// Written after H/COL are computed; used to emit quads with interpolated heights.
const _HC = new Float32Array((_M+1) * (_M+1));
const _CC = new Float32Array((_M+1) * (_M+1) * 3);

// ----------------------------------------------------------------
// Module-level shared index buffers — filled once, reused by every instance.
// The index pattern never changes: only position/colour data changes per render.
// Sharing one BufferAttribute means Three.js uploads the pattern to the GPU
// once and re-uses the same buffer for every geometry that references it.
// ----------------------------------------------------------------
const _floorIdxArray = new Uint32Array(_FQ * 6);
for (let q = 0, v = 0, ii = 0; q < _FQ; q++, v += 4, ii += 6) {
  _floorIdxArray[ii]=v; _floorIdxArray[ii+1]=v+2; _floorIdxArray[ii+2]=v+1;
  _floorIdxArray[ii+3]=v+1; _floorIdxArray[ii+4]=v+2; _floorIdxArray[ii+5]=v+3;
}
const _FLOOR_IDX_ATTR = new THREE.BufferAttribute(_floorIdxArray, 1);

const _wallIdxArray = new Uint32Array(_MAX_WQ * 6);
for (let q = 0, v = 0, ii = 0; q < _MAX_WQ; q++, v += 4, ii += 6) {
  _wallIdxArray[ii]=v; _wallIdxArray[ii+1]=v+1; _wallIdxArray[ii+2]=v+2;
  _wallIdxArray[ii+3]=v+1; _wallIdxArray[ii+4]=v+3; _wallIdxArray[ii+5]=v+2;
}
const _WALL_IDX_ATTR = new THREE.BufferAttribute(_wallIdxArray, 1);

// ----------------------------------------------------------------
// ChunkRenderer
// ----------------------------------------------------------------
export class ChunkRenderer {
  constructor(scene) {
    this._scene     = scene;
    this._obsMeshes = [];
    this._grid      = null;
    this._tileElev  = null;

    // ── Floor — persistent geometry ─────────────────────────────────────
    this._fPos = new Float32Array(_FV * 3);
    this._fCol = new Float32Array(_FV * 3);

    this._floorPosAttr = new THREE.BufferAttribute(this._fPos, 3);
    this._floorColAttr = new THREE.BufferAttribute(this._fCol, 3);
    const fGeo = new THREE.BufferGeometry();
    this._fNrm = new Float32Array(_FV * 3);
    this._floorNrmAttr = new THREE.BufferAttribute(this._fNrm, 3);

    fGeo.setAttribute('position', this._floorPosAttr);
    fGeo.setAttribute('color',    this._floorColAttr);
    fGeo.setAttribute('normal',   this._floorNrmAttr);
    fGeo.setIndex(_FLOOR_IDX_ATTR);                    // shared, never changes
    this._floorMesh = new THREE.Mesh(fGeo,
      new THREE.MeshLambertMaterial({ vertexColors: true }));
    this._floorMesh.castShadow = this._floorMesh.receiveShadow = true;
    this._floorMesh.frustumCulled = false;
    this._floorMesh.visible = false; // hidden until first render() populates the buffer
    scene.add(this._floorMesh);

    // ── Walls — persistent max-size geometry + drawRange ─────────────────
    this._wPos = new Float32Array(_MAX_WQ * 12);
    this._wCol = new Float32Array(_MAX_WQ * 12);
    this._wNrm = new Float32Array(_MAX_WQ * 12);

    this._wallPosAttr = new THREE.BufferAttribute(this._wPos, 3);
    this._wallColAttr = new THREE.BufferAttribute(this._wCol, 3);
    this._wallNrmAttr = new THREE.BufferAttribute(this._wNrm, 3);
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', this._wallPosAttr);
    wGeo.setAttribute('color',    this._wallColAttr);
    wGeo.setAttribute('normal',   this._wallNrmAttr);
    wGeo.setIndex(_WALL_IDX_ATTR);                     // shared, never changes
    wGeo.setDrawRange(0, 0);
    this._wallMesh = new THREE.Mesh(wGeo,
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this._wallMesh.castShadow = this._wallMesh.receiveShadow = true;
    this._wallMesh.frustumCulled = false;
    this._wallMesh.visible = false;
    scene.add(this._wallMesh);

    // ── Grid — persistent geometry ───────────────────────────────────────
    this._gridPts     = new Float32Array(_GRID_SEGS * 6);
    this._gridPosAttr = new THREE.BufferAttribute(this._gridPts, 3);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', this._gridPosAttr);
    this._gridMesh = new THREE.LineSegments(gridGeo,
      new THREE.LineBasicMaterial({ color: 0x222222 }));
    this._gridMesh.frustumCulled = false;
    this._gridMesh.visible = false;
    this._gridVisible = false;
    scene.add(this._gridMesh);

    // ── Pre-allocated per-tile scratch buffers (reused across render calls) ──
    this._H        = new Float32Array(_M * _M);
    this._COL      = new Float32Array(_M * _M * 3);
    this._tileElevBuf = new Float32Array(_S * _S);

    // ── Incremental render state — allows _buildFloor to run in row slices ──
    this._pendingGrid    = null;   // grid being incrementally rendered
    this._pendingNbr     = null;   // nbrGrids for pending render
    this._pendingFvi     = 0;      // floor vertex write cursor
    this._pendingWvi     = 0;      // wall vertex write cursor
    this._pendingRowStart = 0;     // next row to process
  }

  // Optional perf hook — set externally for sub-operation timing.
  perfBegin = null;

  // Full render in one call (used for centre chunk on init/teleport).
  render(grid, nbrGrids = {}) {
    this._disposeObstacles();
    this._floorMesh.visible = true;
    this._wallMesh.visible  = true;
    this._gridMesh.visible  = this._gridVisible;
    this._grid = grid;
    this._pendingGrid = null; // cancel any in-progress incremental render
    const _pb = this.perfBegin;
    const _ef = _pb?.('floor'); this._buildFloor(grid, nbrGrids, 0, _S, 0, 0); _ef?.();
    this._finishFloor();
    const _eg = _pb?.('grid');  this._buildGrid(grid);                          _eg?.();
    const _eo = _pb?.('obstacles'); this._buildObstacles(grid);                 _eo?.();
  }

  // Start an incremental render — call renderSlice() on subsequent frames.
  // Returns true when the render is fully complete.
  beginIncremental(grid, nbrGrids = {}) {
    this._disposeObstacles();
    this._grid = grid;
    this._pendingGrid     = grid;
    this._pendingNbr      = nbrGrids;
    this._pendingFvi      = 0;
    this._pendingWvi      = 0;
    this._pendingRowStart = 0;
    // Hide meshes during incremental build — the floor buffer contains stale
    // data from the previous chunk until all slices complete.  Three.js scans
    // the entire position buffer for computeBoundingSphere(), and stale NaN
    // values from a prior failed render trigger warnings.
    this._floorMesh.visible = false;
    this._wallMesh.visible  = false;
    this._gridMesh.visible  = false;
  }

  // Process the next slice of rows. Returns true when done.
  renderSlice(rowBudget = 32) {
    if (!this._pendingGrid) return true;
    const grid    = this._pendingGrid;
    const nbrGrids = this._pendingNbr;
    const rowStart = this._pendingRowStart;
    const rowEnd   = Math.min(_S, rowStart + rowBudget);

    const _pb = this.perfBegin;
    const _ef = _pb?.('floor');
    const result = this._buildFloor(grid, nbrGrids, rowStart, rowEnd,
                                     this._pendingFvi, this._pendingWvi);
    _ef?.();
    this._pendingFvi      = result.fvi;
    this._pendingWvi      = result.wvi;
    this._pendingRowStart = rowEnd;

    if (rowEnd >= _S) {
      // Floor complete — finalize and build grid + obstacles
      this._floorMesh.visible = true;
      this._wallMesh.visible  = true;
      this._gridMesh.visible  = this._gridVisible;
      this._finishFloor();
      const _eg = _pb?.('grid');  this._buildGrid(grid);       _eg?.();
      const _eo = _pb?.('obstacles'); this._buildObstacles(grid); _eo?.();
      this._pendingGrid = null;
      return true;
    }
    return false;
  }

  // Return this renderer to the MicroWorld pool without disposing its geometry.
  // Clears obstacle meshes and hides all content.  Call render() to reactivate.
  release() {
    this._disposeObstacles();
    this._floorMesh.visible = false;
    this._wallMesh.visible  = false;
    this._gridMesh.visible  = false;
    this._grid        = null;
    this._tileElev    = null;
    this._pendingGrid = null; // cancel any in-progress incremental render
  }

  elevationAt(tx, ty) {
    if (!this._tileElev) return 0;
    const S  = _S;
    // Clamp to chunk interior so edge characters don't read out-of-bounds.
    const x  = Math.max(0, Math.min(S - 0.0001, tx));
    const z  = Math.max(0, Math.min(S - 0.0001, ty));
    const x0 = Math.floor(x),       x1 = Math.min(S - 1, x0 + 1);
    const z0 = Math.floor(z),       z1 = Math.min(S - 1, z0 + 1);
    const fx = x - x0,              fz = z - z0;
    const h00 = this._tileElev[z0 * S + x0];
    const h10 = this._tileElev[z0 * S + x1];
    const h01 = this._tileElev[z1 * S + x0];
    const h11 = this._tileElev[z1 * S + x1];
    // Bilinear interpolation — gives a continuous height field matching
    // the terrain slope, so characters glide instead of snapping at tile edges.
    return h00 * (1 - fx) * (1 - fz)
         + h10 *      fx  * (1 - fz)
         + h01 * (1 - fx) *      fz
         + h11 *      fx  *      fz;
  }

  dispose() {
    this._disposeObstacles();
    for (const m of [this._floorMesh, this._wallMesh, this._gridMesh]) {
      this._scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this._grid     = null;
    this._tileElev = null;
  }

  _disposeObstacles() {
    for (const m of this._obsMeshes) {
      this._scene.remove(m);
      // Geometry and material are shared module-level pools — do NOT dispose them.
      // Only dispose the instance matrix buffer unique to this InstancedMesh.
      m.dispose();
    }
    this._obsMeshes = [];
  }

  // ----------------------------------------------------------------
  // Floor — 8×8 dithered micro-tile grid per tile.
  // ----------------------------------------------------------------
  _buildFloor(grid, nbrGrids = {}, rowStart = 0, rowEnd = _S, startFvi = 0, startWvi = 0) {
    const S     = _S;
    const ES    = ELEVATION_SCALE;
    const M     = _M;
    const MF    = _MF;
    const ZONE  = _ZONE;
    const STEPS = ZONE + 1;

    // ── Neighbour lookup helpers ─────────────────────────────────────────
    const cl = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
    const elevOf = (tx, ty) => {
      if (tx >= 0 && tx < S && ty >= 0 && ty < S) return grid.elevation[ty * S + tx];
      // Diagonal corners — both coords out of bounds
      if (tx <  0 && ty <  0) return nbrGrids['-1,-1']?.elevation[(S-1) * S + (S-1)] ?? grid.elevation[0];
      if (tx >= S && ty <  0) return nbrGrids[ '1,-1']?.elevation[(S-1) * S]          ?? grid.elevation[S-1];
      if (tx <  0 && ty >= S) return nbrGrids['-1,1']?.elevation[S-1]                 ?? grid.elevation[(S-1)*S];
      if (tx >= S && ty >= S) return nbrGrids[ '1,1']?.elevation[0]                   ?? grid.elevation[(S-1)*S+(S-1)];
      // Cardinal edges — only ONE coord is out of bounds
      if (tx <  0) return nbrGrids['-1,0']?.elevation[ty * S + (S-1)] ?? grid.elevation[ty * S];
      if (tx >= S) return nbrGrids[ '1,0']?.elevation[ty * S]         ?? grid.elevation[ty * S + (S-1)];
      if (ty <  0) return nbrGrids['0,-1']?.elevation[(S-1) * S + tx] ?? grid.elevation[tx];
      if (ty >= S) return nbrGrids[ '0,1']?.elevation[tx]             ?? grid.elevation[(S-1) * S + tx];
      return grid.elevation[cl(ty,0,S-1) * S + cl(tx,0,S-1)] || 0;
    };
    const groundOf = (tx, ty) => {
      if (tx >= 0 && tx < S && ty >= 0 && ty < S) return grid.ground[ty * S + tx];
      // Diagonal corners
      if (tx <  0 && ty <  0) return nbrGrids['-1,-1']?.ground[(S-1) * S + (S-1)] ?? grid.ground[0];
      if (tx >= S && ty <  0) return nbrGrids[ '1,-1']?.ground[(S-1) * S]          ?? grid.ground[S-1];
      if (tx <  0 && ty >= S) return nbrGrids['-1,1']?.ground[S-1]                 ?? grid.ground[(S-1)*S];
      if (tx >= S && ty >= S) return nbrGrids[ '1,1']?.ground[0]                   ?? grid.ground[(S-1)*S+(S-1)];
      // Cardinal edges
      if (tx <  0) return nbrGrids['-1,0']?.ground[ty * S + (S-1)] ?? grid.ground[ty * S];
      if (tx >= S) return nbrGrids[ '1,0']?.ground[ty * S]         ?? grid.ground[ty * S + (S-1)];
      if (ty <  0) return nbrGrids['0,-1']?.ground[(S-1) * S + tx] ?? grid.ground[tx];
      if (ty >= S) return nbrGrids[ '0,1']?.ground[tx]             ?? grid.ground[(S-1) * S + tx];
      return grid.ground[cl(ty,0,S-1) * S + cl(tx,0,S-1)] || 0;
    };

    // ── Zone colour helpers — write into _ZC, zero allocations ──────────
    const shadeZC = (off, gType, e01) => {
      const rgb = GROUND_RGB[gType] ?? GROUND_RGB[0];
      const s   = 0.55 + e01 * 0.60;
      _ZC[off]   = Math.min(1, rgb[0] * s);
      _ZC[off+1] = Math.min(1, rgb[1] * s);
      _ZC[off+2] = Math.min(1, rgb[2] * s);
    };
    const blend2ZC = (off, g1,e1, g2,e2) => {
      const r1=GROUND_RGB[g1]??GROUND_RGB[0], r2=GROUND_RGB[g2]??GROUND_RGB[0];
      const s1=0.55+e1*0.60, s2=0.55+e2*0.60;
      _ZC[off]   = (Math.min(1,r1[0]*s1)+Math.min(1,r2[0]*s2))*0.5;
      _ZC[off+1] = (Math.min(1,r1[1]*s1)+Math.min(1,r2[1]*s2))*0.5;
      _ZC[off+2] = (Math.min(1,r1[2]*s1)+Math.min(1,r2[2]*s2))*0.5;
    };
    const blend4ZC = (off, g1,e1, g2,e2, g3,e3, g4,e4) => {
      const r1=GROUND_RGB[g1]??GROUND_RGB[0], r2=GROUND_RGB[g2]??GROUND_RGB[0];
      const r3=GROUND_RGB[g3]??GROUND_RGB[0], r4=GROUND_RGB[g4]??GROUND_RGB[0];
      const s1=0.55+e1*0.60, s2=0.55+e2*0.60, s3=0.55+e3*0.60, s4=0.55+e4*0.60;
      _ZC[off]   = (Math.min(1,r1[0]*s1)+Math.min(1,r2[0]*s2)+Math.min(1,r3[0]*s3)+Math.min(1,r4[0]*s4))*0.25;
      _ZC[off+1] = (Math.min(1,r1[1]*s1)+Math.min(1,r2[1]*s2)+Math.min(1,r3[1]*s3)+Math.min(1,r4[1]*s4))*0.25;
      _ZC[off+2] = (Math.min(1,r1[2]*s1)+Math.min(1,r2[2]*s2)+Math.min(1,r3[2]*s3)+Math.min(1,r4[2]*s4))*0.25;
    };

    // ── Height helpers ───────────────────────────────────────────────────
    const dHash = (a, b) => {
      let h = (Math.imul(a|0, 1664525) ^ Math.imul(b|0, 22695477)) >>> 0;
      h = Math.imul((h ^ (h >>> 16))|0, 0x45d9f3b) >>> 0;
      return h;
    };
    const borderH = (eOwn, eNbr, bdyA, bdyB, depth) => {
      const lo = Math.min(eOwn, eNbr), hi = Math.max(eOwn, eNbr);
      if (lo === hi) return lo * ES;
      const ownAtHi = eOwn >= eNbr, ownLev = ownAtHi ? ZONE : 0;
      let lev;
      if (depth === 0) {
        lev = dHash(bdyA, bdyB) % STEPS;
      } else {
        const dir = ownAtHi ? -1 : 1;
        lev = ownLev + dir * (dHash(bdyA, bdyB + depth * 7919) % (ZONE - depth + 1));
        lev = Math.max(0, Math.min(ZONE, lev));
      }
      return (lo + lev * (hi - lo) / ZONE) * ES;
    };

    // ── Persistent buffer references ─────────────────────────────────────
    const fPos = this._fPos;
    const fCol = this._fCol;
    const fNrm = this._fNrm;
    let fvi = startFvi;

    const wPos = this._wPos, wCol = this._wCol, wNrm = this._wNrm;
    let wvi = startWvi;
    // Wall normals: perpendicular to the wall's XZ direction.
    // For axis-aligned micro-tile walls:  len = MF always.
    //   EW wall (dx=0, dz=MF): nx = dz/MF = 1, nz = 0
    //   NS wall (dx=MF, dz=0): nx = 0,       nz = -dx/MF = -1
    const addWall = (ax, az, bx, bz, hLo, hHi, cr, cg, cb) => {
      const s  = 0.78, b = wvi * 3;
      const rs = cr*s, gs = cg*s, bs = cb*s;
      wPos[b   ]=ax; wPos[b+ 1]=hHi; wPos[b+ 2]=az;
      wPos[b+ 3]=bx; wPos[b+ 4]=hHi; wPos[b+ 5]=bz;
      wPos[b+ 6]=ax; wPos[b+ 7]=hLo; wPos[b+ 8]=az;
      wPos[b+ 9]=bx; wPos[b+10]=hLo; wPos[b+11]=bz;
      wCol[b   ]=rs; wCol[b+ 1]=gs; wCol[b+ 2]=bs;
      wCol[b+ 3]=rs; wCol[b+ 4]=gs; wCol[b+ 5]=bs;
      wCol[b+ 6]=rs; wCol[b+ 7]=gs; wCol[b+ 8]=bs;
      wCol[b+ 9]=rs; wCol[b+10]=gs; wCol[b+11]=bs;
      // Analytical normal: (bz-az)*M, 0, (ax-bx)*M  — normalised because len=MF
      const nx = (bz - az) * M, nz = (ax - bx) * M;
      wNrm[b   ]=nx; wNrm[b+ 1]=0; wNrm[b+ 2]=nz;
      wNrm[b+ 3]=nx; wNrm[b+ 4]=0; wNrm[b+ 5]=nz;
      wNrm[b+ 6]=nx; wNrm[b+ 7]=0; wNrm[b+ 8]=nz;
      wNrm[b+ 9]=nx; wNrm[b+10]=0; wNrm[b+11]=nz;
      wvi += 4;
    };

    // Per-tile scratch — pre-allocated on the instance, zero-filled each render
    const H   = this._H;
    const COL = this._COL;
    const tileElev = this._tileElevBuf;

    // ── Main tile loop (may process a subset of rows for incremental rendering) ──
    for (let ty = rowStart; ty < rowEnd; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i  = ty * S + tx;
        const eC = elevOf(tx, ty), gC = groundOf(tx, ty);
        tileElev[i] = eC * ES;

        // Cardinal neighbours (always needed for both elevation and colour)
        const eN = elevOf(tx, ty-1), gN = groundOf(tx, ty-1);
        const eS = elevOf(tx, ty+1), gS = groundOf(tx, ty+1);
        const eW = elevOf(tx-1, ty), gW = groundOf(tx-1, ty);
        const eE = elevOf(tx+1, ty), gE = groundOf(tx+1, ty);

        // Precompute 9 zone colours — each non-core slot holds the pure neighbour
        // colour so the per-microtile dither can pick discretely between own and neighbour.
        shadeZC(ZC_CORE, gC,  eC);
        shadeZC(ZC_N,    gN,  eN);
        shadeZC(ZC_S,    gS,  eS);
        shadeZC(ZC_W,    gW,  eW);
        shadeZC(ZC_E,    gE,  eE);

        // Diagonal neighbours — corner zone slots hold the diagonal neighbour colour.
        const eNW=elevOf(tx-1,ty-1), gNW=groundOf(tx-1,ty-1);
        const eNE=elevOf(tx+1,ty-1), gNE=groundOf(tx+1,ty-1);
        const eSW=elevOf(tx-1,ty+1), gSW=groundOf(tx-1,ty+1);
        const eSE=elevOf(tx+1,ty+1), gSE=groundOf(tx+1,ty+1);
        shadeZC(ZC_NW, gNW, eNW);
        shadeZC(ZC_NE, gNE, eNE);
        shadeZC(ZC_SW, gSW, eSW);
        shadeZC(ZC_SE, gSE, eSE);

        const wxTile = grid.macroX * S + tx;
        const wyTile = grid.macroY * S + ty;
        const nsBdyN = wyTile * M, nsBdyS = (wyTile + 1) * M;
        const ewBdyW = wxTile * M, ewBdyE = (wxTile + 1) * M;

        // ── Fast path: all cardinal neighbours at same elevation ─────────
        // Skips all borderH / dHash calls; still applies colour zone blending.
        const flatTile = (eN === eC && eS === eC && eW === eC && eE === eC);
        if (flatTile) {
          const hc = eC * ES;
          for (let mi = 0; mi < M; mi++) {
            for (let mj = 0; mj < M; mj++) {
              const k   = mi * M + mj;
              const dN  = mi,     inN = dN < ZONE;
              const dS  = M-1-mi, inS = dS < ZONE;
              const dW  = mj,     inW = dW < ZONE;
              const dE  = M-1-mj, inE = dE < ZONE;
              H[k] = hc;
              const zoff = (!inN&&!inS&&!inW&&!inE) ? ZC_CORE :
                            (inN&&inW) ? ZC_NW : (inN&&inE) ? ZC_NE :
                            (inS&&inW) ? ZC_SW : (inS&&inE) ? ZC_SE :
                            inN ? ZC_N : inS ? ZC_S : inW ? ZC_W : ZC_E;
              let colZoff;
              if (zoff === ZC_CORE) {
                colZoff = ZC_CORE;
              } else {
                const depth = Math.min(inN?dN:ZONE, inS?dS:ZONE, inW?dW:ZONE, inE?dE:ZONE);
                colZoff = (dHash(wxTile*M+mj, wyTile*M+mi) % STEPS) < (ZONE - depth)
                          ? zoff : ZC_CORE;
              }
              COL[k*3]=_ZC[colZoff]; COL[k*3+1]=_ZC[colZoff+1]; COL[k*3+2]=_ZC[colZoff+2];
            }
          }
          // Patch the 4 corner microtiles: cardinal neighbours are all eC but
          // diagonal neighbours may differ, so the shared world-corner height
          // must still be computed with dHash — exactly as the full path does —
          // so adjacent tiles produce identical values at that point.
          { const lo4=Math.min(eC,eN,eW,eNW), hi4=Math.max(eC,eN,eW,eNW);
            H[0]               = (lo4===hi4)?hc:(lo4+dHash(ewBdyW,nsBdyN)%STEPS*(hi4-lo4)/ZONE)*ES; }
          { const lo4=Math.min(eC,eN,eE,eNE), hi4=Math.max(eC,eN,eE,eNE);
            H[M-1]             = (lo4===hi4)?hc:(lo4+dHash(ewBdyE,nsBdyN)%STEPS*(hi4-lo4)/ZONE)*ES; }
          { const lo4=Math.min(eC,eS,eW,eSW), hi4=Math.max(eC,eS,eW,eSW);
            H[(M-1)*M]         = (lo4===hi4)?hc:(lo4+dHash(ewBdyW,nsBdyS)%STEPS*(hi4-lo4)/ZONE)*ES; }
          { const lo4=Math.min(eC,eS,eE,eSE), hi4=Math.max(eC,eS,eE,eSE);
            H[(M-1)*M+(M-1)]   = (lo4===hi4)?hc:(lo4+dHash(ewBdyE,nsBdyS)%STEPS*(hi4-lo4)/ZONE)*ES; }
        } else {
          // ── Full border computation ────────────────────────────────────
          for (let mi = 0; mi < M; mi++) {
            for (let mj = 0; mj < M; mj++) {
              const k   = mi * M + mj;
              const dN  = mi,     inN = dN < ZONE;
              const dS  = M-1-mi, inS = dS < ZONE;
              const dW  = mj,     inW = dW < ZONE;
              const dE  = M-1-mj, inE = dE < ZONE;
              let h, zoff;

              if (!inN && !inS && !inW && !inE) {
                h = eC * ES; zoff = ZC_CORE;

              } else if (inN && inW) {
                zoff = ZC_NW;
                if (dN === 0 && dW === 0) {
                  const lo4=Math.min(eC,eN,eW,eNW), hi4=Math.max(eC,eN,eW,eNW);
                  h = (lo4 + (lo4===hi4?0:dHash(ewBdyW,nsBdyN)%STEPS)*(hi4-lo4)/ZONE)*ES;
                } else if (dN === 0) { h = borderH(eC,eN,wxTile*M+mj,nsBdyN,0);
                } else if (dW === 0) { h = borderH(eC,eW,ewBdyW,wyTile*M+mi,0);
                } else { h = Math.min(borderH(eC,eN,wxTile*M+mj,nsBdyN,dN),
                                      borderH(eC,eW,ewBdyW,wyTile*M+mi,dW)); }

              } else if (inN && inE) {
                zoff = ZC_NE;
                if (dN === 0 && dE === 0) {
                  const lo4=Math.min(eC,eN,eE,eNE), hi4=Math.max(eC,eN,eE,eNE);
                  h = (lo4 + (lo4===hi4?0:dHash(ewBdyE,nsBdyN)%STEPS)*(hi4-lo4)/ZONE)*ES;
                } else if (dN === 0) { h = borderH(eC,eN,wxTile*M+mj,nsBdyN,0);
                } else if (dE === 0) { h = borderH(eC,eE,ewBdyE,wyTile*M+mi,0);
                } else { h = Math.min(borderH(eC,eN,wxTile*M+mj,nsBdyN,dN),
                                      borderH(eC,eE,ewBdyE,wyTile*M+mi,dE)); }

              } else if (inS && inW) {
                zoff = ZC_SW;
                if (dS === 0 && dW === 0) {
                  const lo4=Math.min(eC,eS,eW,eSW), hi4=Math.max(eC,eS,eW,eSW);
                  h = (lo4 + (lo4===hi4?0:dHash(ewBdyW,nsBdyS)%STEPS)*(hi4-lo4)/ZONE)*ES;
                } else if (dS === 0) { h = borderH(eC,eS,wxTile*M+mj,nsBdyS,0);
                } else if (dW === 0) { h = borderH(eC,eW,ewBdyW,wyTile*M+mi,0);
                } else { h = Math.min(borderH(eC,eS,wxTile*M+mj,nsBdyS,dS),
                                      borderH(eC,eW,ewBdyW,wyTile*M+mi,dW)); }

              } else if (inS && inE) {
                zoff = ZC_SE;
                if (dS === 0 && dE === 0) {
                  const lo4=Math.min(eC,eS,eE,eSE), hi4=Math.max(eC,eS,eE,eSE);
                  h = (lo4 + (lo4===hi4?0:dHash(ewBdyE,nsBdyS)%STEPS)*(hi4-lo4)/ZONE)*ES;
                } else if (dS === 0) { h = borderH(eC,eS,wxTile*M+mj,nsBdyS,0);
                } else if (dE === 0) { h = borderH(eC,eE,ewBdyE,wyTile*M+mi,0);
                } else { h = Math.min(borderH(eC,eS,wxTile*M+mj,nsBdyS,dS),
                                      borderH(eC,eE,ewBdyE,wyTile*M+mi,dE)); }

              } else if (inN) { h=borderH(eC,eN,wxTile*M+mj,nsBdyN,dN); zoff=ZC_N;
              } else if (inS) { h=borderH(eC,eS,wxTile*M+mj,nsBdyS,dS); zoff=ZC_S;
              } else if (inW) { h=borderH(eC,eW,ewBdyW,wyTile*M+mi,dW); zoff=ZC_W;
              } else          { h=borderH(eC,eE,ewBdyE,wyTile*M+mi,dE); zoff=ZC_E; }

              H[k] = h;
              let colZoff;
              if (zoff === ZC_CORE) {
                colZoff = ZC_CORE;
              } else {
                const depth = Math.min(inN?dN:ZONE, inS?dS:ZONE, inW?dW:ZONE, inE?dE:ZONE);
                colZoff = (dHash(wxTile*M+mj, wyTile*M+mi) % STEPS) < (ZONE - depth)
                          ? zoff : ZC_CORE;
              }
              COL[k*3]=_ZC[colZoff]; COL[k*3+1]=_ZC[colZoff+1]; COL[k*3+2]=_ZC[colZoff+2];
            }
          }

        } // end full-computation branch

        // ── Corner averaging — (M+1)×(M+1) grid of shared quad corners ──
        // Each corner (ci,cj) averages the H and COL of the 1–4 microtiles
        // that share it.  Adjacent quads reference the same _HC/_CC entries,
        // so the mesh is continuous — no intra-tile walls needed.
        // Average neighbouring microtile heights into shared quad corners (HC only).
        // Colour is NOT averaged here — each quad uses its own discrete dithered COL.
        const MP1 = M + 1;
        for (let ci = 0; ci <= M; ci++) {
          for (let cj = 0; cj <= M; cj++) {
            let hSum=0, cnt=0;
            for (let di = -1; di <= 0; di++) {
              for (let dj = -1; dj <= 0; dj++) {
                const ni = ci+di, nj = cj+dj;
                if (ni >= 0 && ni < M && nj >= 0 && nj < M) {
                  hSum += H[ni*M+nj]; cnt++;
                }
              }
            }
            _HC[ci*MP1+cj] = hSum/cnt;
          }
        }

        // ── Emit floor quads with per-corner heights, colours, normals ───
        for (let mi = 0; mi < M; mi++) {
          for (let mj = 0; mj < M; mj++) {
            const x0 = tx + mj * MF, x1 = x0 + MF;
            const z0 = ty + mi * MF, z1 = z0 + MF;

            const cNW = mi*MP1+mj,     cNE = mi*MP1+mj+1;
            const cSW = (mi+1)*MP1+mj, cSE = (mi+1)*MP1+mj+1;
            const yNW=_HC[cNW], yNE=_HC[cNE], ySW=_HC[cSW], ySE=_HC[cSE];

            const vb = fvi;
            fPos[vb*3  ]=x0; fPos[vb*3+1]=yNW; fPos[vb*3+2]=z0;  // v0 NW
            fPos[vb*3+3]=x1; fPos[vb*3+4]=yNE; fPos[vb*3+5]=z0;  // v1 NE
            fPos[vb*3+6]=x0; fPos[vb*3+7]=ySW; fPos[vb*3+8]=z1;  // v2 SW
            fPos[vb*3+9]=x1; fPos[vb*3+10]=ySE;fPos[vb*3+11]=z1; // v3 SE

            // Uniform discrete colour — all 4 vertices of this quad share the
            // microtile's dithered pick so there is no GPU gradient across the quad.
            const k  = mi * M + mj;
            const cr = COL[k*3], cg = COL[k*3+1], cb = COL[k*3+2];
            fCol[vb*3  ]=cr; fCol[vb*3+1]=cg; fCol[vb*3+2]=cb;
            fCol[(vb+1)*3]=cr; fCol[(vb+1)*3+1]=cg; fCol[(vb+1)*3+2]=cb;
            fCol[(vb+2)*3]=cr; fCol[(vb+2)*3+1]=cg; fCol[(vb+2)*3+2]=cb;
            fCol[(vb+3)*3]=cr; fCol[(vb+3)*3+1]=cg; fCol[(vb+3)*3+2]=cb;

            // Quad normal: cross(diag SE−NW, diag NE−SW).
            // n = MF * (−(dy1+dy2), 2·MF, dy2−dy1)  where dy1=ySE−yNW, dy2=yNE−ySW
            const dy1 = ySE-yNW, dy2 = yNE-ySW;
            const nx = -(dy1+dy2), ny = 2*MF, nz = dy2-dy1;
            const nl = Math.sqrt(nx*nx + ny*ny + nz*nz);
            const nnx=nx/nl, nny=ny/nl, nnz=nz/nl;
            const nb = vb*3;
            fNrm[nb  ]=nnx; fNrm[nb+1]=nny; fNrm[nb+2]=nnz;
            fNrm[nb+3]=nnx; fNrm[nb+4]=nny; fNrm[nb+5]=nnz;
            fNrm[nb+6]=nnx; fNrm[nb+7]=nny; fNrm[nb+8]=nnz;
            fNrm[nb+9]=nnx; fNrm[nb+10]=nny;fNrm[nb+11]=nnz;

            fvi += 4;
          }
        }
      }
    }

    this._tileElev = tileElev;
    this._lastWvi  = wvi;
    return { fvi, wvi };
  }

  // Mark GPU buffers dirty and set wall draw range. Called once after all
  // rows have been processed (either single-shot or after final slice).
  _finishFloor() {
    this._floorPosAttr.needsUpdate = true;
    this._floorColAttr.needsUpdate = true;
    this._floorNrmAttr.needsUpdate = true;
    const wvi = this._lastWvi ?? 0;
    if (wvi > 0) {
      this._wallPosAttr.needsUpdate = true;
      this._wallColAttr.needsUpdate = true;
      this._wallNrmAttr.needsUpdate = true;
    }
    this._wallMesh.geometry.setDrawRange(0, (wvi >> 2) * 6);
  }

  // ----------------------------------------------------------------
  // Grid overlay — 1m tile-boundary lines only (no micro-tile subdivisions).
  // Visible only in turn-based mode; controlled via setGridMode().
  // ----------------------------------------------------------------
  _buildGrid(grid) {
    const S   = _S, OFF = 0.03;
    const te  = this._tileElev;
    const pts = this._gridPts;
    let pi = 0;

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const y  = te[ty * S + tx] + OFF;
        // North edge of this tile (shared with south edge of tile above)
        const yN = ty > 0 ? Math.max(y, te[(ty-1)*S+tx]+OFF) : y;
        pts[pi++]=tx;   pts[pi++]=yN; pts[pi++]=ty;
        pts[pi++]=tx+1; pts[pi++]=yN; pts[pi++]=ty;
        // West edge of this tile (shared with east edge of tile to the left)
        const yW = tx > 0 ? Math.max(y, te[ty*S+(tx-1)]+OFF) : y;
        pts[pi++]=tx; pts[pi++]=yW; pts[pi++]=ty;
        pts[pi++]=tx; pts[pi++]=yW; pts[pi++]=ty+1;
      }
    }
    // Closing east column
    for (let ty = 0; ty < S; ty++) {
      const y = te[ty * S + (S-1)] + OFF;
      pts[pi++]=S; pts[pi++]=y; pts[pi++]=ty;
      pts[pi++]=S; pts[pi++]=y; pts[pi++]=ty+1;
    }
    // Closing south row
    for (let tx = 0; tx < S; tx++) {
      const y = te[(S-1)*S+tx] + OFF;
      pts[pi++]=tx;   pts[pi++]=y; pts[pi++]=S;
      pts[pi++]=tx+1; pts[pi++]=y; pts[pi++]=S;
    }

    this._gridMesh.geometry.setDrawRange(0, pi / 3);
    this._gridPosAttr.needsUpdate = true;
  }

  // Show or hide the 1m tile grid (call from MicroWorld on turn-mode change).
  setGridMode(visible) {
    this._gridVisible = visible;
    this._gridMesh.visible = visible;
  }

  // ----------------------------------------------------------------
  // Obstacles — rebuilt per render (counts vary per obstacle type)
  // ----------------------------------------------------------------
  _buildObstacles(grid) {
    const S       = _S;
    const buckets = OBS_GEO.map(() => []);

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i   = ty * S + tx;
        const obs = grid.obstacle[i];
        if (!obs || !OBS_GEO[obs]) continue;
        if (STAMP2X2_IDS.has(obs) && (tx % 2 !== 0 || ty % 2 !== 0)) continue;
        const elev = this._tileElev ? this._tileElev[i] : grid.elevation[i] * ELEVATION_SCALE;
        buckets[obs].push({ tx, ty, elev });
      }
    }

    const dummy = new THREE.Object3D();
    for (let obsType = 1; obsType < OBS_GEO.length; obsType++) {
      const list = buckets[obsType];
      if (!list.length || !OBS_GEO[obsType]) continue;
      const geo  = _OBS_GEO_POOL[obsType];
      const mat  = _OBS_MAT_POOL[obsType];
      const sh   = OBS_GEO[obsType][1]; // height — needed for Y offset
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.castShadow = true;
      const isStamp = STAMP2X2_IDS.has(obsType);
      list.forEach(({ tx, ty, elev }, idx) => {
        dummy.position.set(isStamp ? tx+1.0 : tx+0.5, elev + sh/2, isStamp ? ty+1.0 : ty+0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this._scene.add(mesh);
      this._obsMeshes.push(mesh);
    }
  }
}
