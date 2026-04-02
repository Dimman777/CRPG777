import { calcRegionIncome, calcRegionDrift, pickLeaderAction, applyAction } from './macro_rules.js';

export class MacroGame {
  constructor(factions, leaders, regions) {
    // Accept arrays, store as Maps for O(1) lookup
    this.factions = new Map(factions.map(f => [f.id, f]));
    this.leaders  = new Map(leaders.map(l => [l.id,  l]));
    this.regions  = new Map(regions.map(r => [r.id,  r]));
    this.day      = 1;
    this.log      = [];
  }

  // Advance one day. Returns an array of consequence records for the bridge layer.
  advanceDay() {
    this._processRegions();
    this._processFactions();
    const consequences = this._buildConsequences();
    this.day++;
    return consequences;
  }

  // ── Accessors for display ──────────────────────────────────────────────────

  get factionList() { return [...this.factions.values()]; }
  get leaderList()  { return [...this.leaders.values()];  }
  get regionList()  { return [...this.regions.values()];  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _processRegions() {
    for (const region of this.regions.values()) {
      const drift = calcRegionDrift(region);
      for (const [key, delta] of Object.entries(drift)) {
        region.clamp(key, delta);
      }
    }
  }

  _processFactions() {
    for (const faction of this.factions.values()) {
      // Collect income from each territory
      for (const regionId of faction.territories) {
        const region = this.regions.get(regionId);
        if (!region) continue;
        const income = calcRegionIncome(region);
        for (const [res, amount] of Object.entries(income)) {
          faction.resources[res] = (faction.resources[res] ?? 0) + amount;
        }
      }

      // Leader acts once per day
      const leader = this.leaders.get(faction.leaderId);
      if (!leader?.alive) continue;

      const action       = pickLeaderAction(leader, faction, this.regionList);
      const targetRegion = action.regionId ? this.regions.get(action.regionId) : null;
      applyAction(action, faction, targetRegion);

      if (action.type !== 'idle') {
        this._log(
          `[Day ${this.day}] ${leader.name} → ${action.type}` +
          (targetRegion ? ` in ${targetRegion.name}` : '')
        );
      }
    }
  }

  // Structured consequence records — consumed by the bridge layer in Phase 5.
  _buildConsequences() {
    return this.regionList.map(r => ({
      type:           'region_update',
      sourceLayer:    'macro',
      regionId:       r.id,
      security:       r.security,
      unrest:         r.unrest,
      prosperity:     r.prosperity,
      foodSupply:     r.foodSupply,
      arcanePressure: r.arcanePressure,
    }));
  }

  _log(msg) {
    this.log.push(msg);
  }
}
