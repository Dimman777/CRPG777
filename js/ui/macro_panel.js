export class MacroPanel {
  constructor() {
    this._container = document.getElementById('macro-panel');
    this._container.style.display = 'block';

    this._el = document.createElement('div');
    this._el.style.cssText = `
      background: rgba(0,0,0,0.7);
      padding: 10px 12px;
      font-family: monospace;
      font-size: 11px;
      color: #ccc;
      min-width: 200px;
      max-height: 100vh;
      overflow-y: auto;
      pointer-events: none;
    `;
    this._container.appendChild(this._el);
  }

  update(macroGame) {
    const { day, factionList, regionList, leaders } = macroGame;

    let html = `<div style="color:#888; margin-bottom:8px">Day <span style="color:#eee">${day}</span></div>`;

    // Factions
    for (const f of factionList) {
      const leader  = leaders.get(f.leaderId);
      const r       = f.resources;
      const color   = f.id === 'a' ? '#4488cc' : '#cc4444';
      html += `
        <div style="margin-bottom:8px">
          <div style="color:${color}; font-weight:bold">${f.name}</div>
          <div style="color:#777; font-size:10px; margin-bottom:2px">${leader?.name ?? '—'}</div>
          <div style="color:#aaa">
            Gold <b>${r.treasury}</b> &nbsp;
            Food <b>${r.food}</b> &nbsp;
            Men <b>${r.manpower}</b>
          </div>
          <div style="color:#777">Stability <b>${r.stability}</b></div>
        </div>`;
    }

    html += `<div style="border-top:1px solid #333; margin: 6px 0"></div>`;

    // Regions
    for (const reg of regionList) {
      const owner      = factionList.find(f => f.id === reg.ownerFactionId);
      const ownerColor = owner?.id === 'a' ? '#4488cc' : owner ? '#cc4444' : '#666';
      html += `
        <div style="margin-bottom:6px">
          <div style="color:#ddd">${reg.name}
            <span style="color:${ownerColor}; font-size:10px">${owner ? ' [' + owner.name + ']' : ' [none]'}</span>
          </div>
          ${bar('Sec',  reg.security,   '#44aa66')}
          ${bar('Pros', reg.prosperity, '#aaaa44')}
          ${bar('Unr',  reg.unrest,     '#cc4444')}
          ${bar('Food', reg.foodSupply, '#44aacc')}
        </div>`;
    }

    this._el.innerHTML = html;
  }
}

function bar(label, value, color) {
  const pct = Math.round(value);
  return `
    <div style="display:flex; align-items:center; margin-top:2px; gap:4px">
      <span style="color:#555; width:26px">${label}</span>
      <span style="display:inline-block; width:80px; height:5px; background:#222">
        <span style="display:inline-block; width:${pct}%; height:100%; background:${color}"></span>
      </span>
      <span style="color:#666; font-size:10px">${pct}</span>
    </div>`;
}
