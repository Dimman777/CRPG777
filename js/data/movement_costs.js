// movement_costs.js — Cardio and Fatigue cost tables for movement actions and terrain.
// Design reference: Movement_Traversal_Stamina_Design.md §14–15.

import { GROUND }        from './micro_tile_data.js';
import { staminaConfig } from './stamina_config.js';

// Base cost per movement type.  Sprint covers 2 tiles per use.
export const MOVE_COST = Object.freeze({
  move:   { cardio: 1, fatigue: 0 },
  run:    { cardio: 2, fatigue: 1 },
  sprint: { cardio: 4, fatigue: 1 },  // one Sprint action = 2 tiles
  stop:   { cardio: 1, fatigue: 1 },
  crouch: { cardio: 1, fatigue: 2 },
  crawl:  { cardio: 2, fatigue: 3 },
});

// Additive per-tile terrain modifier, applied on top of the base move cost.
// Values from §15 of the design doc.
const _T = {
  [GROUND.DEEP_WATER]:    { cardio: 4, fatigue: 4 },  // not normally traversable
  [GROUND.SHALLOW_WATER]: { cardio: 1, fatigue: 1 },  // shin-deep resistance
  [GROUND.WET_SAND]:      { cardio: 1, fatigue: 2 },  // sand drag
  [GROUND.SAND]:          { cardio: 1, fatigue: 2 },
  [GROUND.DRY_EARTH]:     { cardio: 0, fatigue: 1 },  // loose dirt
  [GROUND.EARTH]:         { cardio: 0, fatigue: 0 },  // packed earth — baseline
  [GROUND.GRASS]:         { cardio: 0, fatigue: 0 },
  [GROUND.DRY_GRASS]:     { cardio: 0, fatigue: 0 },
  [GROUND.ROCKY_EARTH]:   { cardio: 1, fatigue: 2 },  // rubble / rough footing
  [GROUND.SCREE]:         { cardio: 1, fatigue: 2 },  // loose rock
  [GROUND.STONE]:         { cardio: 0, fatigue: 0 },  // stone floor — baseline
  [GROUND.SNOW]:          { cardio: 1, fatigue: 1 },
  [GROUND.MUD]:           { cardio: 1, fatigue: 1 },  // shallow mud
  [GROUND.PEAT]:          { cardio: 1, fatigue: 1 },
  [GROUND.RAPIDS]:        { cardio: 3, fatigue: 2 },  // waist-deep fast water
  [GROUND.COBBLESTONE]:   { cardio: 0, fatigue: 0 },  // urban road — baseline
  [GROUND.PACKED_EARTH]:  { cardio: 0, fatigue: 0 },  // dirt road — baseline
};

const ZERO = Object.freeze({ cardio: 0, fatigue: 0 });

export function getTerrainCost(groundType) {
  return _T[groundType] ?? ZERO;
}

// Live cost lookup — reads from the mutable staminaConfig so the StaminaDebug
// panel can adjust costs at runtime without restarting.
export function getMoveBaseCost(type) {
  return staminaConfig.costs[type] ?? ZERO;
}
