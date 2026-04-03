// FollowerManager — up to 8 party followers that orbit formation slots,
// wander to inspect interesting terrain, and chatter with each other.
//
// Each follower has three independent facings (legAngle / torso / head):
//   legAngle    — driven by movement (always faces walk direction)
//   torsoOffset — ±π/4 from legAngle; turned toward conversation partner
//   headOffset  — ±π/4 from torso; turned toward conversation partner
//
// Positions are in local tile-space (same coordinate frame as Player.px/py).
// Call onChunkTransition(dPx, dPy) whenever the centre chunk shifts so all
// positions stay in sync.

import { CHUNK_SIZE } from './micro_grid.js';

export const FORMATION_MODE = Object.freeze({ LOOSE: 'loose', TIGHT: 'tight' });

const STATE = Object.freeze({
  FOLLOWING: 'following', // heading toward formation slot
  WANDERING: 'wandering', // inspecting a nearby terrain feature
  CHATTING:  'chatting',  // walking beside another follower
  RETURNING: 'returning', // heading back to slot after wandering/chatting
});

// [colOffset, rowDepth] — col = tiles right of player heading, row = tiles behind player (negative = ahead)
// Wide lateral spread keeps the party roughly level with the PC rather than queuing behind.
const FORMATION_SLOTS = [
  [ 2.5,  0.5],  // 0 right flank (alongside PC)
  [-2.5,  0.5],  // 1 left flank (alongside PC)
  [ 4.5,  2.5],  // 2 far right, slightly behind
  [ 0.0,  2.5],  // 3 centre, slightly behind
  [-4.5,  2.5],  // 4 far left, slightly behind
  [ 3.0,  5.0],  // 5 right-rear
  [-3.0,  5.0],  // 6 left-rear
  [ 0.0,  7.0],  // 7 trail
];

// Fallback names/colors used only when no character data is provided.
const FOLLOWER_NAMES  = ['Bram','Vera','Dunstan','Lyra','Edda','Gorn','Sable','Rook'];
const FOLLOWER_COLORS = [
  0x4499cc, 0xcc7744, 0x44cc66, 0x9944cc,
  0xcc4488, 0x44cccc, 0xaaaa22, 0x888888,
];

const FOLLOWER_SPEED    = 8.0;   // tiles/s — slightly faster than player to catch up
const ARRIVE_DIST       = 0.45;  // tiles — "close enough to target"
const WANDER_RANGE      = 7;     // tiles from slot to search for interesting features
const LOOSE_ORBIT_DIST  = 4.0;   // tiles from slot before RETURNING is forced
const TIGHT_SLOT_SCALE  = 0.50;  // tight-mode: slots compress to 50 % of normal spacing

// Obstacle IDs worth wandering toward (rocks, shrubs, trees, reeds)
const INTERESTING_OBS = new Set([3, 4, 6, 7, 8, 9, 10, 12, 13]);

// Clamp an angle difference to ±π/4 after normalising to [−π, π].
const QUARTER_PI = Math.PI / 4;
function clampOffset(diff) {
  diff = ((diff % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Math.max(-QUARTER_PI, Math.min(QUARTER_PI, diff));
}

// ─────────────────────────────────────────────────────────────────────────────

export class FollowerManager {
  constructor(rng = null) {
    this._rng              = rng;
    this._followers        = [];
    this._mode             = FORMATION_MODE.LOOSE;
    this._lastPx           = null;
    this._lastPz           = null;
    this._prevPlayerMoving = true;
    this._idleTime         = 0;   // seconds PC has been stationary this stretch
    this._idleScatterTimer = 0;   // countdown to next extended-idle re-scatter
  }

  get followers() { return this._followers; }
  get mode()      { return this._mode; }

  // Seeded random — falls back to Math.random if no RNG was provided.
  _rand() { return this._rng ? this._rng.next() : this._rand(); }
  get count()     { return this._followers.length; }

  // ── Public API ──────────────────────────────────────────────────────────────

  setMode(mode) {
    this._mode = mode;
    if (mode === FORMATION_MODE.TIGHT) {
      for (const f of this._followers) {
        f.state       = STATE.FOLLOWING;
        f.stateTimer  = 0;
        f.chatPartner = null;
        f.showBanter  = false;
        f.banterTimer = 0;
        f.torsoOffset = 0;
        f.headOffset  = 0;
      }
    }
  }

  setCount(n, player) {
    n = Math.max(0, Math.min(8, n));
    const px = player?.px ?? 32, pz = player?.py ?? 32;
    const hx = player?.headingX ?? 0, hz = player?.headingZ ?? 1;

    while (this._followers.length < n) {
      const idx = this._followers.length;
      const [sx, sz] = this._slotPos(px, pz, hx, hz, idx);
      this._followers.push(this._makeFollower(
        { id: `anon_${idx}`, name: FOLLOWER_NAMES[idx], color: FOLLOWER_COLORS[idx] },
        idx, sx, sz, hx, hz,
      ));
    }
    while (this._followers.length > n) this._followers.pop();
  }

  // Replace the active follower list with characters from the given charData array.
  // Existing followers whose charId is still in the list keep their current position.
  // New followers are spawned at their slot position.
  setActiveFollowers(charDataArray, player) {
    const n  = Math.min(charDataArray.length, 8);
    const px = player?.px ?? 32, pz = player?.py ?? 32;
    const hx = player?.headingX ?? 0, hz = player?.headingZ ?? 1;

    // Index existing followers by charId so we can preserve their positions.
    const keep = new Map(this._followers.map(f => [f.charId, f]));

    const next = [];
    for (let idx = 0; idx < n; idx++) {
      const char     = charDataArray[idx];
      const existing = keep.get(char.id);
      if (existing) {
        existing.slot = idx;
        next.push(existing);
      } else {
        const [sx, sz] = this._slotPos(px, pz, hx, hz, idx);
        next.push(this._makeFollower(char, idx, sx, sz, hx, hz));
      }
    }
    this._followers = next;
  }

  _makeFollower(char, slotIdx, sx, sz, hx, hz) {
    return {
      // ── Identity (immutable) ──
      id:             `follower_${char.id}`,
      charId:         char.id,
      charData:       char,
      name:           char.name,
      color:          char.color,

      // ── Simulation state (serializable) ──
      slot:           slotIdx,
      px:             sx,
      py:             sz,
      headingX:       hx,
      headingZ:       hz,
      legAngle:       Math.atan2(hx, hz),
      torsoOffset:    0,
      headOffset:     0,
      headLookTarget: 0,
      headLookTimer:  slotIdx * 0.7 + this._rand() * 3 + 1,
      state:          STATE.FOLLOWING,
      stateTimer:     slotIdx * 1.5 + this._rand() * 2,
      targetPx:       sx,
      targetPy:       sz,
      chatPartner:    null,
      blockTimer:     0,
      idleCol:        0,
      idleRow:        0,

      // ── Transient visual hints (not serialized — rebuilt from state) ──
      showBanter:     false,
      banterTimer:    0,
      showQuip:       false,
      quipText:       '',
      quipTimer:      0,
      ranLastTurn:    false,
    };
  }

  // Adjust all positions when the centre chunk shifts (player crossed an edge).
  // dPx/dPy are the tile-space offsets applied to the player.
  onChunkTransition(dPx, dPy) {
    for (const f of this._followers) {
      f.px       += dPx;
      f.py       += dPy;
      f.targetPx += dPx;
      f.targetPy += dPy;
    }
  }

  // Call during turn mode instead of update() — keeps head-look alive without
  // running the real-time formation / wander / chat AI.
  updateIdleOnly(dt) {
    for (const f of this._followers) {
      this._tickHeadLook(dt, f);
      this._approachHead(dt, f);
    }
  }

  // Called by TurnController when it's this follower's turn to act.
  // Moves them exactly one tile toward their formation slot, respecting
  // tight / loose scale and tile passability.  No-op if already on the target tile.
  advanceOneTurnStep(followerIdx, playerPx, playerPz, hx, hz, grid) {
    const f = this._followers[followerIdx];
    if (!f) return;

    const slotScale = this._mode === FORMATION_MODE.TIGHT ? TIGHT_SLOT_SCALE : 1.0;
    const [slotX, slotZ] = this._slotPos(playerPx, playerPz, hx, hz, f.slot, slotScale);

    const tileX = Math.floor(f.px);
    const tileZ = Math.floor(f.py);
    const targetTileX = Math.floor(slotX);
    const targetTileZ = Math.floor(slotZ);

    if (tileX === targetTileX && tileZ === targetTileZ) return false; // already at slot

    const rawDx = targetTileX - tileX;
    const rawDz = targetTileZ - tileZ;
    const sx = rawDx === 0 ? 0 : (rawDx > 0 ? 1 : -1);
    const sz = rawDz === 0 ? 0 : (rawDz > 0 ? 1 : -1);

    const playerTileX = Math.floor(playerPx);
    const playerTileZ = Math.floor(playerPz);

    const canStep = (tx, tz) =>
      this._passable(tx, tz, grid) &&
      !(tx === playerTileX && tz === playerTileZ) &&
      !this._overlapsFollower(tx + 0.5, tz + 0.5, f, this._followers);

    // Prefer diagonal toward target, then cardinal fallbacks
    const candidates = [];
    if (sx !== 0 && sz !== 0) candidates.push([sx, sz]);
    if (sx !== 0)             candidates.push([sx, 0]);
    if (sz !== 0)             candidates.push([0,  sz]);

    const applyMove = (f, tx, tz, cx, cz) => {
      f.px = tx + 0.5; f.py = tz + 0.5;
      const len = Math.hypot(cx, cz);
      f.legAngle = Math.atan2(cx / len, cz / len);
      f.headingX = cx / len; f.headingZ = cz / len;
    };

    if (f.ranLastTurn) {
      // Momentum: must run 2 tiles again or stop — no 1-tile walk allowed
      for (const [cx, cz] of candidates) {
        const midX = tileX + cx,     midZ = tileZ + cz;
        const dstX = tileX + cx * 2, dstZ = tileZ + cz * 2;
        if (!canStep(midX, midZ) || !canStep(dstX, dstZ)) continue;
        applyMove(f, dstX, dstZ, cx, cz);
        f.ranLastTurn = true;
        return true;
      }
      // Path blocked — stop, momentum broken
      f.ranLastTurn = false;
      return false;
    }

    // No momentum: try run first, then 1-tile walk
    for (const [cx, cz] of candidates) {
      const midX = tileX + cx,     midZ = tileZ + cz;
      const dstX = tileX + cx * 2, dstZ = tileZ + cz * 2;
      if (!canStep(midX, midZ) || !canStep(dstX, dstZ)) continue;
      applyMove(f, dstX, dstZ, cx, cz);
      f.ranLastTurn = true;
      return true;
    }
    for (const [cx, cz] of candidates) {
      if (!canStep(tileX + cx, tileZ + cz)) continue;
      applyMove(f, tileX + cx, tileZ + cz, cx, cz);
      f.ranLastTurn = false;
      return true;
    }
    f.ranLastTurn = false;
    return false; // all candidates blocked
  }

  // Call every frame.  grid may be null during initial load.
  update(dt, player, grid) {
    if (!player || this._followers.length === 0) { this._lastPx = player?.px ?? null; this._lastPz = player?.py ?? null; return; }
    const px = player.px, pz = player.py;
    const hx = player.headingX, hz = player.headingZ;

    const playerMoving = this._lastPx !== null
      ? Math.hypot(px - this._lastPx, pz - this._lastPz) > 0.02
      : true;
    this._lastPx = px;
    this._lastPz = pz;

    if (playerMoving) {
      this._idleTime         = 0;
      this._idleScatterTimer = 0;
    } else {
      this._idleTime += dt;
    }

    // First stopped frame: initial scatter.
    if (!playerMoving && this._prevPlayerMoving && this._mode === FORMATION_MODE.LOOSE) {
      this._assignIdlePositions(hx, hz, 0);
      this._idleScatterTimer = 25 + this._rand() * 15; // first extended scatter in 25–40 s
    }

    // After 30 s idle: periodically re-scatter with growing range.
    if (!playerMoving && this._idleTime > 30 && this._mode === FORMATION_MODE.LOOSE) {
      this._idleScatterTimer -= dt;
      if (this._idleScatterTimer <= 0) {
        // Extra range grows by 1 tile per 10 s of idle beyond the 30 s threshold, capped at 12.
        const extraRange = Math.min(12, (this._idleTime - 30) / 10);
        this._assignIdlePositions(hx, hz, extraRange);
        this._idleScatterTimer = 20 + this._rand() * 15;
      }
    }

    this._prevPlayerMoving = playerMoving;

    for (const f of this._followers) {
      this._tick(dt, f, px, pz, hx, hz, grid, playerMoving);
    }
  }

  // Assign a fresh random idle scatter to every follower.
  // extraRange (tiles) is added to the base distance — grows during extended idle.
  _assignIdlePositions(hx, hz, extraRange = 0) {
    const n = this._followers.length;
    for (let i = 0; i < n; i++) {
      const f = this._followers[i];
      const baseAng = (i / n) * 2 * Math.PI;
      const jitter  = (this._rand() - 0.5) * Math.PI * 0.5;   // ±45°
      const ang     = baseAng + jitter;
      const dist    = 2.5 + this._rand() * 3.5 + extraRange;  // grows with idle time
      f.idleCol = Math.sin(ang) * dist;
      f.idleRow = -Math.cos(ang) * dist; // negative row = ahead of PC
    }
  }

  // ── Per-follower tick ───────────────────────────────────────────────────────

  _tick(dt, f, playerPx, playerPz, hx, hz, grid, playerMoving) {
    const extendedIdle = !playerMoving && this._idleTime > 30;
    const slotScale = this._mode === FORMATION_MODE.TIGHT ? TIGHT_SLOT_SCALE : 1.0;
    const useIdle   = this._mode === FORMATION_MODE.LOOSE && !playerMoving;
    const idleColRow = useIdle ? [f.idleCol, f.idleRow] : null;
    const [slotX, slotZ] = this._slotPos(playerPx, playerPz, hx, hz, f.slot, slotScale, idleColRow);
    const distToSlot = Math.hypot(f.px - slotX, f.py - slotZ);

    f.stateTimer = Math.max(0, f.stateTimer - dt);
    if (f.banterTimer > 0) {
      f.banterTimer -= dt;
      if (f.banterTimer <= 0) f.showBanter = false;
    }
    if (f.quipTimer > 0) {
      f.quipTimer -= dt;
      if (f.quipTimer <= 0) f.showQuip = false;
    }

    // ── Tight mode: just follow slot, but heads still look around ────────────
    if (this._mode === FORMATION_MODE.TIGHT) {
      f.state    = STATE.FOLLOWING;
      f.targetPx = slotX;
      f.targetPy = slotZ;
      this._steer(dt, f, grid, this._followers);
      f.torsoOffset = 0;
      this._tickHeadLook(dt, f);
      this._approachHead(dt, f);
      return;
    }

    // ── Loose mode state machine ──────────────────────────────────────────────
    switch (f.state) {

      case STATE.FOLLOWING:
        f.targetPx = slotX;
        f.targetPy = slotZ;
        if (f.stateTimer <= 0 && distToSlot < LOOSE_ORBIT_DIST) {
          const roll = this._rand();
          // During extended idle: higher wander chance, moderate chat chance.
          const wanderThresh = extendedIdle ? 0.55 : 0.30;
          const chatThresh   = extendedIdle ? 0.75 : 0.50;
          if (roll < wanderThresh) {
            // Try to wander to a nearby interesting tile (including ahead of player)
            const wt = this._pickWanderTarget(f, slotX, slotZ, playerPx, playerPz, hx, hz, grid);
            if (wt) {
              f.state      = STATE.WANDERING;
              f.targetPx   = wt.x;
              f.targetPy   = wt.z;
              f.stateTimer = 2.0 + this._rand() * 3.0; // loiter time
              f.showQuip   = true;
              f.quipText   = "What's that?";
              f.quipTimer  = 2.0;
            } else {
              f.stateTimer = 3.0 + this._rand() * 5.0;
            }
          } else if (roll < chatThresh) {
            // Try to find a chat partner — could be a follower or the PC
            const partner = this._pickChatPartner(f, playerPx, playerPz);
            if (partner) {
              f.state       = STATE.CHATTING;
              f.chatPartner = partner.id; // 'player' or 'follower_N'
              f.stateTimer  = 3.5 + this._rand() * 4.0;
              if (!partner.isPc) {
                // Only mirror state for follower-to-follower chat
                partner.state       = STATE.CHATTING;
                partner.chatPartner = f.id;
                partner.stateTimer  = f.stateTimer;
              }
            } else {
              f.stateTimer = 3.0 + this._rand() * 5.0;
            }
          } else {
            f.stateTimer = 3.0 + this._rand() * 6.0;
          }
        }
        // Force return if slot has drifted too far (relaxed during extended idle).
        if (distToSlot > LOOSE_ORBIT_DIST * (extendedIdle ? 6.0 : 2.5)) {
          f.state    = STATE.RETURNING;
          f.targetPx = slotX;
          f.targetPy = slotZ;
        }
        break;

      case STATE.WANDERING: {
        // If we've arrived at the wander target, idle until stateTimer expires
        const arrived = Math.hypot(f.px - f.targetPx, f.py - f.targetPy) < ARRIVE_DIST;
        if (arrived && f.stateTimer <= 0) {
          f.state      = STATE.RETURNING;
          f.targetPx   = slotX;
          f.targetPy   = slotZ;
          f.showQuip   = true;
          f.quipText   = 'Interesting.';
          f.quipTimer  = 2.0;
        }
        // Abort if slot pulled too far away (relaxed during extended idle).
        if (distToSlot > LOOSE_ORBIT_DIST * (extendedIdle ? 8.0 : 3.0)) {
          f.state    = STATE.RETURNING;
          f.targetPx = slotX;
          f.targetPy = slotZ;
        }
        break;
      }

      case STATE.CHATTING: {
        if (f.stateTimer <= 0) {
          // Chat finished — head back to slot
          f.state       = STATE.RETURNING;
          f.chatPartner = null;
          f.showBanter  = false;
          f.targetPx    = slotX;
          f.targetPy    = slotZ;
          break;
        }

        if (f.chatPartner === 'player') {
          // ── Chatting with the PC ──────────────────────────────────────────
          // Walk alongside the PC — offset perpendicular to their heading
          const len = Math.hypot(hx, hz);
          const fhx = len > 0.001 ? hx / len : 0;
          const fhz = len > 0.001 ? hz / len : 1;
          // Alternate sides based on slot index so two PC-chatters don't stack
          const side  = f.slot % 2 === 0 ? 1 : -1;
          const perpX = -fhz * side, perpZ = fhx * side;
          f.targetPx = playerPx + perpX * 1.4;
          f.targetPy = playerPz + perpZ * 1.4;
          // Show BANTER! when close to PC
          if (!f.showBanter && Math.hypot(f.px - playerPx, f.py - playerPz) < 2.2) {
            f.showBanter  = true;
            f.banterTimer = 2.2;
          }
        } else {
          // ── Chatting with another follower ────────────────────────────────
          const partner = this._followers.find(x => x.id === f.chatPartner);
          if (!partner || partner.chatPartner !== f.id) {
            // Partner wandered off or was removed
            f.state       = STATE.RETURNING;
            f.chatPartner = null;
            f.showBanter  = false;
            f.targetPx    = slotX;
            f.targetPy    = slotZ;
            break;
          }
          const pIdleColRow = useIdle ? [partner.idleCol, partner.idleRow] : null;
          const [pSlotX, pSlotZ] = this._slotPos(playerPx, playerPz, hx, hz, partner.slot, slotScale, pIdleColRow);
          const midX = (slotX + pSlotX) / 2;
          const midZ = (slotZ + pSlotZ) / 2;
          f.targetPx = slotX * 0.4 + midX * 0.6;
          f.targetPy = slotZ * 0.4 + midZ * 0.6;
          if (!f.showBanter && Math.hypot(f.px - partner.px, f.py - partner.py) < 2.5) {
            f.showBanter        = true;
            f.banterTimer       = 2.2;
            partner.showBanter  = true;
            partner.banterTimer = 2.2;
          }
        }
        break;
      }

      case STATE.RETURNING:
        f.targetPx = slotX;
        f.targetPy = slotZ;
        if (distToSlot < ARRIVE_DIST * 2) {
          f.state      = STATE.FOLLOWING;
          f.stateTimer = 2.0 + this._rand() * 3.0;
        }
        break;
    }

    // ── Speed multiplier ──────────────────────────────────────────────────────
    // Catch-up: ramp from 1× at 2 tiles behind slot to 1.8× at 8+ tiles behind.
    // Forward wander: extra boost when the wander target is ahead of the player.
    let speedMult = distToSlot > 2.0
      ? Math.min(1.8, 1.0 + (distToSlot - 2.0) / 7.5)
      : 1.0;
    if (f.state === STATE.WANDERING) {
      const dot = (f.targetPx - playerPx) * hx + (f.targetPy - playerPz) * hz;
      if (dot > 0) speedMult = Math.max(speedMult, 1.4);
    }

    this._steer(dt, f, grid, this._followers, speedMult);

    // Torso & head facing — chat overrides idle look, otherwise heads look around freely.
    if (f.state === STATE.CHATTING && f.chatPartner) {
      let tgtPx, tgtPz;
      if (f.chatPartner === 'player') {
        tgtPx = playerPx; tgtPz = playerPz;
      } else {
        const partner = this._followers.find(x => x.id === f.chatPartner);
        if (partner) { tgtPx = partner.px; tgtPz = partner.py; }
      }
      if (tgtPx !== undefined) {
        const dx = tgtPx - f.px, dz = tgtPz - f.py;
        if (Math.hypot(dx, dz) > 0.1) {
          const aim        = Math.atan2(dx, dz);
          f.torsoOffset    = clampOffset(aim - f.legAngle);
          const torsoAng   = f.legAngle + f.torsoOffset;
          f.headLookTarget = clampOffset(aim - torsoAng); // smooth head approach below
        }
      }
    } else {
      f.torsoOffset = 0;
      this._tickHeadLook(dt, f);
    }
    this._approachHead(dt, f);
  }

  // Advance the idle head-look timer and pick a new random target when it fires.
  _tickHeadLook(dt, f) {
    f.headLookTimer -= dt;
    if (f.headLookTimer <= 0) {
      const r = this._rand();
      if (r < 0.40) {
        f.headLookTarget = 0; // glance back to centre
      } else {
        const side = r < 0.70 ? -1 : 1;
        f.headLookTarget = side * (Math.PI / 8 + this._rand() * Math.PI / 8); // π/8–π/4
      }
      f.headLookTimer = 3 + this._rand() * 5; // 3–8 s between looks
    }
  }

  // Smoothly drive headOffset toward headLookTarget at ~1.2 rad/s.
  _approachHead(dt, f) {
    const diff = f.headLookTarget - f.headOffset;
    if (Math.abs(diff) < 0.001) { f.headOffset = f.headLookTarget; return; }
    f.headOffset += Math.sign(diff) * Math.min(Math.abs(diff), 1.2 * dt);
  }

  // ── Steering ────────────────────────────────────────────────────────────────

  // SEP_DIST   — minimum tile distance between followers before repulsion kicks in
  // BLOCK_TIMEOUT — seconds stuck before allowing a friendly push-through
  static get SEP_DIST()      { return 0.85; }
  static get BLOCK_TIMEOUT() { return 1.5;  }

  _steer(dt, f, grid, allFollowers, speedMult = 1.0) {
    const dx   = f.targetPx - f.px;
    const dz   = f.targetPy - f.py;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) { f.blockTimer = 0; return; }

    // Ease off speed when nearly at target to avoid jitter; scale by caller-supplied multiplier
    const speed = FOLLOWER_SPEED * speedMult * Math.min(1.0, dist / 1.5);
    const step  = speed * dt;

    // Separation: accumulate repulsion from nearby followers
    let sepX = 0, sepZ = 0;
    const SEP = FollowerManager.SEP_DIST;
    for (const other of allFollowers) {
      if (other === f) continue;
      const ox = f.px - other.px;
      const oz = f.py - other.py;
      const od = Math.hypot(ox, oz);
      if (od < SEP && od > 0.001) {
        const strength = (SEP - od) / SEP;
        sepX += (ox / od) * strength;
        sepZ += (oz / od) * strength;
      }
    }

    // Blend separation into the desired direction
    let mx = dx / dist + sepX;
    let mz = dz / dist + sepZ;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 0.001) { mx /= mlen; mz /= mlen; }
    else              { mx = dx / dist; mz = dz / dist; }

    const angle = Math.atan2(mz, mx);

    // Try direct path, then 45° and 90° deflections
    const attempts = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    for (const da of attempts) {
      const ax = Math.cos(angle + da) * step;
      const az = Math.sin(angle + da) * step;
      const nx = f.px + ax;
      const nz = f.py + az;
      if (this._passable(nx, nz, grid) && !this._overlapsFollower(nx, nz, f, allFollowers)) {
        f.px         = nx;
        f.py         = nz;
        f.headingX   = ax / step;
        f.headingZ   = az / step;
        f.legAngle   = Math.atan2(f.headingX, f.headingZ);
        f.blockTimer = 0;
        return;
      }
    }

    // All paths blocked — only push through after being stuck long enough
    f.blockTimer += dt;
    if (f.blockTimer >= FollowerManager.BLOCK_TIMEOUT) {
      f.px += (dx / dist) * step;
      f.py += (dz / dist) * step;
      f.blockTimer = 0;
    }
  }

  _overlapsFollower(nx, nz, self, allFollowers) {
    const SEP = FollowerManager.SEP_DIST * 0.75;
    for (const other of allFollowers) {
      if (other === self) continue;
      if (Math.hypot(nx - other.px, nz - other.py) < SEP) return true;
    }
    return false;
  }

  _passable(x, z, grid) {
    if (!grid) return true;
    const S = CHUNK_SIZE;
    if (x < 0 || x >= S || z < 0 || z >= S) return true;
    const i = Math.floor(z) * S + Math.floor(x);
    return !!grid.passable[i];
  }

  // ── Formation geometry ──────────────────────────────────────────────────────

  _slotPos(px, pz, hx, hz, slotIdx, scale = 1.0, colRowOverride = null) {
    // Normalise heading (default to facing south if no movement yet)
    const len = Math.hypot(hx, hz);
    const fhx = len > 0.001 ? hx / len : 0;
    const fhz = len > 0.001 ? hz / len : 1;
    // Behind = -forward;  right = rotate forward 90° CW in XZ
    const bx = -fhx,  bz = -fhz;
    const rx =  fhz,  rz = -fhx;

    const [col, row] = colRowOverride ?? FORMATION_SLOTS[slotIdx];
    return [
      px + bx * row * scale + rx * col * scale,
      pz + bz * row * scale + rz * col * scale,
    ];
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _pickWanderTarget(follower, slotX, slotZ, playerPx, playerPz, hx, hz, grid) {
    if (!grid) return null;
    const S   = CHUNK_SIZE;
    const r   = WANDER_RANGE;
    const best = [];

    const addZone = (cx, cz) => {
      for (let tz = Math.max(0, Math.floor(cz - r)); tz <= Math.min(S - 1, Math.floor(cz + r)); tz++) {
        for (let tx = Math.max(0, Math.floor(cx - r)); tx <= Math.min(S - 1, Math.floor(cx + r)); tx++) {
          if (!INTERESTING_OBS.has(grid.obstacle[tz * S + tx])) continue;
          // Target the adjacent passable tile closest to the follower, not the obstacle itself
          const adj = [
            { x: tx - 0.5, z: tz + 0.5 },
            { x: tx + 1.5, z: tz + 0.5 },
            { x: tx + 0.5, z: tz - 0.5 },
            { x: tx + 0.5, z: tz + 1.5 },
          ].filter(p => this._passable(p.x, p.z, grid));
          if (adj.length === 0) continue;
          adj.sort((a, b) =>
            Math.hypot(a.x - follower.px, a.z - follower.py) -
            Math.hypot(b.x - follower.px, b.z - follower.py)
          );
          best.push(adj[0]);
        }
      }
    };

    // Search around formation slot
    addZone(slotX, slotZ);
    // Also search ahead of the player so followers scout forward
    addZone(playerPx + hx * 8, playerPz + hz * 8);

    if (best.length === 0) return null;
    // Deduplicate by tile
    const seen = new Set();
    const unique = best.filter(p => {
      const k = `${Math.floor(p.x)},${Math.floor(p.z)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Sort by distance but strongly favour targets ahead of the player's heading.
    // A forward candidate (positive dot with heading) ranks as if it is 45 % closer.
    unique.sort((a, b) => {
      const dotA = (a.x - playerPx) * hx + (a.z - playerPz) * hz;
      const dotB = (b.x - playerPx) * hx + (b.z - playerPz) * hz;
      const dA = Math.hypot(a.x - follower.px, a.z - follower.py) * (dotA > 0 ? 0.55 : 1.0);
      const dB = Math.hypot(b.x - follower.px, b.z - follower.py) * (dotB > 0 ? 0.55 : 1.0);
      return dA - dB;
    });
    return unique[Math.floor(this._rand() * Math.min(5, unique.length))];
  }

  _pickChatPartner(requester, playerPx, playerPz) {
    // Chat is proximity-limited so wandering followers banter with whoever is nearby,
    // not with distant party members they'd have to sprint across the map to reach.
    const CHAT_RANGE = 5.0;

    // ~25% chance to chat with the PC if they are close
    if (this._rand() < 0.25 && Math.hypot(requester.px - playerPx, requester.py - playerPz) < CHAT_RANGE) {
      return { id: 'player', isPc: true };
    }
    const candidates = this._followers.filter(f =>
      f !== requester &&
      f.state === STATE.FOLLOWING &&
      Math.hypot(f.px - requester.px, f.py - requester.py) < CHAT_RANGE
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this._rand() * candidates.length)];
  }
}
