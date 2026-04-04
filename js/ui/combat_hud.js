export class CombatHud {
  constructor() {
    this._container = document.getElementById('hud');
    this._el = document.createElement('div');
    this._el.style.cssText = `
      position: absolute;
      top: 8px; left: 8px;
      background: rgba(0,0,0,0.65);
      padding: 10px 12px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #eee;
      pointer-events: none;
    `;
    this._container.appendChild(this._el);
  }

  update(combatants, initiativeOrder, lastAction = '') {
    const hpRows = combatants.map(c => {
      const hp    = c.resources.hp;
      const pct   = Math.max(0, Math.round((hp.current / hp.max) * 100));
      const color = c.factionId === 'a' ? '#4488cc' : '#cc4444';
      const alive = c.isAlive();
      return `
        <div style="margin-bottom:4px; opacity:${alive ? 1 : 0.4}">
          <span style="color:${color}; display:inline-block; width:60px">${c.name}</span>
          <span style="color:#777; font-size:10px; margin-right:4px">HP ${hp.current}/${hp.max}</span>
          <span style="display:inline-block; width:80px; height:7px;
                       background:#333; vertical-align:middle; border-radius:2px">
            <span style="display:inline-block; width:${pct}%; height:100%;
                         background:${color}; border-radius:2px; transition:width 0.3s"></span>
          </span>
        </div>`;
    }).join('');

    const initRow = initiativeOrder
      .map(e => `<span style="color:#aaa">${e.name}</span><span style="color:#555">(${e.value})</span>`)
      .join(' <span style="color:#444">→</span> ');

    this._el.innerHTML = `
      ${hpRows}
      <div style="margin-top:6px; font-size:11px; color:#888">
        <span style="color:#555">Initiative: </span>${initRow}
      </div>
      ${lastAction ? `<div style="margin-top:5px; font-size:11px; color:#bb9">${lastAction}</div>` : ''}
    `;
  }

  // Show player action buttons below the stat display.
  // options = [{ combatant, dist, inRange }] from CombatManager.getPlayerOptions()
  showPlayerActions(actorName, options, onAction) {
    this._el.style.pointerEvents = 'auto';

    const attackBtns = options.map(o => {
      const label    = o.inRange ? `⚔ Attack ${o.combatant.name}` : `⚔ ${o.combatant.name} (out of range)`;
      const disabled = !o.inRange;
      return `<button data-action="attack" data-id="${o.combatant.id}"
        style="display:block; width:100%; margin-bottom:3px; padding:5px 8px;
               font-family:monospace; font-size:11px; text-align:left; cursor:${disabled ? 'default' : 'pointer'};
               background:${disabled ? 'rgba(40,40,50,0.6)' : 'rgba(100,50,50,0.8)'};
               color:${disabled ? '#555' : '#faa'}; border:1px solid ${disabled ? '#333' : '#833'};
               border-radius:2px;" ${disabled ? 'disabled' : ''}>
        ${label}
      </button>`;
    }).join('');

    const moveBtns = options.map(o =>
      `<button data-action="move" data-id="${o.combatant.id}"
        style="display:block; width:100%; margin-bottom:3px; padding:5px 8px;
               font-family:monospace; font-size:11px; text-align:left; cursor:pointer;
               background:rgba(50,80,100,0.8); color:#8cf; border:1px solid #468; border-radius:2px;">
        → Move toward ${o.combatant.name}
      </button>`
    ).join('');

    const waitBtn = `<button data-action="wait"
      style="display:block; width:100%; margin-bottom:3px; padding:5px 8px;
             font-family:monospace; font-size:11px; text-align:left; cursor:pointer;
             background:rgba(60,60,60,0.8); color:#aaa; border:1px solid #555; border-radius:2px;">
      ○ Wait
    </button>`;

    const panel = document.createElement('div');
    panel.id = 'player-action-panel';
    panel.style.cssText = 'margin-top:10px; border-top:1px solid #444; padding-top:8px;';
    panel.innerHTML = `
      <div style="color:#4f4; font-size:11px; margin-bottom:6px; letter-spacing:1px">
        ▶ YOUR TURN — ${actorName.toUpperCase()}
      </div>
      ${attackBtns}${moveBtns}${waitBtn}
    `;

    panel.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      onAction({ type: btn.dataset.action, targetId: btn.dataset.id });
    });

    this._el.appendChild(panel);
  }

  hidePlayerActions() {
    document.getElementById('player-action-panel')?.remove();
    this._el.style.pointerEvents = 'none';
  }

  clear() {
    this._el.innerHTML = '';
    this._el.style.pointerEvents = 'none';
  }

  dispose() { this._el.remove(); }
}
