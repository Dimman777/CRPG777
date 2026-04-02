// TurnHud — top-centre overlay that shows turn mode status, current actor,
// and contextual hints.  Hidden during real-time exploration.

export class TurnHud {
  constructor() {
    // Inject keyframe animation for the player-turn pulse
    const style = document.createElement('style');
    style.textContent = `
      @keyframes turn-hud-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.65; }
      }
      .turn-hud-pulse { animation: turn-hud-pulse 1.1s ease-in-out infinite; }
    `;
    document.head.appendChild(style);

    this._root = document.createElement('div');
    Object.assign(this._root.style, {
      position:      'fixed',
      top:           '18px',
      left:          '50%',
      transform:     'translateX(-50%)',
      background:    'rgba(8, 12, 24, 0.88)',
      border:        '1px solid rgba(100, 160, 255, 0.45)',
      borderRadius:  '6px',
      padding:       '8px 22px 10px',
      color:         '#dde8ff',
      fontFamily:    'monospace',
      fontSize:      '13px',
      textAlign:     'center',
      pointerEvents: 'none',
      zIndex:        '200',
      display:       'none',
      minWidth:      '220px',
      userSelect:    'none',
    });

    this._modeLabel = document.createElement('div');
    Object.assign(this._modeLabel.style, {
      fontSize:      '10px',
      letterSpacing: '2.5px',
      color:         '#7799cc',
      textTransform: 'uppercase',
      marginBottom:  '3px',
    });

    this._actorLine = document.createElement('div');
    Object.assign(this._actorLine.style, {
      fontSize:   '17px',
      fontWeight: 'bold',
      color:      '#ffffff',
      marginBottom: '3px',
    });

    this._hintLine = document.createElement('div');
    Object.assign(this._hintLine.style, {
      fontSize: '10px',
      color:    '#556677',
    });

    this._root.append(this._modeLabel, this._actorLine, this._hintLine);
    document.body.appendChild(this._root);
  }

  // Call every frame (or on state change) to keep the HUD in sync.
  // actionMode  — 'none' | 'move' | 'run'
  // hasMomentum — true when the player ran last turn (restricts choices to Run / Stop)
  update(controller, followers, actionMode = 'none', hasMomentum = false) {
    if (!controller.isActive) {
      this._root.style.display = 'none';
      return;
    }

    this._root.style.display = 'block';
    this._modeLabel.textContent = `TURN MODE  ·  ROUND ${controller.roundNumber}`;

    if (controller.state === 'player') {
      this._actorLine.textContent = 'Your Turn';
      this._actorLine.classList.add('turn-hud-pulse');
      if (actionMode === 'stop') {
        this._hintLine.textContent = 'LClick current tile · sudden stop    LClick amber tile · gradual stop';
      } else if (actionMode === 'run') {
        this._hintLine.textContent = 'LClick highlighted tile · run ×2    RClick · adjust (±45°)    Enter · stop';
      } else if (actionMode === 'move') {
        this._hintLine.textContent = 'LClick · sidestep / backstep    RClick · face (±180°)    Enter · pass';
      } else if (hasMomentum) {
        this._hintLine.textContent = 'Running — must Run again or Stop    Enter · sudden stop    Space · exit';
      } else {
        this._hintLine.textContent = 'Select Move or Run below    Enter · pass    Space · exit';
      }
    } else {
      const f = followers[controller.followerIndex];
      this._actorLine.textContent = f ? `${f.name}'s Turn` : 'Party moving…';
      this._actorLine.classList.remove('turn-hud-pulse');
      this._hintLine.textContent = '';
    }
  }

  dispose() {
    this._root.remove();
  }
}
