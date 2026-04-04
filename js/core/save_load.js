// save_load.js — serialise and deserialise game state to/from localStorage.
//
// Contract:
//   save(game)        → writes JSON to localStorage, returns the snapshot
//   load()            → reads JSON from localStorage, returns snapshot or null
//   hasSave()         → true if a save exists
//   deleteSave()      → removes the save
//
// Only call save() when game.state === GameState.EXPLORATION.
// Load triggers a full game restart via game.restart(snapshot) — no in-place patching.

const SAVE_KEY    = 'crpg777_save';
const SAVE_VERSION = '1';

// ── Serialise ─────────────────────────────────────────────────────────────────

export function save(game) {
  const snapshot = _buildSnapshot(game);
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw);
    if (snapshot.version !== SAVE_VERSION) {
      console.warn('[SaveLoad] Save version mismatch — ignoring.');
      return null;
    }
    return snapshot;
  } catch (e) {
    console.warn('[SaveLoad] Corrupt save data — ignoring.', e);
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

function _buildSnapshot(game) {
  const player    = game.microWorld?.player;
  const macroGame = game.macroGame;
  const followerMgr = game._followerMgrRef; // exposed via game.followerMgrRef getter

  const snapshot = {
    version:      SAVE_VERSION,
    savedAt:      Date.now(),

    // World generation
    seed:         game.sharedWorld?.seed      ?? 42,
    numFaults:    game.sharedWorld?.numFaults ?? 0,

    // Player — macro cell from microWorld, exact tile pos from player state
    playerCharId: game.playerCharId,
    playerPos: {
      mx: game.microWorld?._mx ?? 0,
      my: game.microWorld?._my ?? 0,
      px: player?.px ?? 32.5,
      py: player?.py ?? 32.5,
    },

    // RNG — the critical determinism anchor
    rngState: game.rngState,

    // Macro simulation
    macro: {
      day: macroGame.day,
      factions: _serialiseFactions(macroGame),
      leaders:  _serialiseLeaders(macroGame),
      regions:  _serialiseRegions(macroGame),
    },

    // Party
    followers: {
      mode:      followerMgr?.mode ?? 'loose',
      activeIds: followerMgr?.followers.map(f => f.charId) ?? [],
    },
  };

  return snapshot;
}

function _serialiseFactions(macroGame) {
  const out = {};
  for (const [id, f] of macroGame.factions) {
    out[id] = {
      resources:   { ...f.resources },
      territories: [...f.territories],
      projects:    [...(f.projects ?? [])],
    };
  }
  return out;
}

function _serialiseLeaders(macroGame) {
  const out = {};
  for (const [id, l] of macroGame.leaders) {
    out[id] = {
      alive:       l.alive,
      socialState: JSON.parse(JSON.stringify(l.socialState ?? {})),
    };
  }
  return out;
}

function _serialiseRegions(macroGame) {
  const out = {};
  for (const [id, r] of macroGame.regions) {
    out[id] = {
      ownerFactionId:   r.ownerFactionId,
      security:         r.security,
      prosperity:       r.prosperity,
      unrest:           r.unrest,
      foodSupply:       r.foodSupply,
      arcanePressure:   r.arcanePressure,
      militaryPresence: r.militaryPresence,
    };
  }
  return out;
}
