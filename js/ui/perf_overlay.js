// PerfOverlay — lightweight frame-time profiler overlay.
// Toggle with F3.  Shows per-subsystem timings so you can identify stutter sources.
// On spike frames (>20ms), the breakdown freezes for 3 seconds so you can read it.

export class PerfOverlay {
  constructor() {
    this._el = document.createElement('div');
    Object.assign(this._el.style, {
      position: 'fixed', top: '4px', right: '4px', zIndex: '9999',
      background: 'rgba(0,0,0,0.75)', color: '#0f0', fontFamily: 'monospace',
      fontSize: '11px', padding: '6px 8px', borderRadius: '4px',
      pointerEvents: 'none', whiteSpace: 'pre', lineHeight: '1.4',
      display: 'none',
    });
    document.body.appendChild(this._el);

    this._visible = false;
    this._timings = {};      // name → latest ms
    this._frameTimes = [];   // last 120 frame dts
    this._frameStart = 0;

    // Spike freeze: when a spike occurs, hold the breakdown display for 3 seconds.
    this._frozenText  = null;
    this._freezeUntil = 0;

    window.addEventListener('keydown', e => {
      if (e.key === 'F3') { e.preventDefault(); this.toggle(); }
    });
  }

  toggle() {
    this._visible = !this._visible;
    this._el.style.display = this._visible ? 'block' : 'none';
  }

  // Call at the very start of the frame update.
  frameStart() {
    this._frameStart = performance.now();
    this._timings = {};
  }

  // Time a named block:  const end = perf.begin('chunkLoad'); ... end();
  begin(name) {
    const t0 = performance.now();
    return () => {
      const ms = performance.now() - t0;
      this._timings[name] = (this._timings[name] || 0) + ms;
    };
  }

  // Call at the very end of the frame update.
  frameEnd() {
    if (!this._visible) return;
    const now   = performance.now();
    const total = now - this._frameStart;
    this._frameTimes.push(total);
    if (this._frameTimes.length > 120) this._frameTimes.shift();

    // Stats header (always live)
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    const max = Math.max(...this._frameTimes);
    const fps = 1000 / avg;
    let header = `FPS: ${fps.toFixed(0)}  avg: ${avg.toFixed(1)}ms  max: ${max.toFixed(1)}ms\n`;

    // Build breakdown for this frame
    const sorted = Object.entries(this._timings).sort((a, b) => b[1] - a[1]);
    let breakdown = '';
    for (const [name, ms] of sorted) {
      const bar = '█'.repeat(Math.min(20, Math.round(ms / 0.5)));
      breakdown += `${name.padEnd(14)} ${ms.toFixed(2).padStart(6)}ms ${bar}\n`;
    }

    // On spike: freeze the breakdown so the user can read it
    if (total > 20) {
      this._frozenText  = `── SPIKE ${total.toFixed(1)}ms ──\n` + breakdown;
      this._freezeUntil = now + 3000;
    }

    // Show frozen breakdown if within the freeze window, otherwise live
    if (now < this._freezeUntil) {
      this._el.textContent = header + this._frozenText;
      this._el.style.color = '#f44';
    } else {
      this._el.textContent = header + breakdown;
      this._el.style.color = '#0f0';
    }
  }
}
