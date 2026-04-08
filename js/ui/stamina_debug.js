// StaminaDebug — floating panel for live-tuning stamina parameters.
// Toggle with backtick (`). Call update() each frame to keep bars live.
// Reads and writes staminaConfig directly; calls updateRates() on all
// active entities whenever rate multipliers change.

import { staminaConfig } from '../data/stamina_config.js';

const PANEL_CSS = [
  'position:fixed', 'top:60px', 'right:10px',
  'background:rgba(10,10,14,0.92)', 'color:#ccc',
  'border:1px solid #444', 'border-radius:6px',
  'padding:12px 16px', 'font:12px/1.5 monospace',
  'z-index:2000', 'display:none',
  'min-width:320px', 'max-height:88vh', 'overflow-y:auto',
  'user-select:none', 'pointer-events:all',
].join(';');

const INPUT_CSS = 'background:#1a1a22;color:#ddd;border:1px solid #444;border-radius:3px;padding:1px 4px;';

export class StaminaDebug {
  /**
   * @param {Function} getEntities — () => Array<{id:string, staminaState:StaminaState}>
   *   Should return player + active followers so updateRates() can be broadcast.
   */
  constructor(getEntities) {
    this._getEntities = getEntities;
    this._visible     = false;
    this._el          = null;
    this._cardioBarEl  = null;
    this._fatigueBarEl = null;
    this._cardioValEl  = null;
    this._fatigueValEl = null;
    this._build();
  }

  toggle() {
    this._visible = !this._visible;
    this._el.style.display = this._visible ? 'block' : 'none';
    if (this._visible) this._refreshMaxInputs();
  }

  // Call every frame; only does work when visible.
  update() {
    if (!this._visible) return;
    const player = this._getEntities().find(e => e.id === 'player');
    if (!player?.staminaState) return;
    const s  = player.staminaState;
    const cf = s.cardioFrac;
    const ff = s.fatigueFrac;
    this._cardioBarEl.style.width  = `${(cf * 100).toFixed(0)}%`;
    this._fatigueBarEl.style.width = `${(ff * 100).toFixed(0)}%`;
    this._cardioValEl.textContent  = `${s.cardio.toFixed(1)} / ${s.maxCardio.toFixed(1)}`;
    this._fatigueValEl.textContent = `${s.fatigue.toFixed(1)} / ${s.maxFatigue.toFixed(1)}`;
  }

  dispose() {
    this._el?.remove();
    this._el = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.id = 'stamina-debug';
    el.style.cssText = PANEL_CSS;
    el.innerHTML = this._html();
    document.body.appendChild(el);
    this._el           = el;
    this._cardioBarEl  = el.querySelector('#sd-c-bar');
    this._fatigueBarEl = el.querySelector('#sd-f-bar');
    this._cardioValEl  = el.querySelector('#sd-c-val');
    this._fatigueValEl = el.querySelector('#sd-f-val');
    this._bindEvents(el);
  }

  _html() {
    const c = staminaConfig;

    const bar  = (id, color) =>
      `<div style="height:9px;background:#222;border-radius:3px;margin:2px 0 5px;overflow:hidden">` +
      `<div id="${id}" style="height:100%;border-radius:3px;background:${color};width:100%;transition:width .1s"></div></div>`;

    const inp = (attrs, val) =>
      `<input ${attrs} value="${val}" style="${INPUT_CSS}">`;

    const costRows = Object.entries(c.costs).map(([type, cost]) =>
      `<tr>
        <td style="padding-right:8px;color:#aaa">${type}</td>
        <td>${inp(`data-cost="${type}" data-res="cardio" type="number" step="0.01" style="width:60px;${INPUT_CSS}"`, cost.cardio)}</td>
        <td>${inp(`data-cost="${type}" data-res="fatigue" type="number" step="0.01" style="width:60px;${INPUT_CSS}"`, cost.fatigue)}</td>
      </tr>`
    ).join('');

    const recRows = Object.entries(c.recoveryAllowed).map(([type, allow]) =>
      `<tr>
        <td style="padding-right:8px;color:#aaa">${type}</td>
        <td style="text-align:center"><input data-rec="${type}" data-res="cardio"  type="checkbox" ${allow.cardio  ? 'checked' : ''}></td>
        <td style="text-align:center"><input data-rec="${type}" data-res="fatigue" type="checkbox" ${allow.fatigue ? 'checked' : ''}></td>
      </tr>`
    ).join('');

    return `
<div style="font-size:13px;font-weight:bold;margin-bottom:8px">
  Stamina Debug <span style="font-size:10px;color:#666">\` to close</span>
</div>

<div style="color:#fa0">Cardio <span id="sd-c-val" style="color:#888;font-size:11px"></span></div>
${bar('sd-c-bar','#fa0')}
<div style="color:#69f">Fatigue <span id="sd-f-val" style="color:#888;font-size:11px"></span></div>
${bar('sd-f-bar','#69f')}

<div style="margin:8px 0 4px;color:#eee">Max values (player)</div>
<div style="margin-bottom:10px">
  Cardio ${inp(`id="sd-max-c" type="number" step="1" style="width:52px;${INPUT_CSS}"`, 60)}
  &nbsp;Fatigue ${inp(`id="sd-max-f" type="number" step="1" style="width:52px;${INPUT_CSS}"`, 60)}
</div>

<div style="margin-bottom:4px;color:#eee">Movement Costs (cardio / fatigue per tile)</div>
<table style="border-collapse:collapse;margin-bottom:10px">
  <thead><tr style="color:#888"><th></th><th style="padding:0 8px">Cardio</th><th>Fatigue</th></tr></thead>
  <tbody>${costRows}</tbody>
</table>

<div style="margin-bottom:4px;color:#eee">Recovery rate multipliers</div>
<div style="margin-bottom:10px">
  Cardio × ${inp(`id="sd-cm" type="number" step="0.001" style="width:70px;${INPUT_CSS}"`, c.cardioRateMultiplier)}
  &nbsp;Fatigue × ${inp(`id="sd-fm" type="number" step="0.001" style="width:70px;${INPUT_CSS}"`, c.fatigueRateMultiplier)}
</div>

<div style="margin-bottom:4px;color:#eee">Recovery allowed per state</div>
<table style="border-collapse:collapse">
  <thead><tr style="color:#888"><th></th><th style="padding:0 16px">Cardio</th><th>Fatigue</th></tr></thead>
  <tbody>${recRows}</tbody>
</table>`;
  }

  _refreshMaxInputs() {
    const player = this._getEntities().find(e => e.id === 'player');
    if (!player?.staminaState) return;
    const s = player.staminaState;
    this._el.querySelector('#sd-max-c').value = s.maxCardio;
    this._el.querySelector('#sd-max-f').value = s.maxFatigue;
  }

  _bindEvents(el) {
    // Movement cost inputs
    el.querySelectorAll('[data-cost]').forEach(inp => {
      inp.addEventListener('change', () => {
        const val = parseFloat(inp.value);
        if (!isNaN(val) && staminaConfig.costs[inp.dataset.cost]) {
          staminaConfig.costs[inp.dataset.cost][inp.dataset.res] = val;
        }
      });
    });

    // Recovery condition checkboxes
    el.querySelectorAll('[data-rec]').forEach(inp => {
      inp.addEventListener('change', () => {
        if (staminaConfig.recoveryAllowed[inp.dataset.rec]) {
          staminaConfig.recoveryAllowed[inp.dataset.rec][inp.dataset.res] = inp.checked;
        }
      });
    });

    // Rate multipliers — also broadcast updateRates() to all active entities
    el.querySelector('#sd-cm').addEventListener('change', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        staminaConfig.cardioRateMultiplier = val;
        for (const ent of this._getEntities()) ent.staminaState?.updateRates();
      }
    });
    el.querySelector('#sd-fm').addEventListener('change', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        staminaConfig.fatigueRateMultiplier = val;
        for (const ent of this._getEntities()) ent.staminaState?.updateRates();
      }
    });

    // Max cardio/fatigue overrides — player only
    el.querySelector('#sd-max-c').addEventListener('change', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        const player = this._getEntities().find(e2 => e2.id === 'player');
        if (player?.staminaState) {
          player.staminaState.maxCardio = val;
          player.staminaState.cardio    = Math.min(player.staminaState.cardio, val);
          player.staminaState._dirty    = true;
        }
      }
    });
    el.querySelector('#sd-max-f').addEventListener('change', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        const player = this._getEntities().find(e2 => e2.id === 'player');
        if (player?.staminaState) {
          player.staminaState.maxFatigue = val;
          player.staminaState.fatigue    = Math.min(player.staminaState.fatigue, val);
          player.staminaState._dirty     = true;
        }
      }
    });
  }
}
