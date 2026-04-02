// ChunkEditor — interactive 64×64 tile painter for chunk overrides.
//
// Opened from the macro map info card ("Edit Chunk" button).
// Displays the procedurally-generated chunk as a base, lets the user
// paint ground types and obstacles on top, then commits the result
// into a ChunkOverrides store.
//
// Usage:
//   const editor = new ChunkEditor();
//   editor.onSave = (mx, my, overrides) => { ... };
//   editor.open(mx, my, grid, overrides);

import { GROUND, OBSTACLE, GROUND_COLOR, OBSTACLE_COLOR, OBSTACLE_BLOCKS } from '../data/micro_tile_data.js';
import { CHUNK_SIZE } from '../micro/micro_grid.js';
import { ELEV_LEVELS } from '../micro/chunk_gen.js';

// Tile size in the editor canvas (pixels per tile).
const PX = 8;
const CANVAS_SIZE = CHUNK_SIZE * PX; // 512

// Ground labels indexed by GROUND value
const GROUND_LABELS = [
  'Deep Water', 'Shallow Water', 'Wet Sand', 'Sand', 'Dry Earth',
  'Earth', 'Grass', 'Dry Grass', 'Rocky Earth', 'Scree',
  'Stone', 'Snow', 'Mud', 'Peat', 'Rapids',
  'Cobblestone', 'Packed Earth',
];

// Obstacle labels indexed by OBSTACLE value
const OBS_LABELS = [
  'None (erase)', 'Pebble', 'Small Rock', 'Large Rock', 'Boulder',
  'Dead Shrub', 'Shrub', 'Dense Shrub', 'Tree', 'Dense Tree',
  'Dead Tree', 'Cactus', 'Reed', 'Tall Grass', 'Spring',
  'Boulder Cluster ■■', 'Rock Outcrop ■■',  // 2×2 stamps
];

// Obstacle IDs that are painted as a 2×2 stamp.
const STAMP2X2 = new Set([OBSTACLE.BOULDER_CLUSTER, OBSTACLE.ROCK_OUTCROP]);

export class ChunkEditor {
  constructor() {
    this.onSave = null; // callback(mx, my, chunkOverrides)

    this._mx = 0;
    this._my = 0;
    this._grid = null;            // base generated MicroGrid
    this._overrides = null;       // ChunkOverrides reference
    this._localPatches = new Map(); // idx → {ground?,obstacle?} — edits in this session

    this._paintMode     = 'ground';  // 'ground' | 'obstacle' | 'height'
    this._paintGround   = GROUND.GRASS;
    this._paintObstacle = OBSTACLE.NONE; // NONE = erase obstacle
    this._paintLevel    = 10;           // 0–ELEV_LEVELS

    this._isDown = false;

    this._el = this._buildDOM();
    document.body.appendChild(this._el);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  open(mx, my, grid, overrides) {
    this._mx = mx;
    this._my = my;
    this._grid = grid;
    this._overrides = overrides;

    // Copy existing overrides into local session patches
    this._localPatches.clear();
    const existing = overrides.getChunk(mx, my);
    if (existing) {
      for (const [idx, patch] of existing) {
        this._localPatches.set(idx, { ...patch });
      }
    }

    this._titleEl.textContent = `Edit Chunk [${mx}, ${my}]`;
    this._el.style.display = 'flex';
    this._redraw();
  }

  close() {
    this._el.style.display = 'none';
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  _buildDOM() {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'display:none', 'position:fixed', 'inset:0', 'z-index:500',
      'background:rgba(0,0,0,0.88)',
      'align-items:center', 'justify-content:center',
      'font-family:monospace', 'font-size:11px', 'color:#ccc',
    ].join(';');

    // ── Main container ─────────────────────────────────────────────────────
    const box = document.createElement('div');
    box.style.cssText = [
      'display:flex', 'flex-direction:column',
      'background:#0d1018', 'border:1px solid #446',
      'border-radius:4px', 'overflow:hidden',
      'max-height:96vh',
    ].join(';');

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = [
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'padding:6px 12px', 'background:#131828', 'border-bottom:1px solid #334',
    ].join(';');

    this._titleEl = document.createElement('span');
    this._titleEl.style.cssText = 'color:#aac;font-weight:bold;font-size:12px';

    const btnStyle = 'padding:3px 10px;font-family:monospace;font-size:11px;' +
                     'background:#1a2030;color:#ccd;border:1px solid #446;' +
                     'border-radius:3px;cursor:pointer;margin-left:6px';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = btnStyle + ';color:#8f8;border-color:#484';
    saveBtn.addEventListener('click', () => this._commit());

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset chunk';
    resetBtn.style.cssText = btnStyle + ';color:#f88;border-color:#844';
    resetBtn.addEventListener('click', () => this._resetChunk());

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = btnStyle;
    closeBtn.addEventListener('click', () => this.close());

    titleBar.appendChild(this._titleEl);
    const btnGroup = document.createElement('div');
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(resetBtn);
    btnGroup.appendChild(closeBtn);
    titleBar.appendChild(btnGroup);

    // Body row: canvas + sidebar
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:row;overflow:auto';

    // Canvas area
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:relative;flex-shrink:0';

    this._canvas = document.createElement('canvas');
    this._canvas.width  = CANVAS_SIZE;
    this._canvas.height = CANVAS_SIZE;
    this._canvas.style.cssText = [
      `width:${CANVAS_SIZE}px`, `height:${CANVAS_SIZE}px`,
      'display:block', 'image-rendering:pixelated', 'cursor:crosshair',
    ].join(';');
    this._ctx = this._canvas.getContext('2d');

    // Hover tooltip
    this._tooltip = document.createElement('div');
    this._tooltip.style.cssText = [
      'position:absolute', 'pointer-events:none',
      'background:rgba(0,0,0,0.82)', 'border:1px solid #446',
      'padding:3px 7px', 'border-radius:3px',
      'font-size:10px', 'color:#aac', 'white-space:nowrap',
      'display:none', 'z-index:10',
    ].join(';');
    canvasWrap.appendChild(this._canvas);
    canvasWrap.appendChild(this._tooltip);

    // Canvas events
    this._canvas.addEventListener('mousedown', e => {
      this._isDown = true;
      this._paint(e);
    });
    this._canvas.addEventListener('mousemove', e => {
      this._updateTooltip(e);
      if (this._isDown) this._paint(e);
    });
    this._canvas.addEventListener('mouseup',   () => { this._isDown = false; });
    this._canvas.addEventListener('mouseleave', () => {
      this._isDown = false;
      this._tooltip.style.display = 'none';
    });
    this._canvas.addEventListener('contextmenu', e => { e.preventDefault(); });

    // Sidebar
    const sidebar = this._buildSidebar();

    body.appendChild(canvasWrap);
    body.appendChild(sidebar);

    box.appendChild(titleBar);
    box.appendChild(body);
    wrap.appendChild(box);

    // Close on backdrop click
    wrap.addEventListener('click', e => { if (e.target === wrap) this.close(); });

    // Escape closes
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._el.style.display !== 'none') this.close();
    });

    return wrap;
  }

  _buildSidebar() {
    const sidebar = document.createElement('div');
    sidebar.style.cssText = [
      'width:160px', 'flex-shrink:0',
      'border-left:1px solid #334', 'overflow-y:auto',
      'padding:8px',
    ].join(';');

    // Mode toggle
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px';

    const mkModeBtn = (label, mode) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.mode = mode;
      btn.style.cssText = [
        'flex:1', 'padding:3px 0', 'font-family:monospace', 'font-size:10px',
        'border:1px solid #446', 'border-radius:3px', 'cursor:pointer',
        'background:#1a2030', 'color:#ccd',
      ].join(';');
      btn.addEventListener('click', () => {
        this._paintMode = mode;
        this._refreshModeButtons();
      });
      return btn;
    };
    this._modeBtnGround   = mkModeBtn('Ground', 'ground');
    this._modeBtnObstacle = mkModeBtn('Obstacle', 'obstacle');
    this._modeBtnHeight   = mkModeBtn('Height', 'height');
    modeRow.appendChild(this._modeBtnGround);
    modeRow.appendChild(this._modeBtnObstacle);
    modeRow.appendChild(this._modeBtnHeight);
    sidebar.appendChild(modeRow);

    // ── Ground palette ─────────────────────────────────────────────────────
    this._groundSection = document.createElement('div');
    const gHead = document.createElement('div');
    gHead.textContent = 'Ground';
    gHead.style.cssText = 'color:#667;font-size:10px;margin-bottom:4px';
    this._groundSection.appendChild(gHead);

    this._groundBtns = [];
    for (let g = 0; g < GROUND_LABELS.length; g++) {
      const col = GROUND_COLOR[g] ?? '#333';
      const btn = document.createElement('div');
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:5px',
        'padding:2px 4px', 'cursor:pointer', 'border-radius:2px',
        'border:1px solid transparent',
      ].join(';');

      const swatch = document.createElement('span');
      swatch.style.cssText = `display:inline-block;width:10px;height:10px;background:${col};flex-shrink:0;border:1px solid rgba(255,255,255,0.1)`;

      const label = document.createElement('span');
      label.textContent = GROUND_LABELS[g];
      label.style.cssText = 'font-size:10px;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this._paintGround = g;
        this._paintMode = 'ground';
        this._refreshModeButtons();
        this._refreshGroundBtns();
      });
      this._groundSection.appendChild(btn);
      this._groundBtns.push(btn);
    }
    sidebar.appendChild(this._groundSection);

    // ── Obstacle palette ───────────────────────────────────────────────────
    this._obstacleSection = document.createElement('div');
    this._obstacleSection.style.cssText = 'display:none;margin-top:4px';
    const oHead = document.createElement('div');
    oHead.textContent = 'Obstacle';
    oHead.style.cssText = 'color:#667;font-size:10px;margin-bottom:4px';
    this._obstacleSection.appendChild(oHead);

    this._obstacleBtns = [];
    for (let o = 0; o < OBS_LABELS.length; o++) {
      const col   = OBSTACLE_COLOR[o] ?? '#333';
      const blocks = OBSTACLE_BLOCKS[o];
      const btn = document.createElement('div');
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:5px',
        'padding:2px 4px', 'cursor:pointer', 'border-radius:2px',
        'border:1px solid transparent',
      ].join(';');

      const swatch = document.createElement('span');
      swatch.style.cssText = o === 0
        ? `display:inline-block;width:10px;height:10px;background:#222;flex-shrink:0;border:1px solid #445`
        : `display:inline-block;width:10px;height:10px;background:${col};flex-shrink:0;border:1px solid rgba(255,255,255,0.1)`;

      const label = document.createElement('span');
      label.textContent = OBS_LABELS[o] + (blocks ? ' ✕' : '');
      label.style.cssText = 'font-size:10px;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this._paintObstacle = o;
        this._paintMode = 'obstacle';
        this._refreshModeButtons();
        this._refreshObstacleBtns();
      });
      this._obstacleSection.appendChild(btn);
      this._obstacleBtns.push(btn);
    }
    sidebar.appendChild(this._obstacleSection);

    // ── Height palette ─────────────────────────────────────────────────────
    this._heightSection = document.createElement('div');
    this._heightSection.style.cssText = 'display:none;margin-top:4px';
    const hHead = document.createElement('div');
    hHead.textContent = 'Height level (0 – ' + ELEV_LEVELS + ')';
    hHead.style.cssText = 'color:#667;font-size:10px;margin-bottom:4px';
    this._heightSection.appendChild(hHead);

    this._heightBtns = [];
    for (let lv = ELEV_LEVELS; lv >= 0; lv--) {
      const t = lv / ELEV_LEVELS;
      const shade = Math.round(40 + t * 180);
      const col = `rgb(${shade},${shade},${Math.round(shade * 0.9)})`;

      const btn = document.createElement('div');
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:5px',
        'padding:2px 4px', 'cursor:pointer', 'border-radius:2px',
        'border:1px solid transparent',
      ].join(';');

      const swatch = document.createElement('span');
      swatch.style.cssText = `display:inline-block;width:10px;height:10px;background:${col};flex-shrink:0;border:1px solid rgba(255,255,255,0.1)`;

      const label = document.createElement('span');
      label.textContent = `${lv}`;
      label.style.cssText = 'font-size:10px;color:#bbb';

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        this._paintLevel = lv;
        this._paintMode  = 'height';
        this._refreshModeButtons();
        this._refreshHeightBtns();
      });
      this._heightSection.appendChild(btn);
      this._heightBtns[lv] = btn; // indexed by level
    }
    sidebar.appendChild(this._heightSection);

    this._refreshModeButtons();
    this._refreshGroundBtns();
    this._refreshObstacleBtns();
    this._refreshHeightBtns();
    return sidebar;
  }

  // ── Paint ───────────────────────────────────────────────────────────────────

  _tileFromEvent(e) {
    const rect = this._canvas.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left) / PX);
    const ty = Math.floor((e.clientY - rect.top)  / PX);
    if (tx < 0 || ty < 0 || tx >= CHUNK_SIZE || ty >= CHUNK_SIZE) return null;
    return { tx, ty };
  }

  _paint(e) {
    let { tx, ty } = this._tileFromEvent(e) ?? {};
    if (tx === undefined) return;
    // Snap 2×2 stamps to even tile coordinates so dragging doesn't produce overlap.
    if (this._paintMode === 'obstacle' && STAMP2X2.has(this._paintObstacle)) {
      tx = tx & ~1; ty = ty & ~1;
    }
    const idx = ty * CHUNK_SIZE + tx;

    if (this._paintMode === 'ground') {
      const existing = this._localPatches.get(idx) ?? {};
      this._localPatches.set(idx, { ...existing, ground: this._paintGround });
      this._redrawTile(tx, ty);
    } else if (this._paintMode === 'obstacle') {
      if (STAMP2X2.has(this._paintObstacle)) {
        // 2×2 stamp — paint all four tiles in the block
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx2 = 0; dx2 <= 1; dx2++) {
            const stx = tx + dx2, sty = ty + dy;
            if (stx >= CHUNK_SIZE || sty >= CHUNK_SIZE) continue;
            const sidx = sty * CHUNK_SIZE + stx;
            const ex = this._localPatches.get(sidx) ?? {};
            this._localPatches.set(sidx, { ...ex, obstacle: this._paintObstacle });
            this._redrawTile(stx, sty);
          }
        }
      } else {
        const existing = this._localPatches.get(idx) ?? {};
        this._localPatches.set(idx, { ...existing, obstacle: this._paintObstacle });
        this._redrawTile(tx, ty);
      }
    } else {
      const existing = this._localPatches.get(idx) ?? {};
      this._localPatches.set(idx, { ...existing, elevation: this._paintLevel / ELEV_LEVELS });
      this._redrawTile(tx, ty);
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  _redraw() {
    if (!this._grid) return;
    const ctx = this._ctx;
    const img = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    const d   = img.data;

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        this._writeTilePixels(d, tx, ty);
      }
    }
    ctx.putImageData(img, 0, 0);
    this._drawGrid();
  }

  _redrawTile(tx, ty) {
    const ctx = this._ctx;
    // Write a PX×PX block via a small ImageData
    const img = ctx.createImageData(PX, PX);
    const d   = img.data;
    const idx = ty * CHUNK_SIZE + tx;

    const { r, g, b } = this._tileRGB(idx);
    const isOverridden = this._localPatches.has(idx);

    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const p = (py * PX + px) * 4;
        // Thin border for overridden tiles (top-left pixel row/column)
        const border = isOverridden && (px === 0 || py === 0);
        d[p]   = border ? 200 : r;
        d[p+1] = border ? 180 : g;
        d[p+2] = border ?  50 : b;
        d[p+3] = 255;
      }
    }
    ctx.putImageData(img, tx * PX, ty * PX);
  }

  _writeTilePixels(d, tx, ty) {
    const idx = ty * CHUNK_SIZE + tx;
    const { r, g, b } = this._tileRGB(idx);
    const isOverridden = this._localPatches.has(idx);

    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const p = ((ty * PX + py) * CANVAS_SIZE + (tx * PX + px)) * 4;
        const border = isOverridden && (px === 0 || py === 0);
        d[p]   = border ? 200 : r;
        d[p+1] = border ? 180 : g;
        d[p+2] = border ?  50 : b;
        d[p+3] = 255;
      }
    }
  }

  _tileRGB(idx) {
    const patch = this._localPatches.get(idx);
    const grid  = this._grid;

    const gnd  = (patch?.ground     !== undefined) ? patch.ground     : grid.ground[idx];
    const obs  = (patch?.obstacle   !== undefined) ? patch.obstacle   : grid.obstacle[idx];
    const elev = (patch?.elevation  !== undefined) ? patch.elevation  : grid.elevation[idx];
    const passable = obs ? !OBSTACLE_BLOCKS[obs] : true;

    const hex = GROUND_COLOR[gnd] ?? '#333333';
    let r = parseInt(hex.slice(1,3), 16);
    let g = parseInt(hex.slice(3,5), 16);
    let b = parseInt(hex.slice(5,7), 16);

    const shade = 0.75 + elev * 0.5;
    r = Math.round(r * shade);
    g = Math.round(g * shade);
    b = Math.round(b * shade);

    const ohex = OBSTACLE_COLOR[obs];
    if (ohex) {
      const or = parseInt(ohex.slice(1,3), 16);
      const og = parseInt(ohex.slice(3,5), 16);
      const ob = parseInt(ohex.slice(5,7), 16);
      r = Math.round(r * 0.55 + or * 0.45);
      g = Math.round(g * 0.55 + og * 0.45);
      b = Math.round(b * 0.55 + ob * 0.45);
    }

    if (!passable) { r = Math.round(r * 0.7); g = Math.round(g * 0.7); b = Math.round(b * 0.7); }

    return {
      r: Math.max(0, Math.min(255, r)),
      g: Math.max(0, Math.min(255, g)),
      b: Math.max(0, Math.min(255, b)),
    };
  }

  _drawGrid() {
    // Draw a faint grid every 8 tiles (every 64px) to aid orientation
    const ctx = this._ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let t = 0; t <= CHUNK_SIZE; t += 8) {
      const pos = t * PX;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(CANVAS_SIZE, pos); ctx.stroke();
    }
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────────

  _updateTooltip(e) {
    const t = this._tileFromEvent(e);
    if (!t) { this._tooltip.style.display = 'none'; return; }
    const { tx, ty } = t;
    const idx   = ty * CHUNK_SIZE + tx;
    const patch = this._localPatches.get(idx);
    const grid  = this._grid;

    const gnd  = (patch?.ground     !== undefined) ? patch.ground     : grid.ground[idx];
    const obs  = (patch?.obstacle   !== undefined) ? patch.obstacle   : grid.obstacle[idx];
    const elev = (patch?.elevation  !== undefined) ? patch.elevation  : grid.elevation[idx];

    const gLabel = GROUND_LABELS[gnd] ?? `g:${gnd}`;
    const oLabel = obs ? (OBS_LABELS[obs] ?? `obs:${obs}`) : null;
    const modified = patch ? ' *' : '';
    const lvl = Math.round(elev * ELEV_LEVELS);

    let text = `[${tx},${ty}]  ${gLabel}`;
    if (oLabel) text += ` / ${oLabel}`;
    text += `  h:${lvl}/${ELEV_LEVELS}${modified}`;

    this._tooltip.textContent = text;
    this._tooltip.style.display = 'block';

    const rect = this._canvas.getBoundingClientRect();
    let lx = (e.clientX - rect.left) + 12;
    let ly = (e.clientY - rect.top)  - 22;
    if (lx + 260 > CANVAS_SIZE) lx = lx - 280;
    if (ly < 0) ly = (e.clientY - rect.top) + 12;
    this._tooltip.style.left = lx + 'px';
    this._tooltip.style.top  = ly + 'px';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  _commit() {
    // Write local patches back into the shared ChunkOverrides
    this._overrides.clearChunk(this._mx, this._my);
    for (const [idx, patch] of this._localPatches) {
      const tx = idx % CHUNK_SIZE;
      const ty = Math.floor(idx / CHUNK_SIZE);
      this._overrides.set(this._mx, this._my, tx, ty, patch);
    }
    if (this.onSave) this.onSave(this._mx, this._my, this._overrides);
    this.close();
  }

  _resetChunk() {
    this._localPatches.clear();
    this._redraw();
  }

  // ── Palette refresh ──────────────────────────────────────────────────────────

  _refreshModeButtons() {
    const btns = [
      [this._modeBtnGround,   'ground',   this._groundSection],
      [this._modeBtnObstacle, 'obstacle', this._obstacleSection],
      [this._modeBtnHeight,   'height',   this._heightSection],
    ];
    for (const [btn, mode, section] of btns) {
      const active = this._paintMode === mode;
      btn.style.background   = active ? '#1e3050' : '#1a2030';
      btn.style.borderColor  = active ? '#66a'    : '#446';
      btn.style.color        = active ? '#fff'    : '#ccd';
      section.style.display  = active ? 'block'   : 'none';
    }
  }

  _refreshGroundBtns() {
    for (let g = 0; g < this._groundBtns.length; g++) {
      const selected = this._paintMode === 'ground' && g === this._paintGround;
      this._groundBtns[g].style.background   = selected ? '#1e3050' : 'transparent';
      this._groundBtns[g].style.borderColor  = selected ? '#66a'    : 'transparent';
    }
  }

  _refreshObstacleBtns() {
    for (let o = 0; o < this._obstacleBtns.length; o++) {
      const selected = this._paintMode === 'obstacle' && o === this._paintObstacle;
      this._obstacleBtns[o].style.background  = selected ? '#1e3050' : 'transparent';
      this._obstacleBtns[o].style.borderColor = selected ? '#66a'    : 'transparent';
    }
  }

  _refreshHeightBtns() {
    for (let lv = 0; lv <= ELEV_LEVELS; lv++) {
      const btn = this._heightBtns[lv];
      if (!btn) continue;
      const selected = this._paintMode === 'height' && lv === this._paintLevel;
      btn.style.background  = selected ? '#1e3050' : 'transparent';
      btn.style.borderColor = selected ? '#66a'    : 'transparent';
    }
  }
}
