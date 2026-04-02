// Terrain types: physical land form only. Vegetation is a separate overlay.
export const TERRAIN = Object.freeze({
  OCEAN:          'ocean',
  SHALLOW_SHORE:  'shallow_shore',  // beach, tidal flat
  STEEP_SHORE:    'steep_shore',    // coastal cliffs — impassable from sea
  FLAT:           'flat',
  HILLS:          'hills',
  MOUNTAIN:       'mountain',
  STEEP_MOUNTAIN: 'steep_mountain',
  PEAK:           'peak',
});

// Moisture zone: drives vegetation character, not density
export const MOISTURE_ZONE = Object.freeze({
  DESERT:    'desert',
  ARID:      'arid',
  DRY:       'dry',
  TEMPERATE: 'temperate',
  WET:       'wet',
});

// Vegetation density: amount of plant cover on the terrain
export const VEGETATION = Object.freeze({
  NONE:  'none',
  LIGHT: 'light',
  DENSE: 'dense',
});

export const TERRAIN_PROPS = Object.freeze({
  ocean:          { passable: false, moveCost: null,  label: 'Ocean',          colorHex: 0x1a3464 },
  shallow_shore:  { passable: true,  moveCost: 1.5,   label: 'Shallow Shore',  colorHex: 0x4a7c8a },
  steep_shore:    { passable: false, moveCost: null,   label: 'Cliffs',         colorHex: 0x3a4a50 },
  flat:           { passable: true,  moveCost: 1.0,   label: 'Flat Lands',     colorHex: 0x6a8a4a },
  hills:          { passable: true,  moveCost: 1.5,   label: 'Hills',          colorHex: 0x8a7a5a },
  mountain:       { passable: true,  moveCost: 3.0,   label: 'Mountain',       colorHex: 0x9a9080 },
  steep_mountain: { passable: false, moveCost: null,   label: 'Steep Mountain', colorHex: 0x706860 },
  peak:           { passable: false, moveCost: null,   label: 'Peak',           colorHex: 0xe8e0d0 },
});

// Human-readable biome label from the three-layer combination
export function describeBiome(terrain, moistureZone, vegetation) {
  if (terrain === 'ocean')          return 'Ocean';
  if (terrain === 'shallow_shore')  return 'Coast';
  if (terrain === 'steep_shore')    return 'Cliffs';
  if (terrain === 'peak')           return 'Summit';
  if (terrain === 'steep_mountain') return 'Alpine Crags';

  const desc = {
    none: {
      desert:    'Barren Dunes',
      arid:      'Dust Flats',
      dry:       'Bare Rock',
      temperate: 'Open Ground',
      wet:       'Boggy Waste',
    },
    light: {
      desert:    'Sparse Desert',
      arid:      'Scrub Plains',
      dry:       'Dry Grassland',
      temperate: 'Meadow',
      wet:       'Marsh',
    },
    dense: {
      desert:    'Scrubland',
      arid:      'Chaparral',
      dry:       'Dry Woodland',
      temperate: 'Forest',
      wet:       'Rainforest',
    },
  };

  const base   = desc[vegetation]?.[moistureZone] ?? terrain;
  const prefix = terrain === 'hills'    ? 'Hilly '
               : terrain === 'mountain' ? 'Mountain '
               : '';
  return prefix + base;
}
