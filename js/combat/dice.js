import { randInt } from '../core/rng.js';
import { getStatDie } from '../data/stats_data.js';

// Roll a single die of the given number of sides.
export function rollDie(sides) {
  return randInt(1, sides);
}

// Roll count dice of sides, returning individual results.
export function rollPool(count, sides) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(rollDie(sides));
  return results;
}

// Roll count dice of sides and return the sum.
export function sumPool(count, sides) {
  return rollPool(count, sides).reduce((a, b) => a + b, 0);
}

// Roll the dice appropriate for a given stat value.
// Returns { rolls, total, exceptional }.
export function rollStatDie(statValue) {
  const { count, sides } = getStatDie(statValue);
  const rolls = rollPool(count, sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total, exceptional: count > 1 };
}
