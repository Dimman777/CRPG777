// TilePanel — shows micro-tile data for the player's current standing tile.
// Updated every frame from game.js via microWorld.getTileInfo().

const GROUND_LABELS = [
  'Deep Water', 'Shallow Water', 'Wet Sand',   'Sand',       'Dry Earth',
  'Earth',      'Grass',         'Dry Grass',  'Rocky Earth','Scree',
  'Stone',      'Snow',          'Mud',         'Peat',
  'Rapids',
];

const OBS_LABELS = [
  null,
  'Pebble', 'Small Rock', 'Large Rock', 'Boulder',
  'Dead Shrub', 'Shrub', 'Dense Shrub', 'Tree', 'Dense Tree',
  'Dead Tree', 'Cactus', 'Reed', 'Tall Grass', 'Spring',
];

// OBSTACLE_BLOCKS mirrors micro_tile_data.js — 1 = impassable
const OBS_BLOCKS = [0,0,0,1,1, 0,0,0,1,1, 1,1,0,0,0];

export class TilePanel {
  constructor() {
    this._el = document.createElement('div');
    this._el.style.cssText = [
      'background:rgba(0,0,0,0.7)',
      'padding:10px 12px',
      'font-family:monospace',
      'font-size:11px',
      'color:#ccc',
      'min-width:180px',
      'pointer-events:none',
      'border-top:1px solid #333',
    ].join(';');
    document.getElementById('tile-panel').appendChild(this._el);
    document.getElementById('tile-panel').style.display = 'block';
    this._el.innerHTML = '<div style="color:#555">—</div>';
    this._lastKey = null;
  }

  update(info) {
    if (!info) {
      this._el.innerHTML = '<div style="color:#555">—</div>';
      this._lastKey = null;
      return;
    }

    // Skip DOM update if nothing changed
    const key = `${info.tx},${info.ty},${info.ground},${info.obstacle},${info.step}`;
    if (key === this._lastKey) return;
    this._lastKey = key;

    const { tx, ty, ground, obstacle, passable, step, worldH } = info;
    const groundLabel = GROUND_LABELS[ground] ?? `type:${ground}`;
    const obsLabel    = obstacle ? (OBS_LABELS[obstacle] ?? `obs:${obstacle}`) : null;
    const blocks      = obstacle ? OBS_BLOCKS[obstacle] : 0;

    let html = `<div style="color:#aac;margin-bottom:6px;font-size:10px">TILE [${tx}, ${ty}]  step:${step} / ${worldH}wu</div>`;
    html += `<div><b>Surface:</b> ${groundLabel}</div>`;

    if (obsLabel) {
      const marker = blocks
        ? '<span style="color:#c66"> ✕</span>'
        : '<span style="color:#6a6"> ·</span>';
      html += `<div><b>Cover:</b> ${obsLabel}${marker}</div>`;
    }

    if (!passable) {
      html += `<div style="color:#c66;font-size:10px;margin-top:3px">Impassable</div>`;
    }

    this._el.innerHTML = html;
  }
}
