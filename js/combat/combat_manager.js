import { Combatant } from './combatant.js';
import { InitiativeQueue } from './initiative.js';
import { resolveMeleeAttack } from './action_resolution.js';
import { GridState } from './grid_state.js';

const MELEE_RANGE   = 1;  // Chebyshev tiles
const ACTION_COST   = 2;  // initiative penalty per action
const MAX_ROUNDS    = 30; // safety limit

export class CombatManager {
  constructor(combatants, gridWidth = 10, gridHeight = 10) {
    this.combatants = combatants;
    this.grid = new GridState(gridWidth, gridHeight);
    this.initiative = new InitiativeQueue();
    this.round = 0;
    this._steps = 0;
    this.log = []; // action log strings
    this.winnerFactionId = null; // set when combat ends
  }

  setup() {
    const groupA = this.combatants.filter(c => c.factionId === 'a');
    const groupB = this.combatants.filter(c => c.factionId !== 'a');
    this._placeGroup(groupA, 1);
    this._placeGroup(groupB, this.grid.width - 2);
    this.initiative.initialize(this.combatants);
    this._log('--- Combat Start ---');
    this._logInitiative();
  }

  // ── Player action API ─────────────────────────────────────────────────────

  // Returns enemies the current actor can reach or see, with range info.
  getPlayerOptions() {
    const actor   = this.initiative.current();
    const enemies = this.combatants.filter(c => c.isAlive() && c.factionId !== actor.factionId);
    return enemies.map(e => {
      const dist = this.grid.getDistance(actor.id, e.id);
      return { combatant: e, dist, inRange: dist <= MELEE_RANGE };
    });
  }

  playerAttack(targetId) {
    const actor  = this.initiative.current();
    const target = this.combatants.find(c => c.id === targetId);
    if (!actor || !target) return this._checkEnd();
    const result = resolveMeleeAttack(actor, target);
    if (result.success) {
      target.takeDamage(result.damage);
      this._log(`${actor.name} hits ${target.name} for ${result.damage} dmg `+
        `(${result.attackRoll} vs ${result.defenseRoll}). `+
        `${target.name} HP: ${target.resources.hp.current}/${target.resources.hp.max}`);
      if (!target.isAlive()) {
        this._log(`${target.name} is defeated.`);
        this.initiative.remove(target);
      }
    } else {
      this._log(`${actor.name} misses ${target.name} (${result.attackRoll} vs ${result.defenseRoll}).`);
    }
    actor.useStamina(2);
    this.initiative.advance(ACTION_COST);
    return this._checkEnd();
  }

  playerMove(targetId) {
    const actor  = this.initiative.current();
    const target = this.combatants.find(c => c.id === targetId);
    if (!actor || !target) return this._checkEnd();
    const moved = this._stepToward(actor, target);
    this._log(`${actor.name} moves to (${moved.x}, ${moved.y}).`);
    this.initiative.advance(1);
    return this._checkEnd();
  }

  playerWait() {
    const actor = this.initiative.current();
    if (!actor) return this._checkEnd();
    this._log(`${actor.name} waits.`);
    this.initiative.advance(0);
    return this._checkEnd();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _placeGroup(combatants, x) {
    const startY = Math.floor((this.grid.height - combatants.length) / 2);
    combatants.forEach((c, i) => this.grid.place(c.id, x, startY + i));
  }

  // Process one action for the current combatant. Returns true if combat continues.
  step() {
    // Safety: if combat exceeds step limit, award win to faction with most HP remaining.
    if (++this._steps > MAX_ROUNDS * this.combatants.length) {
      const alive = this.combatants.filter(c => c.isAlive());
      const best  = alive.reduce((a, b) =>
        b.resources.hp.current > a.resources.hp.current ? b : a
      );
      this.winnerFactionId = best.factionId;
      this._log('--- Combat timed out. Winner by HP. ---');
      return false;
    }

    const actor = this.initiative.current();
    if (!actor || !actor.isAlive()) {
      this.initiative.remove(actor);
      return this._checkEnd();
    }

    const target = this._pickTarget(actor);
    if (!target) {
      this._log(`${actor.name} has no target.`);
      this.initiative.advance(0);
      return this._checkEnd();
    }

    const dist = this.grid.getDistance(actor.id, target.id);

    if (dist <= MELEE_RANGE) {
      // Attack
      const result = resolveMeleeAttack(actor, target);
      if (result.success) {
        target.takeDamage(result.damage);
        this._log(
          `${actor.name} hits ${target.name} for ${result.damage} dmg ` +
          `(${result.attackRoll} vs ${result.defenseRoll}). ` +
          `${target.name} HP: ${target.resources.hp.current}/${target.resources.hp.max}`
        );
        if (!target.isAlive()) {
          this._log(`${target.name} is defeated.`);
          this.initiative.remove(target);
        }
      } else {
        this._log(
          `${actor.name} misses ${target.name} ` +
          `(${result.attackRoll} vs ${result.defenseRoll}).`
        );
      }
      actor.useStamina(2);
      this.initiative.advance(ACTION_COST);
    } else {
      // Move toward target
      const moved = this._stepToward(actor, target);
      this._log(`${actor.name} moves to (${moved.x}, ${moved.y}).`);
      this.initiative.advance(1);
    }

    return this._checkEnd();
  }

  // Run the full encounter to completion.
  run() {
    this.setup();
    let ongoing = true;
    let actionCount = 0;
    while (ongoing && actionCount < MAX_ROUNDS * this.combatants.length) {
      ongoing = this.step();
      actionCount++;
    }
    return this.log;
  }

  _pickTarget(actor) {
    const enemies = this.combatants.filter(
      c => c.isAlive() && c.factionId !== actor.factionId
    );
    if (!enemies.length) return null;
    // Prefer the closest enemy
    return enemies.reduce((best, c) =>
      this.grid.getDistance(actor.id, c.id) < this.grid.getDistance(actor.id, best.id)
        ? c : best
    );
  }

  _stepToward(actor, target) {
    const from = this.grid.getPosition(actor.id);
    const to   = this.grid.getPosition(target.id);

    // Score all 8 neighbours by Chebyshev distance to target, pick closest open tile.
    const candidates = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = from.x + dx, ny = from.y + dy;
        if (nx < 0 || nx >= this.grid.width || ny < 0 || ny >= this.grid.height) continue;
        if (this.grid.isOccupied(nx, ny)) continue;
        const dist = Math.max(Math.abs(nx - to.x), Math.abs(ny - to.y));
        candidates.push({ x: nx, y: ny, dist });
      }
    }

    if (!candidates.length) return from;
    candidates.sort((a, b) => a.dist - b.dist);
    const next = candidates[0];
    this.grid.move(actor.id, next.x, next.y);
    return next;
  }

  _checkEnd() {
    const alive = this.combatants.filter(c => c.isAlive());
    const factions = new Set(alive.map(c => c.factionId));
    if (factions.size <= 1) {
      const winner = factions.size === 1 ? [...factions][0] : 'none';
      this.winnerFactionId = winner;
      this._log(`--- Combat Over. Winner: faction '${winner}' ---`);
      return false;
    }
    return true;
  }

  _logInitiative() {
    const order = this.initiative.getOrder()
      .map(e => `${e.name}(${e.value})`)
      .join(', ');
    this._log(`Initiative: ${order}`);
  }

  _log(msg) {
    this.log.push(msg);
  }
}

// Convenience: build and run a two-fighter test encounter, returning the log.
export function runTestEncounter() {
  const fighter1 = new Combatant({
    id: 'f1', name: 'Aldric', factionId: 'a',
    stats: { strength: 3, toughness: 2, reflexes: 3, coordination: 2 },
  });
  const fighter2 = new Combatant({
    id: 'f2', name: 'Brynn', factionId: 'b',
    stats: { strength: 2, toughness: 3, reflexes: 2, coordination: 3 },
  });

  const manager = new CombatManager([fighter1, fighter2]);
  return manager.run();
}
