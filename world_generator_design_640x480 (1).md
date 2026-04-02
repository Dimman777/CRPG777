# 640 x 480 Macro World Generator Design Doc

## Purpose

This document defines a procedural world generator for a large CRPG world using a **640 x 480 macro authority map** and **64 x 64 tile playable chunks**.

The goal is not literal geological simulation. The goal is **compressed plausibility**:

- continents, coasts, rivers, mountains, and biomes should look believable
- drainage should function consistently
- chunk seams should hold together cleanly
- travel between settlements should stay interesting
- the world should support high CRPG point-of-interest density without losing geographic coherence

The macro map is a **simulation and constraint layer**, not a final art layer.

---

## Core Principles

1. **Generate causes before appearances.**
   Landform structure comes before rivers. Rivers come before chunk realization. Visual curvature comes after hydrology is solved.

2. **Hydrology is authoritative.**
   Rivers are routed from macro elevation and rainfall, not painted by hand.

3. **Chunks obey the macro map.**
   Chunk generation is constrained synthesis, not free interpretation.

4. **Travel pacing matters as much as realism.**
   This is a CRPG world. Points of interest must be dense enough that travel does not become dead time.

5. **Density is route-based, not uniformly area-based.**
   Roads, rivers, passes, borders, and settlement spheres receive more content pressure than empty interiors.

---

## Scale Model

### Scale 1: Macro Authority Layer
**640 x 480 cells**

Each macro cell stores world simulation data:

- land/ocean state
- macro elevation
- rainfall/moisture
- slope and relief
- hydrology and drainage
- biome classification
- coast and water feature classes
- chunk generation contracts
- travel pressure and POI density pressure

Recommended interpretation:

- **1 macro cell = 1 chunk authority cell**
- each macro cell produces one 64 x 64 playable chunk

This yields a very large world, but it is compatible with chunk streaming and procedural realization.

### Scale 2: Chunk Layer
**64 x 64 tiles per chunk**

Each chunk realizes:

- local terrain form
- riverbeds and banks
- coastlines and lake shores
- roads and paths
- settlements
- POIs and landmarks
- gameplay geometry

### Scale 3: Tile / Local Gameplay Layer
Handles moment-to-moment traversal, objects, props, encounters, and gameplay simulation.

---

## Macro Cell Data Schema

```text
MacroCell
- is_land: bool
- water_type: enum {none, ocean, coast, lake, marsh, river}
- macro_elevation: int or float
- relief_strength: int
- slope_dir: dir8 or vector2
- rainfall: int
- temperature: int
- biome_region: biome id
- terrain_region: enum {plain, hill, mountain, plateau, basin, coast, wetland, forest, desert, etc}
- ocean_distance: int
- downstream_dir: dir8 or none
- flow_accumulation: int or float
- watershed_id: int
- river_id: optional int
- river_class: enum {none, creek, stream, river, major_river}
- river_surface_z: optional int or float
- lake_id: optional int
- coast_type: enum {none, beach, rocky, cliff, marsh, delta, sheltered_bay}
- travel_pressure: int
- poi_pressure: int
- danger_pressure: int
- settlement_influence: int
- edge_contracts: ChunkEdgeContract[4]
```

---

## Chunk Contract Schema

```text
ChunkContract
- macro_x
- macro_y
- base_elevation_range
- slope_vector
- terrain_class
- biome_envelope
- relief_budget
- danger_class
- settlement_influence
- travel_pressure
- poi_budget
- boundary_height_profiles[4]
- boundary_water_contracts[]
- boundary_road_contracts[]
- local_feature_tags[]
```

### Edge Contract

```text
ChunkEdgeContract
- side: enum {N,E,S,W}
- edge_profile_type: enum {flat, rising, falling, ridge, valley, coast, riverbank, cliff, marsh}
- min_height
- max_height
- river_crossing: optional RiverCrossingContract
- coast_crossing: optional CoastCrossingContract
- road_crossing: optional RoadCrossingContract
```

### River Crossing Contract

```text
RiverCrossingContract
- river_id
- side
- edge_offset
- width_class
- surface_z
- flow_dir: enum {entering, exiting}
- river_class
```

### Coast Crossing Contract

```text
CoastCrossingContract
- side
- start_offset
- end_offset
- coast_type
- sea_level_z
```

### Road Crossing Contract

```text
RoadCrossingContract
- road_id
- side
- edge_offset
- road_class: enum {trail, minor_road, major_road, paved_road}
```

---

## Generation Pipeline Overview

1. Macro landmass generation
2. Structural region generation
3. Macro elevation generation
4. Temperature and rainfall generation
5. Hydrology generation
6. Water body and coast classification
7. Settlement and route generation
8. POI density allocation
9. Chunk contract export
10. Chunk realization
11. Validation and repair passes

---

## Phase 1: Macro Landmass Generation

### Goals

Produce believable continent shapes rather than thresholded noise blobs.

### Inputs

- world seed
- world style preset
- ocean coverage target
- continent count target
- coastline roughness target

### Method

Use shaped generation rather than raw noise thresholding.

Recommended components:

- continent nuclei / seed regions
- directional expansion fields
- ocean incision fields
- low-frequency distortion noise
- topology cleanup pass

### Desired Results

- broad continents and peninsulas
- bays and inland seas
- limited accidental spaghetti coasts
- optional archipelago regions where intended

### Coastline Topology Cleanup Rules

- remove isolated single-cell spikes unless protected by feature tags
- eliminate diagonal water leaks that break apparent coast continuity
- preserve intentional narrow straits
- identify coast cells as land cells adjacent to ocean
- keep coast classification one macro cell thick logically

---

## Phase 2: Structural Region Generation

### Purpose

Impose broad pseudo-geological logic so the world has recognizable landform causes.

### Structural Regions

- mountain belts
- uplands
- plateaus
- low plains
- basins
- coastal plains
- old eroded interiors
- marsh basins

### Notes

This does not need full tectonic simulation. It needs believable structural fingerprints.

### World Style Bias Examples

- **Continental**: long mountain chains, broad plains, few inland seas
- **Archipelago**: broken shelves, short rivers, steep terrain
- **Frontier**: one major core region and rougher peripheral regions
- **Inland Sea**: major basin, many tributary rivers, multiple coasts focused on enclosed water

---

## Phase 3: Macro Elevation Generation

### Purpose

Create a drainage-driving height field.

### Inputs

- landmask
- structural regions
- coastal falloff
- basin masks
- regional noise

### Rules

- mountains and uplands provide primary relief
- basins and coastal plains lower terrain
- elevation should be broad and smooth enough to support coherent drainage
- avoid excessive high-frequency noise here

### Output

- macro_elevation
- relief_strength
- slope_dir

---

## Phase 4: Temperature and Rainfall Generation

### Purpose

Support biome placement and non-uniform river density.

### Temperature Inputs

- latitude
- elevation
- optional maritime moderation

### Rainfall Inputs

- ocean distance
- prevailing wind direction
- mountain rain shadow
- large basin moisture retention
- latitude bands if desired

### Rules

- windward mountain sides tend wetter
- leeward rain shadows reduce rainfall
- coastal regions generally wetter than deep interiors
- not all slopes should generate equal river density

### Output

- rainfall
- temperature
- preliminary biome region tags

---

## Phase 5: Hydrology Generation

This is the most important systems layer.

### 5.1 Depression Policy

Before routing rivers, accidental sinks must be resolved.

Allowed outcomes:

- preserved large natural basins become lakes
- very low gradient regions may become marshes or wetlands
- small accidental pits should be filled or breached

Recommended mixed policy:

- keep deliberate major basins
- breach tiny accidental traps
- permit broad marsh only in very flat zones

### 5.2 Flow Direction

Each land macro cell gets exactly one downstream neighbor.

Rules:

- choose among 8 neighbors
- prefer valid downhill descent
- use tie-breakers based on strongest descent and directional continuity
- never allow cycles
- equal-height spill only in allowed lake/marsh cases

### 5.3 Flow Accumulation

For each cell:

- add local rainfall contribution
- add all upstream contributions

This produces drainage volume and river thresholds.

### 5.4 Watersheds

Assign watershed IDs across the world.

Use watersheds for:

- debugging
- regional identity
- settlement logic
- river naming logic later

### 5.5 River Classification

Threshold accumulation into classes:

- none
- creek
- stream
- river
- major river

Not every drainage path should become a visible major watercourse.

### 5.6 River Surface Elevation

Store explicit water surface elevation for river and lake cells.

Rules:

- downstream river surface must be <= upstream
- usually strictly lower
- nearly-flat progression allowed only in lakes, marshes, broad deltas, or backwaters

This value is authoritative for chunk-level riverbed generation.

---

## Phase 6: Water Body and Coast Classification

### Coast Types

- beach
- rocky
- cliff
- marsh coast
- delta coast
- sheltered bay

### Inland Water Types

- lake shore
- marsh edge
- riverbank
- braided floodplain
- seasonal drainage corridor

### Purpose

Water and coast class drive chunk realization templates and POI opportunities.

---

## Phase 7: Settlement Generation

### Major Settlement Types

- capital
- city
- major port
- fortress town
- trade hub
- monastery complex
- major mining settlement

### Minor Settlement Types

- town
- village
- hamlet
- fishing settlement
- mill cluster
- border post settlement
- isolated monastery
- waystation hamlet

### Placement Factors

- river adjacency
- harbor quality
- fertile land
- crossroads
- mountain pass control
- borders and chokepoints
- resource proximity
- coastline shelter

### Satellite Logic

Settlements should generate local support sites.

#### Village satellites

- fields
- shrine
- mill
- nearby watch post
- one nearby risk site or old ruin

#### Town satellites

- farms
- bridge or ferry
- inn
- cemetery
- local ruin
- manor / guild hall / guard post

#### City satellites

- outer villages
- roads
- quarries
- docks
- military posts
- villas
- temples
- nearby ruins absorbed into its orbit

---

## Phase 8: Travel Network Generation

### Purpose

Build likely player travel corridors and world movement logic.

### Network Types

- major roads
- minor roads
- trails
- passes
- ferries
- bridges
- river travel corridors
- coast-hugging routes

### Inputs

- settlements
- terrain slope
- rivers and crossings
- passes
- faction borders
- hazard zones

### Notes

The route network is a content spine. It is not only for movement. It is a primary driver of POI placement density.

---

## Phase 9: POI Density and Travel Pacing

A large CRPG world must compress interest density compared with realistic geography.

### Core Rule

The player should not experience long stretches of travel with no decisions, discoveries, landmarks, or route punctuation.

### POI Placement Must Be Weighted By

- roads and route corridors
- river corridors
- settlement influence
- mountain pass chokepoints
- borders and conflict zones
- biome uniqueness
- historical ruin pressure
- danger zones

### POI Class System

The generator uses six POI classes.

#### Class 1: Major Hubs

Examples:

- capitals
- cities
- major ports
- fortress towns
- major temple complexes
- large mines and depots

Purpose:

- anchor regions
- provide services and political identity
- create major travel destinations

#### Class 2: Minor Settlements

Examples:

- villages
- hamlets
- monasteries
- fishing ports
- waystations
- border settlements

Purpose:

- keep regions inhabited
- shorten travel dead zones
- support world believability

#### Class 3: Travel Nodes

Examples:

- inns
- ferries
- bridges
- toll gates
- crossroads shrines
- patrol towers
- caravanserai
- pass forts

Purpose:

- punctuate routes
- provide resupply, choices, and structure
- support emergent encounters

#### Class 4: Adventure Sites

Examples:

- ruins
- caves
- towers
- barrows
- lairs
- abandoned estates
- battlefield remnants
- hidden shrines
- smugglers' coves

Purpose:

- support quests, exploration, combat, treasure, and story hooks

#### Class 5: Micro-POIs / Lightweight Landmarks

Examples:

- memorial stones
- old camps
- wells
- wrecks
- abandoned carts
- tiny caves
- signal fires
- grave markers
- herb groves

Purpose:

- make travel feel dense without requiring heavy production cost
- provide visual punctuation and low-weight interaction

#### Class 6: Unique Biome Chunks

Examples:

- a striking red marsh pocket in an otherwise green lowland
- a giant wind-carved stone garden
- a patch of ghost-white trees
- an unusual fungal grove
- sulfur flats
- crystal-like salt pans
- flower meadows in a harsh pass
- black volcanic glass shore
- twisted cypress sinkland
- oddly luminous bog

Purpose:

- create memorable visual variety
- provide special-looking chunks that are interesting in themselves
- reward exploration with atmosphere, contrast, and sense of place
- avoid forcing every unusual area to carry a dungeon, quest, or major reward

Rules:

- a unique biome chunk is visually and spatially distinctive
- it may have minor resources, ambient encounters, or lore dressing, but it is **not required** to contain a major gameplay site
- these should be rare enough to remain special, but common enough to break monotony on long routes and in wilderness bands
- unique biome chunks should be biased to biome boundaries, unusual geology, wetness anomalies, volcanic influence, sink basins, salt edges, or sheltered microclimates

### Landmark vs Full Site Distinction

Not every content beat should be a full dungeon or settlement.

The world must mix:

- heavyweight authored or semi-authored sites
- medium route sites
- lightweight landmarks
- visually unique chunks

This is critical for production viability.

### Route-Based Density

Density should be highest along:

- major roads
- settlement corridors
- rivers with crossings
- passes
- border regions
- coasts near ports

Density should be lower but still meaningful in:

- frontier wilderness
- mountains
- swamps
- cursed or ancient dead zones

### Regional Density Profiles

#### Heartland

- many settlements
- dense roads
- many class 3 and class 5 POIs
- moderate class 4 density
- occasional unique biome chunk for contrast

#### Frontier

- mixed settlement density
- stronger fort, ruin, lair, and pass density
- more contested travel nodes
- more unique biome chunks marking rough terrain transitions

#### Wilderness

- lower total density
- stronger landmarks
- higher ratio of class 4 and class 6 sites
- fewer but more memorable travel beats

#### Ancient / Cursed Zone

- low normal settlement density
- high ruin density
- strong atmosphere
- many unusual visual chunks
- travel interest maintained through danger and weirdness rather than ordinary habitation

### Travel Pacing Validator

A route validator should inspect likely player paths and flag dead stretches.

Measure:

- distance between meaningful choices
- distance between visible landmarks
- distance between service/safety nodes
- distance between optional detours

If a route is too empty, add one of:

- a travel node
- a micro-landmark
- a small danger/event node
- a unique biome chunk
- a side-track curiosity

A unique biome chunk is especially useful here because it improves the feel of a route without demanding a full authored site.

---

## Phase 10: Chunk Contract Export

Each macro cell exports a chunk contract.

The chunk contract should carry enough information that local generation cannot violate macro logic.

### Required Outputs

- terrain class
- biome envelope
- slope and relief budget
- edge height tendencies
- river entry/exit contracts
- coast/lake edge contracts
- road crossings
- settlement influence
- POI budget and feature tags
- special tags for unique biome chunks if applicable

### Unique Biome Chunk Contract Tags

Suggested tags:

```text
UniqueBiomeTag
- family: enum {stone_garden, white_forest, sulfur_flat, fungal_grove, salt_pan, flower_meadow, black_shore, sinkland, luminous_bog, etc}
- rarity_tier
- dominant_visual_motif
- terrain_modifier
- vegetation_modifier
- fog_or_atmosphere_modifier
- ambient_life_modifier
- optional_minor_resource
- optional_minor_lore_marker
```

These tags are enough to make the chunk look distinct without requiring special systemic logic.

---

## Phase 11: Chunk Realization

Chunks are generated from contracts, not from freeform local noise.

### Chunk Generation Order

1. read chunk contract and neighbor edge contracts
2. lock terrain edge conditions
3. generate water skeletons first if present
4. generate road/path skeletons
5. generate terrain major forms
6. realize settlement/POI templates
7. apply biome and vegetation layers
8. apply unique biome modifiers if tagged
9. place props and local detail
10. validate seams and local flow

### River Generation Rules

For river chunks:

1. lock entry and exit positions from edge contracts
2. lock entry and exit surface elevations
3. generate river centerline inside chunk
4. generate monotonic riverbed profile
5. shape banks and floodplain around fixed riverbed
6. blend outer terrain into edge constraints

Rules:

- no self-intersection
- no upstream rise in river surface
- local meander depends on slope and river class
- chunk terrain must not create a ridge across an authoritative river path

### Coast Generation Rules

For coast chunks:

- shoreline orientation comes from macro coast class and neighboring coast cells
- coast type controls local form: cliff, marsh, beach, rocky, delta
- macro coast remains logically one-cell thick, but chunk realization provides detailed shore shape

### Unique Biome Chunk Realization Rules

A unique biome chunk should:

- read as visually unusual at a glance
- remain traversable and coherent with neighboring chunks
- not demand unique quest or dungeon content to justify itself
- usually contain 1-3 special visual motifs rather than many unrelated oddities
- preserve the broader terrain logic of the surrounding region while introducing local contrast

Examples:

- white-barked deadwood patch in normal forest region
- black volcanic sand shore inside a coastal belt
- red reed marsh inside larger green wetland region
- heavy flower meadow crossing a mountain saddle
- sulfur-yellow flats beside a geothermal spring basin

---

## Validation Rules

### Macro Validation

- every river reaches ocean, lake, or intentional sink
- no cycles in downstream graph
- no river cell drains uphill
- lake outlets are valid unless closed-basin-tagged
- coastline has no invalid diagonal leak artifacts
- major roads connect intended settlements unless blocked intentionally
- POI density along key routes stays within pacing limits

### Chunk Validation

- edge heights agree with neighbors within tolerance
- river crossing positions and elevations match neighboring chunks
- riverbeds remain monotonic downstream
- coast continuity holds across chunk seams
- road crossings match neighbor contracts
- unique biome chunk modifiers do not break traversal or edge blending

### Travel Pacing Validation

For major settlement-to-settlement routes, validate:

- no excessive dead-distance between interest beats
- no excessive dead-distance without visible landmarking
- enough service nodes in safer regions
- enough striking atmosphere or danger in sparse regions

---

## Debug Views

### Macro Debug Overlays

- land/ocean mask
- macro elevation
- slope arrows
- rainfall map
- flow direction arrows
- flow accumulation heatmap
- watershed IDs
- river class overlay
- river surface elevation map
- coast type overlay
- settlement influence
- travel pressure
- poi pressure
- unique biome chunk candidates
- validation error overlay

### Chunk Debug Overlays

- edge contracts
- river crossings
- road crossings
- riverbed elevation samples
- coast line masks
- local slope map
- POI template anchors
- unique biome modifiers
- seam mismatch warnings

---

## Suggested World Style Presets

### Continental Realm

- 2 to 4 major landmasses
- long mountain chains
- large river valleys
- strong heartland/frontier contrast

### Inland Sea Realm

- one major inland sea
- many tributary civilizations
- heavy river and port density

### Broken Frontier

- one organized core region
- fragmented outer lands
- more passes, ruins, and rough borderlands

### Archipelago Realm

- many islands and peninsulas
- short rivers
- heavy coast and harbor play

### Old Wounded Realm

- scarred ancient terrain
- many dead zones and ruins
- more unique biome chunk use
- lower settlement continuity, higher atmospheric density

---

## Practical Design Rules

1. The macro map is not art. It is world logic.
2. Rivers are solved from drainage, then stylized.
3. Chunks must obey macro hydrology and edge contracts.
4. Roads and rivers are content spines.
5. Large CRPG worlds need compressed density.
6. Use lightweight landmarks and unique biome chunks to avoid travel deadness without exploding production cost.
7. Unique biome chunks should be memorable, but not overloaded with systems.
8. Validate both physical logic and travel pacing.

---

## Recommended Next Design Docs

This document defines the world generator structure. Follow-up docs should cover:

1. **Settlement Template Library**
   - capitals, towns, villages, ports, border forts

2. **Road and Route Generation Rules**
   - path cost model, bridge/ferry logic, pass logic

3. **POI Family and State Library**
   - site families, ruined/occupied/cursed states, placement weights

4. **Unique Biome Chunk Library**
   - biome anomaly families, visual rules, rarity, transition logic

5. **Chunk Terrain Realization Rules**
   - terrain stamps, rivers, coasts, cliffs, wetlands

6. **Travel Pacing Validator Spec**
   - route scoring, boredom thresholds, insertion rules

