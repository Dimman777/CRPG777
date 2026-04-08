// ActionBar — movement action buttons shown during the player's turn in turn mode.
//
// Non-momentum layout:   Move | Crouch | Crawl | Climb | Run ×2 | Sprint ×3
// Momentum layout:       Run ×2 | Sprint ×3 | Stop

export class ActionBar {
  constructor() {
    const style = document.createElement('style');
    style.textContent = `
      .ab-btn {
        padding: 9px 20px;
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
      gap:           '10px',
      alignItems:    'center',
      pointerEvents: 'none',
      zIndex:        '200',
    });

    const mk = (label) => {
      const btn = document.createElement('button');
      btn.className   = 'ab-btn';
      btn.textContent = label;
      return btn;
    };

    this._moveBtn   = mk('Move');
    this._crouchBtn = mk('Crouch');
    this._crawlBtn  = mk('Crawl');
    this._climbBtn  = mk('Climb');
    this._runBtn    = mk('Run ×2');
    this._sprintBtn = mk('Sprint ×3');
    this._stopBtn   = mk('Stop');

    this._stopBtn.style.display = 'none'; // hidden until momentum is active

    // Callbacks — set by TurnMode
    this.onMove   = null;
    this.onCrouch = null;
    this.onCrawl  = null;
    this.onClimb  = null;
    this.onRun    = null;
    this.onSprint = null;
    this.onStop   = null;

    this._moveBtn.addEventListener(  'click', () => this.onMove?.());
    this._crouchBtn.addEventListener('click', () => this.onCrouch?.());
    this._crawlBtn.addEventListener( 'click', () => this.onCrawl?.());
    this._climbBtn.addEventListener( 'click', () => this.onClimb?.());
    this._runBtn.addEventListener(   'click', () => this.onRun?.());
    this._sprintBtn.addEventListener('click', () => this.onSprint?.());
    this._stopBtn.addEventListener(  'click', () => this.onStop?.());

    this._root.append(
      this._moveBtn, this._crouchBtn, this._crawlBtn, this._climbBtn,
      this._runBtn, this._sprintBtn, this._stopBtn,
    );
    document.body.appendChild(this._root);
  }

  setVisible(visible) {
    this._root.style.display = visible ? 'flex' : 'none';
  }

  setActive(mode) {
    this._moveBtn.classList.toggle(  'ab-active', mode === 'move');
    this._crouchBtn.classList.toggle('ab-active', mode === 'crouch');
    this._crawlBtn.classList.toggle( 'ab-active', mode === 'crawl');
    this._climbBtn.classList.toggle( 'ab-active', mode === 'climb');
    this._runBtn.classList.toggle(   'ab-active', mode === 'run');
    this._sprintBtn.classList.toggle('ab-active', mode === 'sprint');
    this._stopBtn.classList.toggle(  'ab-active', mode === 'stop');
  }

  setRunEnabled(enabled)    { this._runBtn.disabled    = !enabled; }
  setSprintEnabled(enabled) { this._sprintBtn.disabled = !enabled; }
  setClimbEnabled(enabled)  { this._climbBtn.disabled  = !enabled; }

  // Switch between normal (Move/Crouch/Crawl/Climb/Run/Sprint) and momentum (Run/Sprint/Stop) layouts.
  setMomentum(hasMomentum) {
    this._moveBtn.style.display   = hasMomentum ? 'none' : '';
    this._crouchBtn.style.display = hasMomentum ? 'none' : '';
    this._crawlBtn.style.display  = hasMomentum ? 'none' : '';
    this._climbBtn.style.display  = hasMomentum ? 'none' : '';
    this._stopBtn.style.display   = hasMomentum ? ''     : 'none';
  }

  dispose() { this._root.remove(); }
}
