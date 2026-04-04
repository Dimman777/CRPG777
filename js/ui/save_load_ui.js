// SaveLoadUI — minimal save/load buttons shown during exploration.
// Hides itself when not in EXPLORATION state.

import { GameState } from '../game.js';

export class SaveLoadUI {
  constructor(game) {
    this._game = game;

    const style = document.createElement('style');
    style.textContent = `
      .sl-btn {
        padding: 7px 18px;
        font-family: monospace;
        font-size: 12px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border: 1px solid rgba(100, 160, 255, 0.35);
        border-radius: 5px;
        background: rgba(8, 12, 24, 0.85);
        color: #aabbd4;
        cursor: pointer;
        user-select: none;
        transition: background 0.12s, border-color 0.12s;
      }
      .sl-btn:hover:not(:disabled) {
        background: rgba(100, 160, 255, 0.18);
        color: #dde8ff;
      }
      .sl-btn:disabled { opacity: 0.3; cursor: default; }
    `;
    document.head.appendChild(style);

    this._root = document.createElement('div');
    Object.assign(this._root.style, {
      position:      'fixed',
      top:           '16px',
      right:         '16px',
      display:       'flex',
      gap:           '8px',
      zIndex:        '150',
      pointerEvents: 'auto',
    });

    this._saveBtn = document.createElement('button');
    this._loadBtn = document.createElement('button');
    this._saveBtn.className   = 'sl-btn';
    this._loadBtn.className   = 'sl-btn';
    this._saveBtn.textContent = 'Save';
    this._loadBtn.textContent = 'Load';

    this._saveBtn.addEventListener('click', () => this._onSave());
    this._loadBtn.addEventListener('click', () => this._onLoad());

    this._root.append(this._saveBtn, this._loadBtn);
    document.body.appendChild(this._root);

    this.update();
  }

  // Call each frame or on state change to keep buttons in sync.
  update() {
    const inExploration = this._game.state === GameState.EXPLORATION;
    this._root.style.display  = inExploration ? 'flex' : 'none';
    this._loadBtn.disabled    = !this._game.hasSave();
  }

  _onSave() {
    this._game.save();
    this.update();
  }

  _onLoad() {
    if (!this._game.hasSave()) return;
    if (!confirm('Load save? Current progress will be lost.')) return;
    this._game.loadFromStorage();
  }

  dispose() { this._root.remove(); }
}
