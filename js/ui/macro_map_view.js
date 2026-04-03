// Renders a MacroMap to a 2D canvas overlay.
// Supports optional WorldPopulator data for kingdoms, settlements, and POIs.
// Click any cell to show an info card with terrain, climate, and civilisation details.
//
// Usage:
//   const view = new MacroMapView(canvas);
//   view.setScale(2);
//   view.draw(map);               // terrain only
//   view.draw(map, worldData);    // terrain + civilisation overlay

import { TERRAIN_PROPS, describeBiome }        from '../data/terrain_data.js';
import { GROUND_COLOR, OBSTACLE_COLOR, OBSTACLE_BLOCKS } from '../data/micro_tile_data.js';

// ----------------------------------------------------------------
// Terrain colour with moisture / vegetation tint
// ----------------------------------------------------------------
function cellColor(cell) {
  if (!cell) return '#000';

  const base = TERRAIN_PROPS[cell.terrain]?.colorHex ?? 0x333333;

  if (cell.terrain === 'ocean' || cell.terrain === 'steep_shore')
    return hexColor(base);

  const moistureTint = {
    desert:    [+40, +20, -20],
    arid:      [+20, +10, -10],
    dry:       [+5,  0,   -5 ],
    temperate: [0,   0,   0  ],
    wet:       [-10, +5,  +15],
  };
  const vegTint = {
    none:  [0,    0,    0   ],
    light: [-5,  +10,  -5   ],
    dense: [-15, +20,  -10  ],
  };

  const mt = moistureTint[cell.moistureZone] ?? [0,0,0];
  const vt = vegTint[cell.vegetation]        ?? [0,0,0];

  const r = ((base >> 16) & 0xff) + mt[0] + vt[0];
  const g = ((base >>  8) & 0xff) + mt[1] + vt[1];
  const b = ( base        & 0xff) + mt[2] + vt[2];

  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function hexColor(hex) {
  return `rgb(${(hex>>16)&0xff},${(hex>>8)&0xff},${hex&0xff})`;
}
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// Human-readable labels for info card
const SETT_LABELS = {
  city: 'City', town: 'Town', village: 'Village', fort: 'Fort', ruins: 'Ruins',
};
const FAMILY_LABELS = {
  rsv: 'Roadside Village', mnv: 'Market Village',  rmt: 'Mountain Hold',
  rvt: 'River Town',       gat: 'Gateway Town',    crt: 'Court City',
  sht: 'Shrine Town',      hft: 'Hill Fort',        mit: 'Mining Town',
  prt: 'Port Town',
};
const TIER_LABELS = {
  ba: 'Hamlet (100–500)',    ex: 'Town (500–1,500)',
  dn: 'Town (1,500–4,000)', sd: 'City (4,000–8,000)',
  mh: 'Major Hub (8,000+)', dc: 'Declining',
};
const CONDITION_LABELS = {
  pros: 'Prosperous', mil: 'Militarized', fort: 'Fortified',
  refg: 'Refugee Crisis', over: 'Overpopulated', dmg: 'Damaged',
  recv: 'Recovering', negl: 'Neglected', repr: 'Repressed',
};
const ANCIENT_LABELS = {
  ancient_capital: 'Ancient Capital', ancient_city: 'Ancient City', ancient_outpost: 'Ancient Outpost',
};
const POI_LABELS = {
  monster_lair:   'Monster Lair',
  tribal_village: 'Tribal Settlement',
  battle_site:    'Old Battle Site',
  dungeon:        'Dungeon',
  sacred_site:    'Sacred Site',
};
const MOISTURE_LABELS = {
  desert: 'Desert', arid: 'Arid', dry: 'Dry', temperate: 'Temperate', wet: 'Wet',
};
const VEG_LABELS = {
  none: 'Bare', light: 'Light cover', dense: 'Dense cover',
};

// ----------------------------------------------------------------
// MacroMapView
// ----------------------------------------------------------------
export class MacroMapView {
  constructor(canvas) {
    this._canvas     = canvas;
    this._ctx        = canvas.getContext('2d');
    this._scale      = 2;
    this._map        = null;
    this._worldData  = null;
    this._clicked    = null;   // { x, y } of last clicked cell
    this._playerCell = null;   // { x, y } of player's current macro cell
    this._chunkGen      = null;   // optional ChunkGenerator for preview
    this._chunkOverrides = null;  // optional ChunkOverrides for preview + editor
    this.onGoHere       = null;   // callback(mx, my) — set externally
    this.onEditChunk    = null;   // callback(mx, my, grid) — set externally
    this.goButtonLabel  = 'Go Here'; // changeable before game starts
    this._infoCard   = this._createInfoCard();

    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('click', e => this._onCanvasClick(e));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._hideCard();
    });
  }

  setScale(s) { this._scale = s; }

  // Attach a ChunkGenerator to enable 64×64 previews in the info card
  setChunkGenerator(gen) { this._chunkGen = gen; }

  // Attach a ChunkOverrides store so the preview reflects current edits
  // and the "Edit Chunk" button is enabled.
  setChunkOverrides(overrides) { this._chunkOverrides = overrides; }

  // Update the player location marker (call whenever the player enters a new cell)
  setPlayerCell(mx, my) { this._playerCell = { x: mx, y: my }; }

  draw(map, worldData = null) {
    this._map       = map;
    this._worldData = worldData;

    const s   = this._scale;
    this._canvas.width  = map.width  * s;
    this._canvas.height = map.height * s;
    const ctx = this._ctx;

    // 1 — Terrain base
    map.forEach((cell, x, y) => {
      ctx.fillStyle = cellColor(cell);
      ctx.fillRect(x*s, y*s, s, s);
    });

    // 2 — Territory colour overlay
    if (worldData?.kingdoms?.length) {
      const colorMap = new Map(worldData.kingdoms.map(k => [k.id, k.color]));
      map.forEach((cell, x, y) => {
        if (!cell?.ownerFactionId) return;
        const col = colorMap.get(cell.ownerFactionId);
        if (col == null) return;
        const r = (col >> 16) & 0xff, g = (col >> 8) & 0xff, b = col & 0xff;
        ctx.fillStyle = `rgba(${r},${g},${b},0.22)`;
        ctx.fillRect(x*s, y*s, s, s);
      });
    }

    // 3 — Rivers
    map.forEach((cell, x, y) => {
      if (cell?.hasRiver?.()) {
        ctx.fillStyle = 'rgba(80,140,220,0.7)';
        const rs  = Math.max(1, s * 0.4);
        const off = (s - rs) / 2;
        ctx.fillRect(x*s + off, y*s + off, rs, rs);
      }
    });

    if (worldData) {
      // 4 — Settlement footprints
      for (const k of worldData.kingdoms ?? []) {
        const r = (k.color >> 16) & 0xff;
        const g = (k.color >>  8) & 0xff;
        const b =  k.color        & 0xff;
        for (const sett of k.settlements) {
          if (!sett.footprint?.length) continue;
          ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
          for (const fc of sett.footprint) {
            ctx.fillRect(fc.x*s, fc.y*s, s, s);
          }
        }
      }

      // 5 — Ancient sites (unoccupied)
      for (const site of worldData.ancientSites ?? []) {
        if (site.overlaidBySettlement) continue;
        this._drawAncientSite(ctx, site, s);
      }

      // 6a — Tribal village footprints
      for (const poi of worldData.pois ?? []) {
        if (poi.type !== 'tribal_village' || !poi.footprint?.length) continue;
        ctx.fillStyle = 'rgba(140,50,20,0.55)';
        for (const fc of poi.footprint) ctx.fillRect(fc.x*s, fc.y*s, s, s);
      }

      // 6b — POI icons
      for (const poi of worldData.pois ?? []) this._drawPOI(ctx, poi, s);

      // 7 — Settlement core icons
      for (const k of worldData.kingdoms ?? []) {
        const r = (k.color >> 16) & 0xff;
        const g = (k.color >>  8) & 0xff;
        const b =  k.color        & 0xff;
        for (const sett of k.settlements) this._drawSettlementCore(ctx, sett, r, g, b, s);
      }
    }

    // 8 — Clicked-cell highlight
    if (this._clicked) {
      const { x, y } = this._clicked;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = Math.max(0.5, s * 0.15);
      ctx.strokeRect(x*s + 0.5, y*s + 0.5, s - 1, s - 1);
    }

    // 9 — Player location: flashing red-and-white cross
    if (this._playerCell) {
      const { x, y } = this._playerCell;
      const phase   = Math.floor(Date.now() / 350) % 2 === 0;
      const primary = phase ? '#ff2020' : '#ffffff';
      const outline = phase ? '#ffffff' : '#ff2020';

      const cx    = x * s + s / 2;
      const cy    = y * s + s / 2;
      const arm   = Math.max(3, s * 1.1);   // arm half-length (extends past cell)
      const thick = Math.max(1, s * 0.28);  // bar half-thickness

      ctx.save();
      // Outline pass (drawn 1px larger for contrast on any background)
      const o = 1;
      ctx.fillStyle = outline;
      ctx.fillRect(cx - arm - o, cy - thick - o, arm * 2 + o*2, thick * 2 + o*2);
      ctx.fillRect(cx - thick - o, cy - arm - o, thick * 2 + o*2, arm * 2 + o*2);
      // Primary fill
      ctx.fillStyle = primary;
      ctx.fillRect(cx - arm, cy - thick, arm * 2, thick * 2);
      ctx.fillRect(cx - thick, cy - arm, thick * 2, arm * 2);
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  // Click → info card
  // ----------------------------------------------------------------
  _onCanvasClick(e) {
    const rect  = this._canvas.getBoundingClientRect();
    // Account for CSS scaling (e.g. overflow scroll makes rect size differ from canvas px size)
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    const cx = Math.floor((e.clientX - rect.left)  * scaleX / this._scale);
    const cy = Math.floor((e.clientY - rect.top)   * scaleY / this._scale);

    if (!this._map?.inBounds(cx, cy)) return;

    this._clicked = { x: cx, y: cy };
    this.draw(this._map, this._worldData); // redraw to show highlight

    const info = this._gatherInfo(cx, cy);
    this._showCard(info, e.clientX, e.clientY);
  }

  _gatherInfo(cx, cy) {
    const cell = this._map.get(cx, cy);
    const wd   = this._worldData;

    const info = {
      x: cx, y: cy, cell,
      terrain:      cell?.terrain,
      moistureZone: cell?.moistureZone,
      vegetation:   cell?.vegetation,
      elevation:    cell?.elevation,
      hasRiver:     cell?.hasRiver?.() ?? false,
      kingdom:      null,
      settlement:   null,
      ancientSite:  null,
      poi:          null,
    };

    if (!wd) return info;

    // Territory owner
    if (cell?.ownerFactionId) {
      info.kingdom = wd.kingdoms.find(k => k.id === cell.ownerFactionId) ?? null;
    }

    // Current settlement (check kingdoms' settlement lists)
    if (cell?.settlementType && cell.settlementId) {
      for (const k of wd.kingdoms) {
        const sett = k.settlements.find(s => s.id === cell.settlementId);
        if (sett) { info.settlement = { ...sett, kingdomName: k.name }; break; }
      }
      // If not in any kingdom it's ruins only — info.settlement stays null,
      // ancientSite lookup below covers it.
    }

    // Ancient site at this exact cell (may be overlaid)
    info.ancientSite = wd.ancientSites.find(s => s.x === cx && s.y === cy) ?? null;

    // POI — direct position or footprint membership
    info.poi = wd.pois.find(p => {
      if (p.x === cx && p.y === cy) return true;
      if (p.footprint) return p.footprint.some(fc => fc.x === cx && fc.y === cy);
      return false;
    }) ?? null;

    return info;
  }

  _showCard(info, mouseX, mouseY) {
    const lines = [];
    const sep   = '<div style="border-top:1px solid #334;margin:5px 0"></div>';

    lines.push(`<span style="color:#aac;font-weight:bold">[${info.x}, ${info.y}]</span>`);
    lines.push(sep);

    // Terrain / climate
    const terrLabel = TERRAIN_PROPS[info.terrain]?.label ?? info.terrain ?? '—';
    lines.push(`<b>Terrain:</b> ${terrLabel}`);

    if (info.cell?.isLand?.()) {
      const moist = MOISTURE_LABELS[info.moistureZone] ?? info.moistureZone ?? '—';
      const veg   = VEG_LABELS[info.vegetation]        ?? info.vegetation   ?? '—';
      lines.push(`<b>Climate:</b> ${moist}`);
      lines.push(`<b>Cover:</b>   ${veg}`);
      const biome = describeBiome(info.terrain, info.moistureZone, info.vegetation);
      lines.push(`<b>Biome:</b>   <i>${biome}</i>`);
    }

    if (info.elevation != null)
      lines.push(`<b>Elevation:</b> ${(info.elevation * 100).toFixed(0)}%`);
    if (info.hasRiver)
      lines.push(`<span style="color:#80aaff">◈ River</span>`);

    // Territory
    if (info.kingdom) {
      lines.push(sep);
      lines.push(`<b>Territory:</b> ${info.kingdom.name}`);
    }

    // Current settlement
    if (info.settlement) {
      lines.push(sep);
      const s    = info.settlement;
      const fam  = FAMILY_LABELS[s.family] ?? SETT_LABELS[s.type] ?? s.type;
      const tier = TIER_LABELS[s.sizeTier]  ?? '';
      const cond = s.condition && s.condition !== 'base' ? CONDITION_LABELS[s.condition] ?? '' : '';
      const cap  = s.isCapital ? ' <span style="color:#ffd">(Capital)</span>' : '';
      lines.push(`<b>${fam}:</b> ${s.name ?? ''}${cap}`);
      if (tier) lines.push(`Size: ${tier}`);
      if (s.population) lines.push(`Population: ~${s.population.toLocaleString()}`);
      if (cond) lines.push(`<span style="color:#ffaa44">Condition: ${cond}</span>`);
      if (s.kingdomName) lines.push(`Kingdom of ${s.kingdomName}`);
      if (s.roleTags?.length) lines.push(`<span style="color:#88aacc">${s.roleTags.join(' · ')}</span>`);
      if (s.builtOverAncient)
        lines.push(`<span style="color:#ddaa33">⊕ Built over ancient ruins</span>`);
    } else if (info.cell?.settlementType === 'ruins') {
      lines.push(sep);
      lines.push(`<b>Ruins</b>`);
    }

    // Ancient site
    if (info.ancientSite) {
      lines.push(sep);
      const a    = info.ancientSite;
      const aTyp = ANCIENT_LABELS[a.type] ?? a.type;
      lines.push(`<b>Ancient:</b> ${a.name}`);
      lines.push(`<i>${aTyp}</i>`);
      if (a.overlaidBySettlement)
        lines.push(`<span style="color:#888">(city built on this site)</span>`);
    }

    // POI
    if (info.poi) {
      lines.push(sep);
      const p    = info.poi;
      const pTyp = POI_LABELS[p.type] ?? p.type;
      lines.push(`<b>${p.name}</b>`);
      lines.push(pTyp);
      if (p.subtype)      lines.push(`Race: ${p.subtype}`);
      if (p.dangerLevel) {
        const dl = Math.max(1, Math.min(5, p.dangerLevel));
        lines.push(`Danger: ${'★'.repeat(dl)}${'☆'.repeat(5 - dl)}`);
      }
    }

    this._infoCard.innerHTML = lines.join('\n');

    // Chunk preview — generate and append if ChunkGenerator is available
    let previewGrid = null;
    if (this._chunkGen && info.cell?.isLand?.()) {
      try {
        previewGrid = this._chunkGen.generate(this._map, info.x, info.y, this._chunkOverrides ?? null);
        if (previewGrid) {
          const hasOverrides = this._chunkOverrides?.hasChunk(info.x, info.y);
          const label = document.createElement('div');
          label.style.cssText = 'color:#667;font-size:10px;margin-top:6px';
          label.textContent   = `64×64 chunk  slope:${previewGrid.slopeDir}` +
                                (hasOverrides ? '  ✎' : '');
          this._infoCard.appendChild(label);
          this._infoCard.appendChild(this._renderChunkPreview(previewGrid));
        }
      } catch (e) {
        // chunk gen failure is non-fatal
      }
    }

    // Action buttons
    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';

    const btnStyle = 'flex:1;padding:4px 0;font-family:monospace;font-size:11px;' +
                     'background:#1a2030;color:#ccd;border:1px solid #446;' +
                     'border-radius:3px;cursor:pointer';

    const goBtn = document.createElement('button');
    goBtn.textContent = this.goButtonLabel;
    goBtn.style.cssText = btnStyle;
    goBtn.addEventListener('click', () => {
      if (this.onGoHere) this.onGoHere(info.x, info.y);
      this._hideCard();
    });

    btnBar.appendChild(goBtn);

    // "Edit Chunk" — only available when chunkGen + overrides are wired in and cell is land
    if (this._chunkGen && this._chunkOverrides && info.cell?.isLand?.()) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit Chunk';
      editBtn.style.cssText = btnStyle;
      editBtn.addEventListener('click', () => {
        if (this.onEditChunk) this.onEditChunk(info.x, info.y, previewGrid);
        this._hideCard();
      });
      btnBar.appendChild(editBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = btnStyle;
    closeBtn.addEventListener('click', () => this._hideCard());

    btnBar.appendChild(closeBtn);
    this._infoCard.appendChild(btnBar);

    // Position near mouse, clamped inside viewport
    this._infoCard.style.display = 'block';
    const cw = this._infoCard.offsetWidth  || 220;
    const ch = this._infoCard.offsetHeight || 180;
    const vw = window.innerWidth, vh = window.innerHeight;
    let lx = mouseX + 16, ly = mouseY + 16;
    if (lx + cw > vw) lx = mouseX - cw - 8;
    if (ly + ch > vh) ly = mouseY - ch - 8;
    this._infoCard.style.left = Math.max(4, lx) + 'px';
    this._infoCard.style.top  = Math.max(4, ly) + 'px';
  }

  _hideCard() {
    this._infoCard.style.display = 'none';
    this._clicked = null;
    // Redraw without the highlight
    if (this._map) this.draw(this._map, this._worldData);
  }

  // ----------------------------------------------------------------
  // Chunk preview — renders a 64×64 MicroGrid to a small canvas
  // ----------------------------------------------------------------
  _renderChunkPreview(grid) {
    const { CHUNK_SIZE } = grid.constructor === Object
      ? { CHUNK_SIZE: 64 }  // fallback
      : { CHUNK_SIZE: grid.elevation.length === 4096 ? 64 : 64 };
    const S  = 64;
    const PX = 2; // pixels per tile in the preview

    const canvas = document.createElement('canvas');
    canvas.width  = S * PX;
    canvas.height = S * PX;
    canvas.style.cssText = [
      'display:block', 'margin-top:8px',
      'image-rendering:pixelated',
      `width:${S*PX}px`, `height:${S*PX}px`,
      'border:1px solid #334',
    ].join(';');

    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(S * PX, S * PX);
    const d   = img.data;

    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const i     = ty * S + tx;
        const elev  = grid.elevation[i];
        const gnd   = grid.ground[i];
        const obs   = grid.obstacle[i];

        // Parse ground base colour
        const hex = GROUND_COLOR[gnd] ?? '#333333';
        const br  = parseInt(hex.slice(1, 3), 16);
        const bg  = parseInt(hex.slice(3, 5), 16);
        const bb  = parseInt(hex.slice(5, 7), 16);

        // Elevation shading: brighten high, darken low
        const shade = 0.75 + elev * 0.5;
        let r = Math.round(br * shade);
        let g = Math.round(bg * shade);
        let b = Math.round(bb * shade);

        // Obstacle tint overlay
        const ohex = OBSTACLE_COLOR[obs];
        if (ohex) {
          const or = parseInt(ohex.slice(1, 3), 16);
          const og = parseInt(ohex.slice(3, 5), 16);
          const ob = parseInt(ohex.slice(5, 7), 16);
          r = Math.round(r * 0.55 + or * 0.45);
          g = Math.round(g * 0.55 + og * 0.45);
          b = Math.round(b * 0.55 + ob * 0.45);
        }

        // Impassable darkening
        if (!grid.passable[i]) { r = Math.round(r*0.7); g = Math.round(g*0.7); b = Math.round(b*0.7); }

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        // Write PX×PX block of pixels
        for (let py = 0; py < PX; py++) {
          for (let px = 0; px < PX; px++) {
            const p = ((ty * PX + py) * S * PX + (tx * PX + px)) * 4;
            d[p]   = r; d[p+1] = g; d[p+2] = b; d[p+3] = 255;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Slope direction arrow overlay
    if (grid.slopeDir && grid.slopeDir !== 'flat') {
      const DIR_ARROW = {
        N:'↑', NE:'↗', E:'→', SE:'↘', S:'↓', SW:'↙', W:'←', NW:'↖'
      };
      ctx.font         = '14px monospace';
      ctx.fillStyle    = 'rgba(255,255,255,0.85)';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(DIR_ARROW[grid.slopeDir] ?? '', S*PX - 2, S*PX - 2);
    }

    return canvas;
  }

  _createInfoCard() {
    const card = document.createElement('div');
    card.id    = 'map-info-card';
    Object.assign(card.style, {
      display:      'none',
      position:     'fixed',
      zIndex:       '300',
      background:   'rgba(8,10,20,0.93)',
      border:       '1px solid #446',
      borderRadius: '4px',
      padding:      '10px 13px',
      fontFamily:   'monospace',
      fontSize:     '11px',
      color:        '#ddd',
      minWidth:     '190px',
      maxWidth:     '260px',
      lineHeight:   '1.6',
      pointerEvents:'auto',
      whiteSpace:   'pre-wrap',
    });
    document.body.appendChild(card);
    return card;
  }

  // ----------------------------------------------------------------
  // Drawing helpers
  // ----------------------------------------------------------------
  _drawAncientSite(ctx, site, s) {
    const px = site.x * s + s * 0.5;
    const py = site.y * s + s * 0.5;
    const sz = Math.max(2, s * 0.85);

    ctx.fillStyle   = site.type === 'ancient_capital' ? '#c8943a' : '#8a6820';
    ctx.strokeStyle = site.type === 'ancient_capital' ? '#f0c060' : '#c8943a';
    ctx.lineWidth   = 0.75;
    ctx.fillRect  (px - sz/2, py - sz/2, sz, sz);
    ctx.strokeRect(px - sz/2, py - sz/2, sz, sz);
    if (sz >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px - sz/4, py - sz/4, sz/2, sz/2);
    }
  }

  _drawPOI(ctx, poi, s) {
    const cx = (poi.footprint?.[0]?.x ?? poi.x) * s + s * 0.5;
    const cy = (poi.footprint?.[0]?.y ?? poi.y) * s + s * 0.5;
    const r  = Math.max(0.8, s * 0.45);

    switch (poi.type) {
      case 'monster_lair':   ctx.fillStyle = '#cc2222'; break;
      case 'tribal_village': ctx.fillStyle = '#aa3311'; break;
      case 'battle_site':    ctx.fillStyle = '#cc7722'; break;
      case 'dungeon':        ctx.fillStyle = '#8833cc'; break;
      case 'sacred_site':    ctx.fillStyle = '#33aacc'; break;
      default:               ctx.fillStyle = '#888888';
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSettlementCore(ctx, sett, kr, kg, kb, s) {
    const px = sett.coreX * s + s * 0.5;
    const py = sett.coreY * s + s * 0.5;

    // Size from tier
    const TIER_MULT = { ba: 0.7, ex: 0.85, dn: 1.0, sd: 1.15, mh: 1.4, dc: 0.65 };
    const tierMult = TIER_MULT[sett.sizeTier] ?? (sett.isCapital ? 1.15 : 1.0);
    const capBoost = sett.isCapital ? 1.3 : 1.0;
    const sz = Math.max(1.5, s * tierMult * capBoost);

    // Shape + colour per family
    // shape: 'square' | 'circle' | 'diamond'
    const family = sett.family;
    let shape, fill, stroke, lw;

    const kr2 = Math.min(255, kr + 20), kg2 = Math.min(255, kg + 40), kb2 = Math.min(255, kb + 80);

    switch (family) {
      case 'crt': shape = 'square';  fill = `rgb(${kr},${kg},${kb})`;   stroke = '#ffe080'; lw = 0.8; break;
      case 'mnv': shape = 'square';  fill = `rgb(${kr},${kg},${kb})`;   stroke = '#cccccc'; lw = 0.6; break;
      case 'sht': shape = 'square';  fill = `rgb(${Math.round(kr*0.75+30)},${Math.round(kg*0.75+30)},${Math.round(kb*0.75)})`; stroke = null; lw = 0; break;
      case 'prt': shape = 'circle';  fill = `rgb(${kr2},${kg2},${kb2})`; stroke = '#88aaff'; lw = 0.7; break;
      case 'rvt': shape = 'circle';  fill = `rgb(${kr},${kg},${kb})`;   stroke = '#66aaff'; lw = 0.6; break;
      case 'rsv': shape = 'circle';  fill = `rgb(${kr},${kg},${kb})`;   stroke = null; lw = 0; break;
      case 'hft': shape = 'diamond'; fill = '#b0b0b0';                   stroke = '#ffffff'; lw = 0.7; break;
      case 'gat': shape = 'diamond'; fill = '#909090';                   stroke = '#cccccc'; lw = 0.6; break;
      case 'rmt': shape = 'diamond'; fill = '#7a9a78';                   stroke = null; lw = 0; break;
      case 'mit': shape = 'diamond'; fill = '#aa8844';                   stroke = '#ddaa66'; lw = 0.6; break;
      default:    // fallback: use old-style by type
        if (sett.type === 'fort') {
          shape = 'diamond'; fill = '#bbbbbb'; stroke = '#ffffff'; lw = 0.6;
        } else {
          shape = 'square'; fill = `rgb(${kr},${kg},${kb})`; stroke = sett.isCapital ? '#ffffff' : null; lw = 0.7;
        }
    }

    ctx.fillStyle = fill;

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(px, py, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      if (stroke && sz >= 2) {
        ctx.strokeStyle = stroke; ctx.lineWidth = lw;
        ctx.stroke();
      }
    } else if (shape === 'diamond') {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      if (stroke && sz >= 2) {
        ctx.strokeStyle = stroke; ctx.lineWidth = lw;
        ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
      }
      ctx.restore();
    } else {
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      if (stroke && sz >= 2) {
        ctx.strokeStyle = stroke; ctx.lineWidth = lw;
        ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }

    // Capital: white centre dot
    if (sett.isCapital && sz >= 3) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.6, sz * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ancient-foundation: gold outer ring
    if (sett.builtOverAncient) {
      ctx.strokeStyle = '#ddaa33';
      ctx.lineWidth   = 0.75;
      ctx.strokeRect(px - sz / 2 - 1.2, py - sz / 2 - 1.2, sz + 2.4, sz + 2.4);
    }

    // Condition indicator: small accent dot above the icon
    const cond = sett.condition;
    if (cond && cond !== 'base' && sz >= 2) {
      const dotY = py - sz / 2 - 1.8;
      ctx.fillStyle = cond === 'pros'                  ? '#ffdd44'
                    : (cond === 'mil' || cond === 'fort') ? '#ff5533'
                    : cond === 'negl' || cond === 'dmg'   ? '#887766'
                    : '#88ccff';
      ctx.beginPath();
      ctx.arc(px, dotY, Math.max(0.5, s * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
