// stamina_config.js — runtime-mutable singleton for live-tuning stamina.
// Written by the StaminaDebug panel. Read by stamina_state and movement_costs.
// Design reference: Movement_Traversal_Stamina_Design.md §14–15.

export const staminaConfig = {
  // Per-action base costs (Cardio / Fatigue).
  // Walk/move: tiny fatigue per tile → "road-weary" over 640-1280 tiles.
  // Sprint: 2 tiles per action, no recovery → exhaustion in ~15 actions.
  costs: {
    rest:   { cardio: 0.0,  fatigue: 0.0  },
    move:   { cardio: 0.0,  fatigue: 0.04 },
    run:    { cardio: 1.5,  fatigue: 0.5  },
    sprint: { cardio: 4.0,  fatigue: 2.0  },
    stop:   { cardio: 0.5,  fatigue: 0.5  },
    crouch: { cardio: 0.5,  fatigue: 1.0  },
    crawl:  { cardio: 1.0,  fatigue: 2.0  },
    climb:  { cardio: 3.0,  fatigue: 3.0  },
  },

  // Recovery rates = stat × multiplier (units / second).
  //   cardioRate  = Fitness   × cardioRateMultiplier
  //   fatigueRate = Endurance × fatigueRateMultiplier
  cardioRateMultiplier:  0.03,
  fatigueRateMultiplier: 0.005,

  // Whether each resource recovers while in a given movement state.
  // Rest / Move → full recovery; Run / Sprint → none.
  recoveryAllowed: {
    rest:   { cardio: true,  fatigue: true  },
    move:   { cardio: true,  fatigue: true  },
    run:    { cardio: false, fatigue: false },
    sprint: { cardio: false, fatigue: false },
    stop:   { cardio: true,  fatigue: false }, // catching breath, muscles still working
    crouch: { cardio: true,  fatigue: false },
    crawl:  { cardio: false, fatigue: false },
    climb:  { cardio: false, fatigue: false },
  },
};
