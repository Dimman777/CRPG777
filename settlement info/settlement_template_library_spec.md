# Settlement Template Library Spec
## For Chunk-Based Physicalized Settlement Growth in a Strategic Pressure-and-Adaptation World

## 1. Purpose

This document defines the template library used to physically represent settlement growth and change in the RPG world.

This is **not** a full procedural city-builder library.  
It is a **controlled settlement state library** that lets an AI programmer assemble or update a town by selecting:

- a core identity family
- a size tier
- a condition overlay
- district add-ons
- density upgrades
- temporary strain features
- special building insertions

This follows the strategic design scope: settlements are already meaningful places, and visible change comes from trade, military pressure, migration, strain, patronage, damage, and recovery, not only from abstract settlement founding or optimal build orders.

---

## 2. Core Design Principle

The template library exists to answer:

- what kind of place is this?
- what strategic role does it serve?
- what pressures is it under?
- what visible physical state should that produce?
- how can that state change while preserving place identity?

The template system should preserve **role fidelity** and **historical continuity**. A river market town under stress should still look like that same river market town, just more fortified, more crowded, or more strained, not like a completely different settlement archetype.

---

## 3. Library Structure

The template library should be organized into five layers:

### Layer A: Core Identity Family
What the settlement fundamentally is.

Examples:
- river market town
- roadside market town
- hill fort town
- manor village
- shrine town
- mining town
- port town
- crossing town
- garrison town
- estate service village

### Layer B: Size Tier
The scale and complexity of the settlement.

Examples:
- established base
- expanded
- dense
- strained dense
- declining
- major hub

### Layer C: Condition Overlay
The current strategic condition.

Examples:
- prosperous
- militarized
- fortified
- refugee-swollen
- overstrained
- damaged
- recovering
- neglected
- repressive

### Layer D: District Add-Ons
Optional district-level insertions or emphasis packages.

Examples:
- barracks quarter
- storage quarter
- shrine annex
- craft lane
- expanded market
- noble compound
- camp belt
- checkpoint gate
- slum edge
- depot yard

### Layer E: Lot / Building / Prop State Variants
Micro-level realization of the above.

Examples:
- upgraded shophouses
- yard sheds
- overflow shelters
- patrol posts
- ditch and palisade
- richer paving
- abandoned structures
- scaffolds and repairs
- market spillover stalls

This layered approach directly matches the strategic document’s chunk-family model and lets the generator compose states like “Border Town / Expanded / Militarized / Barracks + Storage Quarter + Checkpoint Gate” rather than inventing towns from scratch.

---

## 4. Authoring Unit Hierarchy

The library should be authored at four spatial scales.

### 4.1 Settlement Family
Defines overall morphology and district tendencies.

### 4.2 Chunk Template
Primary outdoor assembly unit.  
Each chunk corresponds to a 64 x 64 tile map chunk.

### 4.3 Lot / Block Template
Internal chunk subdivision used to place building modules.

### 4.4 Building / Interior Template
Building shell, use type, and room logic.

The settlement generator should primarily assemble at the chunk level, then refine at the lot and building level.

---

## 5. Settlement Family Library

This is the top-level authored list. These are not just aesthetic themes. Each family implies road logic, district tendencies, density behavior, and likely adaptation paths.

### 5.1 Manor Village

**Purpose**
- estate production
- local tenant services
- light administration
- sometimes noble extraction

**Likely role tags**
- Estate Hub
- Grain Basin
- Pastoral
- Noble Seat

**Core physical traits**
- manor or hall compound
- clustered peasant housing
- barns, granaries, smith, shrine
- strong visual dependence on surrounding fields
- often one dominant approach road

**Likely adaptations**
- expanded granaries
- reeve or tax office
- fortified manor edge
- refugee sheltering in farm fringe
- elite patronage upgrades
- levy mustering yard

### 5.2 Rural Service Village

**Purpose**
- support nearby farms, mills, and exchange

**Likely role tags**
- Grain Basin
- Pastoral
- Timber
- Estate Hub

**Physical traits**
- open central green or square
- mill, inn, smith, shrine
- low-density detached housing
- kitchen gardens and livestock yards

**Likely adaptations**
- larger square
- added storage yards
- watch post
- road inn expansion
- temporary grain overflow

### 5.3 Roadside Market Town

**Purpose**
- exchange and lodging node on land routes

**Likely role tags**
- Border Market
- Administrative
- Craft Center
- River Crossing if applicable

**Physical traits**
- elongated main street
- market frontage
- inns and stables
- side lanes and rear yards
- strong road-oriented growth

**Likely adaptations**
- market extension
- second inn yard
- wagon lot
- toll checkpoint
- barracks insertion
- caravan spillover camps

### 5.4 River Market Town

**Purpose**
- trade transfer between river and road network

**Likely role tags**
- River Trade
- Grain Basin
- Administrative
- Mercantile Hub

**Physical traits**
- quay or landing edge
- storage and warehouse strip
- market square
- transport yards
- mixed merchant and labor housing

**Likely adaptations**
- storage quarter
- customs/toll post
- richer market hall
- flood repair works
- refugee riverbank camps
- military supply depots

### 5.5 Port Town

**Purpose**
- sea/coastal traffic and storage node

**Likely role tags**
- Port
- Naval Yard
- Mercantile Hub
- Fishing

**Physical traits**
- dockfront
- warehouse belt
- inns, ropeyards, fish market
- sailor/labor housing
- customs presence

**Likely adaptations**
- expanded dock storage
- naval yard
- quarantine or disease cordon
- camp followers
- imported luxury district growth
- smuggler edge activity

### 5.6 Shrine / Pilgrimage Town

**Purpose**
- religious concentration and seasonal flows

**Likely role tags**
- Pilgrimage
- Monastic Center
- Administrative
- Mercantile Hub

**Physical traits**
- sacred anchor
- lodging clusters
- ritual roads/open courts
- charity structures
- mixed permanent and temporary lodging

**Likely adaptations**
- shrine annex
- hostels
- alms yards
- relief kitchens
- crowd control checkpoints
- temporary pilgrim camps

### 5.7 Hill Fort / Fortress Town

**Purpose**
- control and defense

**Likely role tags**
- Fortress Anchor
- Border Watch
- Muster Point
- Supply Depot

**Physical traits**
- dominant fortification
- military roads
- constrained civilian quarters
- steeper terrain adaptation
- drill yards, armories, storehouses

**Likely adaptations**
- expanded barracks
- outer works
- emergency ditches
- depots
- refugee concentration outside defenses
- repressive checkpoints

### 5.8 Garrison Town

**Purpose**
- local military control node without needing a giant fortress

**Likely role tags**
- Muster Point
- Supply Depot
- Border Watch
- Administrative

**Physical traits**
- barracks quarter
- broad yard spaces
- patrol roads
- civilian service buildings tied to soldiers
- strong traffic variation during campaigns

**Likely adaptations**
- larger barracks
- armory
- stable yard
- hospital/infirmary
- temporary troop camps
- quartermaster stores

### 5.9 Mining Town

**Purpose**
- extraction, labor concentration, unstable growth

**Likely role tags**
- Mine
- Quarry
- Supply Depot
- Frontier Resettlement Site

**Physical traits**
- work yards
- rough worker housing
- storage and hauling routes
- slag/spoil or quarry scar
- strong class contrast if prosperous

**Likely adaptations**
- labor camps
- guard post
- expanded workshops
- tavern density
- slum edge
- rapid decline if output collapses

### 5.10 Crossing Town

**Purpose**
- bridge, ford, or pass control

**Likely role tags**
- River Crossing
- Mountain Pass Control
- Border Market
- Administrative

**Physical traits**
- gate, bridgehead, toll roads
- heavy through-traffic
- inn/stable emphasis
- guards and store sheds
- asymmetric spatial form around the crossing

**Likely adaptations**
- toll station
- stronger fortification
- convoy yards
- checkpoint gate
- bridge repair works
- requisition depots

---

## 6. Size Tier Library

Size tiers should not just scale building count. They define settlement complexity and district differentiation.

### 6.1 Established Base
An already meaningful settlement with its core features present.

**Typical use**
- default state for many villages and towns in the world

**Traits**
- one clear center
- one to three defining chunk groups
- low district differentiation
- basic services present
- little redundancy

### 6.2 Expanded
Growth without full urban crowding.

**Traits**
- clear edge expansion
- one or two extra district bands
- more lots occupied
- secondary roads present
- new support businesses

### 6.3 Dense
Mature and more space-efficient.

**Traits**
- infill and lot subdivision
- attached buildings
- yard reduction
- stronger distinction between core and edge
- more mixed-use frontage

### 6.4 Strained Dense
Overloaded but not yet failing.

**Traits**
- overflow structures
- crowded lanes
- temporary storage
- worsened sanitation appearance
- informal occupation of fringe and unused ground

### 6.5 Declining
Population or support has fallen.

**Traits**
- abandoned lots
- reduced market activity
- underused yards
- collapsed edges
- maintenance gaps

### 6.6 Major Hub
High-complexity node.

**Traits**
- multiple district anchors
- clear social segmentation
- multiple markets/yard systems
- formalized circulation hierarchy
- sustained special-building presence

---

## 7. Condition Overlay Library

These are the main state overlays. They should apply across multiple settlement families.

### 7.1 Prosperous
**Visual effects**
- better maintenance
- richer paving or packed roads
- market enlargement
- improved façades
- more merchant houses
- visible repairs complete
- storage orderly, less ad hoc

### 7.2 Militarized
**Visual effects**
- barracks expansion
- drill spaces
- patrol posts
- more armory/storage
- troop movement staging
- guard-heavy gates
- civilian adaptation to military traffic

### 7.3 Fortified
**Visual effects**
- ditches
- palisades
- repaired walls
- strengthened gates
- towers or watch platforms
- hardened chokepoints

### 7.4 Refugee-Swollen
**Visual effects**
- camp belts
- temporary shelters
- field kitchens
- improvised market spillover
- laundry lines, carts, overcrowded edge conditions
- temple relief yards

### 7.5 Overstrained
**Visual effects**
- storage overflow
- trampled verges
- muddy circulation
- yard crowding
- sanitation decline
- ad hoc sheds and shelters
- queues, clutter, supply piles

### 7.6 Damaged
**Visual effects**
- burned or collapsed structures
- rubble lots
- patched walls
- abandoned edges
- closed streets
- damaged bridges or mills

### 7.7 Recovering
**Visual effects**
- scaffolds
- roof repair
- lumber piles
- labor sheds
- rebuilding markers
- temporary rerouting of traffic

### 7.8 Neglected
**Visual effects**
- failing maintenance
- weeded lots
- sagging fences
- unimproved roads
- underused stalls
- fewer active yards

### 7.9 Repressive
**Visual effects**
- checkpoints
- barriers
- prisons or confiscation yards
- gallows or public warning structures
- visible guard concentration
- narrowed movement corridors

---

## 8. District Add-On Library

District add-ons should be authored as reusable insertions, not hardcoded whole-town replacements.

### 8.1 Expanded Market
**Use when**
- trade opportunity high
- safe enough conditions
- storage/market strain rising

**Physical contents**
- stall square expansion
- permanent frontage shops
- open trade yard
- extra inns and stables
- merchant houses
- more road hardening

### 8.2 Storage Quarter
**Use when**
- supply flow or trade flow high
- grain handling or military stockpiling important

**Physical contents**
- granaries
- warehouses
- fenced yards
- loading spaces
- sheds
- cart staging areas

### 8.3 Barracks Quarter
**Use when**
- military utility rising
- kingdom policy favors militarization
- border pressure high

**Physical contents**
- barracks
- mess yard
- armory
- latrine/service structures
- stables if mounted presence
- training ground

### 8.4 Shrine Annex
**Use when**
- pilgrimage or elite patronage
- relief activity
- loyalty/legitimacy management

**Physical contents**
- shrine court
- dormitories or hostels
- kitchens
- alms yard
- procession path
- graveyard expansion where appropriate

### 8.5 Craft Lane
**Use when**
- artisan activity rises
- market town matures
- road/river trade strengthens

**Physical contents**
- workshop row
- mixed artisan residences
- work yards
- delivery access lane
- chimney/forge clustering where appropriate

### 8.6 Noble Compound
**Use when**
- elite ambition high
- peace and patronage
- administrative centralization

**Physical contents**
- enclosed hall/manor
- servants’ buildings
- paved approach
- gardens or formal yards
- retainers’ housing

### 8.7 Slum Edge / Informal Quarter
**Use when**
- migration high
- housing strain high
- order weak or planning capacity low

**Physical contents**
- improvised shelters
- subdivided yards
- reused outbuildings
- irregular lanes
- ad hoc workshops
- poor drainage and clutter

### 8.8 Camp Belt
**Use when**
- refugee influx
- military passage
- labor surge
- pilgrimage peak

**Physical contents**
- tents
- rough shelters
- field kitchens
- temporary pens
- supply piles
- medical or relief structures

### 8.9 Checkpoint Gate
**Use when**
- coercive pacification
- high threat
- tax control
- occupied or tense border region

**Physical contents**
- gate inspection lanes
- barriers
- watch shelter
- holding pen
- confiscation yard
- troop presence

### 8.10 Depot Yard
**Use when**
- supply pressure high
- troop movement high
- strategic logistics node active

**Physical contents**
- stacked supplies
- wagon yards
- fodder storage
- smithing/repair sheds
- quartermaster structure
- guarded perimeter

---

## 9. Chunk Template Categories

Every settlement family should be composed from chunk categories rather than one-off fixed plans.

### 9.1 Core Chunks
These define the recognizable center.

Examples:
- village green core
- main street market core
- square market core
- shrine court core
- fort court core
- quay square core
- bridgehead core

### 9.2 Residential Chunks
These define social density and district character.

Examples:
- detached cottages
- lane cottages
- mixed yard housing
- row frontage housing
- merchant housing
- noble houses
- labor housing
- informal housing cluster

### 9.3 Economic Chunks
These carry productive and exchange activity.

Examples:
- market stalls and sheds
- permanent market frontage
- workshop strip
- warehouse yard
- mill cluster
- stable/cart yard
- fish or dock trade strip
- quarry/mining support yard

### 9.4 Military Chunks
Examples:
- barracks yard
- gate defense approach
- watch post
- armory yard
- drill field edge
- outer palisade support zone

### 9.5 Civic / Religious Chunks
Examples:
- shrine precinct
- temple square
- town hall block
- courthouse yard
- infirmary / relief yard
- graveyard edge

### 9.6 Transitional / Edge Chunks
Examples:
- farm-edge housing
- market-edge expansion reserve
- wall-edge ad hoc growth
- camp-edge transition
- degraded edge
- recovering edge
- suburban extension

### 9.7 Terrain-Specific Chunks
Examples:
- riverbank retaining edge
- stepped hillside lane
- pass-road terrace
- marsh-raised housing
- bridge approach
- cliffside retaining row
- dock slope storage

---

## 10. Chunk Metadata Requirements

Each chunk template needs metadata rich enough for rule-based selection.

```yaml
ChunkTemplate:
  id: string
  settlement_families: [string]
  biome_affinities: [string]
  terrain_classes: [string]
  chunk_category: enum
  size_tier_affinities: [string]
  condition_overlay_affinities: [string]
  district_tags: [string]
  edge_connections:
    north: EdgeConnection
    south: EdgeConnection
    east: EdgeConnection
    west: EdgeConnection
  road_stubs: [RoadStub]
  density_band: enum
  wealth_band: enum
  military_band: enum
  temporary_capacity: int
  permanent_household_capacity: int
  service_slots: [ServiceSlot]
  anchor_slots: [AnchorSlot]
  lot_skeletons: [LotSkeleton]
  reserve_growth_zones: [Area]
  overlay_attach_points: [AttachPoint]
  upgrade_paths: [ChunkTemplateId]
  downgrade_paths: [ChunkTemplateId]
  continuity_markers: [Marker]
```

**Important fields**
- **reserve_growth_zones**: prevents over-authoring a chunk so there is space to visibly grow
- **overlay_attach_points**: where camps, checkpoints, storage overflow, and military add-ons can appear
- **continuity_markers**: landmarks like wells, shrines, trees, or inns that can persist through upgrades

---

## 11. Road and Edge Connection Standards

Chunks should not be freely swappable. They need structured edge logic.

### 11.1 Edge Connection Types
- closed rural edge
- soft residential edge
- road continuation
- lane continuation
- market edge
- defensive edge
- river edge
- wall edge
- camp edge
- industrial edge

### 11.2 Road Stub Types
- major through-road
- secondary road
- lane
- yard path
- fortified gate route
- quay access path

A settlement generator should only connect compatible edges unless a transition chunk explicitly mediates them.

---

## 12. Density Bands

Density must be template-driven and readable.

### 12.1 Density Bands
- sparse rural
- village low
- village medium
- town low
- town medium
- town high
- dense special
- temporary overflow
- partial abandonment

### 12.2 What Density Changes
- lot width
- outbuilding count
- yard depth
- shared walls
- second stories
- alley frequency
- vegetation retention
- clutter and circulation wear

Density upgrade should happen through template progression, not just extra object scatter.

---

## 13. Upgrade Paths

A chunk must have authored upgrade and downgrade chains.

### 13.1 Upgrade Path Types
- base growth
- density growth
- condition escalation
- condition recovery
- role specialization
- decline

Example:

```yaml
roadside_market_residential_low_A
  -> roadside_market_residential_low_A_expanded
  -> roadside_market_mixed_frontage_B
  -> roadside_market_dense_frontage_B_militarized
```

Another:

```yaml
river_market_storage_basic
  -> river_market_storage_expanded
  -> river_market_storage_overstrained
  -> river_market_storage_recovering
```

The point is continuity. The player should recognize the same place changing state.

---

## 14. Overlay System

Overlays should be attachable, not necessarily requiring a whole chunk swap.

### 14.1 Overlay Types
- market spillover
- checkpoint set
- camp shelters
- storage overflow
- scaffold and repair
- guard post
- temporary pens
- rubble/damage patch
- shrine festival clutter
- military requisition clutter

### 14.2 Overlay Rules
Use overlays when:
- the strategic change is medium or temporary
- the base identity should remain strong
- full chunk replacement would be too disruptive
- the state may revert soon

Use chunk replacement when:
- density changed
- district function changed
- fortification line changed
- permanent buildings were added
- block structure changed

This distinction matters because the system allows fast visible change through temporary swelling, functional growth, and emergency growth without requiring full permanent expansion.

---

## 15. Building Template Grouping

Buildings should be grouped by both use and settlement function.

### 15.1 Housing Groups
- peasant cottage
- village longhouse
- artisan house-workshop
- merchant house
- rowhouse
- tenement-like dense block
- manor/elite house
- barracks housing
- temporary shelter row

### 15.2 Economic Groups
- market stall unit
- shop-house
- inn
- stable
- granary
- warehouse
- smithy
- mill
- fish store
- cart shed
- toll house

### 15.3 Civic / Religious Groups
- shrine
- temple
- reeve or town hall
- court/watch house
- infirmary
- hostel
- school or scribe office if appropriate

### 15.4 Military Groups
- watchtower
- gatehouse
- barracks
- armory
- depot shed
- stable
- prison or holding structure
- checkpoint hut

---

## 16. Interior Template Library

The interior library should also be grouped by settlement role and condition.

### 16.1 Interior Categories
- poor household
- modest household
- artisan household
- merchant household
- elite household
- military sleeping quarters
- workshop
- mixed shop-house
- warehouse
- shrine/temple service space
- inn public room + lodging
- relief kitchen
- temporary shelter interior

### 16.2 Condition Variants
An inn in a prosperous market town is not the same as the same inn under military strain.

Variants should support:
- prosperous furnishing
- cramped overcapacity
- requisitioned military use
- damage and repair state
- neglected low-stock state
- refugee relief conversion

That fits the strategic goal that temporary states and strain should matter physically, not just numerically.

---

## 17. Settlement Family Minimum Viable Template Counts

For a first implementation, each settlement family does not need dozens of chunks.  
It needs enough pieces to express growth and adaptation.

### Recommended minimum per family

#### Core
- 2 base cores
- 1 prosperous core variant
- 1 militarized or fortified core variant

#### Residential
- 3 low/medium residential chunks
- 2 dense or mixed-use upgrades
- 1 decline or neglect variant
- 1 overflow/informal variant

#### Economic
- 2 market/workshop/storage chunks
- 1 expanded economic chunk
- 1 overstrained economic variant

#### Special / District
- 1 barracks-related
- 1 shrine/civic-related
- 1 checkpoint/camp/depot-related

#### Transitional
- 2 edge/transition chunks
- 1 terrain-specific connector

That gives roughly 15–20 chunks per family, enough for variation and staged change.

---

## 18. Recommended Initial Family Set

For the project, do not start with all ten family types.

Start with six:

1. rural service village  
2. manor village  
3. roadside market town  
4. river market town  
5. garrison town  
6. crossing town  

Those six already cover a lot of visible political and economic states.

Then add:
- shrine town
- hill fort town
- mining town
- port town

later.

---

## 19. Example Family Breakdown

### 19.1 Roadside Market Town Template Set

#### Core Chunks
- main street core sparse
- main street core expanded
- main street core prosperous
- main street core checkpointed

#### Residential Chunks
- rear-lane cottages
- mixed yard housing
- attached market frontage
- dense side-lane housing
- informal roadside fringe

#### Economic Chunks
- stable yard
- market spill yard
- workshop lane
- storage/cart yard

#### District Add-On Chunks
- barracks insertion
- toll gate and checkpoint
- depot yard
- damage/recovery strip

#### Common overlays
- caravan spillover
- troop quartering clutter
- refugee lean-tos
- tax inspection barrier

### 19.2 River Market Town Template Set

#### Core Chunks
- quay square
- inland market square
- customs quay
- fortified riverside core

#### Residential Chunks
- merchant housing
- labor housing
- dense riverside rows
- mixed rear-yard housing

#### Economic Chunks
- warehouse strip
- dock storage
- fish/river trade lane
- cart transfer yard

#### District Add-On Chunks
- barracks by quay
- expanded warehouse quarter
- relief camp riverbank
- damaged flood-repair river edge

---

## 20. Generator Selection Logic

The generator should not pick chunks randomly. It should perform staged selection.

### Step 1: Select settlement family
Based on:
- founding identity
- role tags
- terrain
- major route type

### Step 2: Select size tier
Based on:
- baseline class
- current population
- district complexity
- existing footprint

### Step 3: Select condition overlays
Based on:
- security state
- economic state
- physical state
- traffic state
- political state

These simplified states should drive the library cleanly rather than requiring too many raw values at generation time.

### Step 4: Select district add-ons
Based on:
- adaptation mode
- temporary population
- strategic role
- kingdom priorities
- local elite skew

### Step 5: Apply density and continuity rules
- preserve landmark anchors
- preserve core road logic
- prefer upgrading existing chunks before annexing totally new forms
- reserve overflow for edge and attach-point zones

---

## 21. Template Library Rules for Change

### 21.1 Growth should preserve identity
A town expands as itself, not as a new random composition.

### 21.2 Strain should often use overlays first
Especially for:
- camps
- overflow storage
- checkpoints
- temporary quarters
- repair works

### 21.3 Permanent function change should use chunk swaps or insertions
Especially for:
- barracks
- walls
- expanded market
- formal storage quarter
- shrine annex
- depot yard

### 21.4 Decline should be authored too
Do not only author prosperous growth.  
You need:
- abandoned edge chunks
- half-occupied market chunks
- damaged storage areas
- maintenance-failed walls
- reduced service streets

### 21.5 District emphasis matters more than exact building count
The player will read “this town became more military” faster than “this town has 14% more housing.”

---

## 22. Suggested Data Schema for the Template Library

```yaml
SettlementFamilyTemplate:
  id: string
  display_name: string
  role_tag_affinities: [string]
  terrain_affinities: [string]
  route_affinities: [string]
  default_core_chunks: [ChunkTemplateId]
  default_residential_chunks: [ChunkTemplateId]
  default_economic_chunks: [ChunkTemplateId]
  default_edge_chunks: [ChunkTemplateId]
  supported_condition_overlays: [string]
  supported_district_addons: [string]
  landmark_rules: [LandmarkRule]
  default_road_pattern: RoadPattern
  expansion_bias: ExpansionBias
```

```yaml
DistrictAddonTemplate:
  id: string
  addon_type: enum
  compatible_families: [string]
  trigger_tags: [string]
  chunk_insertions: [ChunkTemplateId]
  overlay_sets: [OverlaySetId]
  service_effects: [ServiceEffect]
  traffic_effects: [TrafficEffect]
```

```yaml
ConditionOverlayTemplate:
  id: string
  condition_type: enum
  compatible_chunk_categories: [string]
  overlay_sets: [OverlaySetId]
  chunk_replacements: [ReplacementRule]
  visual_tags: [string]
  gameplay_tags: [string]
```

---

## 23. Practical Authoring Order

Best order for building the library:

### Phase 1
- settlement family definitions
- road patterns
- chunk metadata standard

### Phase 2
- core chunks
- residential chunks
- economic chunks

### Phase 3
- condition overlays
- district add-ons
- edge transitions

### Phase 4
- building library
- interior grammar library

### Phase 5
- decline, damage, and recovery variants
- special temporary states
- elite/military variation

This avoids building too many beautiful but disconnected assets.

---

## 24. What This Library Is Actually For

This library is meant to let the AI programmer convert strategic state into readable physical forms such as:

- the same town, but richer
- the same town, but crowded and strained
- the same town, but more military
- the same town, but fortified
- the same town, but carrying refugees
- the same town, but in partial decline
- the same town, but recovering after damage

That is the point: visible, local, RPG-readable consequences from pressure and adaptation rather than a hidden mini-4X game.

---

## 25. Recommended Next Document

The best next step is:

**Settlement Chunk Catalog and Naming Convention**

That document would define, in a much more concrete way:

- exact chunk categories
- naming scheme
- per-family chunk lists
- edge connection vocabulary
- upgrade chain naming
- district add-on attachment rules
- overlay attachment points

That would make the template library directly implementable.
