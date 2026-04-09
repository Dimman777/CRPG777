// TurnMode — manages turn-based exploration UI: highlight meshes, action bar
// wiring, turn-click handlers, toggle logic.
//
// Receives raycasting via explorationInput.tileFromEvent().

import * as THREE from 'three';
import { TurnController } from './turn_controller.js';
import { TurnHud }        from '../ui/turn_hud.js';
import { ActionBar }      from '../ui/action_bar.js';
import { isStepPassable, ELEVATION_SCALE } from './tile_utils.js';
import { CHUNK_SIZE }             from './micro_grid.js';
import { TURN_DURATION_SECONDS }  from '../data/game_config.js';

const ANIM_DURATION = 0.15; // seconds per tile move

export class TurnMode {
  /**
   * @param {Object} opts
   * @param {THREE.Scene}     opts.scene
   * @param {HTMLElement}     opts.viewport
   * @param {Object}          opts.explorationInput — ExplorationInput instance
   * @param {Function}        opts.getPlayer        — () => PlayerState
   * @param {Function}        opts.getCentreGrid    — () => MicroGrid | null
   * @param {Function}        opts.getCentreRenderer — () => ChunkRenderer | null
   * @param {Function}        opts.getFollowers     — () => Array
   * @param {Object}          opts.followerMgr      — FollowerManager
   * @param {Object}          opts.microWorld       — MicroWorld (for grid visibility)
   * @param {Function}        opts.onToggleMacro    — (active: boolean) => void
   * @param {Function}        opts.onLog            — (msg) => void
   */
  constructor(opts) {
    this._opts = opts;
    this._tc   = new TurnController();
    this._hud  = new TurnHud();
    this._bar  = new ActionBar();

    this._actionMode        = 'none';
    this._facingAtTurnStart = 0;
    this._runTargets        = [];
    this._sprintTargets     = [];
    this._climbTargets      = [];
    this._roundAction       = 'rest'; // last player action: 'move' | 'run' | 'sprint' | 'stop' | 'rest'

    // Movement animation — lerps entities between tiles over ANIM_DURATION seconds
    this._anims    = [];    // [{ entity, fromX, fromZ, toX, toZ, elapsed }]
    this._animBusy = false; // true while animations are playing (blocks input)

    // Highlight mesh pools
    this._moveDsts   = [];
    this._runMids    = [];
    this._runDsts    = [];
    this._sprintDsts = [];
    this._climbDsts  = [];
    this._stopSudden = null;
    this._stop2      = null;
    this._stop3      = null;
    this._initHighlights(opts.scene);

    // Action bar callbacks
    this._bar.onMove   = () => this._setAction('move');
    this._bar.onCrouch = () => this._setAction('crouch');
    this._bar.onCrawl  = () => this._setAction('crawl');
    this._bar.onClimb  = () => this._setAction('climb');
    this._bar.onRun    = () => this._setAction('run');
    this._bar.onSprint = () => this._setAction('sprint');
    this._bar.onStop   = () => this._setAction('stop');

    // Turn state change callback
    this._tc.onStateChange = () => {
      const isPlayerTurn = this._tc.isActive && this._tc.state === 'player';
      // Apply per-round stamina recovery when a full round completes (round 2+).
      // Uses the same stat-driven rates as realtime, sampled at TURN_DURATION_SECONDS.
      if (isPlayerTurn && this._tc.roundNumber > 1) {
        const o          = this._opts;
        const prevAction = this._roundAction;
        this._roundAction = 'rest'; // reset for incoming round
        o.getPlayer()?.staminaState?.recoverRealtime(TURN_DURATION_SECONDS, prevAction);
        // Followers recover based on whether they ran last turn.
        // Runners get no recovery (matches realtime behaviour); walkers recover normally.
        for (const f of o.getFollowers()) {
          f.staminaState?.recoverRealtime(TURN_DURATION_SECONDS, f.ranLastTurn ? 'run' : 'move');
        }
      }
      if (isPlayerTurn) {
        this._actionMode        = 'none';
        this._facingAtTurnStart = opts.getPlayer()?.legAngle ?? 0;
        this._bar.setActive('none');
        this._bar.setMomentum(this._tc.playerRanLastTurn);
        // Recompute sprint availability
        const player = opts.getPlayer();
        const grid   = opts.getCentreGrid();
        const follows = opts.getFollowers();
        this._sprintTargets = player
          ? this._tc.getSprintTargets(player, grid, follows, opts.microWorld.neighborGrids)
          : [];
        this._bar.setSprintEnabled(this._sprintTargets.length > 0);
        // Climb availability
        this._climbTargets = player
          ? this._tc.getClimbTargets(player, grid, follows, opts.microWorld.neighborGrids)
          : [];
        this._bar.setClimbEnabled(this._climbTargets.length > 0);
      }
      this._updateMoveHighlight();
      this._updateRunHighlight();
      this._updateSprintHighlight();
      this._updateClimbHighlight();
      this._updateStopHighlights();
      this._bar.setVisible(isPlayerTurn);
      this._hud.update(this._tc, opts.getFollowers(), this._actionMode, this._tc.playerRanLastTurn);
      opts.microWorld.setGridVisible(this._tc.isActive);
    };

    // Delegate follower movement
    this._tc.onFollowerTurn = (idx, player, grid, neighborGrids) => {
      return opts.followerMgr.advanceOneTurnStep(
        idx,
        player.px, player.py,
        player.headingX, player.headingZ,
        grid,
        neighborGrids,
      );
    };

    // Turn-mode click handlers on the viewport
    this._initClickHandlers(opts.viewport);
  }

  get controller()  { return this._tc; }
  get isActive()    { return this._tc.isActive; }
  get actionMode()  { return this._actionMode; }

  dispose() {
    this._hud.dispose();
    this._bar.dispose();
    // Remove highlight meshes from scene
    [...this._moveDsts, ...this._runMids, ...this._runDsts, ...this._sprintDsts, ...this._climbDsts].forEach(m => this._opts.scene.remove(m));
    if (this._stopSudden) this._opts.scene.remove(this._stopSudden);
    if (this._stop2)      this._opts.scene.remove(this._stop2);
    if (this._stop3)      this._opts.scene.remove(this._stop3);
  }

  // Call every frame
  update(dt) {
    const o = this._opts;

    // Process movement animations
    if (this._anims.length > 0) {
      this._animBusy = true;
      let allDone = true;
      for (const a of this._anims) {
        a.elapsed += dt;
        const t = Math.min(1, a.elapsed / ANIM_DURATION);
        // Smooth step for nicer feel
        const s = t * t * (3 - 2 * t);
        a.entity.px = a.fromX + (a.toX - a.fromX) * s;
        a.entity.py = a.fromZ + (a.toZ - a.fromZ) * s;
        if (t < 1) allDone = false;
      }
      if (allDone) {
        // Snap to final positions
        for (const a of this._anims) {
          a.entity.px = a.toX;
          a.entity.py = a.toZ;
        }
        this._anims = [];
        this._animBusy = false;
        // Refresh elevation after animation completes
        const cr = o.getCentreRenderer();
        if (cr) o.getPlayer()?.refresh(cr);
      }
    }

    if (this._tc.isActive) {
      o.followerMgr.updateIdleOnly(dt);
      // Only tick turn controller when not animating (prevents next turn starting mid-lerp)
      if (!this._animBusy) {
        this._tc.tick(
          dt,
          o.getFollowers(),
          o.getPlayer(),
          o.getCentreGrid(),
          o.getCentreRenderer(),
          o.microWorld.neighborGrids,
        );
      }
    }
    this._hud.update(this._tc, o.getFollowers(), this._actionMode, this._tc.playerRanLastTurn);
  }

  // Queue a movement animation for an entity (player or follower).
  _animateMove(entity, fromX, fromZ, toX, toZ) {
    this._anims.push({ entity, fromX, fromZ, toX, toZ, elapsed: 0 });
  }

  // Capture positions of player + followers, execute moveFn, then animate
  // everyone from their old positions to their new positions.
  _animatedAction(moveFn) {
    if (this._animBusy) return false;
    const o       = this._opts;
    const player  = o.getPlayer();
    const follows = o.getFollowers();

    // Snapshot positions before the move
    const oldPx = player.px, oldPz = player.py;
    const oldFollowers = follows.map(f => ({ f, px: f.px, py: f.py }));

    const result = moveFn();
    if (!result) return false;

    // Queue player animation if they moved.
    // Cross-chunk moves (player.px outside [0, CHUNK_SIZE)) are NOT animated:
    // lerping through OOB values while pState.update() also runs each frame
    // causes repeated chunk-transition cascades.  Instead, leave player.px at
    // the OOB position and let pState.update() handle the clean transition on
    // the next frame.
    const S = CHUNK_SIZE;
    const crossChunk = player.px < 0 || player.px >= S || player.py < 0 || player.py >= S;
    if (!crossChunk && (player.px !== oldPx || player.py !== oldPz)) {
      const newPx = player.px, newPz = player.py;
      player.px = oldPx; player.py = oldPz; // reset to start of lerp
      this._animateMove(player, oldPx, oldPz, newPx, newPz);
    }

    // Queue follower animations (followers always stay in-chunk)
    for (const { f, px, py } of oldFollowers) {
      if (f.px !== px || f.py !== py) {
        const newPx = f.px, newPz = f.py;
        f.px = px; f.py = py; // reset to start
        this._animateMove(f, px, py, newPx, newPz);
      }
    }

    return true;
  }

  toggle() {
    const o         = this._opts;
    const wasActive = this._tc.isActive;

    this._actionMode = 'none';
    this._bar.setActive('none');

    if (!wasActive) {
      ['w','a','s','d'].forEach(k => o.microWorld.keyUp(k));
    } else {
      // Exiting turn mode — reset player pose
      const player = o.getPlayer();
      if (player) player.poseMode = 'stand';
    }

    this._tc.toggle(
      o.getPlayer(),
      o.getFollowers(),
      o.getCentreRenderer(),
    );

    o.onToggleMacro(!wasActive);
    o.onLog(this._tc.isActive
      ? '[Turn] Turn mode ON — macro paused.'
      : '[Turn] Turn mode OFF — macro resumed.');
  }

  pass() {
    const o = this._opts;
    const hadMomentum = this._tc.playerRanLastTurn;
    this._roundAction = 'rest';
    this._tc.pass(o.getFollowers().length, o.getPlayer());
    o.onLog(hadMomentum ? '[Turn] Stop — momentum broken.' : '[Turn] Pass.');
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _setAction(mode) {
    if (!this._tc.isActive) return;
    this._actionMode = mode;
    this._bar.setActive(mode);

    // Update player pose when entering crouch or crawl
    const player = this._opts.getPlayer();
    if (player) {
      if (mode === 'crouch')      player.poseMode = 'crouch';
      else if (mode === 'crawl')  player.poseMode = 'crawl';
      else                        player.poseMode = 'stand';
    }

    this._updateMoveHighlight();
    this._updateRunHighlight();
    this._updateSprintHighlight();
    this._updateClimbHighlight();
    this._updateStopHighlights();
  }

  _initHighlights(scene) {
    const mk = (color, opacity) => {
      const geo = new THREE.PlaneGeometry(0.88, 0.88);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    };
    for (let i = 0; i < 8; i++) this._moveDsts.push(mk(0x44ff88, 0.42));
    for (let i = 0; i < 5; i++) {
      this._runMids.push(mk(0x44aaff, 0.22));
      this._runDsts.push(mk(0x44aaff, 0.45));
    }
    for (let i = 0; i < 5; i++) this._sprintDsts.push(mk(0xff8800, 0.50));
    this._climbDsts.push(mk(0xcc44ff, 0.55)); // single target — the faced tile
    this._stopSudden = mk(0xff4422, 0.35);
    this._stop2      = mk(0xffaa22, 0.45);
    this._stop3      = mk(0xffcc44, 0.35);
  }

  _updateMoveHighlight() {
    const tc = this._tc;
    const isMovMode = tc.isActive && tc.state === 'player' &&
                      (this._actionMode === 'move' ||
                       this._actionMode === 'crouch' ||
                       this._actionMode === 'crawl') &&
                      !tc.playerRanLastTurn;
    if (!isMovMode) {
      for (const m of this._moveDsts) m.visible = false;
      return;
    }
    const o         = this._opts;
    const player    = o.getPlayer();
    const grid      = o.getCentreGrid();
    const followers = o.getFollowers();
    const ptx       = Math.floor(player.px);
    const ptz       = Math.floor(player.py);
    const S         = CHUNK_SIZE;

    let idx = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const tx    = ptx + dx, tz = ptz + dz;
        const valid = tx >= 0 && tx < S && tz >= 0 && tz < S &&
                      isStepPassable(ptx, ptz, tx, tz, grid) &&
                      !followers.some(f => Math.floor(f.px) === tx && Math.floor(f.py) === tz);
        const mesh  = this._moveDsts[idx++];
        if (valid) {
          // Use direct tile elevation — bilinear interpolation from elevationAt() blends
          // across cliff edges and places the mesh below the terrain surface.
          const elev = grid ? grid.elevation[tz * S + tx] * ELEVATION_SCALE : 0;
          mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
      }
    }
  }

  _updateRunHighlight() {
    const o   = this._opts;
    const tc  = this._tc;
    const isPlayerTurn = tc.isActive && tc.state === 'player';

    const player = o.getPlayer();
    const facingDrift = isPlayerTurn
      ? Math.abs(((player.legAngle - this._facingAtTurnStart + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
      : Infinity;
    const withinRunLimit = facingDrift <= Math.PI / 4 + 0.001;
    const targets = (isPlayerTurn && withinRunLimit)
      ? tc.getRunTargets(player, o.getCentreGrid(), o.getFollowers(), o.microWorld.neighborGrids)
      : [];
    this._runTargets = targets;
    this._bar.setRunEnabled(targets.length > 0);

    if (isPlayerTurn && this._actionMode === 'run' && targets.length > 0) {
      const grid = o.getCentreGrid();
      const S    = CHUNK_SIZE;
      const place = (mesh, tx, tz) => {
        const elev = (grid && tx >= 0 && tx < S && tz >= 0 && tz < S)
          ? grid.elevation[tz * S + tx] * ELEVATION_SCALE : 0;
        mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
        mesh.visible = true;
      };
      targets.forEach((t, i) => {
        if (i < this._runMids.length) place(this._runMids[i], t.midX, t.midZ);
        if (i < this._runDsts.length) place(this._runDsts[i], t.tx,   t.tz);
      });
      for (let i = targets.length; i < this._runMids.length; i++) {
        this._runMids[i].visible = false;
        this._runDsts[i].visible = false;
      }
    } else {
      for (const m of this._runMids) m.visible = false;
      for (const m of this._runDsts) m.visible = false;
    }
  }

  _updateSprintHighlight() {
    const o  = this._opts;
    const tc = this._tc;
    const isPlayerTurn = tc.isActive && tc.state === 'player';

    if (isPlayerTurn) {
      this._sprintTargets = tc.getSprintTargets(
        o.getPlayer(), o.getCentreGrid(), o.getFollowers(), o.microWorld.neighborGrids,
      );
      this._bar.setSprintEnabled(this._sprintTargets.length > 0);
    }

    if (isPlayerTurn && this._actionMode === 'sprint' && this._sprintTargets.length > 0) {
      const grid = o.getCentreGrid();
      const S    = CHUNK_SIZE;
      this._sprintTargets.forEach((t, i) => {
        if (i >= this._sprintDsts.length) return;
        const elev = (grid && t.tx >= 0 && t.tx < S && t.tz >= 0 && t.tz < S)
          ? grid.elevation[t.tz * S + t.tx] * ELEVATION_SCALE : 0;
        this._sprintDsts[i].position.set(t.tx + 0.5, elev + 0.06, t.tz + 0.5);
        this._sprintDsts[i].visible = true;
      });
      for (let i = this._sprintTargets.length; i < this._sprintDsts.length; i++) {
        this._sprintDsts[i].visible = false;
      }
    } else {
      for (const m of this._sprintDsts) m.visible = false;
    }
  }

  _updateClimbHighlight() {
    const o  = this._opts;
    const tc = this._tc;
    const isPlayerTurn = tc.isActive && tc.state === 'player';

    if (isPlayerTurn && !tc.playerRanLastTurn) {
      this._climbTargets = tc.getClimbTargets(
        o.getPlayer(), o.getCentreGrid(), o.getFollowers(), o.microWorld.neighborGrids,
      );
      this._bar.setClimbEnabled(this._climbTargets.length > 0);
    }

    if (isPlayerTurn && this._actionMode === 'climb' && this._climbTargets.length > 0) {
      const grid = o.getCentreGrid();
      const S    = CHUNK_SIZE;
      this._climbTargets.forEach((t, i) => {
        if (i >= this._climbDsts.length) return;
        // Direct tile elevation avoids bilinear blending across the cliff face,
        // which would otherwise place the mesh inside the terrain (invisible when
        // ascending) or floating above it (when descending).
        // For the rare cross-chunk case, fall back to the neighbour grid.
        let elev = 0;
        if (grid && t.tx >= 0 && t.tx < S && t.tz >= 0 && t.tz < S) {
          elev = grid.elevation[t.tz * S + t.tx] * ELEVATION_SCALE;
        } else {
          const nbrs = o.microWorld.neighborGrids;
          let dx = 0, dz = 0, ax = t.tx, az = t.tz;
          if (t.tx < 0)  { dx = -1; ax = t.tx + S; }
          if (t.tx >= S) { dx =  1; ax = t.tx - S; }
          if (t.tz < 0)  { dz = -1; az = t.tz + S; }
          if (t.tz >= S) { dz =  1; az = t.tz - S; }
          const ng = nbrs?.[`${dx},${dz}`];
          if (ng) elev = ng.elevation[az * S + ax] * ELEVATION_SCALE;
        }
        this._climbDsts[i].position.set(t.tx + 0.5, elev + 0.06, t.tz + 0.5);
        this._climbDsts[i].visible = true;
      });
      for (let i = this._climbTargets.length; i < this._climbDsts.length; i++) {
        this._climbDsts[i].visible = false;
      }
    } else {
      for (const m of this._climbDsts) m.visible = false;
    }
  }

  _updateStopHighlights() {
    const o  = this._opts;
    const tc = this._tc;
    const isStopMode = tc.isActive && tc.state === 'player' && this._actionMode === 'stop';
    if (!isStopMode) {
      this._stopSudden.visible = false;
      this._stop2.visible      = false;
      this._stop3.visible      = false;
      return;
    }
    const player = o.getPlayer();
    const grid   = o.getCentreGrid();
    const S      = CHUNK_SIZE;
    const place  = (mesh, tx, tz) => {
      const elev = (grid && tx >= 0 && tx < S && tz >= 0 && tz < S)
        ? grid.elevation[tz * S + tx] * ELEVATION_SCALE : 0;
      mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
      mesh.visible = true;
    };
    place(this._stopSudden, Math.floor(player.px), Math.floor(player.py));

    const graduals = tc.getStopGradualTiles(player, o.getCentreGrid(), o.getFollowers(), o.microWorld.neighborGrids);
    const t2 = graduals.find(t => t.dist === 2);
    const t3 = graduals.find(t => t.dist === 3);
    if (t2) place(this._stop2, t2.tx, t2.tz); else this._stop2.visible = false;
    if (t3) place(this._stop3, t3.tx, t3.tz); else this._stop3.visible = false;
  }

  _initClickHandlers(vp) {
    const o     = this._opts;
    const input = o.explorationInput;
    const log   = o.onLog;

    // Right-click in turn mode — face toward tile
    vp.addEventListener('contextmenu', e => {
      if (!this._tc.isActive) return;
      if (this._tc.state !== 'player') return;
      if (this._actionMode !== 'move'   &&
          this._actionMode !== 'crouch' &&
          this._actionMode !== 'crawl'  &&
          this._actionMode !== 'climb'  &&
          this._actionMode !== 'run'    &&
          this._actionMode !== 'sprint') return;
      e.preventDefault();
      const hit = input.tileFromEvent(e);
      if (!hit) return;
      const player = o.getPlayer();
      const dx   = hit.tx + 0.5 - player.px;
      const dz   = hit.tz + 0.5 - player.py;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.01) return;

      const target    = Math.atan2(dx / dist, dz / dist);
      let totalDiff   = ((target - this._facingAtTurnStart + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      const maxRot    = (this._actionMode === 'run' || this._actionMode === 'sprint')
        ? Math.PI / 4
        : Math.PI;
      totalDiff       = Math.max(-maxRot, Math.min(maxRot, totalDiff));
      const newAngle  = this._facingAtTurnStart + totalDiff;
      player.legAngle = newAngle;
      player.headingX = Math.sin(newAngle);
      player.headingZ = Math.cos(newAngle);
      player.refresh(o.getCentreRenderer());
      this._updateMoveHighlight();
      this._updateRunHighlight();
      this._updateSprintHighlight();
      this._updateClimbHighlight();
      this._updateStopHighlights();
      log(`[Turn] Facing (${hit.tx}, ${hit.tz}).`);
    });

    // Left-click in turn mode — execute action
    vp.addEventListener('click', e => {
      const tc = this._tc;
      if (!tc.isActive) return;
      if (tc.state !== 'player') return;
      if (this._actionMode === 'none') {
        log('[Turn] Select Move or Run first.');
        return;
      }
      const hit = input.tileFromEvent(e);
      if (!hit) return;

      if (this._animBusy) return; // block input during animation

      if ((this._actionMode === 'move' ||
           this._actionMode === 'crouch' ||
           this._actionMode === 'crawl') && !tc.playerRanLastTurn) {
        const player = o.getPlayer();
        // Snap to nearest visible move highlight — flat-plane raycasting at player
        // elevation gives inaccurate XZ when adjacent tiles differ in height, so
        // we find the highlight mesh whose center is closest to the click point.
        const worldPos = input.worldPosFromEvent(e);
        if (!worldPos) return;
        const ptx = Math.floor(player.px), ptz = Math.floor(player.py);
        let diffX = null, diffZ = null;
        let bestDist = 1.5; // snap radius in tile-units
        for (const mesh of this._moveDsts) {
          if (!mesh.visible) continue;
          const d = Math.hypot(worldPos.x - mesh.position.x, worldPos.z - mesh.position.z);
          if (d < bestDist) {
            bestDist = d;
            diffX = Math.floor(mesh.position.x) - ptx;
            diffZ = Math.floor(mesh.position.z) - ptz;
          }
        }
        if (diffX === null) {
          log('[Turn] Click an adjacent tile to move.');
          return;
        }
        if (diffX === 0 && diffZ === 0) return;
        const savedAngle = player.legAngle;
        const savedHX    = player.headingX;
        const savedHZ    = player.headingZ;
        const moved = this._animatedAction(() => tc.playerMove(
          diffX, diffZ, player,
          o.getCentreGrid(), o.getCentreRenderer(), o.getFollowers(), o.microWorld.neighborGrids,
        ));
        if (moved) {
          this._roundAction = 'move';
          player.legAngle = savedAngle;
          player.headingX = savedHX;
          player.headingZ = savedHZ;
        } else {
          log('[Turn] Blocked.');
        }

      } else if (this._actionMode === 'climb' && !tc.playerRanLastTurn) {
        // Only one target (the faced tile) — no tile-picking needed.
        // Clicking anywhere while in Climb mode executes the climb.
        const target = this._climbTargets[0];
        if (!target) {
          log('[Turn] No climbable tile ahead — face a ledge first.');
          return;
        }
        const climbed = this._animatedAction(() => tc.playerClimbTo(
          o.getPlayer(),
          o.getCentreGrid(), o.getCentreRenderer(),
          target.tx, target.tz,
          o.getFollowers(), o.microWorld.neighborGrids,
        ));
        if (climbed) this._roundAction = 'move';
        else         log('[Turn] Climb blocked.');

      } else if (this._actionMode === 'stop') {
        const player = o.getPlayer();
        const diffX  = hit.tx - Math.floor(player.px);
        const diffZ  = hit.tz - Math.floor(player.py);
        if (diffX === 0 && diffZ === 0) {
          this._roundAction = 'stop';
          tc.pass(o.getFollowers().length, o.getPlayer());
          log('[Turn] Sudden stop.');
        } else {
          const graduals = tc.getStopGradualTiles(player, o.getCentreGrid(), o.getFollowers(), o.microWorld.neighborGrids);
          const target = graduals.find(t => t.tx === hit.tx && t.tz === hit.tz);
          if (!target) {
            log('[Turn] Click your tile (sudden) or a highlighted tile (gradual stop).');
            return;
          }
          const moved = this._animatedAction(() => tc.playerStopTo(
            player,
            o.getCentreGrid(), o.getCentreRenderer(),
            hit.tx, hit.tz,
            o.getFollowers(), o.microWorld.neighborGrids,
          ));
          if (moved) { this._roundAction = 'stop'; log(`[Turn] Gradual stop (${target.dist} tiles).`); }
          else       log('[Turn] Blocked.');
        }

      } else if (this._actionMode === 'run') {
        const target = this._runTargets.find(t => t.tx === hit.tx && t.tz === hit.tz);
        if (!target) {
          log('[Turn] Click a highlighted tile to run.');
          return;
        }
        const ran = this._animatedAction(() => tc.playerRunTo(
          o.getPlayer(),
          o.getCentreGrid(), o.getCentreRenderer(),
          target.tx, target.tz,
          o.getFollowers(), o.microWorld.neighborGrids,
        ));
        if (ran) this._roundAction = 'run';
        else     log('[Turn] Run blocked.');

      } else if (this._actionMode === 'sprint') {
        const target = this._sprintTargets.find(t => t.tx === hit.tx && t.tz === hit.tz);
        if (!target) {
          log('[Turn] Click a highlighted tile to sprint.');
          return;
        }
        const ran = this._animatedAction(() => tc.playerSprintTo(
          o.getPlayer(),
          o.getCentreGrid(), o.getCentreRenderer(),
          target.tx, target.tz,
          o.getFollowers(), o.microWorld.neighborGrids,
        ));
        if (ran) this._roundAction = 'sprint';
        else     log('[Turn] Sprint blocked.');
      }
    });
  }
}
