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
import { PlayerState }    from './player_state.js';
import { PlayerView }     from './player.js';
import { CHUNK_SIZE }     from './micro_grid.js';

export class MicroWorld {
  constructor() {
    // Bridge-layer world-tag interface
    this.locationId = null;
    this.worldTags  = [];

    this._scene    = null;
    this._macroMap = null;
    this._chunkGen = null;
    this._playerState = null;
    this._playerView  = null;
    this._mx       = 0;   // centre macro cell X
    this._my       = 0;   // centre macro cell Y

    // Map<"mx,my", { renderer: ChunkRenderer, group: THREE.Group, grid: MicroGrid }>
    this._chunks = new Map();

    this._overrides = null; // ChunkOverrides | null

    // Chunks queued for neighbour-aware re-render, processed 2 per frame in
    // update() to avoid a single-frame spike on boundary crossings.
    this._rerenderQueue = [];
    this._rerenderSet   = new Set();

    // Pool of reusable {renderer, group} pairs — created once at init, never
    // constructed again during gameplay.  Eliminates the ~4.3M-iteration index
    // buffer fill that previously happened inside every new ChunkRenderer().
    this._rendererPool = [];

    // Chunks queued for lazy loading — processed 1 per frame in update() so
    // the preload work is spread across many frames instead of spiking on the
    // first frame the player enters the 10-tile approach zone.
    this._loadQueue    = [];
    this._loadQueueSet = new Set();
    this._pendingPhase2 = null; // deferred phase2 generation from previous frame

    // getTileInfo() cache — avoids per-frame object allocation when standing still
    this._lastTileX     = -1;
    this._lastTileY     = -1;
    this._cachedTileInfo = null;
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
    this._playerState = new PlayerState();
    this._playerView  = new PlayerView(scene);

    this._mx = startMx;
    this._my = startMy;

    // Pre-create 28 renderer+group pairs.  25 are needed for the active 5×5 window;
    // 3 more cover in-flight load-queue items.
    this._initPool(28);

    this._loadAndPlacePlayer();
    this._dispatchCellChange();
  }

  // Call every frame (dt in seconds).
  update(dt, cameraController) {
    if (!this._playerState) return;

    // Budget: each frame does ONE of: chunk gen phase, re-render slice, or nothing.
    const _pb = this.perfBegin;
    let didWork = false;

    // Two-phase chunk generation: phase1 (elevation+river) on one frame,
    // phase2 (ground+obstacles) on the next, then queue for incremental render.
    if (this._pendingPhase2) {
      const p = this._pendingPhase2;
      this._pendingPhase2 = null;
      const _endLoad = _pb?.('chunkLoad');
      const grid = this._chunkGen.generatePhase2(p.partial, this._overrides);
      _endLoad?.();
      if (grid) {
        this._finishChunkLoad(p.mx, p.my, p.key, grid);
        console.log(`[load] gen2 (${p.mx},${p.my}) — ${this._loadQueue.length} queued`);
      }
      didWork = true;
    } else if (this._loadQueue.length > 0) {
      const item = this._loadQueue.shift();
      this._loadQueueSet.delete(item.key);
      if (!this._chunks.has(item.key)) {
        const _endLoad = _pb?.('chunkLoad');
        const partial = this._chunkGen.generatePhase1(this._macroMap, item.mx, item.my);
        _endLoad?.();
        if (partial) {
          this._pendingPhase2 = { partial, mx: item.mx, my: item.my, key: item.key };
          console.log(`[load] gen1 (${item.mx},${item.my}) — ${this._loadQueue.length} queued`);
        }
        didWork = true;
      }
    }

    // Process active incremental slices (1 slice per frame).
    if (!this._activeSlices) this._activeSlices = [];
    if (!didWork && this._activeSlices.length > 0) {
      const slice = this._activeSlices[0];
      slice.renderer.perfBegin = _pb;
      const _endRR = _pb?.('rerender');
      const done = slice.renderer.renderSlice(8);
      _endRR?.();
      slice.renderer.perfBegin = null;
      if (done) {
        this._activeSlices.shift();
        const entry = this._chunks.get(slice.key);
        if (entry) {
          entry.group.visible = true;
          console.log(`[load] rendered (${entry.mx},${entry.my}) — ${this._rerenderQueue.length} rerender, ${this._activeSlices.length} slicing`);
        }
      }
      didWork = true;
    }
    // Start new incremental rerenders when no slices are active.
    else if (!didWork && this._activeSlices.length === 0 && this._rerenderQueue.length > 0) {
      const key = this._rerenderQueue.shift();
      this._rerenderSet.delete(key);
      this._rerenderIncremental(key);
    }

    const centre  = this._centreChunk;
    const az      = cameraController?.azimuth ?? 45;
    const elevFn  = centre?.renderer ? (tx, ty) => centre.renderer.elevationAt(tx, ty) : null;
    const pState  = this._playerState;
    const dir     = pState.update(dt, centre?.grid, elevFn, az);

    if (dir !== 'none') {
      const S = CHUNK_SIZE;
      let nmx = this._mx, nmy = this._my;
      let epx = pState.px, epy = pState.py;

      // Preserve the crossing overshoot so the player's speed is continuous.
      if (dir === 'east')  { nmx++; epx = pState.px - S; }
      if (dir === 'west')  { nmx--; epx = pState.px + S; }
      if (dir === 'south') { nmy++; epy = pState.py - S; }
      if (dir === 'north') { nmy--; epy = pState.py + S; }

      // Clamp to map
      const map = this._macroMap;
      nmx = Math.max(0, Math.min(map.width  - 1, nmx));
      nmy = Math.max(0, Math.min(map.height - 1, nmy));

      if (nmx !== this._mx || nmy !== this._my) {
        this._mx = nmx;
        this._my = nmy;
        const _endSync = _pb?.('chunkSync');
        const newlyLoaded = this._syncChunkPool();
        _endSync?.();

        // With a 5×5 pool, a normal 1-step crossing means the new centre and
        // its 3×3 neighbors were already loaded and rendered with full neighbor
        // context.  Only newly loaded chunks (outer ring, deferred) and their
        // neighbors need re-rendering — and those are queued naturally when the
        // load queue processes them.  No need to clear or rebuild the queue here.
        // Only queue re-renders for chunks that were synchronously loaded (rare —
        // only happens if the centre was missing, e.g. teleport or map edge).
        if (newlyLoaded.length > 0) {
          for (const key of newlyLoaded) {
            this._queueRerender(key);
            const [kx, ky] = key.split(',').map(Number);
            for (let ddy = -1; ddy <= 1; ddy++)
              for (let ddx = -1; ddx <= 1; ddx++)
                if (ddx || ddy) this._queueRerender(`${kx+ddx},${ky+ddy}`);
          }
        }

        const _endEvt = _pb?.('cellEvent');
        this._dispatchCellChange();
        _endEvt?.();
      }

      // Notify followers of the same px/py adjustment applied to the player
      const dPx = epx - pState.px;
      const dPy = epy - pState.py;
      pState.px = epx;
      pState.py = epy;
      if ((dPx !== 0 || dPy !== 0) && this.onChunkTransition) {
        const _endFT = _pb?.('followerShift');
        this.onChunkTransition(dPx, dPy);
        _endFT?.();
      }
      const newCentre = this._centreChunk;
      const newElevFn = newCentre?.renderer ? (tx, ty) => newCentre.renderer.elevationAt(tx, ty) : null;
      pState.refreshElevation(newElevFn);
    }
    // No explicit preload needed — the 5×5 window ensures chunks one ring beyond
    // the visible 3×3 are already loading/loaded via the deferred queue.

    this._playerView.sync(pState, dt);
    const pos = pState.position;
    if (cameraController) cameraController.setTarget(pos.x, pos.y, pos.z);
    return pos;
  }

  // Teleport the player to the centre of macro cell (mx, my).
  teleportTo(mx, my) {
    if (!this._playerState) return;
    const map = this._macroMap;
    this._mx = Math.max(0, Math.min(map.width  - 1, mx));
    this._my = Math.max(0, Math.min(map.height - 1, my));
    this._loadAndPlacePlayer();
    this._dispatchCellChange();
  }

  // Shared init/teleport sequence: unload stale chunks, load full 5×5,
  // re-render with neighbors, and place the player on a passable tile.
  _loadAndPlacePlayer() {
    const map = this._macroMap;

    // 1. Flush all deferred work from any prior state
    this._loadQueue.length = 0;
    this._loadQueueSet.clear();
    this._pendingPhase2 = null;
    this._rerenderQueue.length = 0;
    this._rerenderSet.clear();
    if (this._activeSlices) this._activeSlices.length = 0;

    // 2. Unload ALL existing chunks — clean slate
    for (const key of [...this._chunks.keys()]) this._unloadChunk(key);

    // 3. Generate + render ONLY the centre chunk
    const t0 = performance.now();
    this._loadChunk(this._mx, this._my, true);
    const centre = this._centreChunk;
    if (centre) {
      centre.group.position.set(0, 0, 0);
    }
    console.log(`[load] centre chunk in ${(performance.now() - t0).toFixed(0)}ms`);

    // 4. Place player with precise rendered elevation
    if (centre) {
      const spawn = this._findPassableTile(centre.grid, 32, 32) ?? { x: 32, y: 32 };
      const elevFn = (tx, ty) => centre.renderer.elevationAt(tx, ty);
      this._playerState.place(spawn.x, spawn.y, elevFn);
      this._playerView.playSpawnAnim();
      this._playerView.sync(this._playerState);
      console.log(`[load] player placed at (${spawn.x}, ${spawn.y})`);
    }

    // 5. Defer the remaining 24 chunks — inner ring first (closer = visible sooner)
    let queued = 0;
    for (let r = 1; r <= 2; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
          const cx = this._mx + dx, cy = this._my + dy;
          if (map.inBounds(cx, cy)) { this._enqueueLoad(cx, cy); queued++; }
        }
    console.log(`[load] ${queued} chunks queued for deferred loading`);
  }

  keyDown(key) { this._playerState?.keyDown(key); }
  keyUp(key)   { this._playerState?.keyUp(key);   }

  rotateFacingLeft()  { this._playerState?.rotateFacingLeft();  }
  rotateFacingRight() { this._playerState?.rotateFacingRight(); }

  // Returns the PlayerState (serializable, no Three.js).
  // All external callers that read player.px, player.position, etc. keep working.
  get player()        { return this._playerState; }
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

  // Fires once after _loadAndPlacePlayer completes (init or teleport).
  // Used by the UI to trigger fade-from-black at the right moment.
  onReady = null;

  // Optional perf hooks — set by Game to instrument subsystem timings.
  // Each should be a function(name) that returns an end() function.
  perfBegin = null;

  // Returns micro-tile data for the player's current standing tile, or null.
  // Cached — only rebuilds the result object when the tile changes.
  getTileInfo() {
    const centre = this._centreChunk;
    if (!centre || !this._playerState) return null;
    const S  = CHUNK_SIZE;
    const tx = Math.max(0, Math.min(S - 1, Math.floor(this._playerState.px)));
    const ty = Math.max(0, Math.min(S - 1, Math.floor(this._playerState.py)));
    if (tx === this._lastTileX && ty === this._lastTileY) return this._cachedTileInfo;
    this._lastTileX = tx;
    this._lastTileY = ty;
    const i  = ty * S + tx;
    const g  = centre.grid;
    this._cachedTileInfo = {
      tx, ty,
      ground:   g.ground[i],
      obstacle: g.obstacle[i],
      passable: !!g.passable[i],
      step:     Math.round(g.elevation[i] * ELEV_LEVELS),
      worldH:   +(g.elevation[i] * ELEVATION_SCALE).toFixed(1),
    };
    return this._cachedTileInfo;
  }

  // ── Bridge-layer API ────────────────────────────────────────────────────────

  applyConditions(conditions) { this.worldTags = conditions.map(c => c.tag); }
  hasTag(tag) { return this.worldTags.includes(tag); }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Find the nearest passable tile to (cx, cy) via spiral search.
  _findPassableTile(grid, cx, cy, maxRadius = 16) {
    const S = CHUNK_SIZE;
    if (cx >= 0 && cx < S && cy >= 0 && cy < S && grid.passable[cy * S + cx]) {
      return { x: cx, y: cy };
    }
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (tx >= 0 && tx < S && ty >= 0 && ty < S && grid.passable[ty * S + tx]) {
            return { x: tx, y: ty };
          }
        }
      }
    }
    return null;
  }

  // ── Chunk pool ──────────────────────────────────────────────────────────────

  get _centreChunk() { return this._chunks.get(`${this._mx},${this._my}`); }

  // Load missing chunks in the 5×5 window, unload those outside it,
  // then reposition every group so the centre is at world origin.
  // Only the centre chunk is loaded synchronously (the player is standing on it).
  // Other missing chunks are deferred to the load queue — inner ring (3×3) first,
  // then outer ring, so the nearest chunks render soonest.
  _syncChunkPool() {
    const map = this._macroMap;
    const R   = 2; // half-width: 2 → 5×5 window
    const _pb = this.perfBegin;

    // Build desired key set
    const desired = new Set();
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = this._mx + dx, cy = this._my + dy;
        if (map.inBounds(cx, cy)) desired.add(`${cx},${cy}`);
      }
    }

    // Unload chunks outside the window
    const _endUnload = _pb?.('unload');
    for (const key of [...this._chunks.keys()]) {
      if (!desired.has(key)) this._unloadChunk(key);
    }
    _endUnload?.();

    // Centre chunk must exist immediately (player is on it).
    const centreKey = `${this._mx},${this._my}`;
    const newlyLoaded = [];
    if (!this._chunks.has(centreKey)) {
      this._loadChunk(this._mx, this._my);
      newlyLoaded.push(centreKey);
    }

    // Defer remaining missing chunks — inner ring first (closer = higher priority).
    const _endEnqueue = _pb?.('enqueue');
    for (let ring = 1; ring <= R; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) < ring && Math.abs(dy) < ring) continue; // skip inner rings
          const cx = this._mx + dx, cy = this._my + dy;
          if (map.inBounds(cx, cy) && !this._chunks.has(`${cx},${cy}`)) {
            this._enqueueLoad(cx, cy);
          }
        }
      }
    }
    _endEnqueue?.();

    // Reposition all groups relative to the new centre
    const _endRepos = _pb?.('reposition');
    for (const entry of this._chunks.values()) {
      entry.group.position.set(
        (entry.mx - this._mx) * CHUNK_SIZE,
        0,
        (entry.my - this._my) * CHUNK_SIZE
      );
    }
    _endRepos?.();

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

  // Place a fully generated grid into the chunk pool and queue it for rendering.
  _finishChunkLoad(mx, my, key, grid) {
    const { renderer, group } = this._acquireRenderer();
    group.visible = false;  // stays hidden until rerender queue renders it
    this._chunks.set(key, { renderer, group, grid, mx, my });
    const entry = this._chunks.get(key);
    if (entry) {
      entry.group.position.set(
        (mx - this._mx) * CHUNK_SIZE,
        0,
        (my - this._my) * CHUNK_SIZE
      );
    }
    this._queueRerender(key);
    for (let ddy = -1; ddy <= 1; ddy++)
      for (let ddx = -1; ddx <= 1; ddx++)
        if (ddx || ddy) this._queueRerender(`${mx+ddx},${my+ddy}`);
  }

  // Full synchronous load — used for centre chunk on init/teleport.
  _loadChunk(mx, my, renderNow = true) {
    const key  = `${mx},${my}`;
    const grid = this._chunkGen.generate(this._macroMap, mx, my, this._overrides);
    if (!grid) return;

    const { renderer, group } = this._acquireRenderer();
    if (renderNow) {
      // Pass any already-loaded neighbor grids so diagonal corners don't get NaN.
      renderer.render(grid, this._collectNeighbors(mx, my));
      group.visible = true;
    } else {
      group.visible = false;
    }
    this._chunks.set(key, { renderer, group, grid, mx, my });

    // River elevation propagation: queue downstream river chunks for regeneration
    // rather than recursively reloading them in the same frame.  The downstream
    // chunks will pick up the upstream riverZ constraint from the cache when the
    // load queue processes them on a later frame.
    const cell = this._macroMap.get(mx, my);
    if (cell?.riverMask) {
      const downDir = cell.riverDownDir ?? 0;
      const DOWN_DELTA = { 1: [0,-1], 2: [1,0], 4: [0,1], 8: [-1,0] };
      for (const bit of [1, 2, 4, 8]) {
        if (!(downDir & bit)) continue;
        const [dx, dy] = DOWN_DELTA[bit];
        const dnKey = `${mx + dx},${my + dy}`;
        if (this._chunks.has(dnKey)) {
          // Downstream chunk needs regeneration — unload it and enqueue a fresh load
          // so it picks up our newly cached riverZ.  Deferred to the load queue so
          // we never cascade multiple generates into a single frame.
          this._unloadChunk(dnKey);
          this._enqueueLoad(mx + dx, my + dy);
        }
      }
    }
  }

  _unloadChunk(key) {
    const entry = this._chunks.get(key);
    if (!entry) return;
    // Cancel any in-progress incremental render for this chunk.
    if (this._activeSlices) {
      const idx = this._activeSlices.findIndex(s => s.key === key);
      if (idx >= 0) this._activeSlices.splice(idx, 1);
    }
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
  // Used by _rerenderAllWithNeighbors (init/teleport) where we want immediate results.
  _rerenderOne(key) {
    const entry = this._chunks.get(key);
    if (!entry) return;
    entry.renderer.perfBegin = this.perfBegin;
    entry.renderer.render(entry.grid, this._collectNeighbors(entry.mx, entry.my));
    entry.renderer.perfBegin = null;
  }

  // Start an incremental re-render — floor is built in slices across frames.
  _rerenderIncremental(key) {
    const entry = this._chunks.get(key);
    if (!entry) return;
    entry.renderer.perfBegin = this.perfBegin;
    entry.renderer.beginIncremental(entry.grid, this._collectNeighbors(entry.mx, entry.my));
    entry.renderer.perfBegin = null;
    // Track this renderer as having an active incremental render.
    if (!this._activeSlices) this._activeSlices = [];
    this._activeSlices.push({ key, renderer: entry.renderer });
  }

  // Add key to the deferred queue if it is in the pool and not already queued.
  _queueRerender(key) {
    if (this._chunks.has(key) && !this._rerenderSet.has(key)) {
      this._rerenderQueue.push(key);
      this._rerenderSet.add(key);
    }
  }

  // Re-render every chunk in the pool with its current neighbours synchronously.
  // Used by init(), teleportTo(), and reloadChunk() where an immediate full
  // refresh is required.  Clears any pending deferred queue.
  _rerenderAllWithNeighbors() {
    this._rerenderQueue = [];
    this._rerenderSet.clear();
    for (const [key, entry] of this._chunks) {
      this._rerenderOne(key);
      entry.group.visible = true; // ensure visible after deferred-load init
    }
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
