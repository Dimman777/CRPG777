// FormationPanel — party management panel.
// Shows available companions (non-PC characters) and lets the player toggle
// each one in or out of the active party, up to MAX_FOLLOWERS.
//
// Callbacks:
//   onRosterChange(activeCharIds: string[]) — ordered list of active followers changed
//   onModeChange(mode)                      — loose / tight formation changed
// Requires charSheet: CharacterSheet instance for the "···" detail button.

import { FORMATION_MODE } from '../micro/follower_manager.js';

const MAX_FOLLOWERS = 8;

function hexToCSS(n) {
  return '#' + n.toString(16).padStart(6, '0');
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

export class FormationPanel {
  constructor(charSheet) {
    this._charSheet      = charSheet;
    this.onRosterChange  = null;  // (string[]) => void
    this.onModeChange    = null;  // (mode) => void

    this._playerChar = null;  // PC character data (always shown as #1, non-removable)
    this._roster  = [];   // all available companions [{id, name, color, role}]
    this._active  = [];   // ordered array of char ids currently in party
    this._mode    = FORMATION_MODE.LOOSE;

    this._el = document.createElement('div');
    this._el.style.cssText = [
      'background:rgba(0,0,0,0.75)',
      'padding:8px 10px',
      'font-family:monospace',
      'font-size:11px',
      'color:#ccc',
      'min-width:200px',
      'max-width:240px',
      'border-top:1px solid #333',
      'user-select:none',
    ].join(';');

    document.getElementById('formation-panel').appendChild(this._el);
    document.getElementById('formation-panel').style.display = 'block';

    this._el.addEventListener('click', e => this._onClick(e));
  }

  // Set the Player Character shown at slot #1 (non-removable).
  setPlayerCharacter(char) {
    this._playerChar = char;
    this._render();
  }

  // Set the full roster of available companions (excludes PC).
  setRoster(chars) {
    this._roster = chars;
    // Remove any active ids that are no longer in the roster.
    this._active = this._active.filter(id => chars.some(c => c.id === id));
    this._render();
  }

  // Force a specific set of active ids from outside (e.g. on load).
  setActive(ids) {
    this._active = ids.filter(id => this._roster.some(c => c.id === id));
    this._render();
    this.onRosterChange?.(this._active.slice());
  }

  _render() {
    const { _playerChar, _roster, _active, _mode } = this;
    const loose      = _mode === FORMATION_MODE.LOOSE;
    const count      = _active.length;
    const partySize  = ((_playerChar ? 1 : 0) + count);

    // ── Active party ──────────────────────────────────────────────────────────
    let html = `<div style="color:#aac;font-size:10px;letter-spacing:0.1em;margin-bottom:6px">PARTY (${partySize})</div>`;
    html += `<div style="margin-bottom:6px">`;

    // Slot #1 — Player Character (always shown, non-removable)
    if (_playerChar) {
      const col = hexToCSS(_playerChar.color);
      html += `
        <div style="display:flex;align-items:center;gap:5px;padding:2px 0;
                    border-bottom:1px solid #1a1a28">
          <span style="color:#556;font-size:10px;min-width:14px">1</span>
          <span style="width:8px;height:8px;border-radius:50%;
                       background:${col};flex-shrink:0;display:inline-block"></span>
          <span style="flex:1;color:#e8dcc8;font-size:11px;white-space:nowrap;
                       overflow:hidden;text-overflow:ellipsis">${_playerChar.name.split(' ')[0]}</span>
          <span style="font-size:9px;color:#446;letter-spacing:0.06em">YOU</span>
          <button data-detail="${_playerChar.id}"
            style="padding:0 4px;font-family:monospace;font-size:10px;
                   background:transparent;color:#556;border:none;cursor:pointer;
                   pointer-events:auto">···</button>
        </div>`;
    }

    // Slots #2+ — Active followers
    for (let i = 0; i < _active.length; i++) {
      const id   = _active[i];
      const char = _roster.find(c => c.id === id);
      if (!char) continue;
      const col   = hexToCSS(char.color);
      const slot  = (_playerChar ? 2 : 1) + i;
      html += `
        <div style="display:flex;align-items:center;gap:5px;padding:2px 0;
                    border-bottom:1px solid #1a1a28">
          <span style="color:#445;font-size:10px;min-width:14px">${slot}</span>
          <span style="width:8px;height:8px;border-radius:50%;
                       background:${col};flex-shrink:0;display:inline-block"></span>
          <span style="flex:1;color:#ccd;font-size:11px;white-space:nowrap;
                       overflow:hidden;text-overflow:ellipsis">${char.name.split(' ')[0]}</span>
          <button data-detail="${id}"
            style="padding:0 4px;font-family:monospace;font-size:10px;
                   background:transparent;color:#556;border:none;cursor:pointer;
                   pointer-events:auto">···</button>
          <button data-remove="${id}"
            style="padding:0 4px;font-family:monospace;font-size:11px;
                   background:transparent;color:#664;border:none;cursor:pointer;
                   pointer-events:auto" title="Dismiss">×</button>
        </div>`;
    }

    if (partySize === 0) {
      html += `<div style="color:#445;font-size:10px">No one here.</div>`;
    }
    html += `</div>`;

    // ── Available roster ──────────────────────────────────────────────────────
    const available = _roster.filter(c => !_active.includes(c.id));
    if (available.length > 0) {
      html += `<div style="color:#556;font-size:10px;letter-spacing:0.08em;
                            margin-bottom:4px;margin-top:4px">AVAILABLE</div>`;
      html += `<div style="max-height:160px;overflow-y:auto;margin-bottom:6px">`;
      for (const char of available) {
        const col      = hexToCSS(char.color);
        const canAdd   = count < MAX_FOLLOWERS;
        html += `
          <div style="display:flex;align-items:center;gap:5px;padding:2px 0;
                      border-bottom:1px solid #151520">
            <span style="width:8px;height:8px;border-radius:50%;
                         background:${col};flex-shrink:0;display:inline-block"></span>
            <span style="flex:1;color:#889;font-size:11px;white-space:nowrap;
                         overflow:hidden;text-overflow:ellipsis">${char.name.split(' ')[0]}</span>
            <button data-detail="${char.id}"
              style="padding:0 4px;font-family:monospace;font-size:10px;
                     background:transparent;color:#445;border:none;cursor:pointer;
                     pointer-events:auto">···</button>
            <button data-add="${char.id}"
              style="padding:1px 6px;font-family:monospace;font-size:11px;
                     background:transparent;color:${canAdd ? '#88a8cc' : '#334'};
                     border:1px solid ${canAdd ? '#335' : '#222'};
                     border-radius:2px;cursor:${canAdd ? 'pointer' : 'default'};
                     pointer-events:auto"
              ${canAdd ? '' : 'disabled'}>+</button>
          </div>`;
      }
      html += `</div>`;
    }

    // ── Formation mode ────────────────────────────────────────────────────────
    html += `
      <div style="display:flex;gap:4px;margin-top:4px">
        <button data-action="loose" style="${btnCss(loose)}">Loose</button>
        <button data-action="tight" style="${btnCss(!loose)}">Tight</button>
      </div>`;

    this._el.innerHTML = html;
  }

  _onClick(e) {
    const t = e.target;
    if (!t.dataset) return;

    if (t.dataset.add) {
      const id = t.dataset.add;
      if (!this._active.includes(id) && this._active.length < MAX_FOLLOWERS) {
        this._active.push(id);
        this.onRosterChange?.(this._active.slice());
        this._render();
      }
    } else if (t.dataset.remove) {
      const id = t.dataset.remove;
      const idx = this._active.indexOf(id);
      if (idx !== -1) {
        this._active.splice(idx, 1);
        this.onRosterChange?.(this._active.slice());
        this._render();
      }
    } else if (t.dataset.detail) {
      const char = this._roster.find(c => c.id === t.dataset.detail);
      if (char) this._charSheet?.show(char);
    } else if (t.dataset.action === 'loose') {
      this._mode = FORMATION_MODE.LOOSE;
      this.onModeChange?.(this._mode);
      this._render();
    } else if (t.dataset.action === 'tight') {
      this._mode = FORMATION_MODE.TIGHT;
      this.onModeChange?.(this._mode);
      this._render();
    }
  }
}
