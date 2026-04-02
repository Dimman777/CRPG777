// MicroWorld — manages a 3×3 pool of rendered chunks centred on the player.
//
// The player is always in the centre chunk.  When they cross an edge the centre
// shifts: the three chunks that are now out of range are disposed, three new
// ones are loaded at the opposite side, and every group is repositioned so the
// seam is invisible.
//
// Keeps applyConditions()/hasTag() for bridge-layer compatibility.

import * as THREE from 'three';
import { MacroMap }       from '../macro/macro_map.js';
import { MacroCell }      from '../macro/macro_cell.js';
import { ChunkGenerator, ELEV_LEVELS } from './chunk_gen.js';
import { ChunkRenderer, ELEVATION_SCALE } from '../render/chunk_renderer.js';
import { Player }         from './player.js';
import { CHUNK_SIZE }     from './micro_grid.js';

export class MicroWorld {
  constructor() {
    // Bridge-layer world-tag interface
    this.locationId = null;
    this.worldTags  = [];

    this._scene    = null;
    this._macroMap = null;
    this._chunkGen = null;
    this._player   = null;
    this._mx       = 0;   // centre macro cell X
    this._my       = 0;   // centre macro cell Y

    // Map<"mx,my", { renderer: ChunkRenderer, group: THREE.Group, grid: MicroGrid }>
    this._chunks = new Map();

    this._overrides = null; // ChunkOverrides | null

    // Chunks queued for neighbour-aware re-render, processed 2 per frame in
    // update() to avoid a single-frame spike on boundary crossings.
    this._rerenderQueue = [];

    // Pool of reusable {renderer, group} pairs — created once at init, never
    // constructed again during gameplay.  Eliminates the ~4.3M-iteration index
    // buffer fill that previously happened inside every new ChunkRenderer().
    this._rendererPool = [];

    // Chunks queued for lazy loading — processed 1 per frame in update() so
    // the preload work is spread across many frames instead of spiking on the
    // first frame the player enters the 10-tile approach zone.
    this._loadQueue    = [];
    this._loadQueueSet = new Set();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  // Initialise the exploration layer.
  //   scene    — THREE.Scene
  //   macroMap — MacroMap | null  (null → built-in 5×5 test map)
  //   seed     — integer world seed
  init(scene, macroMap, seed, startMx = 2, startMy = 2, overrides = null) {
    this._scene    = scene;
    this._macroMap = macroMap ?? this._buildTestMap();
    this._chunkGen = new ChunkGenerator(seed);
    this._overrides = overrides;
    this._player   = new Player(scene);

    this._mx = startMx;
    this._my = startMy;

    // Pre-create 12 renderer+group pairs.  9 are needed for the active 3×3 window;
    // 3 more cover chunks that are preloaded ahead before the player crosses an edge.
    this._initPool(12);

    // Load the initial 3×3, fix seams, then place player at centre
    this._syncChunkPool();
    this._rerenderAllWithNeighbors();
    const centre = this._centreChunk;
    if (centre) this._player.place(32, 32, centre.renderer);

    this._dispatchCellChange();
  }

  // Call every frame (dt in seconds).
  update(dt, cameraController) {
    if (!this._player) return;

    // Process one deferred chunk load per frame.  Preloading is queued here
    // rather than executed synchronously so the cost is spread across many
    // frames before the player reaches the chunk edge (Jolt 1 fix).
    if (this._loadQueue.length > 0) {
      const item = this._loadQueue.shift();
      this._loadQueueSet.delete(item.key);
      if (!this._chunks.has(item.key)) {
        this._loadChunk(item.mx, item.my);
        const entry = this._chunks.get(item.key);
        if (entry) {
          entry.group.position.set(
            (item.mx - this._mx) * CHUNK_SIZE,
            0,
            (item.my - this._my) * CHUNK_SIZE
          );
        }
        this._queueRerender(item.key);
        // Include diagonal neighbours: their outermost corners depend on the
        // newly loaded chunk's elevation data via the dHash corner formula.
        for (let ddy = -1; ddy <= 1; ddy++)
          for (let ddx = -1; ddx <= 1; ddx++)
            if (ddx || ddy) this._queueRerender(`${item.mx+ddx},${item.my+ddy}`);
      }
    }

    // Drain the deferred re-render queue: 2 chunks per frame maximum.
    // This spreads the neighbour-seam fix work across several frames so
    // no single frame bears the cost of re-rendering all 9 chunks at once.
    if (this._rerenderQueue.length > 0) {
      const batch = this._rerenderQueue.splice(0, 2);
      for (const key of batch) this._rerenderOne(key);
    }

    const centre = this._centreChunk;
    const az     = cameraController?.azimuth ?? 45;
    const dir    = this._player.update(dt, centre?.grid, centre?.renderer, az);

    if (dir !== 'none') {
      const S = CHUNK_SIZE;
      let nmx = this._mx, nmy = this._my;
      let epx = this._player.px, epy = this._player.py;

      // Preserve the crossing overshoot so the player's speed is continuous.
      if (dir === 'east')  { nmx++; epx = this._player.px - S; }
      if (dir === 'west')  { nmx--; epx = this._player.px + S; }
      if (dir === 'south') { nmy++; epy = this._player.py - S; }
      if (dir === 'north') { nmy--; epy = this._player.py + S; }

      // Clamp to map
      const map = this._macroMap;
      nmx = Math.max(0, Math.min(map.width  - 1, nmx));
      nmy = Math.max(0, Math.min(map.height - 1, nmy));

      if (nmx !== this._mx || nmy !== this._my) {
        this._mx = nmx;
        this._my = nmy;
        const newlyLoaded = this._syncChunkPool();

        // Only re-render chunks whose neighbour relationships actually changed:
        //   • The 3 newly loaded chunks — first render had no full neighbour context.
        //   • The centre chunk — safety fix in case its leading edge was not preloaded.
        // The 6 chunks that were already in the pool and are not on the new leading
        // edge retain their existing renders: their visible seams did not change.
        this._rerenderQueue = [];
        const centreKey = `${this._mx},${this._my}`;
        for (const key of newlyLoaded) {
          this._queueRerender(key);
          // Also queue already-loaded diagonal neighbours of each new chunk:
          // their outermost corners change now that they have a new diagonal peer.
          const [kx, ky] = key.split(',').map(Number);
          for (let ddy = -1; ddy <= 1; ddy++)
            for (let ddx = -1; ddx <= 1; ddx++)
              if (ddx || ddy) this._queueRerender(`${kx+ddx},${ky+ddy}`);
        }
        this._queueRerender(centreKey); // no-op if centreKey is already queued

        this._dispatchCellChange();
      }

      // Notify followers of the same px/py adjustment applied to the player
      const dPx = epx - this._player.px;
      const dPy = epy - this._player.py;
      this._player.px = epx;
      this._player.py = epy;
      if ((dPx !== 0 || dPy !== 0) && this.onChunkTransition) {
        this.onChunkTransition(dPx, dPy);
      }
      const newCentre = this._centreChunk;
      this._player.refresh(newCentre?.renderer);
    } else {
      // Pre-load chunks ahead of the player before they reach the edge
      const px = this._player.px, py = this._player.py;
      const S  = CHUNK_SIZE;
      const T  = 10; // tile threshold for pre-loading
      if (px < T)       this._preloadEdge('west');
      if (px > S - T)   this._preloadEdge('east');
      if (py < T)       this._preloadEdge('north');
      if (py > S - T)   this._preloadEdge('south');
    }

    const pos = this._player.position;
    if (cameraController) cameraController.setTarget(pos.x, pos.y, pos.z);
    return pos;
  }

  // Teleport the player to the centre of macro cell (mx, my).
  teleportTo(mx, my) {
    if (!this._player) return;
    const map = this._macroMap;
    mx = Math.max(0, Math.min(map.width  - 1, mx));
    my = Math.max(0, Math.min(map.height - 1, my));
    this._mx = mx;
    this._my = my;
    this._syncChunkPool();
    this._rerenderAllWithNeighbors();
    this._dispatchCellChange();
    const centre = this._centreChunk;
    if (centre) this._player.place(32, 32, centre.renderer);
  }

  keyDown(key) { this._player?.keyDown(key); }
  keyUp(key)   { this._player?.keyUp(key);   }

  rotateFacingLeft()  { this._player?.rotateFacingLeft();  }
  rotateFacingRight() { this._player?.rotateFacingRight(); }

  get player()        { return this._player; }
  get centreGrid()    { return this._centreChunk?.grid     ?? null; }
  get centreRenderer(){ return this._centreChunk?.renderer ?? null; }

  // Show or hide the 1m tile grid on all active chunk renderers.
  setGridVisible(visible) {
    for (const { renderer } of this._chunks.values()) {
      renderer.setGridMode(visible);
    }
  }

  // Callback slot — set by Game to receive chunk-transition tile offsets
  // so FollowerManager can adjust follower positions in sync with the player.
  onChunkTransition = null;

  // Returns micro-tile data for the player's current standing tile, or null.
  getTileInfo() {
    const centre = this._centreChunk;
    if (!centre || !this._player) return null;
    const S  = CHUNK_SIZE;
    const tx = Math.max(0, Math.min(S - 1, Math.floor(this._player.px)));
    const ty = Math.max(0, Math.min(S - 1, Math.floor(this._player.py)));
    const i  = ty * S + tx;
    const g  = centre.grid;
    return {
      tx, ty,
      ground:   g.ground[i],
      obstacle: g.obstacle[i],
      passable: !!g.passable[i],
      step:     Math.round(g.elevation[i] * ELEV_LEVELS),
      worldH:   +(g.elevation[i] * ELEVATION_SCALE).toFixed(1),
    };
  }

  // ── Bridge-layer API ────────────────────────────────────────────────────────

  applyConditions(conditions) { this.worldTags = conditions.map(c => c.tag); }
  hasTag(tag) { return this.worldTags.includes(tag); }

  // ── Chunk pool ──────────────────────────────────────────────────────────────

  get _centreChunk() { return this._chunks.get(`${this._mx},${this._my}`); }

  // Load missing chunks in the 3×3 window, unload those outside it,
  // then reposition every group so the centre is at world origin.
  _syncChunkPool() {
    const map = this._macroMap;

    // Build desired key set
    const desired = new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = this._mx + dx, cy = this._my + dy;
        if (map.inBounds(cx, cy)) desired.add(`${cx},${cy}`);
      }
    }

    // Unload chunks outside the window
    for (const key of [...this._chunks.keys()]) {
      if (!desired.has(key)) this._unloadChunk(key);
    }

    // Load chunks not yet in pool; collect which keys were actually loaded so
    // the caller can target re-renders precisely rather than refreshing all 9.
    const newlyLoaded = [];
    for (const key of desired) {
      if (!this._chunks.has(key)) {
        const [cx, cy] = key.split(',').map(Number);
        this._loadChunk(cx, cy);
        newlyLoaded.push(key);
      }
    }

    // Reposition all groups relative to the new centre
    for (const [key, entry] of this._chunks) {
      const [cx, cy] = key.split(',').map(Number);
      entry.group.position.set(
        (cx - this._mx) * CHUNK_SIZE,
        0,
        (cy - this._my) * CHUNK_SIZE
      );
    }

    return newlyLoaded;
  }

  // Reload a live chunk after its overrides have changed.
  reloadChunk(mx, my) {
    const key = `${mx},${my}`;
    if (this._chunks.has(key)) {
      const pos = this._chunks.get(key).group.position.clone();
      this._unloadChunk(key);
      this._loadChunk(mx, my);
      const entry = this._chunks.get(key);
      if (entry) entry.group.position.copy(pos);
    }
    // Re-render neighbours so seams stay seamless.
    this._rerenderAllWithNeighbors();
  }

  _loadChunk(mx, my) {
    const key  = `${mx},${my}`;
    const grid = this._chunkGen.generate(this._macroMap, mx, my, this._overrides);
    if (!grid) return;

    const { renderer, group } = this._acquireRenderer();
    renderer.render(grid);
    group.visible = true;
    this._chunks.set(key, { renderer, group, grid });

    // River elevation propagation: after caching this chunk's riverZ, reload any
    // already-loaded downstream river chunks so they pick up the upstream constraint
    // we just added to the cache.  This fixes the generation-order problem where a
    // downstream chunk was generated before its upstream neighbour was available.
    // Propagation recurses downstream until it runs out of loaded river chunks.
    const cell = this._macroMap.get(mx, my);
    if (cell?.riverMask) {
      const downDir = cell.riverDownDir ?? 0;
      const DOWN_DELTA = { 1: [0,-1], 2: [1,0], 4: [0,1], 8: [-1,0] };
      for (const bit of [1, 2, 4, 8]) {
        if (!(downDir & bit)) continue;
        const [dx, dy] = DOWN_DELTA[bit];
        const dnKey = `${mx + dx},${my + dy}`;
        if (this._chunks.has(dnKey)) {
          // Downstream chunk exists but was generated without our cached riverZ.
          // Unload + regenerate it; the recursive _loadChunk call will again
          // propagate further downstream if needed.
          this._unloadChunk(dnKey);
          this._loadChunk(mx + dx, my + dy);
          // Restore the correct world position immediately.  _loadChunk creates a
          // new THREE.Group at (0,0,0); without this the reloaded chunk visually
          // overlaps whatever chunk sits at world origin until the next full sync.
          const dnEntry = this._chunks.get(dnKey);
          if (dnEntry) {
            dnEntry.group.position.set(
              (mx + dx - this._mx) * CHUNK_SIZE,
              0,
              (my + dy - this._my) * CHUNK_SIZE
            );
          }
        }
      }
    }
  }

  _unloadChunk(key) {
    const entry = this._chunks.get(key);
    if (!entry) return;
    this._releaseRenderer(entry);  // clears obstacles, hides meshes, returns to pool
    this._chunks.delete(key);
  }

  // Collect the eight neighbour grids for chunk at (cx, cy).
  _collectNeighbors(cx, cy) {
    const nbrGrids = {};
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const ne = this._chunks.get(`${cx+dx},${cy+dy}`);
        if (ne) nbrGrids[`${dx},${dy}`] = ne.grid;
      }
    }
    return nbrGrids;
  }

  // Re-render a single chunk with its current neighbours (no-op if not in pool).
  _rerenderOne(key) {
    const entry = this._chunks.get(key);
    if (!entry) return;
    const [cx, cy] = key.split(',').map(Number);
    entry.renderer.render(entry.grid, this._collectNeighbors(cx, cy));
  }

  // Add key to the deferred queue if it is in the pool and not already queued.
  _queueRerender(key) {
    if (this._chunks.has(key) && !this._rerenderQueue.includes(key)) {
      this._rerenderQueue.push(key);
    }
  }

  // Re-render every chunk in the pool with its current neighbours synchronously.
  // Used by init(), teleportTo(), and reloadChunk() where an immediate full
  // refresh is required.  Clears any pending deferred queue.
  _rerenderAllWithNeighbors() {
    this._rerenderQueue = [];
    for (const key of this._chunks.keys()) this._rerenderOne(key);
  }

  // ── ChunkRenderer pool ──────────────────────────────────────────────────────

  // Create n idle {renderer, group} pairs and push them into the pool.
  // Called once at init — never called again during gameplay.
  _initPool(n) {
    for (let i = 0; i < n; i++) {
      const group    = new THREE.Group();
      const renderer = new ChunkRenderer(group);
      group.visible  = false;
      this._scene.add(group);
      this._rendererPool.push({ renderer, group });
    }
  }

  // Take one entry from the pool.  Falls back to creating a new one if exhausted
  // (should not happen with a correctly sized pool, but prevents hard crashes).
  _acquireRenderer() {
    if (this._rendererPool.length > 0) return this._rendererPool.pop();
    // Fallback — pool too small; create an extra pair and warn in dev builds.
    console.warn('ChunkRenderer pool exhausted — creating extra instance');
    const group    = new THREE.Group();
    const renderer = new ChunkRenderer(group);
    this._scene.add(group);
    return { renderer, group };
  }

  // Release an active chunk entry back to the pool.
  _releaseRenderer(entry) {
    entry.renderer.release();   // dispose obstacles, hide meshes
    entry.group.visible = false;
    this._rendererPool.push({ renderer: entry.renderer, group: entry.group });
  }

  // Queue the chunks that will enter the pool if the player crosses in `dir`.
  // Safe to call every frame — skips already-loaded and already-queued chunks.
  // Actual loading is deferred to update(), one chunk per frame.
  _preloadEdge(dir) {
    let nmx = this._mx, nmy = this._my;
    if (dir === 'north') nmy--;
    else if (dir === 'south') nmy++;
    else if (dir === 'west')  nmx--;
    else if (dir === 'east')  nmx++;

    const map = this._macroMap;
    nmx = Math.max(0, Math.min(map.width  - 1, nmx));
    nmy = Math.max(0, Math.min(map.height - 1, nmy));

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = nmx + dx, cy = nmy + dy;
        if (map.inBounds(cx, cy)) this._enqueueLoad(cx, cy);
      }
    }
  }

  // Add (mx, my) to the lazy load queue if it is not already loaded or queued.
  _enqueueLoad(mx, my) {
    const key = `${mx},${my}`;
    if (!this._chunks.has(key) && !this._loadQueueSet.has(key)) {
      this._loadQueue.push({ mx, my, key });
      this._loadQueueSet.add(key);
    }
  }

  _dispatchCellChange() {
    this.locationId = `${this._mx},${this._my}`;
    const detail = { mx: this._mx, my: this._my };
    // Store globally so overlay scripts that register their listener after this
    // event fires can still read the current cell (module load-order race).
    window._playerCell = detail;
    window.dispatchEvent(new CustomEvent('playerCellChanged', { detail }));
  }

  // ── Built-in test map ───────────────────────────────────────────────────────

  _buildTestMap() {
    const T = [
      ['flat',  'flat',  'flat',     'flat',  'flat'    ],
      ['flat',  'hills', 'hills',    'hills', 'flat'    ],
      ['flat',  'hills', 'mountain', 'hills', 'flat'    ],
      ['flat',  'hills', 'hills',    'flat',  'flat'    ],
      ['flat',  'flat',  'flat',     'flat',  'flat'    ],
    ];
    const V = [
      ['sparse', 'sparse', 'sparse', 'sparse', 'sparse'],
      ['sparse', 'light',  'light',  'light',  'sparse'],
      ['sparse', 'light',  'sparse', 'light',  'sparse'],
      ['sparse', 'light',  'light',  'sparse', 'sparse'],
      ['sparse', 'sparse', 'sparse', 'sparse', 'sparse'],
    ];

    const map = new MacroMap(5, 5);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++)
        map.set(x, y, new MacroCell({
          terrain:      T[y][x],
          moistureZone: 'temperate',
          vegetation:   V[y][x],
        }));
    return map;
  }
}
