// Compass — SVG rose in the bottom-right corner.
// The rose rotates by the camera azimuth so the red N pointer always indicates
// world-north on screen.  Derivation: at azimuth A the camera is A° clockwise
// from north, so world-north appears at A° clockwise from screen-up.

export class Compass {
  constructor() {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'width:80px',
      'height:80px',
      'pointer-events:none',
      'z-index:50',
    ].join(';');

    wrap.innerHTML = `
      <svg width="80" height="80" viewBox="-40 -40 80 80"
           style="display:block;overflow:visible">
        <!-- fixed outer ring -->
        <circle r="38" fill="rgba(0,0,0,0.65)" stroke="#444" stroke-width="1.5"/>
        <!-- rotating rose — transform updated each frame -->
        <g id="compass-rose">
          <!-- cardinal tick marks -->
          <line x1="0"    y1="-35"  x2="0"    y2="-27" stroke="#666" stroke-width="1.5"/>
          <line x1="35"   y1="0"    x2="27"   y2="0"   stroke="#666" stroke-width="1.5"/>
          <line x1="0"    y1="35"   x2="0"    y2="27"  stroke="#666" stroke-width="1.5"/>
          <line x1="-35"  y1="0"    x2="-27"  y2="0"   stroke="#666" stroke-width="1.5"/>
          <!-- ordinal tick marks -->
          <line x1="24.7" y1="-24.7" x2="19.8" y2="-19.8" stroke="#444" stroke-width="1"/>
          <line x1="24.7" y1="24.7"  x2="19.8" y2="19.8"  stroke="#444" stroke-width="1"/>
          <line x1="-24.7" y1="24.7" x2="-19.8" y2="19.8" stroke="#444" stroke-width="1"/>
          <line x1="-24.7" y1="-24.7" x2="-19.8" y2="-19.8" stroke="#444" stroke-width="1"/>
          <!-- north arrow (red) -->
          <polygon points="0,-25 4,-8 0,-14 -4,-8" fill="#cc3333"/>
          <!-- south arrow (grey) -->
          <polygon points="0,25 4,8 0,14 -4,8"   fill="#555"/>
          <!-- cardinal labels -->
          <text x="0"   y="-15" text-anchor="middle" dominant-baseline="middle"
                font-family="monospace" font-size="9" font-weight="bold" fill="#eee">N</text>
          <text x="0"   y="19"  text-anchor="middle" dominant-baseline="middle"
                font-family="monospace" font-size="8" fill="#777">S</text>
          <text x="19"  y="0"   text-anchor="middle" dominant-baseline="middle"
                font-family="monospace" font-size="8" fill="#777">E</text>
          <text x="-19" y="0"   text-anchor="middle" dominant-baseline="middle"
                font-family="monospace" font-size="8" fill="#777">W</text>
          <!-- centre dot -->
          <circle r="2.5" fill="#999"/>
        </g>
      </svg>`;

    document.body.appendChild(wrap);
    this._rose = wrap.querySelector('#compass-rose');
    this._lastAz = null;
  }

  update(azimuth) {
    if (azimuth === this._lastAz) return;
    this._lastAz = azimuth;
    this._rose.setAttribute('transform', `rotate(${azimuth})`);
  }
}
