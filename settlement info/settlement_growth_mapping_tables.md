# Settlement Growth Mapping Tables
## Simulation-to-Physicalization Mapping Spec for Chunk-Based Settlements

## 1. Purpose

This document defines the mapping layer between the strategic settlement simulation and the physical settlement asset library.

Its purpose is to translate strategic state into concrete physical outputs such as:

- settlement footprint expansion
- district emphasis changes
- chunk family selection
- density upgrades
- building mix adjustments
- service availability
- temporary encampments
- military insertions
- refugee accommodation
- neglect, damage, and recovery states

This document does **not** replace the strategic simulation.  
It assumes that simulation values and state categories already exist.

This document answers:

- how much housing should a settlement physically show?
- when does growth appear as new chunks versus denser lots?
- how many service buildings should a given town support?
- when do camps, depots, checkpoints, and overflow markets appear?
- how do prosperity, strain, militarization, or decline change the built form?

---

## 2. Mapping Philosophy

The purpose of the mapping layer is not exact realism at census precision.

Its purpose is to produce:

- visually legible settlement change
- physical coherence
- stable asset selection rules
- enough numerical consistency to support gameplay

Therefore the mapping tables should be:

- broad and robust
- easy to tune
- tolerant of simulation noise
- more concerned with readable thresholds than tiny continuous variation

The world should feel consistent, not mathematically rigid.

---

## 3. Core Input Variables

The mapping layer should consume a compact set of high-value inputs.

## 3.1 Settlement Identity Inputs
- settlement class
- settlement family
- role tags
- terrain context
- district layout history
- prior physical state

## 3.2 Core Numeric Inputs
- permanent population
- temporary population
- food balance
- wealth surplus
- order
- loyalty
- infrastructure capacities
- military utility
- throughput values
- pressure values

## 3.3 Derived State Inputs
- economic state
- security state
- political state
- physical state
- traffic state
- adaptation mode

These derived states should be primary driver inputs where possible because they reduce excessive branching.

---

## 4. Population to Household Mapping

Permanent population should first be translated into physical household demand.

## 4.1 Household Assumptions

Recommended broad household assumptions:

```text
low-status rural household: 5 to 6 persons
standard village household: 4 to 5 persons
urban labor household: 4 to 5 persons
artisan household: 4 to 6 persons
merchant household: 3 to 6 persons + staff
elite household: 3 to 10 persons + retainers/servants
```

Use a simple baseline for most calculations:

```text
default_household_size = 5
```

---

## 4.2 Permanent Household Calculation

```text
required_households = ceil(permanent_population / default_household_size)
```

This should then be adjusted by social profile if desired.

### Optional weighted refinement

```text
peasants_smallholders = population / 5.5
laborers = population / 4.8
artisans_merchants = population / 4.5
elites_retainers = population / 6.0
clergy = population / 5.0
garrison = handled separately
```

For first-pass implementation, a single divisor of 5 is enough.

---

## 4.3 Housing Buffer Rule

Settlements should generally carry some excess housing or sleeping capacity.

Recommended target:

```text
target_housing_capacity = permanent_population * 1.10 to 1.20
```

Suggested baseline:

```text
target_housing_capacity = permanent_population * 1.15
```

This allows:
- family growth
- vacancy
- status differentiation
- non-crisis lodging flexibility

Low-order or rapidly growing settlements may fall below this target.

---

## 5. Temporary Population Accommodation Mapping

Temporary population should not normally be treated as ordinary households.

## 5.1 Temporary Population Categories
- traders and caravan staff
- pilgrims
- seasonal laborers
- refugees
- military support staff
- camp followers
- passing troops
- levy musters

## 5.2 Accommodation Modes

Temporary population should map into one or more of:

- inn beds
- boarding houses
- shrine hostels
- barracks overflow
- billets in ordinary houses
- temporary shelter rows
- camp belts
- relief halls
- warehouse or stable reuse in emergency states

## 5.3 Temporary Capacity Thresholds

Recommended bands:

```text
0% to 5% of permanent population:
  absorbed with no major visible change

5% to 15%:
  visible crowding in inns, markets, and yards

15% to 30%:
  overflow lodging, billets, temporary structures likely

30% to 60%:
  camp belts, relief yards, storage strain, sanitation decline likely

60%+:
  emergency settlement state; major crowding, strong overlays, possible slum or refugee quarter formation
```

These percentages refer to:

```text
temporary_population / permanent_population
```

---

## 6. Settlement Size Tier Mapping

Size tier should be selected from permanent population, district complexity, and prior state.

These are broad default ranges.  
Final tuning should vary by settlement family and role.

## 6.1 Suggested Population Ranges by Tier

```text
Established Base:
  80 to 250

Expanded:
  200 to 600

Dense:
  500 to 1,500

Strained Dense:
  500 to 1,500 permanent, with strain or temporary excess

Declining:
  any population band if capacity, wealth, or upkeep have fallen

Major Hub:
  1,200+
```

These are not city-history claims.  
They are gameplay-facing visual settlement bands.

---

## 6.2 Tier Selection Guidance

### Established Base
Use when:
- the settlement is meaningful but simple
- one dominant center exists
- limited district differentiation
- no sustained overflow

### Expanded
Use when:
- one or more district additions exist
- regular trade or military support is visible
- edge growth has occurred

### Dense
Use when:
- infill and attached frontage dominate important zones
- service variety is broader
- core roads are mature and crowded

### Strained Dense
Use when:
- density is high
- infrastructure strain is visible
- temporary or military loads exceed comfortable absorption

### Declining
Use when:
- the settlement is below expected maintenance or occupancy for its footprint
- lots are abandoned
- market and housing are underfilled

### Major Hub
Use when:
- multiple district anchors coexist
- redundant services appear
- social segmentation is strong
- multiple traffic types are visible

---

## 7. Density Target Tables by District

District density should be determined by settlement tier, district type, and current condition.

## 7.1 Base District Density Table

| District Type | Established Base | Expanded | Dense | Strained Dense | Declining | Major Hub |
|---|---:|---:|---:|---:|---:|---:|
| Core | vm | tl | tm | tm/th | tl | th |
| Residential Low | sr/vl | vl | tl | tl/tm | sr/vl | tl |
| Residential Medium | vl | vm/tl | tm | tm/th | vl | tm |
| Residential High | n/a | tl | tm/th | th | tl | th |
| Market | vl/vm | tl | tm | tm/th | vl/tl | th |
| Artisan | vl | tl | tm | tm | vl | tm/th |
| Warehouse / Storage | vl | tl | tm | tm/th | vl | tm/th |
| Military | vl | tl | tm | tm/th | tl | tm/th |
| Civic / Religious | vl | vm/tl | tl/tm | tl/tm | vl | tm |
| Noble | n/a or vl | tl | tl/tm | tl | vl | tm |

Codes:
- sr = sparse rural
- vl = village low
- vm = village medium
- tl = town low
- tm = town medium
- th = town high

---

## 7.2 Condition Modifiers to Density

### Prosperous
- raise market and merchant-facing districts by one sub-band where possible
- prefer quality before extreme crowding in elite districts

### Militarized
- raise military, storage, and gate-adjacent district intensity
- may suppress civic comfort or elite residential growth

### Refugee-Swollen
- add temporary overflow density at edge, relief, and low residential districts
- do not automatically raise formal core density unless prolonged

### Overstrained
- add clutter and overflow before formal density changes
- if sustained, convert reserve growth zones and subdivide low-status lots

### Neglected / Declining
- reduce effective occupied density without shrinking all geometry immediately
- prefer partial abandonment and underused lots

---

## 8. Housing Capacity by Building Type

Use these broad capacity values for mapping.

## 8.1 Residential Capacity Table

| Building Type | Household Capacity | Resident Capacity Estimate |
|---|---:|---:|
| Cottage Small | 1 | 4-5 |
| Cottage Expanded | 1 | 5-6 |
| Longhouse | 1-2 | 6-10 |
| Row Unit | 1 | 4-6 |
| Dense Row Pair / Duplex | 2 | 8-12 |
| Boarding House | 3-8 transient groups | 10-30 transient |
| Merchant House | 1 + staff | 5-12 |
| Noble House | 1 elite household + staff | 8-25 |
| Shelter Row | temporary only | 6-20 |
| Barracks | troop capacity only | 10-60 soldiers |

For normal household accounting, ignore barracks and temporary shelters unless a pressure rule explicitly converts them.

---

## 8.2 Density by Building Mix Guidance

### Village Low
- detached cottages
- longhouses
- small artisan houses
- wide yard spacing

### Village Medium
- detached + semi-attached mix
- modest artisan/workshop houses
- limited frontage compression

### Town Low
- more attached frontages
- shop-house beginnings
- rear sheds and secondary structures
- more formal lane structure

### Town Medium
- regular mixed-use frontage
- row units and denser labor housing
- storage behind shop fronts
- more vertical separation in interiors

### Town High
- narrow lots
- attached rows
- dense mixed-use cores
- reduced private yard area
- stronger alley and rear-building presence

---

## 9. Chunk Household Capacity Targets

Each chunk should carry broad target capacity by density band and family type.

## 9.1 Generic Capacity Bands per 64 x 64 Chunk

| Density Band | Approx. Household Capacity | Notes |
|---|---:|---|
| sr | 1-3 | sparse edge, hamlet fringe, farm-linked |
| vl | 4-8 | detached village housing |
| vm | 6-12 | mixed detached/semi-attached village |
| tl | 10-18 | low town density |
| tm | 16-28 | medium town density |
| th | 24-40 | high-density core or labor districts |
| to | temporary capacity only | tents, overflow, shelters |
| pa | variable, partially occupied | decline or abandonment |

These are target envelopes, not exact quotas.

---

## 9.2 Family Capacity Modifiers

### Manor Village
- more land-hungry
- lower household count at same visual size

### Roadside Market Town
- medium capacity, strong mixed-use frontage

### River Market Town
- higher labor and merchant density near quay/core

### Garrison Town
- some land diverted to military use, lowering civilian housing in core chunks

### Crossing Town
- core may prioritize inns, stables, and storage over household count

---

## 10. Service Threshold Mapping

Services available to the player should map from settlement size, role, and special district emphasis.

## 10.1 Baseline Service Thresholds by Settlement Class

| Service | Small Village | Large Village / Expanded Village | Market Town | Fortified / Garrison Town | City / Major Hub |
|---|---|---|---|---|---|
| Lodging | maybe | yes | yes, multiple possible | yes | yes |
| Basic food / tavern | maybe | yes | yes | yes | yes |
| Basic smith / repair | maybe | yes | yes | yes | yes |
| General trader | rare | maybe | yes | yes | yes |
| Dedicated market square | no | maybe | yes | yes | yes |
| Temple / shrine services | shrine | yes | yes | yes | yes |
| Local administration | no or minimal | minimal | yes | yes | yes |
| Barracks / formal watch | rare | maybe | maybe | yes | yes |
| Advanced military services | no | no | rare | yes | yes |
| Multiple specialist artisans | no | rare | maybe | maybe | yes |
| Moneychanger / banker | no | no | rare | rare | yes |
| Infirmary / relief hall | rare | maybe | maybe | yes | yes |

---

## 10.2 Service Slot Counts by Tier

| Tier | Lodging Slots | Trade Slots | Craft Slots | Civic Slots | Military Slots |
|---|---:|---:|---:|---:|---:|
| Established Base | 0-2 | 0-2 | 0-2 | 0-1 | 0-1 |
| Expanded | 1-3 | 1-4 | 1-3 | 1-2 | 0-2 |
| Dense | 2-5 | 2-6 | 2-5 | 1-3 | 1-3 |
| Strained Dense | 2-5 + overflow | 2-6 + informal | 2-5 | 1-3 + relief | 1-4 |
| Declining | 0-3 active | 0-3 active | 0-2 active | 0-2 | 0-2 |
| Major Hub | 4+ | 5+ | 4+ | 3+ | 2+ |

These are total active service opportunities, not necessarily unique landmark buildings.

---

## 10.3 Role Tag Service Modifiers

### Grain Basin / Pastoral
- prioritize mills, granaries, stables, cart sheds

### River Trade / Port
- prioritize warehouse, dock sheds, customs, inns, traders

### Border Market / Crossing
- prioritize inns, stables, checkpoint/toll services, repair

### Pilgrimage / Monastic Center
- prioritize shrine services, hostel, relief, food service

### Border Watch / Muster Point / Supply Depot
- prioritize barracks, armory, depot sheds, infirmary, remount support

### Administrative / Noble Seat
- prioritize hall, court, merchant house, paved core, elite residence

---

## 11. Building Mix Targets by District

Each district type should prefer certain building mixes.

## 11.1 Residential Low
Typical mix:
- 60-80% cottages or longhouses
- 10-25% artisan houses
- 0-10% small service structures
- 0-15% temporary overflow in strain states

## 11.2 Residential Medium
Typical mix:
- 35-60% cottages / row units
- 20-35% artisan houses or mixed-use
- 5-15% boarding / lodging in high-traffic zones
- 0-10% civic or shrine minor structures

## 11.3 Residential High
Typical mix:
- 35-60% row units / dense rows
- 20-35% shop-houses or mixed-use
- 10-20% boarding / labor lodging
- little private yard space

## 11.4 Market District
Typical mix:
- 20-40% shop-houses
- 10-25% inns / boarding
- 10-25% market structures / stalls
- 10-20% storage / back-store buildings
- 10-20% merchant houses or mixed-use upper residences

## 11.5 Artisan District
Typical mix:
- 30-50% artisan houses
- 20-35% dedicated workshops
- 10-20% mixed-use shop/work frontage
- 5-15% labor housing

## 11.6 Warehouse / Storage District
Typical mix:
- 35-60% warehouses / granaries / depots
- 10-25% cart or stable support
- 10-20% worker lodging
- 0-15% guard or checkpoint buildings

## 11.7 Military District
Typical mix:
- 30-50% barracks / troop housing
- 15-30% armory / supply / stables
- 10-20% service buildings
- 10-20% civilian support or labor housing

## 11.8 Civic / Religious District
Typical mix:
- 20-40% main public buildings
- 10-25% lodging/hostel/relief
- 10-20% attendant housing
- 10-20% storage or support
- remainder as open court, processional, or grave space

---

## 12. Growth Mode Selection Rules

When housing or function demand rises, the mapping layer should decide between infill, expansion, densification, or temporary relief.

## 12.1 Expansion Mode
Use when:
- nearby compatible edge chunks exist
- land is available
- order and planning capacity are adequate
- growth is durable

Visible results:
- new edge chunks
- new roads or extended lanes
- new detached or medium-density housing
- new district add-on chunks

## 12.2 Densification Mode
Use when:
- expansion is constrained
- core traffic is high
- land value or pressure is high
- settlement is mature

Visible results:
- lot subdivision
- cottages to row units
- residences to shop-houses
- rear-yard infill
- second stories
- denser cores

## 12.3 Temporary Relief Mode
Use when:
- growth is probably temporary
- refugee, military, or seasonal pressure is high
- order is too weak for formal buildout
- relief response is faster than formal construction

Visible results:
- camp belts
- shelter rows
- relief yards
- overflow storage
- billets and overcrowding

## 12.4 Functional Growth Mode
Use when:
- same population, but strategic role intensifies
- trade, military, or religious activity rises

Visible results:
- depots
- barracks
- inns
- warehouses
- shrine annexes
- checkpoints
- market expansion

---

## 13. Housing Stress Thresholds

Housing stress should be one of the main drivers of visible change.

## 13.1 Housing Stress Ratio

```text
housing_stress = permanent_population / current_formal_housing_capacity
```

## 13.2 Threshold Bands

```text
0.00 - 0.85:
  comfortable, no growth pressure

0.85 - 0.95:
  early pressure; consider filling reserve lots

0.95 - 1.05:
  active growth needed; expansion or densification likely

1.05 - 1.20:
  visible crowding; add overflow signs, boarding expansion, possible temporary structures

1.20+:
  crisis; camp belt, slum edge, billets, shelter rows, rapid densification or unrest
```

---

## 14. Market and Trade Pressure Mapping

Trade opportunity and throughput should create visible changes even without large permanent population growth.

## 14.1 Trade Opportunity Bands

```text
low:
  only basic exchange

moderate:
  stable market and regular trader presence

high:
  visible market expansion, storage, inns, shop-house conversions

very high:
  expanded market district, warehouse quarter, more mixed-use frontage, carriage/stable support
```

## 14.2 Trade Output Mapping

### Moderate Trade Opportunity
- one market chunk or expanded square possible
- shop-house conversion chance increases
- stable or cart yard likely if road node

### High Trade Opportunity
- permanent market frontage
- second inn or larger inn
- warehouse strip or storage quarter
- merchant houses
- better road wear and hardening

### Very High Trade Opportunity
- multiple economic chunks
- customs, toll, or counting functions
- denser market frontage
- more mixed-use cores
- more temporary traders and caravan overflow

---

## 15. Military Pressure Mapping

Border pressure and military posture should alter both function and traffic.

## 15.1 Military Pressure Bands

```text
low:
  ordinary watch or occasional patrol

moderate:
  visible patrols, watch posts, some quartering

high:
  barracks growth, checkpoints, depots, fortified gates, troop traffic

very high:
  heavy militarization, camps, stockpiles, coercive order measures, civilian crowding or requisition strain
```

## 15.2 Military Output Mapping

### Moderate
- guard post overlays
- watch house or small barracks possible
- gate chunk may harden

### High
- barracks quarter or barracks chunk insertion
- depot yard
- checkpoint gate
- drill yard or armory support
- inn requisition variants

### Very High
- outerworks or fortified edges
- camp belts for troops/support staff
- storage overflow
- reduced market comfort
- stronger civilian resentment signals

---

## 16. Refugee and Migration Pressure Mapping

Refugees and migration should be a major non-conquest driver of visible change.

## 16.1 Refugee Pressure Bands

```text
minor:
  extra crowding in inns, shrines, and yards

moderate:
  relief yard, temporary shelters, visible lines and aid structures

high:
  camp belt, shelter rows, overcrowded low districts, food and sanitation strain

severe:
  semi-permanent edge quarter, slum formation, coercive controls, unrest risk
```

## 16.2 Refugee Output Mapping

### Moderate
- shrine annex relief use
- relief hall or kitchen
- lodging overstrain
- some edge shelters

### High
- camp belt chunk or overlays
- shelter rows
- market clutter and aid queues
- increased petty trade and scavenging

### Severe
- slum edge formation
- edge lots subdivided
- long-term informal district risk
- checkpoint or ration control structures

---

## 17. Prosperity and Elite Ambition Mapping

Prosperity should not only mean “more houses.”  
It should also mean better houses, better roads, and stronger institutions.

## 17.1 Prosperity Bands

```text
low:
  survival or stagnation

moderate:
  maintenance, modest infill, small business support

high:
  visible improvement, richer market, larger merchant presence, road hardening

very high:
  civic works, elite compounds, temple expansion, formalized districts
```

## 17.2 Prosperity Output Mapping

### Moderate
- repairs complete
- modest shop-house conversion
- better market organization

### High
- prosperous core variants
- merchant house variants
- expanded market chunk
- paved or improved approaches
- larger civic structures

### Very High
- noble compound
- temple hall or civic hall upgrade
- elite residences
- stronger class contrast
- better-furnished interiors

---

## 18. Decline and Neglect Mapping

Decline should be gradual and legible.

## 18.1 Decline Indicators
- wealth low or falling
- order weak
- maintenance below need
- trade reduced
- population stagnant or falling
- war damage unresolved

## 18.2 Decline Output Mapping

### Early Decline
- fewer market stalls active
- neglected façades
- reduced clutter density
- some empty lots or shuttered frontages

### Moderate Decline
- partial abandonment chunks
- inactive workshops
- lower service availability
- collapsing outbuildings
- edge retreat

### Severe Decline
- damaged or abandoned ring
- heavily reduced market function
- missing roof sections
- civic decay
- poorer interiors and unused rooms

---

## 19. Damage and Recovery Mapping

Damage should create temporary but meaningful state changes.

## 19.1 Damage Levels

```text
light:
  local repairs, isolated roof or wall damage

moderate:
  rubble lots, blocked streets, damaged public buildings

heavy:
  chunk replacement to damaged variants, strong service loss, camp or labor response
```

## 19.2 Recovery Output Mapping

### Light Recovery
- scaffold overlays
- lumber stacks
- patch repairs

### Moderate Recovery
- recovering chunk variants
- relief and labor sheds
- rerouted access
- partial reoccupation

### Heavy Recovery
- rebuilding district emphasis
- temporary worker camps
- long-term reduced service capacity until rebuilt

---

## 20. Settlement Footprint Expansion Rules

Expansion should be discrete and legible.

## 20.1 Expansion Trigger Conditions

A settlement should consider adding new chunks when:

- housing stress >= 0.95
- or function demand exceeds existing district capacity
- and edge chunk candidates exist
- and expansion land is suitable
- and growth is likely durable

## 20.2 Expansion Priority Order

Suggested order:
1. fill reserve lots in current footprint
2. convert low-intensity edge chunks
3. add new edge-adjacent chunks with road continuity
4. add specialized district chunks
5. only then consider major new annexes

---

## 21. District Add-On Triggers

## 21.1 Expanded Market
Trigger when:
- trade opportunity high
- order moderate or better
- market strain present
- one existing market core already exists

## 21.2 Storage Quarter
Trigger when:
- supply flow or trade flow high
- grain, port, or military role present
- storage strain sustained

## 21.3 Barracks Quarter
Trigger when:
- military pressure high
- kingdom policy militarized
- troop or quartering load sustained

## 21.4 Shrine Annex
Trigger when:
- pilgrimage or relief activity high
- legitimacy/patronage emphasis active

## 21.5 Camp Belt
Trigger when:
- temporary population high
- formal housing capacity exceeded
- relief or military pressure significant

## 21.6 Checkpoint Gate
Trigger when:
- repressive or tense security posture
- border pressure or tax control high
- a major movement route exists

## 21.7 Slum Edge
Trigger when:
- housing crisis sustained
- low order and low wealth
- migration or labor influx remains unresolved over time

---

## 22. Mixed-Use Conversion Thresholds

Mixed-use conversion is one of the most efficient visual signs of town maturation.

## 22.1 Residential to Shop-House Conversion
Eligible when:
- lot fronts primary/secondary road
- road traffic high
- trade opportunity moderate+
- district is core, market, or artisan-adjacent
- frontage visibility high

## 22.2 Residential to Artisan House Conversion
Eligible when:
- craft demand moderate+
- artisan district emphasis active
- lot has yard or rear access

## 22.3 Shop-House to Merchant House Upgrade
Eligible when:
- prosperity high
- stable traffic
- medium/high wealth district
- larger frontage or corner lot available

---

## 23. Temporary Overlay Intensity Rules

Temporary overlays should scale by severity.

## 23.1 Overlay Intensity Table

| State Driver | Low | Medium | High |
|---|---|---|---|
| Trade Spillover | a few extra stalls/carts | visible market overflow | packed trade yards, queueing, temporary trade lanes |
| Military Quartering | gear and a few guards | temporary bunks, supply stacks | troop camp spillover, requisition clutter |
| Refugee Presence | edge shelters | camp lines, relief kitchens | camp belt, dense shelter rows |
| Recovery Work | small scaffold | blocked lane, repair stores | labor camp, debris yards, major reconstruction |
| Storage Strain | stacked goods | overflow yard use | improvised depots, guarded storage sprawl |

---

## 24. Example Mapping Profiles

## 24.1 Greyford Example

**Settlement Family**
- river market town

**Permanent Population**
- 420

**Temporary Population**
- 110

**Derived States**
- economic: growing
- security: tense
- political: compliant
- physical: expanding
- traffic: military-heavy
- adaptation mode: fortify and stockpile

### Mapped Physical Outputs
- size tier = Expanded, nearing Dense
- district emphasis = market + storage + military
- housing stress modest but rising
- one barracks or depot-oriented chunk insertion
- warehouse/storage quarter expansion
- checkpointed quay or gate
- temporary overflow lodging and supply clutter
- possible inn militarized variant
- no full slum edge yet unless pressure persists

---

## 24.2 Shrine Town Example

**Permanent Population**
- 260

**Temporary Population**
- 180 during festival season

**Derived States**
- economic: active
- security: watchful
- physical: overstrained
- traffic: pilgrim-heavy
- adaptation mode: emergency relief

### Mapped Physical Outputs
- size tier remains Expanded
- temporary state drives camp belts and relief yards
- shrine annex use intensifies
- lodging and boarding overstrain
- market spillover
- edge shelters and temporary kitchens
- little permanent housing growth unless seasonality becomes persistent

---

## 24.3 Border Garrison Example

**Permanent Population**
- 340

**Temporary Population**
- 70 troops/support staff

**Derived States**
- economic: stagnant
- security: militarized
- political: resentful
- physical: fortified
- traffic: military-heavy
- adaptation mode: militia mobilization

### Mapped Physical Outputs
- barracks quarter expansion
- checkpoint gate and armory support
- some inns or houses in militarized/billet variants
- depot yard
- stronger wall or outerworks chunk variants
- reduced comfort in market/civic areas
- no prosperity upgrade despite stable population

---

## 25. Implementation Tables for First Pass

## 25.1 Housing Need Table

| Permanent Population | Target Formal Housing Capacity | Typical Physical Response |
|---:|---:|---|
| 80 | 92 | base village stock |
| 120 | 138 | fill reserve lots |
| 200 | 230 | add village/edge chunk or densify low district |
| 300 | 345 | new residential chunk and some mixed-use conversion |
| 500 | 575 | expanded district and denser core |
| 800 | 920 | dense rows, larger market, more specialist housing |
| 1,200 | 1,380 | multi-district dense town / major hub logic |

---

## 25.2 Temporary Load Table

| Temporary / Permanent Ratio | Physical Response |
|---:|---|
| 0.00 - 0.05 | no major visible accommodation needed |
| 0.05 - 0.15 | inns and yards visibly crowded |
| 0.15 - 0.30 | overflow lodging, billets, some temporary structures |
| 0.30 - 0.60 | camp belts, relief yards, serious clutter and strain |
| 0.60+ | emergency state, possible long-term informal quarter |

---

## 25.3 Militarization Table

| Military Pressure | Outputs |
|---|---|
| Low | routine guards, maybe watch overlay |
| Moderate | watch house, small gate hardening, patrol clutter |
| High | barracks chunk, checkpoint gate, depot yard |
| Very High | outerworks, camp spillover, billet pressure, coercive overlays |

---

## 25.4 Trade Opportunity Table

| Trade Opportunity | Outputs |
|---|---|
| Low | baseline exchange only |
| Moderate | stable market, one or two mixed-use conversions |
| High | expanded market, stable/cart support, merchant housing |
| Very High | storage quarter, multiple inns, customs/toll support, denser market frontage |

---

## 26. First-Pass Generation Order

Recommended mapping order:

1. determine tier from permanent population and prior state
2. compute formal housing target
3. compare current housing capacity to target
4. map temporary population to overflow needs
5. determine district density targets
6. determine district add-ons from adaptation mode and pressures
7. determine service slot needs
8. choose expansion vs densification vs temporary overlays
9. select chunk and building upgrades
10. apply condition overlays and intensity
11. validate capacity, connectivity, and continuity

---

## 27. Tuning Priorities

When tuning, prioritize these in order:

1. visual legibility of change
2. continuity of place identity
3. believable district emphasis
4. stable service availability
5. rough capacity plausibility
6. finer social realism

The player should notice that a town changed for a reason.  
That matters more than perfect demographic simulation.

---

## 28. Recommended Next Document

The next useful document is:

**Settlement Update Algorithm and Pseudocode Spec**

That should define:

- monthly update order
- pressure-to-adaptation selection logic
- chunk selection pseudocode
- district upgrade selection pseudocode
- overlay application order
- validation routines
- persistence and revisit behavior
- how previous physical states are preserved through updates
