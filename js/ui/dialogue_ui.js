export class DialogueUI {
  constructor() {
    this._container = document.getElementById('dialogue-panel');
    this._el        = document.createElement('div');
    this._el.style.cssText = `
      background: rgba(0,0,0,0.85);
      border-top: 1px solid #334;
      padding: 16px 24px 20px;
      font-family: monospace;
      color: #ddd;
      max-height: 40vh;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    this._container.appendChild(this._el);
    this._onSelect = null;
  }

  onSelect(cb) { this._onSelect = cb; }

  show(state) {
    document.getElementById('debug-panel').style.bottom = '240px';
    const { npcName, text, options } = state;
    this._container.style.display = 'block';

    const nameColor = '#aabbff'; // could vary by faction later

    this._el.innerHTML = `
      <div style="font-size:13px; color:${nameColor}; font-weight:bold; letter-spacing:1px">
        ${npcName.toUpperCase()}
      </div>
      <div style="font-size:12px; line-height:1.6; color:#ccc; white-space:pre-wrap">${text}</div>
      <div id="dlg-options" style="display:flex; flex-direction:column; gap:6px"></div>
    `;

    const optContainer = this._el.querySelector('#dlg-options');
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.disabled    = !opt.available;
      btn.style.cssText = `
        background: ${opt.available ? 'rgba(80,80,120,0.7)' : 'rgba(40,40,50,0.5)'};
        color: ${opt.available ? '#eee' : '#555'};
        border: 1px solid ${opt.available ? '#445' : '#333'};
        padding: 6px 12px;
        font-family: monospace;
        font-size: 11px;
        cursor: ${opt.available ? 'pointer' : 'default'};
        text-align: left;
        border-radius: 2px;
        transition: background 0.15s;
      `;
      if (opt.available) {
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(100,100,160,0.8)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(80,80,120,0.7)';
        });
        btn.addEventListener('click', () => this._onSelect?.(opt.id));
      }
      optContainer.appendChild(btn);
    });
  }

  hide() {
    document.getElementById('debug-panel').style.bottom = '0';
    this._container.style.display = 'none';
    this._el.innerHTML = '';
  }
}
