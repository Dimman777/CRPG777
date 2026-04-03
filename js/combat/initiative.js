import { rollStatDie } from './dice.js';

// Dynamic initiative queue. After each action the active combatant re-rolls
// initiative (with an optional cost penalty) and is re-inserted into the queue.
// The combatant with the highest value acts next.
export class InitiativeQueue {
  constructor(rng = null) {
    this._queue = []; // [{ combatant, value }], sorted descending
    this._rng   = rng;
  }

  // Roll initial initiative for all combatants using their reflexes stat.
  initialize(combatants) {
    this._queue = combatants.map(c => ({
      combatant: c,
      value: this._roll(c),
    }));
    this._sort();
  }

  // Returns the combatant whose turn it currently is, or null if empty.
  current() {
    return this._queue[0]?.combatant ?? null;
  }

  // Returns a snapshot of the queue order for display.
  getOrder() {
    return this._queue.map(e => ({ name: e.combatant.name, value: e.value }));
  }

  // Removes the active combatant, re-rolls their initiative with an action cost
  // penalty, then re-inserts them. Call this after each action.
  // actionCost: flat penalty subtracted from the re-rolled result (minimum 1).
  advance(actionCost = 0) {
    if (!this._queue.length) return;
    const entry = this._queue.shift();
    const newValue = Math.max(1, this._roll(entry.combatant) - actionCost);
    entry.value = newValue;
    entry.combatant.initiativeValue = newValue;
    this._queue.push(entry);
    this._sort();
  }

  // Remove a combatant entirely (e.g. on death).
  remove(combatant) {
    this._queue = this._queue.filter(e => e.combatant !== combatant);
  }

  // Count of active combatants in the queue.
  size() {
    return this._queue.length;
  }

  _roll(combatant) {
    const result = rollStatDie(combatant.getStat('reflexes'), this._rng);
    combatant.initiativeValue = result.total;
    return result.total;
  }

  _sort() {
    this._queue.sort((a, b) => b.value - a.value);
  }
}
