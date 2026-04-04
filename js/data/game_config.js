// game_config.js — game design constants and balance tuning knobs.
// These are the values Dimman adjusts to tune feel and balance.
// No behaviour lives here — only named constants.

// ── Macro simulation ──────────────────────────────────────────────────────────

/** How often the macro daily tick fires (ms). */
export const MACRO_INTERVAL = 2000;

/** Starting manpower per faction. */
export const START_MANPOWER = 8;

// ── Combat ────────────────────────────────────────────────────────────────────

/** Maximum fighters each side can commit to a single encounter. */
export const MAX_COMMITMENT = 5;

/** Tactical combat grid dimensions (tiles). */
export const GRID_W = 10;
export const GRID_H = 10;

/** How often the combat tick fires (ms). Affects pace of NPC turns. */
export const COMBAT_INTERVAL = 700;

/** Base HP for every combatant. */
export const COMBATANT_HP = 20;

/** Base stamina for every combatant. */
export const COMBATANT_STAMINA = 10;

/** Base damage on a successful melee hit (margin adds on top). */
export const MELEE_BASE_DAMAGE = 3;

// ── Player / faction identifiers ─────────────────────────────────────────────
// These wire the player into the faction and combat systems.
// Change with care — IDs must match roster and region data.

export const PLAYER_FACTION      = 'a';
export const PLAYER_COMBATANT_ID = 'a0';
export const COMBAT_REGION       = 'r1';
