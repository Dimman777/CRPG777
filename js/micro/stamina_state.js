// StaminaState — physical exertion model shared by all characters.
// Tracks Cardio (breathlessness) and Fatigue (muscle strain) as independent resources.
//
// Attach one StaminaState to every entity: player, followers, NPCs, monsters.
// Design reference: Movement_Traversal_Stamina_Design.md §3, §5, §14.

import { staminaConfig } from '../data/stamina_config.js';

export const MOVEMENT_STATE = Object.freeze({
  REST:   'rest',   // standing still / waiting — maximum recovery
  MOVE:   'move',
  RUN:    'run',
  SPRINT: 'sprint',
  CROUCH: 'crouch',
  STOP:   'stop',   // transitional — arresting sprint momentum
});

export class StaminaState {
  constructor(maxCardio = 60, maxFatigue = 60) {
    this.maxCardio     = maxCardio;
    this.maxFatigue    = maxFatigue;
    this.cardio        = maxCardio;   // full = fresh, 0 = gasping
    this.fatigue       = maxFatigue;  // full = fresh, 0 = burned out
    this.movementState = MOVEMENT_STATE.MOVE;
    this._cardioRate   = 1;
    this._fatigueRate  = 0.5;
    // Stored stats for re-deriving rates when config multipliers change.
    this._statFitness   = null;
    this._statEndurance = null;
    this._dirty        = true;        // signals stamina_bars.js to redraw
  }

  /**
   * Configure max pools and recovery rates from a character's stat block.
   * Formulas match the derivation table in characters_data.js:
   *   maxCardio  = Fitness + Endurance + floor(Build / 2)
   *   maxFatigue = Strength + Endurance + floor(Fitness / 2)
   *   cardioRate  = Fitness   × staminaConfig.cardioRateMultiplier
   *   fatigueRate = Endurance × staminaConfig.fatigueRateMultiplier
   */
  setFromStats(stats) {
    if (!stats) return;
    const g = k => stats[k] ?? stats[k.toLowerCase()] ?? 10;
    this.maxCardio      = g('Fitness')  + g('Endurance') + Math.floor(g('Build')    / 2);
    this.maxFatigue     = g('Strength') + g('Endurance') + Math.floor(g('Fitness')  / 2);
    this._statFitness   = g('Fitness');
    this._statEndurance = g('Endurance');
    this._cardioRate    = this._statFitness   * staminaConfig.cardioRateMultiplier;
    this._fatigueRate   = this._statEndurance * staminaConfig.fatigueRateMultiplier;
    // Reset to full when stats are applied (character is initially fresh).
    this.cardio  = this.maxCardio;
    this.fatigue = this.maxFatigue;
    this._dirty  = true;
  }

  /**
   * Re-derive recovery rates from stored stat values + current config multipliers.
   * Call this after editing staminaConfig.cardioRateMultiplier or fatigueRateMultiplier
   * (e.g. from the StaminaDebug panel).
   */
  updateRates() {
    if (this._statFitness == null) return;
    this._cardioRate  = this._statFitness   * staminaConfig.cardioRateMultiplier;
    this._fatigueRate = this._statEndurance * staminaConfig.fatigueRateMultiplier;
    this._dirty = true;
  }

  // Subtract exertion cost from a movement action (clamped to 0).
  applyMoveCost(cardio, fatigue) {
    this.cardio  = Math.max(0, this.cardio  - cardio);
    this.fatigue = Math.max(0, this.fatigue - fatigue);
    this._dirty  = true;
  }

  /**
   * Restore both resources toward their maximum at stat-driven rates.
   * Recovery is gated by staminaConfig.recoveryAllowed for the given state.
   *
   * @param {number} dt             - Elapsed seconds.
   * @param {string} [movementState] - Override state; defaults to this.movementState.
   */
  recoverRealtime(dt, movementState) {
    const state   = movementState ?? this.movementState;
    const allowed = staminaConfig.recoveryAllowed[state] ?? { cardio: true, fatigue: true };
    let changed = false;
    if (allowed.cardio && this.cardio < this.maxCardio) {
      this.cardio = Math.min(this.maxCardio, this.cardio + this._cardioRate * dt);
      changed = true;
    }
    if (allowed.fatigue && this.fatigue < this.maxFatigue) {
      this.fatigue = Math.min(this.maxFatigue, this.fatigue + this._fatigueRate * dt);
      changed = true;
    }
    if (changed) this._dirty = true;
  }

  setMovementState(state) {
    if (this.movementState !== state) {
      this.movementState = state;
      this._dirty = true;
    }
  }

  get isSprinting()  { return this.movementState === MOVEMENT_STATE.SPRINT; }
  // 1.0 = full / fresh, 0.0 = empty / exhausted
  get cardioFrac()   { return this.maxCardio  > 0 ? this.cardio  / this.maxCardio  : 1; }
  get fatigueFrac()  { return this.maxFatigue > 0 ? this.fatigue / this.maxFatigue : 1; }

  toJSON() {
    return {
      cardio: this.cardio, fatigue: this.fatigue,
      maxCardio: this.maxCardio, maxFatigue: this.maxFatigue,
      movementState: this.movementState,
    };
  }

  fromJSON(data) {
    this.cardio        = data.cardio        ?? this.maxCardio;
    this.fatigue       = data.fatigue       ?? this.maxFatigue;
    this.maxCardio     = data.maxCardio     ?? this.maxCardio;
    this.maxFatigue    = data.maxFatigue    ?? this.maxFatigue;
    this.movementState = data.movementState ?? MOVEMENT_STATE.MOVE;
    this._dirty = true;
  }
}
