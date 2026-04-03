import { rollStatDie } from './dice.js';

// Active opposition: attacker rolls attackStat vs defender rolls defenseStat.
// Returns { success, margin, attackRoll, defenseRoll }.
export function resolveVsTarget(attacker, defender, attackStat, defenseStat, rng = null) {
  const atkResult = rollStatDie(attacker.getStat(attackStat), rng);
  const defResult = rollStatDie(defender.getStat(defenseStat), rng);
  const margin = atkResult.total - defResult.total;
  return {
    success: margin > 0,
    margin,
    attackRoll:  atkResult.total,
    defenseRoll: defResult.total,
  };
}

// Passive DC check: combatant rolls stat against a fixed difficulty.
// Returns { success, margin, roll }.
export function resolveVsDC(combatant, stat, dc, rng = null) {
  const result = rollStatDie(combatant.getStat(stat), rng);
  const margin = result.total - dc;
  return {
    success: margin >= 0,
    margin,
    roll: result.total,
  };
}

// Convenience: resolve a basic melee attack (strength vs toughness).
// Returns the resolution result plus a calculated damage value.
export function resolveMeleeAttack(attacker, defender, rng = null) {
  const result = resolveVsTarget(attacker, defender, 'strength', 'toughness', rng);
  const damage = result.success ? 3 + Math.max(0, result.margin) : 0;
  return { ...result, damage };
}
