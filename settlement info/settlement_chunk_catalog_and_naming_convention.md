# Settlement Chunk Catalog and Naming Convention
## Asset Spec for Chunk-Based Settlement Assembly

## 1. Purpose

This document defines the chunk asset naming convention, category system, edge vocabulary, upgrade path rules, and attachment-point standards for the settlement template library.

Its job is to make the template library directly implementable by an AI programmer or content pipeline.

This document assumes the broader settlement system already exists and that settlements are assembled from authored 64 x 64 tile chunks selected according to:

- settlement family
- size tier
- condition overlay
- district add-on
- density state
- terrain context
- temporary or permanent strategic change

The catalog should support:

- strong visual continuity across upgrades
- clear asset discoverability
- reusable chunk pieces
- compatibility validation
- predictable generator behavior

---

## 2. Chunk as the Primary Outdoor Unit

A settlement chunk is the main authored outdoor map cell for a settlement.

### Standard
- 1 chunk = 64 x 64 world tiles
- 1 tile = 1m x 1m
- height increments = 0.5m

A chunk should contain enough authored structure to feel intentional, but enough reserve or variation space to support visible growth and overlays.

Each chunk must be usable as:

- a base identity piece
- an upgraded or downgraded variant
- a support piece in a district assembly
- a stable target for overlays and temporary state expression

---

## 3. Chunk Library Design Principles

### 3.1 Readability over maximal variation
The library should prioritize a controlled set of strongly legible chunks over huge numbers of weakly differentiated assets.

### 3.2 Families first
Chunks are not generic city pieces. They belong to specific settlement families and carry their settlement logic with them.

### 3.3 Change should preserve memory
Upgraded chunks should usually preserve:
- one or more roads
- one landmark anchor
- at least some lot structure
- district identity
- spatial rhythm

### 3.4 Edge compatibility matters
No chunk should be treated as universally compatible. All chunks must declare edge types and road stubs.

### 3.5 Temporary states should not require full replacement
A settlement under short-term strain should often use overlays or edge attachments rather than a total chunk swap.

---

## 4. Directory / Asset Organization Model

Recommended top-level organization:

```text
/settlements/
  /families/
    /rural_service_village/
    /manor_village/
    /roadside_market_town/
    /river_market_town/
    /garrison_town/
    /crossing_town/
    /shrine_town/
    /hill_fort_town/
    /mining_town/
    /port_town/
  /shared/
    /overlays/
    /edge_transitions/
    /props/
    /road_modules/
    /interiors/
```

Within each family:

```text
/family_name/
  /core/
  /residential/
  /economic/
  /military/
  /civic/
  /edge/
  /terrain/
  /variants/
```

---

## 5. Core Naming Convention

Each chunk should have a machine-readable ID and a human-readable label.

## 5.1 Canonical Chunk ID Pattern

```text
stl_<family>_<category>_<subtype>_<density>_<tier>_<condition>_<variant>
```

Where:

- `stl` = settlement library
- `family` = settlement family code
- `category` = chunk category code
- `subtype` = chunk subtype code
- `density` = density band code
- `tier` = size tier code
- `condition` = condition overlay code or `base`
- `variant` = variant letter or number

### Example IDs

```text
stl_rsv_core_green_vl_ba_base_a
stl_rmt_core_mainstreet_tm_ex_pros_b
stl_rmt_econ_stableyard_tl_ex_base_a
stl_rmt_edge_roadfringe_vl_ex_refg_a
stl_gat_mil_barracksyard_tm_ex_mil_a
stl_rvt_econ_warestrip_tm_dn_over_a
```

---

## 5.2 Family Codes

Use short stable codes.

```text
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

---

## 5.3 Category Codes

```text
core = settlement center / anchor chunk
res = residential
econ = economic / exchange / storage / production
mil = military
civ = civic / religious / administrative
edge = transition / fringe / expansion edge
ter = terrain-specific structural chunk
```

---

## 5.4 Subtype Rules

Subtype is a short descriptive noun phrase collapsed to one token if possible.

Examples:
```text
green
mainstreet
quaysquare
bridgehead
cottages
mixedyard
frontagerow
stableyard
warestrip
craftlane
barracksyard
checkpointgate
campbelt
roadfringe
wallfringe
riveredge
terracelane
```

Subtype should describe the chunk’s main spatial function, not every object in it.

Bad:
```text
housesmithandwell
```

Good:
```text
mixedyard
```

---

## 5.5 Density Codes

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

## 5.6 Size Tier Codes

```text
ba = established_base
ex = expanded
dn = dense
sd = strained_dense
dc = declining
mh = major_hub
```

---

## 5.7 Condition Codes

```text
base = no major overlay baked in
pros = prosperous
mil = militarized
fort = fortified
refg = refugee_swollen
over = overstrained
dmg = damaged
recv = recovering
negl = neglected
repr = repressive
```

---

## 5.8 Variant Codes

Use a simple final token for authored alternates.

```text
a
b
c
d
```

Or numbered variants where needed:

```text
01
02
03
```

Use letters for near-equivalent visual alternates and numbers for structurally distinct alternates.

---

## 6. Human-Readable Display Name Format

Recommended pattern:

```text
<Family> / <Category> / <Subtype> / <Density> / <Tier> / <Condition> / <Variant>
```

Example:

```text
Roadside Market Town / Core / Main Street / Town Medium / Expanded / Prosperous / B
```

This is helpful in tools and debugging.

---

## 7. Chunk Category Catalog

## 7.1 Core Chunks

Purpose:
- define the recognizable center
- anchor road hierarchy
- host persistent landmarks
- establish settlement identity

Common core subtypes by family:

### Rural Service Village
- green
- square
- millgreen

### Manor Village
- hallcourt
- manorroad
- barncourt

### Roadside Market Town
- mainstreet
- marketcross
- innsquare

### River Market Town
- quaysquare
- inlandmarket
- customsquay

### Garrison Town
- drillsquare
- garrisoncross
- gatecourt

### Crossing Town
- bridgehead
- fordgate
- tollsquare

Core chunk rules:
- at least one landmark anchor
- at least one major road stub
- low to medium reserve growth space
- strong continuity preference across upgrades

---

## 7.2 Residential Chunks

Purpose:
- represent long-term housing stock
- absorb growth and densification
- reflect wealth and class segmentation

Common residential subtypes:
- cottages
- lanecottages
- mixedyard
- rearlane
- frontagerow
- merchanthouses
- laborrows
- noblecourt
- informalcluster

Residential chunk rules:
- must declare household capacity
- must expose density upgrade paths
- must have walkable entrance logic
- should preserve road frontage hierarchy

---

## 7.3 Economic Chunks

Purpose:
- represent trade, storage, workshops, and supporting services

Common subtypes:
- marketstalls
- permanentmarket
- stableyard
- cartyard
- craftlane
- millcluster
- warestrip
- dockstore
- fishlane
- quarryyard
- depotsheds

Economic chunk rules:
- must declare service slots
- should declare temporary throughput capacity
- should support overstrain overlays
- should usually connect to at least one road or quay access edge

---

## 7.4 Military Chunks

Purpose:
- represent coercive authority, defense, and troop support

Common subtypes:
- barracksyard
- armoryyard
- gateapproach
- towerpost
- drillfield
- checkpointgate
- outerworks
- remountyard

Military chunk rules:
- must declare security posture impact
- must declare troop capacity or utility
- may modify adjacent civilian desirability
- should support militarized, fortified, and repressive states

---

## 7.5 Civic / Religious Chunks

Purpose:
- represent administration, religion, legitimacy, relief, and higher services

Common subtypes:
- shrinecourt
- templesquare
- reevehall
- townhall
- courthouse
- reliefyard
- infirmaryyard
- graveyardedge
- hostelcourt

Civic chunk rules:
- should expose service and social function tags
- should often host persistent anchors
- should support prosperous, refugee, recovery, and repressive variants

---

## 7.6 Edge / Transitional Chunks

Purpose:
- mediate urban-to-rural transitions
- hold reserve growth areas
- carry overflow states
- absorb decline or camp attachment

Common subtypes:
- roadfringe
- farmedge
- wallfringe
- suburbedge
- marketedge
- campedge
- degradededge
- recoveryedge
- adhoctransition

Edge chunk rules:
- high importance for expansion logic
- must support multiple edge connection types
- should be primary attachment targets for overlays and temporary structures

---

## 7.7 Terrain Chunks

Purpose:
- adapt settlement logic to terrain constraints

Common subtypes:
- riveredge
- bridgeapproach
- terracelane
- cliffrow
- marshrise
- dockslope
- passroad
- retainingyard

Terrain chunk rules:
- strong terrain class metadata required
- limited compatibility outside matching terrain
- often need unique road and lot rules

---

## 8. Edge Vocabulary

Every chunk edge must declare a compatible edge class.

## 8.1 Edge Class Codes

```text
cr = closed_rural
sr = soft_residential
rr = road_run
ln = lane_run
me = market_edge
de = defensive_edge
re = river_edge
we = wall_edge
ce = camp_edge
ie = industrial_edge
qe = quay_edge
te = terrain_locked_edge
```

Each side of the chunk uses one of these codes.

Example:

```yaml
edge_connections:
  north: rr
  south: sr
  east: sr
  west: cr
```

---

## 8.2 Edge Compatibility Guidelines

### Strong Compatibility
- rr with rr
- ln with ln
- sr with sr
- me with me
- de with de
- qe with qe
- re with re where shoreline logic aligns

### Mediated Compatibility
- rr with me via market-road transition
- sr with cr via soft fringe transition
- de with sr via wall-fringe transition
- ce with sr via camp-edge transition
- ie with sr via mixed-edge buffer

### Disallowed by Default
- qe directly to cr
- de directly to me without gate or transition
- re directly to standard urban edge without retaining or riverbank transition
- te to anything not explicitly matched

---

## 9. Road Stub Vocabulary

Road stubs declare actual connection intent within compatible edge classes.

## 9.1 Road Stub Codes

```text
mr = major_road
sr = secondary_road
ln = lane
yp = yard_path
gr = gate_route
qa = quay_access
wp = wall_path
```

A chunk can have multiple road stubs on one side if authored for more complex connection.

Example:

```yaml
road_stubs:
  - side: north
    type: mr
    offset: 28
  - side: south
    type: sr
    offset: 18
  - side: south
    type: ln
    offset: 45
```

---

## 10. Attach-Point System

Attach points are reserved locations inside or at the edge of a chunk where overlays or district inserts can appear without needing a full replacement.

## 10.1 Attach-Point Types

```text
camp_attach
checkpoint_attach
storage_attach
marketspill_attach
repair_attach
guardpost_attach
yardfill_attach
wall_upgrade_attach
shrinefestival_attach
militaryclutter_attach
```

## 10.2 Attach-Point Metadata

```yaml
AttachPoint:
  id: string
  type: enum
  tile_area: Area
  orientation: enum
  max_footprint_class: enum
  visibility_weight: int
  access_requirement: enum
  blocking_rules: [string]
```

Attach points should be authored especially on:
- edge chunks
- gate chunks
- storage/economic chunks
- civic relief chunks
- military approach chunks

---

## 11. Reserve Growth Zone Standard

Reserve growth zones are pre-authored empty or low-intensity areas intended for future densification or add-on building.

## 11.1 Reserve Zone Purposes
- add new houses
- subdivide lots
- convert gardens to workshops
- insert sheds and service structures
- add density without replacing whole block layout

## 11.2 Reserve Zone Metadata

```yaml
ReserveGrowthZone:
  id: string
  area: Area
  allowed_upgrade_types: [string]
  max_density_target: enum
  preserve_paths: [PathId]
  preserve_landmarks: [MarkerId]
```

Every family should have reserve-heavy chunks in early tiers.

---

## 12. Landmark and Continuity Marker Standard

Continuity markers are objects or layout anchors that should preferably persist through upgrades.

Examples:
- central well
- shrine
- ancient tree
- inn sign location
- hall gate
- bridge ramp
- quay crane
- yard wall line

## 12.1 Continuity Marker Metadata

```yaml
Marker:
  id: string
  type: enum
  tile_position: [x, y]
  persistence_priority: int
  allowed_transformations: [string]
```

Recommended persistence priority:
- 100 = preserve if at all possible
- 75 = preserve in same zone
- 50 = preserve in some altered form
- 25 = optional carry-forward

---

## 13. Upgrade Chain Naming Standard

Upgrade chains should be explicit and inspectable.

## 13.1 Upgrade Rule ID Pattern

```text
upg_<from_chunk_id>__to__<to_chunk_id>
```

Example:

```text
upg_stl_rmt_res_mixedyard_vl_ba_base_a__to__stl_rmt_res_mixedyard_tl_ex_base_a
```

For readability in external docs, you may also use shorter aliases:

```text
rmt_res_mixedyard_a : vl/ba/base -> tl/ex/base
```

## 13.2 Downgrade Rule ID Pattern

```text
dng_<from_chunk_id>__to__<to_chunk_id>
```

## 13.3 Upgrade Classes

```text
growth
density
prosperity
militarization
fortification
overstrain
damage
recovery
decline
repurposing
```

Every upgrade rule should declare one primary class.

---

## 14. District Add-On Attachment Rules

District add-ons should usually be implemented in one of three ways:

### 14.1 Chunk Insertion
A compatible district chunk is added into the settlement footprint.

Use for:
- barracks quarter
- formal storage quarter
- shrine annex
- depot yard
- noble compound

### 14.2 Chunk Replacement
An existing chunk is replaced with a functionally upgraded variant.

Use for:
- market becoming permanent market
- village housing becoming mixed-use frontage
- gate approach becoming checkpointed or fortified

### 14.3 Overlay Attachment
Temporary or moderate changes attached to existing chunks.

Use for:
- camp belt
- storage overflow
- quartering clutter
- relief kitchens
- queue lines
- temporary pens
- scaffold repairs

---

## 15. Per-Family Starter Chunk Lists

Below are recommended first-pass chunk lists for the initial six settlement families.

## 15.1 Rural Service Village (rsv)

### Core
- stl_rsv_core_green_vl_ba_base_a
- stl_rsv_core_square_vm_ex_base_a
- stl_rsv_core_millgreen_vm_ex_pros_a
- stl_rsv_core_square_vm_ex_repr_a

### Residential
- stl_rsv_res_cottages_sr_ba_base_a
- stl_rsv_res_lanecottages_vl_ex_base_a
- stl_rsv_res_mixedyard_vm_ex_base_a
- stl_rsv_res_mixedyard_tl_dn_base_a
- stl_rsv_res_informalcluster_to_sd_refg_a
- stl_rsv_res_cottages_pa_dc_negl_a

### Economic
- stl_rsv_econ_millcluster_vl_ba_base_a
- stl_rsv_econ_stableyard_vl_ex_base_a
- stl_rsv_econ_cartyard_vm_ex_over_a
- stl_rsv_econ_marketstalls_vl_ex_base_a

### Edge / Transition
- stl_rsv_edge_farmedge_sr_ba_base_a
- stl_rsv_edge_roadfringe_vl_ex_base_a
- stl_rsv_edge_campedge_to_sd_refg_a

## 15.2 Manor Village (mnv)

### Core
- stl_mnv_core_hallcourt_vm_ba_base_a
- stl_mnv_core_manorroad_vm_ex_pros_a
- stl_mnv_core_barncourt_vm_ex_base_a

### Residential
- stl_mnv_res_cottages_vl_ba_base_a
- stl_mnv_res_mixedyard_vm_ex_base_a
- stl_mnv_res_noblecourt_tl_ex_pros_a
- stl_mnv_res_informalcluster_to_sd_refg_a

### Economic / Civic
- stl_mnv_econ_grainyard_vm_ex_base_a
- stl_mnv_econ_storeyard_vm_ex_over_a
- stl_mnv_civ_reevehall_vl_ex_base_a

### Edge / Transition
- stl_mnv_edge_farmedge_sr_ba_base_a
- stl_mnv_edge_estatefringe_vm_ex_base_a
- stl_mnv_edge_campedge_to_sd_refg_a

## 15.3 Roadside Market Town (rmt)

### Core
- stl_rmt_core_mainstreet_tl_ba_base_a
- stl_rmt_core_marketcross_tm_ex_base_a
- stl_rmt_core_mainstreet_tm_ex_pros_a
- stl_rmt_core_mainstreet_tm_ex_repr_a

### Residential
- stl_rmt_res_rearlane_vl_ba_base_a
- stl_rmt_res_mixedyard_tl_ex_base_a
- stl_rmt_res_frontagerow_tm_dn_base_a
- stl_rmt_res_frontagerow_th_sd_over_a
- stl_rmt_res_informalcluster_to_sd_refg_a
- stl_rmt_res_rearlane_pa_dc_negl_a

### Economic
- stl_rmt_econ_stableyard_tl_ex_base_a
- stl_rmt_econ_marketstalls_tl_ba_base_a
- stl_rmt_econ_permanentmarket_tm_ex_pros_a
- stl_rmt_econ_craftlane_tm_ex_base_a
- stl_rmt_econ_cartyard_tm_sd_over_a
- stl_rmt_econ_depotsheds_tm_ex_mil_a

### Military / Civic
- stl_rmt_mil_checkpointgate_tm_ex_repr_a
- stl_rmt_mil_barracksyard_tm_ex_mil_a
- stl_rmt_civ_reliefyard_tl_sd_refg_a

### Edge / Terrain
- stl_rmt_edge_roadfringe_vl_ba_base_a
- stl_rmt_edge_marketedge_tl_ex_base_a
- stl_rmt_edge_campedge_to_sd_refg_a

## 15.4 River Market Town (rvt)

### Core
- stl_rvt_core_quaysquare_tm_ba_base_a
- stl_rvt_core_inlandmarket_tm_ex_base_a
- stl_rvt_core_customsquay_tm_ex_mil_a
- stl_rvt_core_quaysquare_tm_ex_pros_a

### Residential
- stl_rvt_res_merchanthouses_tl_ex_pros_a
- stl_rvt_res_laborrows_tl_ex_base_a
- stl_rvt_res_frontagerow_tm_dn_base_a
- stl_rvt_res_informalcluster_to_sd_refg_a

### Economic
- stl_rvt_econ_warestrip_tm_ex_base_a
- stl_rvt_econ_warestrip_tm_dn_over_a
- stl_rvt_econ_dockstore_tm_ex_base_a
- stl_rvt_econ_fishlane_tl_ex_base_a
- stl_rvt_econ_cartyard_tm_ex_base_a
- stl_rvt_econ_depotsheds_tm_ex_mil_a

### Civic / Military / Terrain
- stl_rvt_civ_reliefyard_tl_sd_refg_a
- stl_rvt_mil_barracksyard_tm_ex_mil_a
- stl_rvt_ter_riveredge_tm_ex_base_a
- stl_rvt_ter_bridgeapproach_tm_ex_base_a

## 15.5 Garrison Town (gat)

### Core
- stl_gat_core_drillsquare_tm_ba_base_a
- stl_gat_core_garrisoncross_tm_ex_mil_a
- stl_gat_core_gatecourt_tm_ex_fort_a

### Residential
- stl_gat_res_laborrows_tl_ex_base_a
- stl_gat_res_mixedyard_tl_ex_base_a
- stl_gat_res_frontagerow_tm_dn_mil_a
- stl_gat_res_informalcluster_to_sd_refg_a

### Economic / Military
- stl_gat_econ_depotsheds_tm_ex_mil_a
- stl_gat_econ_cartyard_tm_sd_over_a
- stl_gat_mil_barracksyard_tm_ex_mil_a
- stl_gat_mil_armoryyard_tm_ex_mil_a
- stl_gat_mil_outerworks_tm_ex_fort_a
- stl_gat_mil_checkpointgate_tm_ex_repr_a
- stl_gat_civ_infirmaryyard_tl_ex_recv_a

### Edge
- stl_gat_edge_wallfringe_tl_ex_fort_a
- stl_gat_edge_campedge_to_sd_refg_a
- stl_gat_edge_recoveryedge_tl_recv_a

## 15.6 Crossing Town (crt)

### Core
- stl_crt_core_bridgehead_tm_ba_base_a
- stl_crt_core_tollsquare_tm_ex_base_a
- stl_crt_core_fordgate_tm_ex_repr_a
- stl_crt_core_bridgehead_tm_ex_fort_a

### Residential
- stl_crt_res_rearlane_vl_ba_base_a
- stl_crt_res_mixedyard_tl_ex_base_a
- stl_crt_res_frontagerow_tm_dn_base_a
- stl_crt_res_informalcluster_to_sd_refg_a

### Economic / Military / Terrain
- stl_crt_econ_stableyard_tm_ex_base_a
- stl_crt_econ_cartyard_tm_ex_base_a
- stl_crt_econ_depotsheds_tm_ex_mil_a
- stl_crt_mil_checkpointgate_tm_ex_repr_a
- stl_crt_mil_outerworks_tm_ex_fort_a
- stl_crt_ter_bridgeapproach_tm_ex_base_a
- stl_crt_ter_passroad_tl_ex_base_a

### Edge
- stl_crt_edge_roadfringe_vl_ba_base_a
- stl_crt_edge_campedge_to_sd_refg_a
- stl_crt_edge_wallfringe_tl_ex_fort_a

---

## 16. Overlay Asset Naming Convention

Overlays should use a separate but parallel naming scheme.

### Pattern

```text
ovl_<type>_<context>_<intensity>_<variant>
```

Examples:

```text
ovl_camp_refugee_med_a
ovl_storage_spill_high_a
ovl_checkpoint_tax_low_b
ovl_repair_scaffold_med_a
ovl_marketspill_trade_high_a
ovl_military_quartering_med_a
```

### Overlay Type Suggestions
```text
camp
checkpoint
storage
repair
marketspill
guardpost
rubble
festival
military
queue
pen
```

### Intensity Codes
```text
low
med
high
```

---

## 17. Validation Rules for the Catalog

The generator or asset validator should enforce:

### 17.1 Naming Rules
- every chunk ID must match canonical pattern
- family code must be valid
- category code must be valid
- density/tier/condition codes must be valid

### 17.2 Connectivity Rules
- every chunk must declare all four edge classes
- every chunk with roads must declare road stubs
- terrain-locked chunks must specify terrain constraints

### 17.3 Upgrade Rules
- no upgrade may remove all continuity markers unless explicitly marked catastrophic
- all growth chunks must have at least one legal prior or subsequent state unless intentionally terminal

### 17.4 Capacity Rules
- residential chunks require permanent household capacity
- economic chunks require at least one service or throughput tag
- military chunks require troop/security utility tags
- refugee or overflow chunks require temporary capacity tags

---

## 18. Recommended First Asset Pass

First pass should not try to complete the whole catalog.

Build these first:

### For each initial family
- 2 core chunks
- 3 residential chunks
- 2 economic chunks
- 1 edge chunk
- 1 strained/refugee overlay-ready chunk
- 1 militarized or fortified chunk

That is enough to test:
- settlement identity
- growth
- strain
- militarization
- recovery continuity

After that, add:
- decline variants
- prosperous variants
- special district add-ons
- terrain-special connectors

---

## 19. Implementation Notes for the AI Programmer

The AI programmer should treat this catalog as a constrained search space, not an open grammar.

Selection order should be:
1. choose compatible family
2. choose needed category mix
3. choose chunk IDs with compatible edges and roads
4. choose condition or upgrade variants
5. apply overlays at attach points
6. validate continuity and capacity coverage

The programmer should not attempt to infer chunk meaning from raw geometry alone. The metadata and naming convention are the source of truth.

---

## 20. Recommended Next Document

The next useful document is:

**Building Footprint and Interior Grammar Catalog**

That should define:
- exact building archetype IDs
- lot frontage/depth rules
- building upgrade paths
- interior room grammars
- furnishing tiers
- mixed-use conversion rules

That will connect the chunk catalog to the enterable-building layer.
