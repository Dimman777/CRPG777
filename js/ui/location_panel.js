// LocationPanel — shows the macro-cell info for the player's current position.
// Mirrors the data in the MacroMapView info card but as a persistent HUD panel.

import { TERRAIN_PROPS, describeBiome } from '../data/terrain_data.js';

const MOISTURE_LABELS = {
  desert: 'Desert', arid: 'Arid', dry: 'Dry', temperate: 'Temperate', wet: 'Wet',
};
const VEG_LABELS = {
  none: 'Bare', light: 'Light', dense: 'Dense', sparse: 'Sparse',
};
const SETT_LABELS = {
  city: 'City', town: 'Town', village: 'Village', fort: 'Fort', ruins: 'Ruins',
};
const FAMILY_LABELS = {
  rsv: 'Roadside Village', mnv: 'Market Village',  rmt: 'Mountain Hold',
  rvt: 'River Town',       gat: 'Gateway Town',    crt: 'Court City',
  sht: 'Shrine Town',      hft: 'Hill Fort',        mit: 'Mining Town',
  prt: 'Port Town',
};
const DISTRICT_LABELS = {
  core: 'Town Centre',     res:  'Residential Quarter',
  econ: 'Market District', mil:  'Military Quarter',
  civ:  'Civic Quarter',   edge: 'Town Edge',
};
const CONDITION_LABELS = {
  pros: 'Prosperous', mil: 'Militarized', fort: 'Fortified',
  refg: 'Refugee Crisis', over: 'Overstrained', dmg: 'Damaged',
  recv: 'Recovering',  negl: 'Neglected',  repr: 'Repressed',
};
const POI_LABELS = {
  monster_lair:   'Monster Lair',
  tribal_village: 'Settlement',
  battle_site:    'Battle Site',
  dungeon:        'Dungeon',
  sacred_site:    'Sacred Site',
};

export class LocationPanel {
  constructor() {
    this._el = document.createElement('div');
    this._el.style.cssText = [
      'background:rgba(0,0,0,0.7)',
      'padding:10px 12px',
      'font-family:monospace',
      'font-size:11px',
      'color:#ccc',
      'min-width:180px',
      'max-height:100vh',
      'overflow-y:auto',
      'pointer-events:none',
    ].join(';');
    document.getElementById('location-panel').appendChild(this._el);
    document.getElementById('location-panel').style.display = 'block';
    this._el.innerHTML = '<div style="color:#555">Exploring…</div>';

    // Entry/exit banner — centred at top of screen, fades out
    this._banner     = document.createElement('div');
    this._banner.style.cssText = [
      'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.75)', 'border:1px solid #554',
      'padding:8px 22px', 'border-radius:3px',
      'font-family:monospace', 'font-size:13px', 'color:#eedd99',
      'pointer-events:none', 'opacity:0',
      'transition:opacity 0.4s ease',
      'text-align:center', 'white-space:nowrap', 'z-index:900',
    ].join(';');
    document.body.appendChild(this._banner);
    this._bannerTimer  = null;
    this._lastSettId   = null;
    this._lastDistrict = null;
  }

  _showBanner(line1, line2 = '') {
    this._banner.innerHTML = line2
      ? `${line1}<div style="font-size:10px;color:#aab;margin-top:2px">${line2}</div>`
      : line1;
    this._banner.style.opacity = '1';
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { this._banner.style.opacity = '0'; }, 2800);
  }

  update(cell, worldData, mx, my) {
    if (!cell) { this._el.innerHTML = '<div style="color:#555">—</div>'; return; }

    // ── Entry / exit banner logic ────────────────────────────────────────────
    const curSettId   = cell.settlementId   ?? null;
    const curDistrict = cell.settlementDistrict ?? null;

    if (curSettId !== this._lastSettId) {
      if (curSettId && worldData) {
        // Entering a settlement
        for (const k of worldData.kingdoms ?? []) {
          const s = k.settlements?.find(s => s.id === curSettId);
          if (s) {
            const fam = FAMILY_LABELS[s.family ?? cell.settlementFamily] ?? '';
            const dist = DISTRICT_LABELS[curDistrict] ?? '';
            this._showBanner(`Entering ${s.name}`, fam + (dist ? ` · ${dist}` : ''));
            break;
          }
        }
      } else if (!curSettId && this._lastSettId) {
        // Leaving a settlement
        this._showBanner('Leaving settlement');
      }
      this._lastDistrict = curDistrict;
    } else if (curSettId && curDistrict !== this._lastDistrict) {
      // Moved to a different district within the same settlement
      const distLabel = DISTRICT_LABELS[curDistrict] ?? curDistrict;
      this._showBanner(distLabel);
      this._lastDistrict = curDistrict;
    }

    this._lastSettId = curSettId;
    // ── End banner logic ─────────────────────────────────────────────────────

    const terrLabel = TERRAIN_PROPS[cell.terrain]?.label ?? cell.terrain;
    const elevStr   = cell.elevation != null ? `  h:${(cell.elevation * 100).toFixed(0)}` : '';
    let html = `<div style="color:#aac;margin-bottom:6px;font-size:10px">LOCATION [${mx}, ${my}${elevStr}]</div>`;
    html += `<div><b>Terrain:</b> ${terrLabel}</div>`;

    if (cell.isLand?.()) {
      html += `<div><b>Biome:</b> <i>${describeBiome(cell.terrain, cell.moistureZone, cell.vegetation)}</i></div>`;
      html += `<div><b>Climate:</b> ${MOISTURE_LABELS[cell.moistureZone] ?? cell.moistureZone}</div>`;
      html += `<div><b>Cover:</b> ${VEG_LABELS[cell.vegetation] ?? cell.vegetation}</div>`;
    }

    if (cell.hasRiver?.()) {
      html += `<div style="color:#80aaff">◈ River</div>`;
    }

    if (worldData) {
      const sep = '<div style="border-top:1px solid #333;margin:5px 0"></div>';

      if (cell.ownerFactionId) {
        const k = worldData.kingdoms?.find(k => k.id === cell.ownerFactionId);
        if (k) { html += sep; html += `<div><b>Territory:</b> ${k.name}</div>`; }
      }

      if (cell.settlementType && cell.settlementId) {
        for (const k of worldData.kingdoms ?? []) {
          const s = k.settlements?.find(s => s.id === cell.settlementId);
          if (s) {
            html += sep;
            const famLabel  = FAMILY_LABELS[s.family ?? cell.settlementFamily] ?? (SETT_LABELS[s.type] ?? s.type);
            const distLabel = DISTRICT_LABELS[cell.settlementDistrict] ?? '';
            const condLabel = s.condition && s.condition !== 'base' ? CONDITION_LABELS[s.condition] ?? '' : '';
            html += `<div style="color:#eea;font-weight:bold">${famLabel}: ${s.name ?? ''}</div>`;
            if (s.isCapital) html += `<div style="color:#ffd;font-size:10px">⚑ Capital</div>`;
            if (distLabel)   html += `<div style="color:#99bbcc;font-size:10px">${distLabel}</div>`;
            if (s.population) html += `<div style="color:#aaa;font-size:10px">Pop. ~${s.population.toLocaleString()}</div>`;
            if (condLabel)   html += `<div style="color:#ffaa44;font-size:10px">${condLabel}</div>`;
            break;
          }
        }
      } else if (cell.settlementType === 'ruins') {
        html += sep;
        html += `<div style="color:#998855">⊕ Ruins</div>`;
      }

      const ancient = worldData.ancientSites?.find(a => a.x === mx && a.y === my);
      if (ancient) {
        html += sep;
        html += `<div style="color:#ddaa33">⊕ ${ancient.name}</div>`;
      }

      const poi = worldData.pois?.find(p => p.x === mx && p.y === my);
      if (poi) {
        html += sep;
        html += `<div style="color:#cc8844"><b>${POI_LABELS[poi.type] ?? poi.type}:</b> ${poi.name}</div>`;
        if (poi.dangerLevel) {
          const dl = Math.max(1, Math.min(5, poi.dangerLevel));
          html += `<div style="color:#777;font-size:10px">Danger: ${'★'.repeat(dl)}${'☆'.repeat(5 - dl)}</div>`;
        }
      }
    }

    this._el.innerHTML = html;
  }
}
