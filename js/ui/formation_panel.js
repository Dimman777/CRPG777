// FormationPanel — compact HUD for managing party followers.
// Exposes onCountChange(n) and onModeChange(mode) callbacks.

import { FORMATION_MODE } from '../micro/follower_manager.js';

const MAX_FOLLOWERS = 8;

export class FormationPanel {
  constructor() {
    this.onCountChange = null;
    this.onModeChange  = null;

    this._count = 0;
    this._mode  = FORMATION_MODE.LOOSE;

    this._el = document.createElement('div');
    this._el.style.cssText = [
      'background:rgba(0,0,0,0.7)',
      'padding:8px 12px',
      'font-family:monospace',
      'font-size:11px',
      'color:#ccc',
      'min-width:160px',
      'border-top:1px solid #333',
      'user-select:none',
    ].join(';');

    this._el.innerHTML = this._html();
    document.getElementById('formation-panel').appendChild(this._el);
    document.getElementById('formation-panel').style.display = 'block';

    this._el.addEventListener('click', e => this._onClick(e));
  }

  _html() {
    const loose = this._mode === FORMATION_MODE.LOOSE;
    return `
      <div style="color:#aac;font-size:10px;margin-bottom:5px">PARTY FORMATION</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="flex:1">Followers:</span>
        <button data-action="dec" style="${btnCss()}"
          ${this._count === 0 ? 'disabled' : ''}>−</button>
        <span style="min-width:16px;text-align:center">${this._count}</span>
        <button data-action="inc" style="${btnCss()}"
          ${this._count >= MAX_FOLLOWERS ? 'disabled' : ''}>+</button>
      </div>
      <div style="display:flex;gap:4px">
        <button data-action="loose" style="${btnCss(loose)}">Loose</button>
        <button data-action="tight" style="${btnCss(!loose)}">Tight</button>
      </div>`;
  }

  _onClick(e) {
    const action = e.target.dataset?.action;
    if (!action) return;
    if (action === 'inc' && this._count < MAX_FOLLOWERS) {
      this._count++;
      this.onCountChange?.(this._count);
    } else if (action === 'dec' && this._count > 0) {
      this._count--;
      this.onCountChange?.(this._count);
    } else if (action === 'loose') {
      this._mode = FORMATION_MODE.LOOSE;
      this.onModeChange?.(this._mode);
    } else if (action === 'tight') {
      this._mode = FORMATION_MODE.TIGHT;
      this.onModeChange?.(this._mode);
    }
    this._el.innerHTML = this._html();
  }
}

function btnCss(active = false) {
  return [
    'padding:2px 8px',
    'font-family:monospace',
    'font-size:11px',
    `background:${active ? '#334' : '#222'}`,
    `color:${active ? '#aac' : '#888'}`,
    'border:1px solid #555',
    'border-radius:2px',
    'cursor:pointer',
    'pointer-events:auto',
  ].join(';');
}
