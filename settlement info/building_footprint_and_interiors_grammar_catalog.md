# Building Footprint and Interior Grammar Catalog
## Asset Spec for Enterable Buildings in Chunk-Based Settlements

## 1. Purpose

This document defines the building-level catalog that sits beneath the settlement chunk catalog.

Its purpose is to let an AI programmer or content pipeline place believable, enterable buildings inside settlement chunks in a way that is:

- physically consistent with the chunk and lot
- consistent with settlement family, district, density, and condition
- readable to the player
- compatible with staged settlement growth
- compatible with interior generation

This document covers:

- building archetype categories
- building ID naming rules
- footprint classes
- lot frontage and depth rules
- story and height classes
- household and worker capacity
- building upgrade paths
- mixed-use conversion rules
- interior grammar rules
- furnishing and condition variants

This catalog is intended to connect the outdoor chunk system to the enterable building layer.

---

## 2. Core Design Principle

Buildings should not be spawned as isolated props.

Every building should be the physical result of:

- settlement family
- district function
- lot shape and frontage
- density band
- wealth band
- condition state
- role or service need

The same settlement should be able to evolve from:

- detached cottages
- to denser row frontage
- to mixed-use shop-houses
- to overcrowded or strained variants
- to damaged, neglected, or recovered versions

while still feeling like the same place.

---

## 3. Building Asset Layers

The building system should be treated as four linked layers:

### Layer A: Building Archetype
The abstract building type.

Examples:
- peasant cottage
- merchant house
- barracks
- inn
- shrine
- warehouse
- shop-house
- smithy
- granary

### Layer B: Building Footprint Variant
The exterior footprint, massing, and entrance logic.

Examples:
- narrow street-front
- deep yard house
- corner building
- courtyard cluster
- attached row unit
- freestanding hall

### Layer C: Building Use Variant
The occupancy and service role.

Examples:
- pure residence
- residence + shop
- residence + workshop
- public service
- military lodging
- relief shelter

### Layer D: Interior Grammar Variant
The room-layout logic and furnishing rules.

Examples:
- poor household
- artisan household
- merchant household
- garrison quarters
- inn public house
- workshop with attached residence

---

## 4. Building Naming Convention

Each building asset should have a canonical machine-readable ID.

## 4.1 Canonical ID Pattern

```text
bld_<family_or_shared>_<category>_<archetype>_<footprint>_<density>_<wealth>_<condition>_<variant>
```

Where:

- `bld` = building asset
- `family_or_shared` = settlement family code or `shd` for shared
- `category` = major building category
- `archetype` = specific building type
- `footprint` = footprint class
- `density` = density code
- `wealth` = wealth band code
- `condition` = condition code
- `variant` = variant letter or number

### Examples

```text
bld_shd_res_cottage_sm_vl_lo_base_a
bld_rmt_mix_shophouse_nr_tm_md_pros_a
bld_rvt_econ_warehouse_lg_tm_md_base_a
bld_gat_mil_barracks_lg_tm_md_mil_a
bld_sht_civ_shrine_md_vl_md_pros_a
bld_shd_res_rowunit_nr_th_lo_over_b
```

---

## 4.2 Family Codes

Use the same settlement family codes as the chunk catalog.

```text
shd = shared
rsv = rural_service_village
mnv = manor_village
rmt = roadside_market_town
rvt = river_market_town
gat = garrison_town
crt = crossing_town
sht = shrine_town
hft = hill_fort_town
mit = mining_town
prt = port_town
```

Use `shd` where the same building family can be reused across multiple settlement types.

---

## 4.3 Building Category Codes

```text
res = residential
mix = mixed_use
econ = economic
civ = civic_religious_administrative
mil = military
tmp = temporary_or_relief
```

---

## 4.4 Archetype Rules

Archetype should identify the main social or functional role of the building.

Examples:
```text
cottage
longhouse
rowunit
merchanthouse
noblehouse
shophouse
artisanhouse
inn
smithy
granary
warehouse
stable
mill
shrine
templehall
reevehall
courthouse
barracks
armory
gatehouse
checkpointhut
reliefshed
shelterrow
```

Archetype should not encode every detail. Use footprint, density, wealth, and condition for that.

---

## 4.5 Footprint Codes

```text
xs = extra_small
sm = small
md = medium
lg = large
xl = extra_large

nr = narrow_frontage
wd = wide_frontage
dp = deep_plot
cr = corner_plot
ct = courtyard
rw = row_attached
fr = freestanding
ln = lane_oriented
yr = yard_oriented
```

Footprint token can be one or two-part depending on asset needs.

Examples:
```text
sm
nr
nr_dp
md_ct
lg_fr
rw
yr
```

---

## 4.6 Density Codes

Use the same density codes as the chunk catalog.

```text
sr = sparse_rural
vl = village_low
vm = village_medium
tl = town_low
tm = town_medium
th = town_high
ds = dense_special
to = temporary_overflow
pa = partial_abandonment
```

---

## 4.7 Wealth Codes

```text
lo = low
md = medium
hi = high
el = elite
```

---

## 4.8 Condition Codes

```text
base = normal maintained state
pros = prosperous
mil = militarized or requisitioned
fort = fortified support state
refg = refugee-adapted
over = overstrained
dmg = damaged
recv = recovering
negl = neglected
repr = repressive use
```

---

## 5. Building Archetype Categories

## 5.1 Residential Archetypes

### Cottage
Small detached or semi-detached dwelling.

Use for:
- village edge housing
- poor to modest households
- low-density districts

Variants:
- single-room cottage
- cottage with rear room
- cottage with loft
- cottage with tiny side shed

### Longhouse
Long rectangular dwelling for larger households or mixed family use.

Use for:
- rural family clusters
- labor settlements
- low-tech or traditional forms
- village medium density

### Row Unit
One module in an attached row.

Use for:
- denser market towns
- labor housing
- side-lane housing
- high-density growth

### Artisan House
Residence with attached workshop function.

Use for:
- blacksmith
- carpenter
- cooper
- dyer
- weaver
- cobbler
- etc.

### Merchant House
Larger residence, often with storage and reception spaces.

Use for:
- trade-active districts
- prosperous cores
- river and port towns

### Noble House / Hall House
Elite residence or administrative manor-like house.

Use for:
- noble compounds
- administrative centers
- wealthy patronage districts

---

## 5.2 Mixed-Use Archetypes

### Shop-House
Commercial or service frontage with residence attached.

Use for:
- market streets
- crossroads
- bridgeheads
- river trade areas

### Inn
Public house with lodging.

Variants:
- small roadside inn
- market inn
- river inn
- military-overflow inn
- pilgrimage hostel-inn hybrid

### Artisan-Shop
Workshop plus sales frontage.

Use for:
- smith
- clothier
- apothecary
- butcher
- baker

### Boarding House / Lodging House
Dense sleeping accommodation for transients or laborers.

Use for:
- garrison spillover
- pilgrim towns
- trade corridors
- refugee conversion

---

## 5.3 Economic Archetypes

### Warehouse
Storage-focused building, often little domestic use.

### Granary
Food storage building with handling space.

### Mill
Processing building requiring terrain or water logic.

### Stable
Animal housing, yard service, cart support.

### Cart Shed / Wagon Hall
Vehicle and hauling support building.

### Smithy / Forge Hall
Heavy workshop building.

### Fish Store / Salt Store
Product-specific storage/processing.

### Dock Shed / Quay Store
Transfer and handling building tied to waterfront.

---

## 5.4 Civic / Religious Archetypes

### Shrine
Small sacred building.

### Temple Hall
Larger religious public building.

### Reeve Hall / Town Hall
Local administration.

### Courthouse / Watch House
Authority and law presence.

### Infirmary / Relief Hall
Medical or emergency aid.

### Hostel / Alms House
Charity lodging or pilgrim lodging.

---

## 5.5 Military Archetypes

### Barracks
Organized troop sleeping and support structure.

### Armory
Weapons and supply building.

### Gatehouse
Entry-control and defensive structure.

### Checkpoint Hut / Toll House
Small authority structure controlling movement.

### Stable Barracks / Remount Hall
Mounted troop support.

### Prison / Holding House
Coercive control building.

---

## 5.6 Temporary / Relief Archetypes

### Shelter Row
Temporary linear shelter cluster.

### Relief Shed
Food, aid, and medical support building.

### Tent Hall
Large temporary enclosed structure.

### Store Tent / Supply Pavilion
Temporary stock storage.

These should usually be overlays or temporary add-ons, not primary permanent buildings.

---

## 6. Footprint Class System

A footprint class defines the outer shell and placement constraints.

## 6.1 Basic Footprint Dimensions

Suggested footprint bands in tiles:

```text
xs = 4x4 to 5x6
sm = 5x6 to 7x8
md = 7x8 to 10x12
lg = 10x12 to 14x18
xl = 14x18+
```

These are not exact fixed dimensions. They are footprint classes for template grouping.

---

## 6.2 Frontage Classes

```text
narrow_frontage = 4m to 6m
medium_frontage = 7m to 10m
wide_frontage = 11m+
```

Use codes:
```text
nr
md
wd
```

This matters especially for:
- row units
- shop-houses
- market frontage
- noble houses
- inns

---

## 6.3 Depth Classes

```text
shallow = 5m to 8m
standard = 8m to 12m
deep = 12m+
```

Use codes:
```text
sh
st
dp
```

Deep plots are important for:
- rear workshops
- storerooms
- yards
- stable access
- merchant storage

---

## 6.4 Footprint Orientation Types

```text
street_front
lane_front
yard_oriented
courtyard_oriented
corner_oriented
free_form
terrain_stepped
```

These should be metadata flags, not only name tokens.

---

## 7. Lot Fit Rules

Buildings should only be selected if the lot supports them.

## 7.1 Lot Metadata Needed

Each lot should expose:

```yaml
LotFitData:
  frontage_width: int
  depth: int
  corner_lot: bool
  road_class: enum
  lane_access: bool
  rear_access: bool
  yard_capacity: enum
  slope_class: enum
  district_type: enum
  density_target: enum
  wealth_target: enum
```

---

## 7.2 Building Fit Metadata

Each building should declare:

```yaml
BuildingFitRules:
  min_frontage: int
  preferred_frontage: int
  max_frontage: int
  min_depth: int
  preferred_depth: int
  requires_corner: bool
  allows_corner: bool
  requires_rear_access: bool
  requires_yard: bool
  allowed_road_classes: [enum]
  allowed_slope_classes: [enum]
  district_affinities: [enum]
```

---

## 7.3 Common Fit Logic

### Cottage
- low frontage requirement
- medium depth preferred
- yard desirable
- road or lane access acceptable

### Row Unit
- narrow frontage required
- medium depth
- no yard required
- street or lane access

### Shop-House
- road frontage required
- narrow to medium frontage
- good pedestrian visibility
- rear storage desirable

### Warehouse
- medium to wide frontage
- deep lot preferred
- rear or side access strongly preferred
- major road or quay access

### Barracks
- wide frontage or freestanding plot
- large depth
- yard or parade space preferred

### Smithy
- medium frontage
- yard preferred
- road access preferred
- avoid elite districts unless story-authored

---

## 8. Story / Height Classes

Buildings should support height classes by density and wealth.

## 8.1 Story Classes

```text
1
1.5
2
2.5
3
```

Use metadata:
```yaml
stories_min
stories_max
stories_preferred
```

### Typical ranges

- cottages: 1 to 1.5
- artisan houses: 1 to 2
- merchant houses: 2 to 3
- row units: 1.5 to 2.5
- warehouses: 1 to 3 depending on district
- barracks: 1 to 2
- gatehouses/towers: special case

---

## 8.2 Height by Density Guidance

- sparse rural: mostly 1 story
- village low: mostly 1 to 1.5
- village medium: mix of 1 and 2
- town low: 1.5 to 2 common
- town medium: 2 common
- town high: 2 to 3 common on key frontages

Do not overuse height. Density should also come from lot compression, attached walls, and rear structures.

---

## 9. Capacity Rules

Every building should declare its gameplay capacity.

## 9.1 Household Capacity

```yaml
household_capacity: int
resident_capacity_estimate: int
```

Suggested broad values:

- cottage: 1 household, 4-6 residents
- longhouse: 1-2 households, 6-12 residents
- row unit: 1 household, 4-7 residents
- dense row pair: 2 households, 8-12 residents
- merchant house: 1 household plus staff
- boarding house: 3-10 transient sleeping groups
- barracks: 10-60 soldiers depending on class

---

## 9.2 Worker Capacity

```yaml
worker_capacity: int
```

Examples:
- smithy: 2-6
- bakery: 2-5
- warehouse: 2-10
- stable: 2-8
- inn: 3-12
- temple hall: 2-10
- barracks support building: 2-8

---

## 9.3 Service Slots

Buildings may expose service slots instead of unique full services.

```yaml
service_slots:
  - lodging
  - retail_small
  - retail_general
  - repair_basic
  - repair_weapons
  - food_service
  - storage_public
  - administration
  - worship
  - healing_basic
  - military_logistics
  - detention
```

This helps the generator support varied towns without requiring a unique landmark for every service.

---

## 10. Wealth Band Expression

Wealth should affect more than decoration.

## 10.1 Low Wealth
- smaller rooms
- simpler roofs
- less permanent foundation
- rougher furniture
- more shared spaces
- weaker storage separation

## 10.2 Medium Wealth
- more room separation
- better materials
- some privacy
- modest decorative objects
- more stable outbuildings

## 10.3 High Wealth
- larger footprints
- better façade and paving
- dedicated storage
- guest/reception rooms
- private chambers
- servants’ support areas

## 10.4 Elite
- compound behavior
- ceremonial or status-oriented space
- strong separation of public/private/service zones
- better landscaping or formal yards

---

## 11. Condition Expression at the Building Level

Condition state should alter the building’s use or layout where appropriate.

## 11.1 Prosperous
- more complete furnishing
- repaired and expanded side rooms
- cleaner circulation
- added storage and display

## 11.2 Militarized
- requisitioned rooms
- supply stacks
- temporary bunks
- weapon racks
- restricted rooms

## 11.3 Refugee / Relief
- overcrowded sleeping layouts
- communal cooking
- improvised partitions
- aid stores
- fewer private rooms

## 11.4 Overstrained
- clutter
- temporary bedding
- storage spillover
- blocked corners
- reduced comfort

## 11.5 Damaged
- inaccessible rooms
- blocked doors
- collapsed roof sections
- emergency shoring

## 11.6 Recovering
- scaffold access
- rooms under repair
- partial furnishing return
- temporary closures

## 11.7 Neglected
- missing furniture
- storage decay
- reduced occupancy
- obvious disrepair

## 11.8 Repressive
- bars, locks, guard stations
- controlled circulation
- confiscation storage
- interrogation or holding use where relevant

---

## 12. Building Upgrade Paths

Buildings need explicit upgrade paths so settlement growth can be visible and logical.

## 12.1 Upgrade Classes

```text
growth
density
mixed_use_conversion
prosperity
militarization
fortification_support
overstrain
damage
recovery
decline
repurposing
```

---

## 12.2 Common Upgrade Paths

### Cottage Growth
```text
cottage_small -> cottage_expanded -> artisan_house OR shop-house OR duplex
```

### Row Density Growth
```text
single_rowunit -> rowunit_pair -> dense_row_block
```

### Market Commercialization
```text
residential_frontage -> shop-house -> prosperous shop-house -> merchant house
```

### Artisan Formalization
```text
yard workshop + house -> artisan house -> artisan shop -> guild-grade workshop
```

### Military Requisition
```text
inn -> inn_militarized
warehouse -> depot warehouse
house -> billet house
```

### Decline
```text
shop-house -> neglected mixed-use house -> residence only -> abandoned shell
```

---

## 12.3 Upgrade Rule ID Pattern

```text
bup_<from_building_id>__to__<to_building_id>
```

Example:

```text
bup_bld_shd_res_cottage_sm_vl_lo_base_a__to__bld_shd_mix_artisanhouse_md_vm_md_base_a
```

---

## 13. Mixed-Use Conversion Rules

Mixed-use conversion is one of the most important systems for believable town growth.

## 13.1 Conversion Candidates

A residential building is eligible for mixed-use conversion if:

- it fronts a primary or secondary market road
- trade opportunity is high
- district emphasis is market or craft
- frontage visibility is high
- the lot can support storage or a workroom

### Typical conversions
- cottage -> shop-house
- cottage -> artisan house
- merchant house -> formal shop-house
- house + yard -> workshop compound

---

## 13.2 Conversion Signals to the Player

Mixed-use conversion should be readable from outside:

- signage
- larger front opening
- display tables
- workshop clutter
- carts and deliveries
- smoke/forge indicators
- better paving or heavier wear

---

## 14. Interior Grammar System

Every building archetype should point to an interior grammar, not a fixed single layout.

## 14.1 Interior Grammar Structure

```yaml
InteriorGrammar:
  id: string
  archetype: string
  use_variant: string
  required_rooms: [RoomType]
  optional_rooms: [RoomType]
  adjacency_rules: [AdjacencyRule]
  vertical_rules: [VerticalRule]
  access_rules: [AccessRule]
  furnishing_profile: FurnishingProfile
  condition_overrides: [ConditionOverride]
```

---

## 14.2 Room Type Vocabulary

### Domestic
- entry
- main_room
- hearth
- sleep_space
- bedchamber
- family_room
- loft
- pantry
- storage
- private_chamber
- servant_room

### Commercial
- shop_front
- counter
- display
- back_store
- office
- receiving_room

### Workshop
- work_floor
- forge
- kiln
- craft_bench
- materials_store
- yard_work_area

### Public / Hospitality
- common_room
- kitchen
- dining_room
- guest_room
- dormitory
- stable_access
- wash_space

### Civic / Religious
- shrine_room
- hall
- office
- archive
- cell
- treatment_room
- ward

### Military / Coercive
- bunk_room
- officer_room
- armory
- mess
- holding_cell
- guard_room
- interrogation_room
- supply_room

### Temporary / Relief
- shelter_bay
- soup_line
- triage_space
- communal_sleep
- ration_store

---

## 15. Core Interior Grammars

## 15.1 Cottage Grammar

**Required**
- entry/main_room
- hearth
- sleep_space
- storage

**Optional**
- loft
- rear room
- side shed access

**Rules**
- main room is the central organizing space
- sleep may be shared with main room in low wealth variants
- loft only if roof volume allows
- storage should be near wall edge or rear

---

## 15.2 Artisan House Grammar

**Required**
- entry
- work_floor
- storage
- family_room or main_room
- sleep_space

**Optional**
- shop_front
- yard_work_area
- loft
- office niche

**Rules**
- work zone and domestic zone should be adjacent but distinct
- noisy or dirty work should bias toward front or side yard
- yard preferred where the lot allows

---

## 15.3 Shop-House Grammar

**Required**
- shop_front
- counter/display
- back_store
- domestic room
- sleep room or upper floor chamber

**Optional**
- workshop niche
- office
- loft storage

**Rules**
- shop front must touch main road side
- private domestic zone should be behind or above public zone
- back_store should connect to both shop and service access where possible

---

## 15.4 Inn Grammar

**Required**
- public room/common_room
- kitchen
- pantry/storage
- owner chamber or service room
- guest sleeping rooms or dormitory

**Optional**
- stable access
- private dining
- cellar
- yard seating
- servant sleeping

**Rules**
- public room should sit on main entry axis
- kitchen connects to public room but not dominate it
- guest access can be separated from service access in larger variants

---

## 15.5 Merchant House Grammar

**Required**
- reception or front room
- family room
- private chamber
- storage
- service room

**Optional**
- office
- guest room
- servant room
- upper gallery
- secure store

**Rules**
- stronger public/private separation
- better circulation hierarchy
- storage may be ground floor rear or detached side room

---

## 15.6 Warehouse Grammar

**Required**
- loading space
- storage hall
- office or watch niche

**Optional**
- loft storage
- side room
- guard room

**Rules**
- large open storage zone is primary
- circulation must support receiving and stacking
- domestic spaces should be absent or minimal unless mixed-use

---

## 15.7 Barracks Grammar

**Required**
- bunk room
- mess
- storage
- officer room or guard desk

**Optional**
- armory room
- wash area
- stable access
- infirmary corner

**Rules**
- communal sleeping dominates area
- command/control room should be near entry
- circulation should be efficient, not domestic

---

## 15.8 Shrine / Relief Grammar

**Required**
- sacred or service hall
- store/pantry
- attendant or clerk space

**Optional**
- small sleeping cell
- treatment corner
- alms counter
- yard access

**Rules**
- public-facing sacred or service zone near main access
- storage important in relief variants
- pilgrimage or refugee states may convert side rooms to communal functions

---

## 16. Vertical Rules

Buildings with upper stories need simple but firm vertical logic.

## 16.1 General Rules
- public or work functions usually on lower floor
- private domestic rooms usually above
- heavy storage should remain low unless specifically designed for loft storage
- upper floor access should not cross private sleeping space unnecessarily
- militarized or repressive variants may lock upper access

## 16.2 Common Patterns
- shop-house: shop below, family above
- inn: common room below, guest rooms above
- merchant house: reception below, chambers above
- row unit: main living below, sleeping above
- warehouse: storage below, loft above

---

## 17. Furnishing Profiles

Furnishing should be treated as a profile set, not hand-placed every time.

## 17.1 Profile Axes
- wealth
- density
- occupation
- condition
- region/biome

## 17.2 Example Furnishing Profiles
- poor domestic sparse
- poor domestic crowded
- artisan working clutter
- modest merchant
- prosperous merchant
- military requisitioned
- refugee relief
- damaged partial use
- neglected half-empty

---

## 18. Starter Building Catalog

Below is a recommended initial building set for implementation.

## 18.1 Residential
- bld_shd_res_cottage_sm_vl_lo_base_a
- bld_shd_res_cottage_sm_vl_lo_negl_a
- bld_shd_res_longhouse_md_vm_lo_base_a
- bld_shd_res_rowunit_nr_tm_lo_base_a
- bld_shd_res_rowunit_rw_th_lo_over_a
- bld_shd_res_merchanthouse_md_tm_hi_base_a
- bld_shd_res_noblehouse_lg_wd_el_pros_a

## 18.2 Mixed Use
- bld_shd_mix_shophouse_nr_tl_md_base_a
- bld_shd_mix_shophouse_nr_tm_md_pros_a
- bld_shd_mix_artisanhouse_md_vm_md_base_a
- bld_shd_mix_artisanhouse_md_tm_md_base_a
- bld_shd_mix_inn_lg_fr_md_base_a
- bld_shd_mix_inn_lg_fr_md_mil_a
- bld_shd_mix_boardinghouse_md_tm_lo_over_a

## 18.3 Economic
- bld_shd_econ_warehouse_lg_dp_md_base_a
- bld_shd_econ_warehouse_lg_dp_md_over_a
- bld_shd_econ_granary_md_fr_md_base_a
- bld_shd_econ_stable_lg_yr_md_base_a
- bld_shd_econ_cartshed_md_yr_lo_base_a
- bld_shd_econ_smithy_md_yr_md_base_a
- bld_rvt_econ_dockshed_lg_dp_md_base_a
- bld_rsv_econ_mill_lg_fr_md_base_a

## 18.4 Civic / Religious
- bld_shd_civ_shrine_sm_fr_md_base_a
- bld_shd_civ_templehall_lg_fr_hi_pros_a
- bld_shd_civ_reevehall_md_fr_md_base_a
- bld_shd_civ_courthouse_md_fr_md_repr_a
- bld_shd_civ_infirmary_md_fr_md_recv_a
- bld_sht_civ_hostel_md_ct_md_base_a

## 18.5 Military
- bld_shd_mil_barracks_lg_fr_md_mil_a
- bld_shd_mil_armory_md_fr_md_mil_a
- bld_shd_mil_gatehouse_lg_fr_md_fort_a
- bld_shd_mil_checkpointhut_sm_fr_lo_repr_a
- bld_shd_mil_stablebarracks_lg_yr_md_mil_a
- bld_shd_mil_holdinghouse_md_fr_lo_repr_a

## 18.6 Temporary / Relief
- bld_shd_tmp_shelterrow_md_rw_lo_refg_a
- bld_shd_tmp_reliefshed_md_fr_lo_refg_a
- bld_shd_tmp_tenthall_lg_fr_lo_refg_a
- bld_shd_tmp_supplypavilion_md_fr_lo_over_a

---

## 19. Validation Rules

The generator or asset validator should enforce:

### 19.1 Fit Validation
- building must fit frontage and depth limits
- building slope compatibility must match lot
- required road or yard access must be present

### 19.2 Category Validation
- civic buildings prefer civic, core, or market-adjacent lots
- military buildings prefer military, gate, edge, or strategic lots
- mixed-use buildings require meaningful frontage
- temporary buildings should not occupy elite or fully built lots without override logic

### 19.3 Interior Validation
- all required rooms must fit within shell
- stairs required for multi-story accessible layouts
- public and private circulation must obey grammar rules
- condition override may suppress but should not break required access paths

### 19.4 Capacity Validation
- settlement housing target should be measurable from building capacity
- worker/service slots should match economic and civic needs
- transient capacity should be tracked separately where relevant

---

## 20. Implementation Notes for the AI Programmer

The AI programmer should select building assets in this order:

1. determine required housing, work, service, and military functions
2. determine district and lot context
3. filter by fit rules
4. filter by density and wealth compatibility
5. filter by condition state
6. choose upgrade-consistent variant where possible
7. generate interior from assigned grammar
8. apply furnishing profile and condition overrides

The building asset name is not sufficient on its own. The metadata is the source of truth.

---

## 21. Recommended Next Document

The next useful document is:

**Settlement Growth Mapping Tables**

That should define:

- population-to-household conversion tables
- density target tables by district
- which building mixes satisfy each settlement tier
- service thresholds by settlement class
- mixed-use conversion triggers
- temporary population accommodation rules
- how strategic pressure states map to building and overlay changes

That document would connect the asset catalogs to the actual simulation outputs.
