// PerfOverlay — lightweight frame-time profiler overlay.
// Toggle with F3.  Persistent rows for each tracked subsystem.

const ROWS = [
  'microWorld',
  'chunkSync',
  'unload',
  'enqueue',
  'reposition',
  'chunkLoad',
  'rerender',
  'floor',
  'grid',
  'obstacles',
  'cellEvent',
  'followerShift',
];

export class PerfOverlay {
  constructor() {
    this._el = document.createElement('div');
    Object.assign(this._el.style, {
      position: 'fixed', top: '4px', right: '4px', zIndex: '9999',
      background: 'rgba(0,0,0,0.8)', color: '#0f0', fontFamily: 'monospace',
      fontSize: '11px', padding: '6px 8px', borderRadius: '4px',
      pointerEvents: 'none', whiteSpace: 'pre', lineHeight: '1.4',
      display: 'none',
    });
    document.body.appendChild(this._el);

    this._visible = false;
    this._timings = {};
    this._frameTimes = [];
    this._frameStart = 0;
    this._displayCounter = 0; // throttle DOM updates
    // Peak hold: remembers the highest value seen for each row.
    // Decays toward current value so stale peaks fade out.
    this._peaks = {};
    this._peakAge = {};
    this._accum = {};       // rolling sum over last ~5 seconds
    this._accumBuf = {};    // ring buffer of per-frame values
    this._accumIdx = 0;
    const ACCUM_FRAMES = 300; // ~5s at 60fps
    for (const r of ROWS) {
      this._peaks[r] = 0;
      this._peakAge[r] = 0;
      this._accum[r] = 0;
      this._accumBuf[r] = new Float32Array(ACCUM_FRAMES);
    }
    this._accumLen = ACCUM_FRAMES;

    window.addEventListener('keydown', e => {
      if (e.key === 'F3') { e.preventDefault(); this.toggle(); }
    });
  }

  toggle() {
    this._visible = !this._visible;
    this._el.style.display = this._visible ? 'block' : 'none';
  }

  frameStart() {
    if (!this._visible) return;
    this._frameStart = performance.now();
    this._timings = {};
  }

  begin(name) {
    if (!this._visible) return null;
    const t0 = performance.now();
    return () => {
      const ms = performance.now() - t0;
      this._timings[name] = (this._timings[name] || 0) + ms;
    };
  }

  frameEnd() {
    if (!this._visible) return;
    const now   = performance.now();
    const total = now - this._frameStart;
    this._frameTimes.push(total);
    if (this._frameTimes.length > 120) this._frameTimes.shift();

    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    const max = Math.max(...this._frameTimes);
    const fps = 1000 / avg;

    // Update peaks — hold on spike, decay otherwise
    for (const name of ROWS) {
      const cur = this._timings[name] || 0;
      if (cur >= this._peaks[name]) {
        this._peaks[name] = cur;
        this._peakAge[name] = 0;
      } else {
        this._peakAge[name]++;
        // Hold peak for 600 frames (~10s at 60fps), then decay slowly
        if (this._peakAge[name] > 600) {
          this._peaks[name] += (cur - this._peaks[name]) * 0.03;
          if (this._peaks[name] < 0.05) this._peaks[name] = 0;
        }
      }
    }

    // Update accumulators (rolling 5s window)
    const idx = this._accumIdx % this._accumLen;
    for (const name of ROWS) {
      const cur = this._timings[name] || 0;
      const buf = this._accumBuf[name];
      this._accum[name] += cur - buf[idx];
      buf[idx] = cur;
    }
    this._accumIdx++;

    // Throttle DOM writes to every 10th frame (~6 updates/sec at 60fps)
    this._displayCounter++;
    if (this._displayCounter < 10) return;
    this._displayCounter = 0;

    // Header
    const frameColor = total > 12 ? '#f44' : total > 8 ? '#fa0' : '#0f0';
    let html = `<span style="color:${frameColor}">${fps.toFixed(0)} FPS  avg ${avg.toFixed(1)}ms  max ${max.toFixed(1)}ms  frame ${total.toFixed(1)}ms</span>\n`;
    html += `<span style="color:#888">  ${'name'.padEnd(14)} ${'now'.padStart(6)}   ${'peak'.padStart(6)}  ${'5s tot'.padStart(6)}</span>\n`;

    // Persistent rows
    for (const name of ROWS) {
      const cur  = this._timings[name] || 0;
      const peak = this._peaks[name];
      const show = Math.max(cur, peak);

      // Current value color
      let curColor;
      if (cur > 5)       curColor = '#f44';
      else if (cur > 2)  curColor = '#fa0';
      else if (cur > 0.1) curColor = '#0f0';
      else               curColor = '#555';

      // Peak color
      let peakColor;
      if (peak > 5)       peakColor = '#f44';
      else if (peak > 2)  peakColor = '#fa0';
      else if (peak > 0.1) peakColor = '#0f0';
      else                peakColor = '#555';

      const acc = this._accum[name] || 0;
      let accColor;
      if (acc > 200)      accColor = '#f44';
      else if (acc > 50)  accColor = '#fa0';
      else if (acc > 1)   accColor = '#0f0';
      else                accColor = '#555';

      const peakStr = peak > 0.1 ? peak.toFixed(1) : '-';
      const accStr  = acc > 0.1 ? acc.toFixed(0) : '-';
      const bar = peak > 0.1 ? '█'.repeat(Math.min(20, Math.round(peak * 2))) : '';
      html += `<span style="color:${curColor}">  ${name.padEnd(14)} ${cur.toFixed(1).padStart(6)}</span> <span style="color:${peakColor}">${peakStr.padStart(6)}</span> <span style="color:${accColor}">${accStr.padStart(6)}</span> <span style="color:${peakColor}">${bar}</span>\n`;
    }

    this._el.innerHTML = html;
  }

  dispose() { this._el.remove(); }
}
