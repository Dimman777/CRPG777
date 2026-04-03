// ExplorationInput — keyboard and mouse input for free-roam exploration.
// Owns the raycaster, ground-plane intersection, WASD state, right-click
// mouse movement, and follower context menu.
//
// Does NOT own turn-mode logic — that lives in TurnMode which receives
// raycasting results via the shared tileFromEvent/worldPosFromEvent methods.

import * as THREE from 'three';

export class ExplorationInput {
  /**
   * @param {Object} opts
   * @param {HTMLElement}     opts.viewport      — game viewport element
   * @param {Function}        opts.getCamera     — () => THREE.Camera
   * @param {Function}        opts.getPlayer     — () => PlayerState
   * @param {Function}        opts.getCentreRenderer — () => ChunkRenderer | null
   * @param {Function}        opts.getFollowers  — () => Array
   * @param {Object}          opts.microWorld    — MicroWorld
   * @param {Object}          opts.charSheet     — CharacterSheet
   * @param {Object}          opts.formationPanel — FormationPanel
   * @param {Function}        opts.onToggleTurn  — () => void
   * @param {Function}        opts.isTurnActive  — () => boolean
   * @param {Function}        opts.onTurnPass    — () => void
   * @param {Function}        opts.onLog         — (msg) => void
   */
  constructor(opts) {
    this._opts = opts;
    const vp = opts.viewport;

    // Raycaster state — shared with TurnMode via worldPosFromEvent/tileFromEvent
    this._raycaster    = new THREE.Raycaster();
    this._groundPlane  = new THREE.Plane();
    this._groundNormal = new THREE.Vector3(0, 1, 0);
    this._hitPoint     = new THREE.Vector3();

    // Mouse movement state (captured by the frame loop in game.js)
    this.rmouseDown = false;
    this.rmouseX    = 0;
    this.rmouseZ    = 0;

    // Context menu
    this._contextMenu = this._createContextMenu();
    document.body.appendChild(this._contextMenu);

    const hideCtx = () => { this._contextMenu.style.display = 'none'; };
    document.addEventListener('click', hideCtx);
    document.addEventListener('keydown', hideCtx);
    vp.addEventListener('contextmenu', hideCtx);

    // WASD + Z/C + Space + Enter
    this._onKeyDown = e => {
      const k    = e.key.toLowerCase();
      const turn = opts.isTurnActive();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
        e.preventDefault();
        if (!turn) opts.microWorld.keyDown(k);
      }
      if (!turn) {
        if (k === 'z') opts.microWorld.rotateFacingLeft();
        if (k === 'c') opts.microWorld.rotateFacingRight();
      }
      if (k === ' ') { e.preventDefault(); opts.onToggleTurn(); }
      if (e.key === 'Enter' && turn) {
        e.preventDefault();
        opts.onTurnPass();
      }
    };
    this._onKeyUp = e => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
        opts.microWorld.keyUp(k);
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // Right-click mouse movement (free-roam only)
    let _followerHit = null;
    vp.addEventListener('mousedown', e => {
      if (e.button !== 2) return;
      if (opts.isTurnActive()) return;
      e.preventDefault();
      const pos = this.worldPosFromEvent(e);
      _followerHit = this._followerAtPos(pos);
      if (_followerHit) return;
      this.rmouseDown = true;
      if (pos) { this.rmouseX = pos.x; this.rmouseZ = pos.z; }
    });
    vp.addEventListener('mousemove', e => {
      if (!this.rmouseDown) return;
      const pos = this.worldPosFromEvent(e);
      if (pos) { this.rmouseX = pos.x; this.rmouseZ = pos.z; }
    });
    vp.addEventListener('mouseup', e => {
      if (e.button !== 2) return;
      if (_followerHit) {
        this._showContextMenu(_followerHit, e.clientX, e.clientY);
        _followerHit = null;
        return;
      }
      this.rmouseDown = false;
      opts.getPlayer()?.clearMouseMove();
    });
    vp.addEventListener('mouseleave', () => {
      _followerHit = null;
      this.rmouseDown = false;
      opts.getPlayer()?.clearMouseMove();
    });
    vp.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ── Public raycasting API (shared with TurnMode) ────────────────────────

  worldPosFromEvent(e) {
    const o    = this._opts;
    const vp   = o.viewport;
    const rect = vp.getBoundingClientRect();
    const ndcX =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, o.getCamera());
    const cr   = o.getCentreRenderer();
    const p    = o.getPlayer();
    const elev = cr ? cr.elevationAt(p.px, p.py) : 0;
    this._groundPlane.set(this._groundNormal, -elev);
    if (!this._raycaster.ray.intersectPlane(this._groundPlane, this._hitPoint)) return null;
    return { x: this._hitPoint.x, z: this._hitPoint.z };
  }

  tileFromEvent(e) {
    const pos = this.worldPosFromEvent(e);
    return pos ? { tx: Math.floor(pos.x), tz: Math.floor(pos.z) } : null;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  _followerAtPos(pos) {
    if (!pos) return null;
    const HIT_R = 0.85;
    let best = null, bestD = HIT_R;
    for (const f of this._opts.getFollowers()) {
      const d = Math.hypot(pos.x - f.px, pos.z - f.py);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  _createContextMenu() {
    const el = document.createElement('div');
    el.style.cssText = [
      'display:none', 'position:fixed', 'z-index:400',
      'background:#0e0e18', 'border:1px solid #334', 'border-radius:3px',
      'font-family:monospace', 'font-size:12px', 'color:#ccc',
      'min-width:160px', 'box-shadow:0 4px 16px rgba(0,0,0,0.6)', 'overflow:hidden',
    ].join(';');
    return el;
  }

  _showContextMenu(follower, screenX, screenY) {
    const o    = this._opts;
    const char = follower.charData;
    const el   = this._contextMenu;
    el.innerHTML = `
      <div style="padding:8px 12px 6px;border-bottom:1px solid #222">
        <div style="font-size:13px;color:#e8dcc8">${follower.name}</div>
        ${char ? `<div style="font-size:10px;color:#556;margin-top:1px">${char.role.toUpperCase()}</div>` : ''}
      </div>
      <button id="ctx-sheet"
        style="display:block;width:100%;padding:7px 12px;text-align:left;
               font-family:monospace;font-size:11px;background:transparent;
               color:#aab8cc;border:none;cursor:pointer;
               border-bottom:1px solid #1a1a28">
        Character Sheet
      </button>
      <button id="ctx-dismiss"
        style="display:block;width:100%;padding:7px 12px;text-align:left;
               font-family:monospace;font-size:11px;background:transparent;
               color:#886655;border:none;cursor:pointer">
        Dismiss
      </button>`;

    const menuW = 170, menuH = 90;
    let mx = screenX + 4, my = screenY + 4;
    if (mx + menuW > window.innerWidth)  mx = screenX - menuW - 4;
    if (my + menuH > window.innerHeight) my = screenY - menuH - 4;
    el.style.left    = mx + 'px';
    el.style.top     = my + 'px';
    el.style.display = 'block';

    el.querySelector('#ctx-sheet')?.addEventListener('click', e => {
      e.stopPropagation();
      el.style.display = 'none';
      if (char) o.charSheet?.show(char);
    });
    el.querySelector('#ctx-dismiss')?.addEventListener('click', e => {
      e.stopPropagation();
      el.style.display = 'none';
      if (follower.charId) o.formationPanel.setActive(
        o.getFollowers().map(f => f.charId).filter(id => id && id !== follower.charId),
      );
    });
  }
}
