import { getStatDie } from '../data/stats_data.js';

// Roll a single die of the given number of sides.
// rng is required — all dice rolls must be deterministic.
export function rollDie(sides, rng) {
  return rng.nextInt(1, sides);
}

// Roll count dice of sides, returning individual results.
export function rollPool(count, sides, rng) {
  const results = [];
  for (let i = 0; i < count; i++) results.push(rollDie(sides, rng));
  return results;
}

// Roll count dice of sides and return the sum.
export function sumPool(count, sides, rng) {
  return rollPool(count, sides, rng).reduce((a, b) => a + b, 0);
}

// Roll the dice appropriate for a given stat value.
// Returns { rolls, total, exceptional }.
export function rollStatDie(statValue, rng) {
  const { count, sides } = getStatDie(statValue);
  const rolls = rollPool(count, sides, rng);
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total, exceptional: count > 1 };
}
