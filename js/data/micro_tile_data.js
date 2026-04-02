// Tile type data for the 64×64 micro-chunk system.
// Pure constants — no behavior. Mirrors the pattern of terrain_data.js.

// ----------------------------------------------------------------
// Terrain elevation rank — drives slope direction and macro gradient
// ----------------------------------------------------------------
export const TERRAIN_RANK = Object.freeze({
  ocean:          0,
  shallow_shore:  1,
  steep_shore:    1,
  flat:           2,
  hills:          3,
  mountain:       4,
  steep_mountain: 5,
  peak:           6,
});

// ----------------------------------------------------------------
// Ground tile IDs — visual category of the floor surface
// ----------------------------------------------------------------
export const GROUND = Object.freeze({
  DEEP_WATER:    0,
  SHALLOW_WATER: 1,
  WET_SAND:      2,
  SAND:          3,
  DRY_EARTH:     4,
  EARTH:         5,
  GRASS:         6,
  DRY_GRASS:     7,
  ROCKY_EARTH:   8,
  SCREE:         9,
  STONE:         10,
  SNOW:          11,
  MUD:           12,
  PEAT:          13,
  RAPIDS:        14,
  COBBLESTONE:   15,  // urban paving — cities, market squares
  PACKED_EARTH:  16,  // dirt roads, village paths
});

// Preview colour per ground type (used by MacroMapView chunk canvas)
export const GROUND_COLOR = [
  '#182444', // DEEP_WATER
  '#3a5c6a', // SHALLOW_WATER
  '#c8b88a', // WET_SAND
  '#d4c090', // SAND
  '#8a6a3a', // DRY_EARTH
  '#6a5030', // EARTH
  '#4a7a3a', // GRASS
  '#9a9040', // DRY_GRASS
  '#7a6a50', // ROCKY_EARTH
  '#908880', // SCREE
  '#888080', // STONE
  '#e8e4e0', // SNOW
  '#4a4030', // MUD
  '#3a4828', // PEAT
  '#6ab0cc', // RAPIDS (fast water, foamy)
  '#7a7060', // COBBLESTONE
  '#7a5a3c', // PACKED_EARTH
];

// ----------------------------------------------------------------
// Obstacle IDs — what sits on top of the ground tile
// ----------------------------------------------------------------
export const OBSTACLE = Object.freeze({
  NONE:           0,
  PEBBLE:         1,  // cosmetic, fully passable
  SMALL_ROCK:     2,  // passable
  LARGE_ROCK:     3,  // impassable
  BOULDER:        4,  // impassable
  DEAD_SHRUB:     5,  // passable
  SHRUB:          6,  // passable
  DENSE_SHRUB:    7,  // passable, movement cost
  TREE:           8,  // impassable
  DENSE_TREE:     9,  // impassable
  DEAD_TREE:      10, // impassable
  CACTUS:         11, // impassable
  REED:           12, // passable
  TALL_GRASS:     13, // passable, concealment
  SPRING:         14, // river source marker, passable
  BOULDER_CLUSTER:15, // impassable; placed as 2×2 stamp
  ROCK_OUTCROP:   16, // impassable; placed as 2×2 stamp
});

// 1 = blocks movement
export const OBSTACLE_BLOCKS = new Uint8Array([
  0, 0, 0, 1, 1,  // NONE PEBBLE SMALL_ROCK LARGE_ROCK BOULDER
  0, 0, 0, 1, 1,  // DEAD_SHRUB SHRUB DENSE_SHRUB TREE DENSE_TREE
  1, 1, 0, 0, 0,  // DEAD_TREE CACTUS REED TALL_GRASS SPRING
  1, 1,           // BOULDER_CLUSTER ROCK_OUTCROP
]);

// Debug preview dot colour per obstacle (null = don't draw)
export const OBSTACLE_COLOR = [
  null,      '#998877', '#776655', '#554433', '#332211',
  '#887744', '#448833', '#336622', '#225511', '#113300',
  '#775522', '#cccc00', '#336688', '#558844', '#55bbdd',
  '#664422', '#887766', // BOULDER_CLUSTER, ROCK_OUTCROP
];

// ----------------------------------------------------------------
// Biome ground palettes:  BIOME_GROUND[terrain][moisture]
// Returns array of { g: GROUND.*, w: number } (weight)
// Use getGroundPalette() to safely look up with fallback.
// ----------------------------------------------------------------
const gp = (...args) => {
  const out = [];
  for (let i = 0; i < args.length; i += 2) out.push({ g: args[i], w: args[i+1] });
  return out;
};

const {
  DEEP_WATER, SHALLOW_WATER, WET_SAND, SAND, DRY_EARTH, EARTH,
  GRASS, DRY_GRASS, ROCKY_EARTH, SCREE, STONE, SNOW, MUD, PEAT,
} = GROUND;

export const BIOME_GROUND = {
  ocean: {
    _: gp(DEEP_WATER, 85, SHALLOW_WATER, 15),
  },
  shallow_shore: {
    desert:    gp(WET_SAND,60, SAND,30, SHALLOW_WATER,10),
    arid:      gp(WET_SAND,50, SAND,40, SHALLOW_WATER,10),
    dry:       gp(WET_SAND,45, EARTH,35, SHALLOW_WATER,20),
    temperate: gp(WET_SAND,35, EARTH,30, MUD,20, SHALLOW_WATER,15),
    wet:       gp(MUD,45, SHALLOW_WATER,30, PEAT,15, WET_SAND,10),
    _:         gp(WET_SAND,50, SHALLOW_WATER,30, SAND,20),
  },
  steep_shore: {
    _: gp(STONE,65, ROCKY_EARTH,25, SCREE,10),
  },
  flat: {
    desert:    gp(SAND,55, DRY_EARTH,30, ROCKY_EARTH,15),
    arid:      gp(DRY_EARTH,45, SAND,25, DRY_GRASS,20, ROCKY_EARTH,10),
    dry:       gp(DRY_GRASS,40, EARTH,35, DRY_EARTH,15, ROCKY_EARTH,10),
    temperate: gp(GRASS,50, EARTH,25, ROCKY_EARTH,15, MUD,10),
    wet:       gp(PEAT,35, MUD,30, GRASS,25, SHALLOW_WATER,10),
    _:         gp(GRASS,55, EARTH,30, ROCKY_EARTH,15),
  },
  hills: {
    desert:    gp(DRY_EARTH,45, ROCKY_EARTH,35, SAND,20),
    arid:      gp(DRY_EARTH,40, ROCKY_EARTH,35, DRY_GRASS,25),
    dry:       gp(ROCKY_EARTH,38, DRY_GRASS,32, EARTH,20, STONE,10),
    temperate: gp(GRASS,38, ROCKY_EARTH,30, EARTH,22, STONE,10),
    wet:       gp(PEAT,32, GRASS,30, ROCKY_EARTH,22, MUD,16),
    _:         gp(ROCKY_EARTH,45, GRASS,30, EARTH,25),
  },
  mountain: {
    desert:    gp(ROCKY_EARTH,40, SCREE,38, STONE,22),
    arid:      gp(SCREE,42, ROCKY_EARTH,35, STONE,23),
    dry:       gp(SCREE,42, STONE,36, ROCKY_EARTH,22),
    temperate: gp(SCREE,38, STONE,34, ROCKY_EARTH,18, GRASS,10),
    wet:       gp(SCREE,34, STONE,30, ROCKY_EARTH,22, MUD,14),
    _:         gp(SCREE,45, STONE,35, ROCKY_EARTH,20),
  },
  steep_mountain: {
    _: gp(STONE,55, SCREE,30, SNOW,15),
  },
  peak: {
    _: gp(SNOW,70, STONE,20, SCREE,10),
  },
};

export function getGroundPalette(terrain, moisture) {
  const t = BIOME_GROUND[terrain];
  if (!t) return BIOME_GROUND.flat._;
  return t[moisture] ?? t._ ?? BIOME_GROUND.flat._;
}

// ----------------------------------------------------------------
// Biome obstacle rules:  BIOME_OBSTACLE[terrain][moisture][vegetation]
// Returns { density: 0-1, obstacles: OBSTACLE.*[] }
// Use getObstacleRule() to safely look up.
// ----------------------------------------------------------------
const op = (density, obstacles) => ({ density, obstacles });

const {
  NONE, PEBBLE, SMALL_ROCK, LARGE_ROCK, BOULDER,
  DEAD_SHRUB, SHRUB, DENSE_SHRUB, TREE, DENSE_TREE,
  DEAD_TREE, CACTUS, REED, TALL_GRASS,
} = OBSTACLE;

const noObs = op(0, []);

export const BIOME_OBSTACLE = {
  ocean:          { _: { none: noObs, light: noObs, dense: noObs } },
  shallow_shore: {
    _: {
      none:  op(0.03, [SMALL_ROCK, REED]),
      light: op(0.07, [REED, TALL_GRASS, SMALL_ROCK]),
      dense: op(0.12, [REED, TALL_GRASS, DENSE_SHRUB]),
    },
  },
  steep_shore: {
    _: {
      none:  op(0.14, [LARGE_ROCK, BOULDER]),
      light: op(0.14, [LARGE_ROCK, BOULDER]),
      dense: op(0.14, [LARGE_ROCK, BOULDER]),
    },
  },
  flat: {
    desert: {
      none:  op(0.04, [PEBBLE, SMALL_ROCK]),
      light: op(0.08, [CACTUS, DEAD_SHRUB, SMALL_ROCK]),
      dense: op(0.13, [CACTUS, SHRUB, DEAD_SHRUB]),
    },
    arid: {
      none:  op(0.04, [PEBBLE, SMALL_ROCK]),
      light: op(0.09, [DEAD_SHRUB, SHRUB, SMALL_ROCK]),
      dense: op(0.15, [SHRUB, DENSE_SHRUB, DEAD_SHRUB]),
    },
    dry: {
      none:  op(0.04, [SMALL_ROCK, DEAD_SHRUB]),
      light: op(0.12, [SHRUB, TALL_GRASS, SMALL_ROCK]),
      dense: op(0.20, [TREE, DENSE_SHRUB, SHRUB]),
    },
    temperate: {
      none:  op(0.03, [PEBBLE, SMALL_ROCK]),
      light: op(0.13, [TREE, SHRUB, TALL_GRASS]),
      dense: op(0.30, [DENSE_TREE, TREE, DENSE_SHRUB]),
    },
    wet: {
      none:  op(0.08, [REED, SMALL_ROCK]),
      light: op(0.18, [REED, TALL_GRASS, SHRUB]),
      dense: op(0.34, [DENSE_TREE, REED, TALL_GRASS]),
    },
  },
  hills: {
    desert: {
      none:  op(0.10, [PEBBLE, SMALL_ROCK, LARGE_ROCK]),
      light: op(0.13, [DEAD_SHRUB, SMALL_ROCK, LARGE_ROCK]),
      dense: op(0.17, [SHRUB, DEAD_SHRUB, SMALL_ROCK]),
    },
    arid: {
      none:  op(0.11, [SMALL_ROCK, LARGE_ROCK]),
      light: op(0.15, [SHRUB, SMALL_ROCK, DEAD_SHRUB]),
      dense: op(0.20, [DENSE_SHRUB, SHRUB, SMALL_ROCK]),
    },
    dry: {
      none:  op(0.12, [SMALL_ROCK, LARGE_ROCK]),
      light: op(0.16, [SHRUB, SMALL_ROCK, TREE]),
      dense: op(0.24, [TREE, SHRUB, DENSE_SHRUB]),
    },
    temperate: {
      none:  op(0.10, [SMALL_ROCK, LARGE_ROCK]),
      light: op(0.17, [TREE, SHRUB, SMALL_ROCK]),
      dense: op(0.28, [DENSE_TREE, TREE, LARGE_ROCK]),
    },
    wet: {
      none:  op(0.13, [LARGE_ROCK, SMALL_ROCK, REED]),
      light: op(0.20, [TREE, REED, TALL_GRASS]),
      dense: op(0.30, [DENSE_TREE, TREE, REED]),
    },
  },
  mountain: {
    desert: {
      none:  op(0.15, [LARGE_ROCK, BOULDER, SMALL_ROCK]),
      light: op(0.17, [LARGE_ROCK, DEAD_SHRUB, SMALL_ROCK]),
      dense: op(0.19, [LARGE_ROCK, DEAD_SHRUB, DEAD_TREE]),
    },
    arid: {
      none:  op(0.15, [LARGE_ROCK, BOULDER]),
      light: op(0.17, [LARGE_ROCK, DEAD_SHRUB]),
      dense: op(0.19, [LARGE_ROCK, DEAD_TREE, DEAD_SHRUB]),
    },
    dry: {
      none:  op(0.15, [LARGE_ROCK, BOULDER]),
      light: op(0.17, [LARGE_ROCK, DEAD_TREE, SHRUB]),
      dense: op(0.21, [LARGE_ROCK, DEAD_TREE, TREE]),
    },
    temperate: {
      none:  op(0.15, [LARGE_ROCK, BOULDER]),
      light: op(0.18, [LARGE_ROCK, TREE, SHRUB]),
      dense: op(0.23, [LARGE_ROCK, TREE, DEAD_TREE]),
    },
    wet: {
      none:  op(0.16, [LARGE_ROCK, BOULDER, SMALL_ROCK]),
      light: op(0.19, [LARGE_ROCK, TREE, SHRUB]),
      dense: op(0.25, [LARGE_ROCK, DENSE_TREE, TREE]),
    },
  },
  steep_mountain: {
    _: {
      none:  op(0.22, [BOULDER, LARGE_ROCK]),
      light: op(0.22, [BOULDER, LARGE_ROCK]),
      dense: op(0.22, [BOULDER, LARGE_ROCK]),
    },
  },
  peak: {
    _: {
      none:  op(0.18, [BOULDER, LARGE_ROCK]),
      light: op(0.18, [BOULDER, LARGE_ROCK]),
      dense: op(0.18, [BOULDER, LARGE_ROCK]),
    },
  },
};

export function getObstacleRule(terrain, moisture, vegetation) {
  const t = BIOME_OBSTACLE[terrain];
  if (!t) return noObs;
  const m = t[moisture] ?? t._;
  if (!m) return noObs;
  return m[vegetation] ?? m.none ?? noObs;
}

// ----------------------------------------------------------------
// 2×2 stamp rules — terrain types that can spawn Boulder Clusters
// and Rock Outcrops as large geological features.
// density = probability per candidate even-origin tile pair.
// ----------------------------------------------------------------
export const BIOME_STAMP2X2 = Object.freeze({
  steep_shore:    { density: 0.04, obstacles: [OBSTACLE.BOULDER_CLUSTER, OBSTACLE.ROCK_OUTCROP] },
  hills:          { density: 0.015, obstacles: [OBSTACLE.ROCK_OUTCROP] },
  mountain:       { density: 0.12, obstacles: [OBSTACLE.BOULDER_CLUSTER, OBSTACLE.ROCK_OUTCROP] },
  steep_mountain: { density: 0.20, obstacles: [OBSTACLE.BOULDER_CLUSTER, OBSTACLE.ROCK_OUTCROP] },
  peak:           { density: 0.18, obstacles: [OBSTACLE.BOULDER_CLUSTER] },
});

export function getStampRule(terrain) {
  return BIOME_STAMP2X2[terrain] ?? null;
}
