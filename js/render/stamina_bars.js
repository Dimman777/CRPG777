// StaminaBars — world-space billboard sprites showing Cardio and Fatigue above
// every entity that has a staminaState.  Uses THREE.Sprite (auto-billboards to camera).
//
// Usage:
//   const bars = new StaminaBars(scene);
//   // each frame, after building the entity list:
//   bars.sync(entities);
//   // each entity: { id, px, py, headTopY, staminaState }
//
// Sprites are hidden while both resources are at zero to reduce visual noise.

import * as THREE from 'three';

const BAR_W    = 80;    // canvas pixels
const BAR_H    = 18;    // canvas pixels
const SPRITE_W = 1.1;   // world units wide
const SPRITE_H = SPRITE_W * (BAR_H / BAR_W);  // ~0.25 world units tall
const Y_OFFSET = 0.22;  // world units above headTopY

const MARGIN   = 2;     // canvas pixels
const ROW_H    = 6;     // canvas pixels per bar
const ROW_GAP  = 2;     // gap between Cardio and Fatigue bars

function _drawBars(ctx, cf, ff) {
  ctx.clearRect(0, 0, BAR_W, BAR_H);

  // Semi-transparent background panel
  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  ctx.fillRect(0, 0, BAR_W, BAR_H);

  const inner = BAR_W - MARGIN * 2;

  // ── Cardio bar (top) — orange/yellow when full, dark red when depleted ────
  // cf = 1.0 → full/fresh, cf = 0.0 → exhausted
  const yC = MARGIN;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(MARGIN, yC, inner, ROW_H);
  if (cf > 0.001) {
    const g = Math.round(160 * cf);          // green channel fades as bar empties
    ctx.fillStyle = `rgb(220,${g},20)`;
    ctx.fillRect(MARGIN, yC, Math.max(1, Math.round(inner * cf)), ROW_H);
  }

  // ── Fatigue bar (bottom) — bright blue when full, dark purple when depleted
  // ff = 1.0 → full/fresh, ff = 0.0 → burned out
  const yF = MARGIN + ROW_H + ROW_GAP;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(MARGIN, yF, inner, ROW_H);
  if (ff > 0.001) {
    const r = Math.round(120 * (1 - ff));    // red creeps in as bar empties
    const b = Math.round(160 + 60 * ff);     // blue fades slightly when depleted
    ctx.fillStyle = `rgb(${r},60,${b})`;
    ctx.fillRect(MARGIN, yF, Math.max(1, Math.round(inner * ff)), ROW_H);
  }
}

export class StaminaBars {
  constructor(scene) {
    this._scene   = scene;
    // id → { sprite, canvas, ctx, tex, lastCF, lastFF }
    this._entries = new Map();
  }

  /**
   * Sync bar sprites to the current entity states.
   * @param {Array<{id:string, px:number, py:number, headTopY:number, staminaState}>} entities
   */
  sync(entities) {
    const seen = new Set();

    for (const e of entities) {
      seen.add(e.id);
      let entry = this._entries.get(e.id);
      if (!entry) entry = this._create(e.id);

      const s  = e.staminaState;
      const cf = s.cardioFrac;
      const ff = s.fatigueFrac;

      // Redraw the canvas texture only when values have changed
      if (s._dirty || cf !== entry.lastCF || ff !== entry.lastFF) {
        _drawBars(entry.ctx, cf, ff);
        entry.tex.needsUpdate = true;
        entry.lastCF = cf;
        entry.lastFF = ff;
        s._dirty = false;
      }

      entry.sprite.visible = true;
      entry.sprite.position.set(e.px, e.headTopY + Y_OFFSET, e.py);
    }

    // Remove sprites for entities no longer in the list
    for (const [id, entry] of this._entries) {
      if (!seen.has(id)) {
        this._scene.remove(entry.sprite);
        entry.sprite.material.dispose();
        entry.tex.dispose();
        this._entries.delete(id);
      }
    }
  }

  dispose() {
    for (const entry of this._entries.values()) {
      this._scene.remove(entry.sprite);
      entry.sprite.material.dispose();
      entry.tex.dispose();
    }
    this._entries.clear();
  }

  _create(id) {
    const canvas = document.createElement('canvas');
    canvas.width  = BAR_W;
    canvas.height = BAR_H;
    const ctx = canvas.getContext('2d');

    const tex    = new THREE.CanvasTexture(canvas);
    const mat    = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(SPRITE_W, SPRITE_H, 1);
    sprite.visible = false;
    this._scene.add(sprite);

    const entry = { sprite, canvas, ctx, tex, lastCF: -1, lastFF: -1 };
    this._entries.set(id, entry);
    return entry;
  }
}
