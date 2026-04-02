// Translates macro region state into world conditions that the micro layer reads.
// Each condition has a tag, a test against the region, stat deltas for each side,
// and a human-readable description for logging.

const WORLD_CONDITIONS = [
  {
    tag:    'high_unrest',
    test:   r => r.unrest > 60,
    enemy:  { strength: +1 },
    player: {},
    desc:   'High unrest — enemies are desperate and more dangerous (+1 STR)',
  },
  {
    tag:    'low_security',
    test:   r => r.security < 40,
    enemy:  { toughness: +1 },
    player: {},
    desc:   'Low security — hardened criminals operate freely (+1 TGH)',
  },
  {
    tag:    'prosperous',
    test:   r => r.prosperity > 65,
    enemy:  {},
    player: { endurance: +1 },
    desc:   'Prosperous region — player is well-supplied (+1 END)',
  },
  {
    tag:    'famine',
    test:   r => r.foodSupply < 30,
    enemy:  {},
    player: { strength: -1 },
    desc:   'Famine — player is weakened by hunger (-1 STR)',
  },
];

// Returns the subset of WORLD_CONDITIONS active for this region.
export function getWorldConditions(region) {
  return WORLD_CONDITIONS.filter(c => c.test(region));
}

// Mutate combatant stats according to active conditions.
export function applyWorldConditions(conditions, playerCombatants, enemyCombatants) {
  for (const cond of conditions) {
    _applyDeltas(cond.player, playerCombatants);
    _applyDeltas(cond.enemy,  enemyCombatants);
  }
}

function _applyDeltas(deltas, combatants) {
  for (const c of combatants) {
    for (const [stat, delta] of Object.entries(deltas)) {
      c.stats[stat] = Math.max(1, (c.stats[stat] ?? 1) + delta);
    }
  }
}
