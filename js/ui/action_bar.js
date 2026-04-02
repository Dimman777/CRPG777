// ActionBar — Move / Run buttons shown at the bottom of the screen during
// the player's turn in turn mode.

export class ActionBar {
  constructor() {
    const style = document.createElement('style');
    style.textContent = `
      .ab-btn {
        padding: 9px 26px;
        font-family: monospace;
        font-size: 13px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border: 1px solid rgba(100, 160, 255, 0.45);
        border-radius: 5px;
        background: rgba(8, 12, 24, 0.88);
        color: #dde8ff;
        cursor: pointer;
        user-select: none;
        transition: background 0.12s, border-color 0.12s;
        pointer-events: auto;
      }
      .ab-btn:hover:not(:disabled) {
        background: rgba(100, 160, 255, 0.22);
      }
      .ab-btn.ab-active {
        background: rgba(100, 160, 255, 0.30);
        color: #ffffff;
        border-color: rgba(100, 160, 255, 0.85);
      }
      .ab-btn:disabled {
        opacity: 0.30;
        cursor: default;
      }
    `;
    document.head.appendChild(style);

    this._root = document.createElement('div');
    Object.assign(this._root.style, {
      position:      'fixed',
      bottom:        '24px',
      left:          '50%',
      transform:     'translateX(-50%)',
      display:       'none',
      gap:           '12px',
      alignItems:    'center',
      pointerEvents: 'none',   // let clicks pass through the gap
      zIndex:        '200',
    });

    this._moveBtn = document.createElement('button');
    this._runBtn  = document.createElement('button');
    this._stopBtn = document.createElement('button');
    this._moveBtn.className   = 'ab-btn';
    this._runBtn.className    = 'ab-btn';
    this._stopBtn.className   = 'ab-btn';
    this._moveBtn.textContent = 'Move';
    this._runBtn.textContent  = 'Run ×2';
    this._stopBtn.textContent = 'Stop';
    this._stopBtn.style.display = 'none'; // hidden until momentum is active

    this.onMove = null; // () => void
    this.onRun  = null; // () => void
    this.onStop = null; // () => void

    this._moveBtn.addEventListener('click', () => this.onMove?.());
    this._runBtn.addEventListener('click',  () => this.onRun?.());
    this._stopBtn.addEventListener('click', () => this.onStop?.());

    this._root.append(this._moveBtn, this._runBtn, this._stopBtn);
    document.body.appendChild(this._root);
  }

  // Show or hide the whole bar.
  setVisible(visible) {
    this._root.style.display = visible ? 'flex' : 'none';
  }

  // Visually highlight which action is "active".
  setActive(mode) { // 'none' | 'move' | 'run' | 'stop'
    this._moveBtn.classList.toggle('ab-active', mode === 'move');
    this._runBtn.classList.toggle('ab-active',  mode === 'run');
    this._stopBtn.classList.toggle('ab-active', mode === 'stop');
  }

  // Enable or disable the Run button (disabled when no valid run path exists).
  setRunEnabled(enabled) {
    this._runBtn.disabled = !enabled;
  }

  // Switch between normal (Move + Run) and momentum (Run + Stop) layouts.
  setMomentum(hasMomentum) {
    this._moveBtn.style.display = hasMomentum ? 'none' : '';
    this._stopBtn.style.display = hasMomentum ? ''     : 'none';
  }

  dispose() { this._root.remove(); }
}
