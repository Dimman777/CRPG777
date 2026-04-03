import { RNG, randInt } from '../core/rng.js';
import { getStatDie } from '../data/stats_data.js';

// Roll a single die of the given number of sides.
// If an RNG instance is passed, uses it; otherwise falls back to the
// legacy module-level randInt (non-deterministic).
export function rollDie(sides, rng = null) {
  return rng ? rng.nextInt(1, sides) : randInt(1, sides);
}

// Roll count dice of sides, returning individual results.
export function rollPool(count, sides, rng = null) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(rollDie(sides, rng));
  return results;
}

// Roll count dice of sides and return the sum.
export function sumPool(count, sides, rng = null) {
  return rollPool(count, sides, rng).reduce((a, b) => a + b, 0);
}

// Roll the dice appropriate for a given stat value.
// Returns { rolls, total, exceptional }.
export function rollStatDie(statValue, rng = null) {
  const { count, sides } = getStatDie(statValue);
  const rolls = rollPool(count, sides, rng);
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total, exceptional: count > 1 };
}
