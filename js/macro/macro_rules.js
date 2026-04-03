// Pure rule functions — no state, no side effects.
// All functions take entities as input and return change descriptors or values.

// Daily income a faction earns from one region.
export function calcRegionIncome(region) {
  return {
    treasury: Math.floor(region.prosperity    / 20), // 0–5 / day
    food:     Math.floor(region.foodSupply    / 25), // 0–4 / day
    manpower: region.militaryPresence > 50 ? 1 : 0,
  };
}

// Natural daily pressure drift for a region (no faction intervention).
// Returns a map of { key: delta } to apply via region.clamp().
export function calcRegionDrift(region) {
  const d = {};

  // High unrest erodes security
  if (region.unrest > 60)    d.security   = (d.security   ?? 0) - 1;

  // Strong security slowly calms unrest
  if (region.security > 70)  d.unrest     = (d.unrest     ?? 0) - 1;

  // Hunger breeds unrest
  if (region.foodSupply < 30)  d.unrest   = (d.unrest     ?? 0) + 2;
  else if (region.foodSupply > 70) d.unrest = (d.unrest   ?? 0) - 1;

  // Prosperity drifts toward 50 without investment
  if (region.prosperity > 55)  d.prosperity = (d.prosperity ?? 0) - 1;
  else if (region.prosperity < 45) d.prosperity = (d.prosperity ?? 0) + 1;

  return d;
}

// Leader picks one action for the day based on faction/region state.
// Returns an action descriptor { type, regionId, cost }.
export function pickLeaderAction(leader, faction, allRegions) {
  const territory = allRegions.filter(r => faction.territories.includes(r.id));
  if (!territory.length) return { type: 'idle' };

  const { treasury } = faction.resources;

  // Priority 1 — quell dangerous unrest
  const unstable = territory.find(r => r.unrest > 60);
  if (unstable && treasury >= 10)
    return { type: 'stabilize', regionId: unstable.id, cost: { treasury: 10 } };

  // Priority 2 — relieve food shortage
  const hungry = territory.find(r => r.foodSupply < 40);
  if (hungry && treasury >= 15)
    return { type: 'provision', regionId: hungry.id, cost: { treasury: 15 } };

  // Priority 3 — develop a region if funds allow
  // Aggressive leaders invest more readily (lower threshold to act)
  const developCost = 15;
  const threshold   = 20 - leader.macroProfile.aggression;
  if (treasury >= Math.max(developCost, threshold))
    return { type: 'develop', regionId: territory[0].id, cost: { treasury: developCost } };

  return { type: 'idle' };
}

// Apply an action to a faction and target region (mutates both).
export function applyAction(action, faction, region) {
  if (!action || action.type === 'idle') return;

  // Deduct resource costs
  for (const [res, amount] of Object.entries(action.cost ?? {})) {
    faction.resources[res] = Math.max(0, (faction.resources[res] ?? 0) - amount);
  }

  switch (action.type) {
    case 'stabilize':
      region?.clamp('unrest',    -15);
      region?.clamp('security',  +10);
      break;
    case 'provision':
      region?.clamp('foodSupply', +20);
      break;
    case 'develop':
      region?.clamp('prosperity', +5);
      break;
  }
}
