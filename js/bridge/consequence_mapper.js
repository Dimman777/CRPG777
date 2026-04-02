// Maps consequence type strings to their effect functions.
// This is the authoritative registry — adding a new consequence type means
// adding one entry here, nowhere else.

export const CONSEQUENCE_DEFS = {
  leader_rallied: {
    desc: 'Leader rallied the troops.',
    applyToMacro(payload, macroGame) {
      const f = macroGame.factions.get(payload.factionId);
      if (!f) return;
      f.resources.treasury -= 10;
    },
  },
  hope_spread: {
    desc: 'Hopeful news spread through the settlement.',
    applyToMacro(payload, macroGame) {
      macroGame.regions.get(payload.regionId)?.clamp('unrest', -5);
    },
  },
  combat_victory: {
    desc: 'Combat victory stabilises the region.',
    applyToMacro(payload, macroGame) {
      const r = macroGame.regions.get(payload.regionId);
      r?.clamp('security', +8);
      r?.clamp('unrest',   -12);
    },
  },
  combat_defeat: {
    desc: 'Combat defeat destabilises the region.',
    applyToMacro(payload, macroGame) {
      const r = macroGame.regions.get(payload.regionId);
      r?.clamp('unrest',   +15);
      r?.clamp('security', -5);
    },
  },
};

// Apply a consequence record to the appropriate layer(s).
export function applyConsequence(consequence, macroGame) {
  const def = CONSEQUENCE_DEFS[consequence.type];
  if (!def) return;
  if (consequence.targetLayer === 'macro' || consequence.targetLayer === 'both') {
    def.applyToMacro?.(consequence.payload, macroGame);
  }
}
