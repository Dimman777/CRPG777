// Packages micro-layer outcomes as structured consequence records.
// The macro layer consumes these at sync time — micro never mutates macro directly.

let _seq = 0;

// Build a consequence record from a combat result.
// playerFactionId is used to determine victory vs defeat framing.
export function buildCombatConsequence(winnerFactionId, playerFactionId, regionId, day) {
  const victory = winnerFactionId === playerFactionId;
  return {
    id:          `combat_${regionId}_d${day}_${++_seq}`,
    type:        victory ? 'combat_victory' : 'combat_defeat',
    sourceLayer: 'micro',
    targetLayer: 'macro',
    payload:     { regionId, winnerFactionId },
    timestamp:   day,
  };
}

// Build a consequence record from a dialogue outcome.
export function buildDialogueConsequence(type, payload, day) {
  return {
    id:          `dlg_${type}_d${day}_${++_seq}`,
    type,
    sourceLayer: 'micro',
    targetLayer: 'macro',
    payload,
    timestamp:   day,
  };
}
