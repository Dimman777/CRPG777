// character_sheet.js — Modal overlay showing a character's full stat block,
// skills, and equipment.  Call show(charData) to open; the close button or
// clicking the backdrop dismisses it.

import { computeConsumables } from '../data/characters_data.js';

const DOMAINS = [
  {
    name: 'BODY',
    groups: [
      { name: 'Vigour',    stats: ['Power', 'Strength', 'Endurance'] },
      { name: 'Dexterity', stats: ['Balance', 'Coordination', 'Precision'] },
      { name: 'Stock',     stats: ['Build', 'Vitality', 'Fitness'] },
    ],
  },
  {
    name: 'MIND',
    groups: [
      { name: 'Perception', stats: ['Alertness', 'Observation', 'Intuition'] },
      { name: 'Lore',       stats: ['Learning', 'Memory', 'Knowledge'] },
      { name: 'Intellect',  stats: ['Wit', 'Control', 'Expression'] },
    ],
  },
  {
    name: 'SOUL',
    groups: [
      { name: 'Eija',      stats: ['Channel', 'Project', 'Source'] },
      { name: 'Integrity', stats: ['Courage', 'Composure', 'Identity'] },
      { name: 'Ardour',    stats: ['Passion', 'Empathy', 'Aura'] },
    ],
  },
];

const SKILL_LEVELS = ['Unknown', 'Exposed', 'Learned', 'Practiced', 'Internalized'];
const LEVEL_COLOR  = {
  Unknown:      '#444',
  Exposed:      '#667',
  Learned:      '#889',
  Practiced:    '#aab8cc',
  Internalized: '#c8b890',
};

// Render a 0–40 stat as a narrow filled bar.
function statBar(value) {
  const pct = Math.round((value / 40) * 100);
  return `
    <div style="display:inline-flex;align-items:center;gap:5px;width:100%">
      <div style="flex:1;height:4px;background:#222;border-radius:2px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:#446;border-radius:2px"></div>
      </div>
      <span style="color:#ccc;font-size:10px;min-width:16px;text-align:right">${value}</span>
    </div>`;
}

// Convert hex color number to CSS string.
function hexToCSS(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

export class CharacterSheet {
  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:300',
      'background:rgba(0,0,0,0.78)',
      'overflow:auto',
      'display:none',
    ].join(';');
    document.body.appendChild(this._overlay);

    // Click backdrop to close
    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this.hide();
    });
  }

  show(char) {
    if (!char) return;
    this._overlay.innerHTML = this._buildHTML(char);
    this._overlay.style.display = 'block';
    this._overlay.querySelector('#cs-close-btn')
      .addEventListener('click', () => this.hide());
  }

  hide() {
    this._overlay.style.display = 'none';
  }

  _buildHTML(char) {
    const consumables = computeConsumables(char.stats);
    const colorCSS    = hexToCSS(char.color);

    // ── Header ────────────────────────────────────────────────────────────────
    let html = `
      <div style="max-width:720px;margin:32px auto;background:#0e0e18;
                  border:1px solid #334;border-radius:4px;font-family:monospace;
                  font-size:12px;color:#ccc;overflow:hidden">
        <div style="padding:20px 24px 14px;border-bottom:1px solid #222;
                    display:flex;align-items:flex-start;gap:16px">
          <div style="width:16px;height:16px;border-radius:50%;
                      background:${colorCSS};flex-shrink:0;margin-top:2px"></div>
          <div style="flex:1">
            <div style="font-size:18px;color:#e8dcc8;letter-spacing:0.06em">${char.name}</div>
            <div style="font-size:11px;color:#778;letter-spacing:0.1em;margin-top:2px">${char.role.toUpperCase()}</div>
            <div style="font-size:11px;color:#889;margin-top:8px;line-height:1.55;max-width:540px">${char.brief}</div>
          </div>
          <button id="cs-close-btn" style="background:transparent;color:#556;
            border:none;font-size:18px;cursor:pointer;padding:0 4px;line-height:1">×</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
    `;

    // ── Stats (left column) ───────────────────────────────────────────────────
    html += `<div style="padding:16px 20px;border-right:1px solid #1a1a28">`;
    html += `<div style="font-size:10px;color:#556;letter-spacing:0.12em;margin-bottom:10px">STATISTICS</div>`;

    for (const domain of DOMAINS) {
      html += `<div style="color:#aac;font-size:10px;letter-spacing:0.1em;
                            margin-bottom:4px;margin-top:10px">${domain.name}</div>`;
      for (const group of domain.groups) {
        html += `<div style="margin-bottom:6px">`;
        html += `<div style="font-size:10px;color:#556;margin-bottom:3px">${group.name}</div>`;
        for (const stat of group.stats) {
          html += `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="color:#889;min-width:92px;font-size:10px">${stat}</span>
              ${statBar(char.stats[stat])}
            </div>`;
        }
        html += `</div>`;
      }
    }
    html += `</div>`;

    // ── Right column: consumables + skills + equipment ────────────────────────
    html += `<div style="padding:16px 20px">`;

    // Consumables
    html += `<div style="font-size:10px;color:#556;letter-spacing:0.12em;margin-bottom:8px">DERIVED POOLS</div>`;
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-bottom:16px">`;
    for (const [name, val] of Object.entries(consumables)) {
      html += `
        <div style="display:flex;justify-content:space-between;
                    border-bottom:1px solid #1a1a28;padding-bottom:3px">
          <span style="color:#778;font-size:10px">${name}</span>
          <span style="color:#c8b890;font-size:10px">${val}</span>
        </div>`;
    }
    html += `</div>`;

    // Skills
    html += `<div style="font-size:10px;color:#556;letter-spacing:0.12em;margin-bottom:8px">SKILLS</div>`;
    if (char.skills?.length) {
      const byTrunk = {};
      for (const sk of char.skills) {
        (byTrunk[sk.trunk] ??= []).push(sk);
      }
      for (const [trunk, skills] of Object.entries(byTrunk)) {
        html += `<div style="font-size:10px;color:#667;margin-bottom:2px">${trunk}</div>`;
        for (const sk of skills) {
          const col = LEVEL_COLOR[sk.level] ?? '#889';
          html += `
            <div style="display:flex;justify-content:space-between;
                        padding:1px 0 3px 8px;border-bottom:1px solid #151520">
              <span style="color:#aab">${sk.name}</span>
              <span style="color:${col};font-size:10px">${sk.level}</span>
            </div>`;
        }
        html += `<div style="margin-bottom:6px"></div>`;
      }
    } else {
      html += `<div style="color:#445;font-size:11px">None recorded.</div>`;
    }

    // Equipment
    html += `<div style="font-size:10px;color:#556;letter-spacing:0.12em;
                          margin-top:12px;margin-bottom:8px">EQUIPMENT</div>`;
    if (char.equipment?.length) {
      for (const item of char.equipment) {
        html += `<div style="color:#889;font-size:11px;padding:2px 0;
                              border-bottom:1px solid #151520">${item}</div>`;
      }
    }

    html += `</div>`; // right column
    html += `</div>`; // grid
    html += `</div>`; // card

    return html;
  }
}
