// hero_select.js — Full-screen hero selection overlay shown after map selection
// and before the game begins.  Displays all pre-generated characters; the player
// picks one to be their PC (the rest become available as followers).
//
// Usage:
//   const hs = new HeroSelect(characters, charSheet);
//   hs.onSelect = (heroId, gameOpts) => enterGame({...gameOpts, heroId});
//   hs.show(gameOpts);

function hexToCSS(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Top 5 stat highlights for the preview card.
function topStats(stats) {
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `<span style="color:#889">${k}</span>&nbsp;<span style="color:#c8b890">${v}</span>`)
    .join('<span style="color:#334"> · </span>');
}

export class HeroSelect {
  constructor(characters, charSheet) {
    this._chars     = characters;
    this._sheet     = charSheet;   // CharacterSheet instance
    this._gameOpts  = null;
    this.onSelect   = null;        // (heroId, gameOpts) => void

    this._overlay = document.createElement('div');
    this._overlay.id = 'hero-select-overlay';
    this._overlay.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:250',
      'background:#0d0d14',
      'overflow-y:auto',
      'font-family:monospace',
    ].join(';');
    document.body.appendChild(this._overlay);
  }

  show(gameOpts) {
    this._gameOpts = gameOpts;
    this._overlay.innerHTML = this._buildHTML();
    this._overlay.style.display = 'block';
    this._overlay.scrollTop = 0;
    this._bindEvents();
  }

  hide() {
    this._overlay.style.display = 'none';
  }

  _buildHTML() {
    let html = `
      <div style="max-width:900px;margin:0 auto;padding:40px 20px 60px">
        <div style="text-align:center;margin-bottom:36px">
          <div style="font-size:11px;letter-spacing:0.25em;color:#556;margin-bottom:8px">
            CHOOSE YOUR HERO
          </div>
          <div style="font-size:32px;letter-spacing:0.14em;color:#c8b890;
                      text-shadow:0 0 24px rgba(200,184,144,0.25)">
            Who are you?
          </div>
          <div style="font-size:11px;color:#445;margin-top:8px">
            The others can join you as companions.
          </div>
        </div>
        <div id="hero-card-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
    `;

    for (const char of this._chars) {
      const colorCSS = hexToCSS(char.color);
      html += `
        <div class="hero-card" data-id="${char.id}"
          style="background:rgba(255,255,255,0.02);border:1px solid #223;
                 border-radius:3px;padding:16px;cursor:default;
                 transition:border-color 0.12s,background 0.12s">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:12px;height:12px;border-radius:50%;
                        background:${colorCSS};flex-shrink:0"></div>
            <div>
              <div style="font-size:13px;color:#dde;letter-spacing:0.04em">${char.name}</div>
              <div style="font-size:10px;color:#556;letter-spacing:0.08em;margin-top:1px">${char.role.toUpperCase()}</div>
            </div>
          </div>
          <div style="font-size:11px;color:#778;line-height:1.55;margin-bottom:10px;
                      min-height:48px">${char.brief.split('.')[0]}.</div>
          <div style="font-size:10px;line-height:1.8;margin-bottom:12px">
            ${topStats(char.stats)}
          </div>
          <div style="display:flex;gap:6px">
            <button class="hero-select-btn" data-id="${char.id}"
              style="flex:1;padding:7px 0;font-family:monospace;font-size:11px;
                     background:transparent;color:#88a8cc;border:1px solid #334;
                     border-radius:2px;cursor:pointer;letter-spacing:0.06em;
                     transition:background 0.1s,border-color 0.1s">
              Select
            </button>
            <button class="hero-detail-btn" data-id="${char.id}"
              style="padding:7px 10px;font-family:monospace;font-size:11px;
                     background:transparent;color:#556;border:1px solid #223;
                     border-radius:2px;cursor:pointer;
                     transition:background 0.1s">
              ···
            </button>
          </div>
        </div>`;
    }

    html += `</div></div>`;
    return html;
  }

  _bindEvents() {
    // Hover highlight on cards
    for (const card of this._overlay.querySelectorAll('.hero-card')) {
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#446';
        card.style.background  = 'rgba(80,100,140,0.08)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#223';
        card.style.background  = 'rgba(255,255,255,0.02)';
      });
    }

    // Select buttons
    for (const btn of this._overlay.querySelectorAll('.hero-select-btn')) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background   = 'rgba(80,100,140,0.2)';
        btn.style.borderColor  = '#556';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background   = 'transparent';
        btn.style.borderColor  = '#334';
      });
      btn.addEventListener('click', () => {
        const heroId = btn.dataset.id;
        this.hide();
        this.onSelect?.(heroId, this._gameOpts);
      });
    }

    // Detail / character sheet buttons
    for (const btn of this._overlay.querySelectorAll('.hero-detail-btn')) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,0.04)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        const char = this._chars.find(c => c.id === btn.dataset.id);
        if (char) this._sheet.show(char);
      });
    }
  }
}
