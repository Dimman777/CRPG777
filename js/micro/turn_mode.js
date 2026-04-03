// TurnMode — manages turn-based exploration UI: highlight meshes, action bar
// wiring, turn-click handlers, toggle logic.
//
// Receives raycasting via explorationInput.tileFromEvent().

import * as THREE from 'three';
import { TurnController } from './turn_controller.js';
import { TurnHud }        from '../ui/turn_hud.js';
import { ActionBar }      from '../ui/action_bar.js';

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

    // Movement animation — lerps entities between tiles over ANIM_DURATION seconds
    this._anims    = [];    // [{ entity, fromX, fromZ, toX, toZ, elapsed }]
    this._animBusy = false; // true while animations are playing (blocks input)

    // Highlight mesh pools
    this._runMids  = [];
    this._runDsts  = [];
    this._stopSudden  = null;
    this._stopGradual = null;
    this._initHighlights(opts.scene);

    // Action bar callbacks
    this._bar.onMove = () => this._setAction('move');
    this._bar.onRun  = () => this._setAction('run');
    this._bar.onStop = () => this._setAction('stop');

    // Turn state change callback
    this._tc.onStateChange = () => {
      const isPlayerTurn = this._tc.isActive && this._tc.state === 'player';
      if (isPlayerTurn) {
        this._actionMode        = 'none';
        this._facingAtTurnStart = opts.getPlayer()?.legAngle ?? 0;
        this._bar.setActive('none');
        this._bar.setMomentum(this._tc.playerRanLastTurn);
      }
      this._updateRunHighlight();
      this._updateStopHighlights();
      this._bar.setVisible(isPlayerTurn);
      this._hud.update(this._tc, opts.getFollowers(), this._actionMode, this._tc.playerRanLastTurn);
      opts.microWorld.setGridVisible(this._tc.isActive);
    };

    // Delegate follower movement
    this._tc.onFollowerTurn = (idx, player, grid) => {
      return opts.followerMgr.advanceOneTurnStep(
        idx,
        player.px, player.py,
        player.headingX, player.headingZ,
        grid,
      );
    };

    // Turn-mode click handlers on the viewport
    this._initClickHandlers(opts.viewport);
  }

  get controller()  { return this._tc; }
  get isActive()    { return this._tc.isActive; }
  get actionMode()  { return this._actionMode; }

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

    // Queue player animation if they moved
    if (player.px !== oldPx || player.py !== oldPz) {
      const newPx = player.px, newPz = player.py;
      player.px = oldPx; player.py = oldPz; // reset to start
      this._animateMove(player, oldPx, oldPz, newPx, newPz);
    }

    // Queue follower animations
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
    this._tc.pass(o.getFollowers().length);
    o.onLog(hadMomentum ? '[Turn] Stop — momentum broken.' : '[Turn] Pass.');
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _setAction(mode) {
    if (!this._tc.isActive) return;
    this._actionMode = mode;
    this._bar.setActive(mode);
    this._updateRunHighlight();
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
    for (let i = 0; i < 5; i++) {
      this._runMids.push(mk(0x44aaff, 0.22));
      this._runDsts.push(mk(0x44aaff, 0.45));
    }
    this._stopSudden  = mk(0xff4422, 0.35);
    this._stopGradual = mk(0xffaa22, 0.45);
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
      ? tc.getRunTargets(player, o.getCentreGrid(), o.getFollowers())
      : [];
    this._runTargets = targets;
    this._bar.setRunEnabled(targets.length > 0);

    if (isPlayerTurn && this._actionMode === 'run' && targets.length > 0) {
      const cr = o.getCentreRenderer();
      const place = (mesh, tx, tz) => {
        const elev = cr ? cr.elevationAt(tx + 0.5, tz + 0.5) : 0;
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

  _updateStopHighlights() {
    const o  = this._opts;
    const tc = this._tc;
    const isStopMode = tc.isActive && tc.state === 'player' && this._actionMode === 'stop';
    if (!isStopMode) {
      this._stopSudden.visible  = false;
      this._stopGradual.visible = false;
      return;
    }
    const player = o.getPlayer();
    const cr     = o.getCentreRenderer();
    const place  = (mesh, tx, tz) => {
      const elev = cr ? cr.elevationAt(tx + 0.5, tz + 0.5) : 0;
      mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
      mesh.visible = true;
    };
    place(this._stopSudden, Math.floor(player.px), Math.floor(player.py));
    const gradual = tc.getStopGradualTile(player, o.getCentreGrid(), o.getFollowers());
    if (gradual) {
      place(this._stopGradual, gradual.tx, gradual.tz);
    } else {
      this._stopGradual.visible = false;
    }
  }

  _initClickHandlers(vp) {
    const o     = this._opts;
    const input = o.explorationInput;
    const log   = o.onLog;

    // Right-click in turn mode — face toward tile
    vp.addEventListener('contextmenu', e => {
      if (!this._tc.isActive) return;
      if (this._tc.state !== 'player') return;
      if (this._actionMode !== 'move' && this._actionMode !== 'run') return;
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
      const maxRot    = this._actionMode === 'run' ? Math.PI / 4 : Math.PI;
      totalDiff       = Math.max(-maxRot, Math.min(maxRot, totalDiff));
      const newAngle  = this._facingAtTurnStart + totalDiff;
      player.legAngle = newAngle;
      player.headingX = Math.sin(newAngle);
      player.headingZ = Math.cos(newAngle);
      player.refresh(o.getCentreRenderer());
      this._updateRunHighlight();
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

      if (this._actionMode === 'move' && !tc.playerRanLastTurn) {
        const player = o.getPlayer();
        const diffX  = hit.tx - Math.floor(player.px);
        const diffZ  = hit.tz - Math.floor(player.py);
        if (diffX === 0 && diffZ === 0) return;
        if (Math.abs(diffX) > 1 || Math.abs(diffZ) > 1) {
          log('[Turn] Click an adjacent tile to move.');
          return;
        }
        const savedAngle = player.legAngle;
        const savedHX    = player.headingX;
        const savedHZ    = player.headingZ;
        const moved = this._animatedAction(() => tc.playerMove(
          diffX, diffZ, player,
          o.getCentreGrid(), o.getCentreRenderer(), o.getFollowers(),
        ));
        if (moved) {
          player.legAngle = savedAngle;
          player.headingX = savedHX;
          player.headingZ = savedHZ;
        } else {
          log('[Turn] Blocked.');
        }

      } else if (this._actionMode === 'stop') {
        const player = o.getPlayer();
        const diffX  = hit.tx - Math.floor(player.px);
        const diffZ  = hit.tz - Math.floor(player.py);
        if (diffX === 0 && diffZ === 0) {
          tc.pass(o.getFollowers().length);
          log('[Turn] Sudden stop.');
        } else {
          const gradual = tc.getStopGradualTile(player, o.getCentreGrid(), o.getFollowers());
          if (!gradual || hit.tx !== gradual.tx || hit.tz !== gradual.tz) {
            log('[Turn] Click your tile (sudden) or the highlighted tile (gradual stop).');
            return;
          }
          const moved = this._animatedAction(() => tc.playerMove(
            diffX, diffZ, player,
            o.getCentreGrid(), o.getCentreRenderer(), o.getFollowers(),
          ));
          if (moved) log('[Turn] Gradual stop.');
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
          o.getFollowers(),
        ));
        if (!ran) log('[Turn] Run blocked.');
      }
    });
  }
}
