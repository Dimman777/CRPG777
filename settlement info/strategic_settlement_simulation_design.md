# Strategic Settlement Simulation Design Document

## Purpose

This system is **not** a full QuadX game running behind the RPG. It is a **strategic pressure-and-adaptation simulator** for established kingdoms and nations. Its purpose is to generate believable changes in settlements, roads, border regions, and local economies so the player experiences a living world at the micro RPG level.

The core goal is to answer questions such as:

- Why is this town richer, poorer, more fortified, or more crowded than before?
- Why are there more patrols, caravans, troops, refugees, pilgrims, or laborers on the road?
- Why did a new barracks, market extension, shrine complex, or slum edge appear?
- Why do some regions feel stable and prosperous while others feel tense, militarized, or neglected?

This system is **not primarily about settlement founding, optimal city build orders, or map painting**. It is about producing visible local consequences from strategic pressures.

---

## Design Goals

1. **Established kingdoms first**
   - Most realms begin already settled.
   - Most settlements start at a meaningful baseline size and function.
   - Very few places begin as tiny frontier villages.

2. **Strategic simulation in service of the RPG**
   - The strategic layer exists to create visible, playable consequences.
   - Any hidden variable should ideally drive map changes, NPC behavior, traffic, quests, prices, or services.

3. **Pressure over optimization**
   - Settlements react to pressures rather than solving a city-building puzzle.
   - Kingdom AI should prioritize strategic adaptation, not perfect economic play.

4. **Change without conquest**
   - Wars matter, but major visible change should also come from taxation, military buildup, trade shifts, refugee flows, local unrest, bad harvests, noble patronage, and infrastructure strain.

5. **Physicalized growth**
   - Settlement growth is represented through chunk/state selection and overlays, not purely abstract numbers.
   - A town can visibly change through density, district emphasis, fortification, camps, and traffic even without major permanent population growth.

---

## Core Concept

Each settlement is treated as a **strategic node** inside a kingdom network.

A settlement converts:

- population
- food
- local production
- trade access
- security
- policy pressure
- military needs
- elite interests

into:

- goods
- taxes
- manpower
- order or unrest
- military support
- local growth or decline
- visible world-state changes

A settlement is therefore not just a "city" but a **regional organ** with a role in administration, supply, defense, exchange, and social control.

---

## What the Strategic Layer Simulates

### 1. Stability
Whether the settlement and the realm can function normally.

Includes:
- tax collection
- food supply
- local order
- road safety
- administrative reach
- legitimacy of rule

### 2. Throughput
How people, goods, and force move through the network.

Includes:
- trade traffic
- grain shipments
- messenger speed
- troop movements
- caravan density
- depot use
- port/river throughput

### 3. Pressure
What internal and external forces are acting on the settlement.

Includes:
- border threat
- migration
- refugees
- banditry
- unrest
- taxation
- poor harvests
- political agitation
- religious tension
- military requisitioning

### 4. Adaptation
How the settlement responds.

Includes:
- fortification
- market expansion
- storage construction
- militia musters
- barracks growth
- shrine and patronage projects
- checkpoints and coercive measures
- camps and emergency infrastructure

### 5. Expression
What the player actually sees in the RPG layer.

Includes:
- more houses or denser blocks
- barracks, depots, walls, shrines, warehouses
- refugee camps
- checkpoints
- extra patrols
- trampled fields
- richer markets
- abandoned structures
- changed traffic and NPC composition

---

## Settlement Identity Model

A settlement is defined by three major things:

- **Class**: what general type of place it is
- **Size**: how large and complex it is
- **Role Tags**: what it does within the realm

Size alone should never define behavior.

---

## Settlement Classes

### Hamlet / Small Village
Primarily agricultural or extraction support.

Strategic function:
- food production
- local labor
- very limited manpower
- low-value local logistics

Micro expression:
- sparse permanent structures
- barns, mills, shrine, manor outbuildings
- vulnerable to raids and requisitioning

### Large Village / Village Cluster
A stronger rural service center.

Strategic function:
- grain collection
- milling
- livestock handling
- local exchange
- modest militia mustering

Micro expression:
- larger square
- blacksmith, inn, reeve hall, shrine
- simple local defenses in insecure regions

### Market Town
The core settlement type for many kingdoms.

Strategic function:
- regional exchange
- taxation
- artisan activity
- local administration
- temporary troop quartering

Micro expression:
- market square
- inns, stables, warehouses
- artisan streets
- moderate suburban growth
- ditch, palisade, or early walls in some cases

### Fortified Town / Garrison Town
A defense and control node.

Strategic function:
- troop staging
- depots
- patrol generation
- local coercive authority
- refugee concentration under stress

Micro expression:
- barracks
- armories
- walls, towers, drill yards
- frequent patrol movement
- civilian layout shaped by military needs

### City
A major hub of administration, commerce, religion, or production.

Strategic function:
- high tax output
- craft concentration
- elite residence
- redistribution and command
- major manpower pool

Micro expression:
- multiple districts
- class segmentation
- temples, guild halls, compounds, dense markets
- sustained construction and maintenance

### Great City / Capital
A rare top-tier seat of power.

Strategic function:
- court politics
- treasury
- strategic depots
- diplomacy
- high symbolic value

Micro expression:
- monumental works
- layered social districts
- large administrative and elite footprint
- major slum/service zones
- strong law presence

---

## Settlement Role Tags

Role tags drive adaptation and distinguish places of equal size.

### Economic Roles
- Grain Basin
- Pastoral
- Fishing
- Timber
- Quarry
- Mine
- River Trade
- Port
- Craft Center
- Textile Center
- Horse Breeding
- Salt
- Border Market
- Pilgrimage
- Administrative
- Estate Hub

### Strategic Roles
- Border Watch
- Fortress Anchor
- River Crossing
- Mountain Pass Control
- Supply Depot
- Muster Point
- Naval Yard
- Refuge Intake
- Royal Seat
- Rebel-Prone District Center

### Social / Political Roles
- Noble Seat
- Monastic Center
- Mercantile Hub
- Militarized Colony
- Ethnically Mixed Town
- Frontier Resettlement Site

Role tags determine which adaptation packages are most likely and most effective.

---

## Core Settlement State Variables

These should remain compact and high-value. Every tracked variable should have visible downstream effects.

### Population
Track broad population groups rather than detailed demographics.

Suggested groups:
- Peasants / smallholders
- Town laborers
- Artisans / merchants
- Elites / retainers
- Clergy
- Garrison troops
- Temporary population

Temporary population is important and includes:
- refugees
- pilgrims
- traders
- seasonal laborers
- camp followers
- military support staff

### Food Balance
Measures ability to feed permanent and temporary population.

Affects:
- prices
- unrest
- disease risk
- migration pressure
- theft and black market activity

### Wealth / Surplus
Represents usable local surplus rather than abstract gold.

Used for:
- maintenance
- adaptation
- patronage projects
- local recovery
- market expansion
- attracting specialists and migrants

### Order / Security
Represents how controlled the settlement is.

Affected by:
- patrols
- food shortage
- legitimacy
- unrest
- faction agitation
- troop discipline
- road safety

Low order creates visible outcomes such as:
- checkpoints
- closed gates
- heavy guards
- burned outskirts
- criminal activity
- barricades and restricted movement

### Loyalty / Alignment
Measures support for current authority.

Possible states:
- loyal
- compliant
- resentful
- divided
- subverted
- rebellious

Influences:
- tax efficiency
- militia quality
- sabotage risk
- conquest response
- intelligence leakage

### Infrastructure Capacity
Represents how much activity the settlement can absorb before visible strain appears.

Suggested capacities:
- housing
- storage
- market capacity
- local road/stable/yard capacity
- sanitation / resilience
- fortification state
- garrison capacity

### Military Utility
Represents the settlement's usefulness in conflict.

Includes:
- militia pool
- depot value
- defensibility
- remount capacity
- repair and smithing support
- troop quartering capacity

### Throughput
Represents ongoing movement through the node.

Track:
- trade flow
- supply flow
- troop flow
- tax flow

### Pressure Indexes
Use a small set of normalized pressures.

Recommended pressures:
- Border Pressure
- Migration Pressure
- Supply Pressure
- Faction Pressure
- Fiscal Pressure
- Food Stress
- Trade Opportunity
- Infrastructure Strain
- Elite Ambition

These pressures should drive most adaptation behavior.

---

## Kingdom-Level Variables

Kingdoms are not full strategy-game actors. They are policy and response actors.

Suggested kingdom state:
- treasury health
- legitimacy
- manpower reserves
- military posture
- policy priorities
- factional stability
- logistics reach
- frontier concerns
- current rivalries / wars

### Kingdom Priorities
Kingdoms can lean toward several priorities at once.

Suggested priorities:
- Consolidate Interior
- Secure Border
- Expand Influence
- Recover from War
- Crush Disorder
- Restore Treasury
- Feed Population
- Patronize Religion / Prestige
- Favor Nobility
- Favor Towns / Trade
- Militarize Frontier

These priorities influence how resources and attention are allocated across settlements.

Examples:
- **Restore Treasury** -> harsher extraction, reduced maintenance, more resentment
- **Militarize Frontier** -> more depots, troop movement, walls, checkpoints
- **Favor Towns / Trade** -> better roads, caravan safety, market expansion

---

## Strategic Time Scale

Recommended update interval: **monthly**, with seasonal modifiers.

Monthly is granular enough to show movement and pressure changes without requiring excessive simulation detail.

---

## Strategic Update Loop

### Step 1: Update Regional Conditions
Apply:
- season
- harvest state
- weather modifiers
- war state
- raid activity
- policy edicts
- disease/plague flags
- trade disruption
- festival cycles
- migration/refugee flows

### Step 2: Compute Network Flow
For each route and settlement, update:
- food inflow/outflow
- trade throughput
- troop movement
- tax collection flow
- migration flow
- authority reach

Settlements should be treated as networked nodes, not isolated cities.

### Step 3: Compute Pressures
Convert current conditions into settlement pressures.

Examples:
- troop passage + weak storage + poor roads -> Supply Pressure
- bad harvest + refugee inflow -> Food Stress
- tax increase + weak legitimacy -> Fiscal + Faction Pressure
- border tension + strategic location -> Border Pressure
- prosperous corridor + safe roads -> Trade Opportunity

### Step 4: Choose Settlement Response Mode
Each settlement selects a dominant response mode.

Recommended modes:
- Routine Administration
- Commercial Expansion
- Fortify and Stockpile
- Emergency Relief
- Repressive Order
- Militia Mobilization
- Recovery / Rebuild
- Elite Patronage
- Survival / Contraction

### Step 5: Spend Surplus and Authority
Resources are spent through weighted adaptation rather than detailed build queues.

Possible uses:
- more patrols
- road repairs
- wall repairs
- storage yards
- barracks
- shrine expansion
- market enlargement
- checkpoints
- camps
- labor levies
- sanitation work
- poor relief

### Step 6: Update Physical State
Update:
- permanent growth
- temporary crowding
- district emphasis
- fortification level
- maintenance state
- road wear
- field condition
- visible damage or recovery

### Step 7: Emit RPG Output States
Generate data used by the micro layer:
- settlement visual tier
- district additions/removals
- traffic profiles
- NPC composition
- service availability
- prices
- rumors
- quest hooks
- law/order posture

---

## Change Channels

Settlements should be able to change through more than raw population growth.

### 1. Permanent Demographic Growth
Slow increase in houses, density, and craft activity.

### 2. Temporary Swelling
Fast visible change from:
- refugees
- military traffic
- pilgrims
- labor crews
- camp followers
- trade surges

### 3. Functional Growth
Same population, but more:
- barracks
- depots
- shrines
- offices
- workshops
- warehouses
- toll stations

### 4. Class Growth
More elite housing, merchant compounds, improved streets, richer institutions.

### 5. Defensive Growth
Palisades, ditches, towers, repaired walls, hardened gates.

### 6. Emergency Growth
Camps, field kitchens, hospitals, temporary storeyards, mass shelters.

### 7. Decline
Abandoned structures, reduced market activity, maintenance failure, shrinking occupied area.

This is critical because towns should be able to feel very different without doubling in permanent population.

---

## Strain: The Most Important Hidden Mechanic

**Strain** is the main engine of visible change in a mostly settled world.

Strain occurs when demand exceeds local capacity:
- too many troops
- too many caravans
- too many refugees
- too much taxation
- too little food
- poor storage
- weak roads
- insufficient sanitation
- too much quartering burden

### Strain Effects
Depending on the source of strain, outcomes may include:
- overcrowding
- higher prices
- disease risk
- theft
- black markets
- camps outside walls
- warehouse overflow
- trampled fields
- road damage
- slum emergence
- resentment
- slower logistics
- elite withdrawal

This system allows major visible change without requiring constant conquest or city founding.

---

## Conflict Model for Established Kingdoms

Conflict should usually be modeled as escalating pressure rather than immediate annexation.

### Recommended Conflict States
1. Rivalry
2. Border Tension
3. Patrol Clashes
4. Raiding / Proxy Action
5. Limited War
6. Campaign Season
7. Siege / Invasion
8. Occupation / Settlement Transfer

Most of the world should spend more time in states 2 through 5 than in full conquest.

These mid-level conflict states generate strong RPG content:
- convoys
- requisitioning
- patrols
- fortification work
- refugees
- shortages
- spies
- local fear
- militia musters
- black market activity

Full conquest should be rare and high impact.

---

## Border Regions vs Interior Regions

### Interior Settlements
More likely to show:
- stable markets
- patronage projects
- elite politics
- stronger craft concentration
- lower overt military presence
- better maintained roads

### Border Settlements
More likely to show:
- barracks growth
- depot traffic
- walls and watchtowers
- refugee camps
- shortages
- rough mixed populations
- harsher authority
- convoy and troop flow
- visible raiding scars

This distinction helps the player feel the geopolitical structure of the world physically.

---

## Resource Model

Avoid simplistic 4X-style resource nodes where possible.

Use broad productive channels:
- staple food
- fodder
- timber
- stone
- metals
- craft goods
- remounts
- river transport
- sea transport
- tax yield
- manpower
- legitimacy / prestige
- religious influence

What matters is not only whether the resource exists, but whether it can be:
- extracted
- protected
- transported
- stored
- converted into useful strategic output

---

## Adaptation Package Model

Instead of detailed build queues, settlements should use **adaptation packages**.

Each package has:
- trigger conditions
- settlement compatibility
- minimum surplus / authority requirement
- visible outputs
- strategic effects

### Example Packages

#### Market Expansion
Triggered by:
- strong Trade Opportunity
- good Order
- adequate food
- storage/market strain

Outputs:
- larger market area
- more stalls
- inns
- stables
- warehouses
- merchant housing

Effects:
- higher trade throughput
- stronger tax base
- more migration pull

#### Military Buildup
Triggered by:
- high Border Pressure
- kingdom military priority
- strategic location

Outputs:
- barracks
- drill yard
- armory
- depots
- camp followers
- increased patrol traffic

Effects:
- stronger defense and troop support
- greater requisition burden
- more civilian resentment risk

#### Emergency Fortification
Triggered by:
- raids
- invasion threat
- weak defenses

Outputs:
- ditches
- earthworks
- palisade
- reinforced gates
- watchtowers

Effects:
- short-term defense improvement
- labor diversion
- reduced prosperity growth

#### Refugee Absorption
Triggered by:
- nearby devastation
- secure enough access
- minimum food and order

Outputs:
- camps
- poor housing
- relief structures
- social tension
- disease risk

Effects:
- labor pool increase
- instability increase
- possible later permanent growth

#### Elite Patronage
Triggered by:
- peace
- strong surplus
- stable rule
- ambitious elites

Outputs:
- temple expansion
- market hall
- bridge
- manor compound
- paved core roads
- fountains or civic works

Effects:
- prestige
- loyalty
- trade boost
- greater visible class contrast

#### Coercive Pacification
Triggered by:
- unrest
- tax resistance
- subversion
- road insecurity

Outputs:
- checkpoints
- gallows
- prison yard
- stronger guard presence
- confiscation posts

Effects:
- short-term order gain
- long-term resentment
- suppressed commerce

#### Recovery and Rebuild
Triggered by:
- recent damage
- peace window
- enough support

Outputs:
- rebuilt roofs
- repaired mills
- cleared debris
- restored bridge
- temporary labor camps

Effects:
- gradual restoration of normal function
- possibility of altered district layout

---

## Recommended Derived State Categories

These simplified states are useful for downstream RPG systems.

### Economic State
- Stagnant
- Stable
- Growing
- Booming
- Overstrained
- Collapsing

### Security State
- Secure
- Watchful
- Tense
- Troubled
- Militarized
- Unstable

### Political State
- Loyal
- Compliant
- Divided
- Resentful
- Subverted
- Rebellious

### Physical State
- Maintained
- Expanding
- Densifying
- Fortified
- Damaged
- Decaying
- Rebuilding

### Traffic State
- Local
- Active
- Heavy
- Military-Heavy
- Refugee-Heavy
- Disrupted

These states provide clean inputs for map generation, NPC spawning, and content triggers.

---

## RPG Layer Outputs

Each strategic update should emit presentation and gameplay directives.

### Settlement Footprint
- core only
- core + suburb
- expanded suburb
- dense infill
- camp belt
- decayed edge
- damaged ring

### District Emphasis
- market
- military
- religious
- noble
- craft
- storage/logistics
- poor quarter

### Outskirts Condition
- healthy fields
- trampled fields
- encamped edge
- fortified edge
- abandoned edge
- newly cleared edge

### Security Posture
- open
- routine guards
- checkpointed
- curfew-like
- besieged
- occupied

### Traffic Profile
- peasants and carts
- caravans
- pilgrims
- pack trains
- military columns
- refugees
- smugglers
- messengers

### Mood Profile
- prosperous
- anxious
- resentful
- patriotic
- hungry
- celebratory
- war-weary

These outputs should affect:
- chunk selection
- NPC composition
- ambient dialogue
- quest hooks
- shop inventory
- lodging prices
- random encounters
- faction presence
- local law behavior

---

## Chunk-Based Settlement Growth Model

Because the world is physicalized through bitmap/tile chunks, the strategy layer should drive **chunk family selection** rather than individual building placement.

Each settlement should be assembled from layered state selectors.

### A. Core Identity Family
Defines what the settlement fundamentally is:
- river market town
- hill fort town
- manor village
- temple town
- mining town
- port district town

### B. Size Tier
Defines broad scale:
- established base
- expanded
- dense
- strained
- declining

### C. Condition Overlay
Defines current strategic condition:
- prosperous
- militarized
- fortified
- refugee-swollen
- damaged
- recovering
- neglected

### D. District Add-Ons
Optional additions:
- barracks
- expanded market
- shrine complex
- storage quarter
- slum edge
- toll gate
- craft lane
- noble compound
- camp belt
- checkpointed gate

Example composed states:
- **River Market Town / Expanded / Militarized / Storage Quarter + Barracks**
- **Pilgrimage Town / Dense / Prosperous / Shrine Annex + Market Hall**
- **Border Town / Strained / Refugee-Swollen / Camp Belt + Emergency Ditch**

This allows visible evolution without requiring a full city-builder.

---

## Main Change Drivers in a Mostly Settled World

### Slow Drivers
- long peace
- noble investment
- merchant privileges
- road improvements
- demographic growth
- expanding institutions
- gradual local prosperity

### Medium Drivers
- tax changes
- local political struggle
- patrol funding
- trade rerouting
- bandit suppression or resurgence
- garrison relocation
- poor but non-catastrophic harvests

### Fast Drivers
- war scares
- raids
- refugee waves
- army passage
- plague
- fires
- severe requisitioning
- siege preparation
- crop blight

The world should mostly move through slow and medium drivers, with fast drivers producing spikes.

---

## Realm Success Criteria

Since this is not a full 4X game, kingdoms do not require one universal victory condition.

They should instead pursue weighted strategic goals such as:
- maintain legitimacy
- keep treasury solvent
- feed the population
- secure borders
- keep roads and trade functional
- suppress revolt
- preserve noble support
- weaken rivals
- hold symbolic centers
- remain militarily ready

Different kingdoms can weight these differently, creating distinct strategic personalities.

Examples:
- cautious agrarian monarchy
- militarized frontier realm
- merchant-focused league
- faction-ridden feudal kingdom
- temple-centered state

---

## Recommended Data Schema

```md
Settlement
- id
- name
- owner_realm
- province
- class
- role_tags[]
- terrain_context[]
- population_permanent
- population_temporary
- social_profile
  - peasants_smallholders
  - laborers
  - artisans_merchants
  - elites_retainers
  - clergy
  - garrison
- food_balance
- wealth_surplus
- order
- loyalty
- health_resilience
- infrastructure
  - housing
  - storage
  - market
  - roads_local
  - fortification
  - sanitation
  - garrison_capacity
- military_utility
  - militia_pool
  - depot_value
  - defensibility
  - remount_capacity
  - repair_capacity
- throughput
  - trade_flow
  - supply_flow
  - troop_flow
  - tax_flow
- pressures
  - border_pressure
  - migration_pressure
  - supply_pressure
  - faction_pressure
  - fiscal_pressure
  - food_stress
  - trade_opportunity
  - infrastructure_strain
  - elite_ambition
- damage
- adaptation_mode
- visible_state_tags[]
- micro_state_seed
```

```md
Realm
- id
- name
- treasury
- legitimacy
- manpower_reserve
- military_posture
- policy_priorities[]
- factional_stability
- logistics_rating
- frontier_regions[]
- war_states[]
- strategic_goals[]
```

```md
Route
- id
- node_a
- node_b
- type
- quality
- capacity
- safety
- seasonal_modifier
- patrol_coverage
- toll_control
- disruption
```

---

## Example Settlement State Evolution

### Example: Greyford
Class: Market Town  
Role Tags: River Trade, Grain Basin, Administrative  
Baseline: stable, moderately prosperous, lightly fortified

#### Under Peace + Trade Support
Possible outputs:
- expanded market
- second inn yard
- larger warehouses
- improved roads
- more merchant homes
- more caravan and barge traffic

#### Under Border Tension
Possible outputs:
- more patrols
- militia musters
- guarded grain stores
- checkpoints
- troop quartering
- new supply sheds

#### Under Refugee Influx
Possible outputs:
- camps outside the gate
- food prices rise
- theft increases
- temple relief structures expand
- labor pool increases
- social tension rises

#### Under Treasury Crisis
Possible outputs:
- harsher tax presence
- stalled maintenance
- more guard supervision
- smuggling
- increased resentment
- lower visible prosperity despite continued traffic

This example demonstrates how the same town can physically and socially transform under different strategic pressures.

---

## Implementation Principles

1. **Pressure over optimization**
   - Focus AI on response logic, not perfect economic play.

2. **Role fidelity**
   - Settlements should continue to feel like themselves even when changing.

3. **Temporary states matter**
   - Camps, depots, emergency works, quartering loads, and traffic spikes are valuable content.

4. **Strain is productive**
   - Overcapacity states often create the richest RPG consequences.

5. **Conquest should be rare and significant**
   - Most interesting world change should happen before annexation.

6. **Visible consequences first**
   - Hidden systems are justified only if they create playable or visible results.

7. **Local elites matter**
   - Governors, nobles, guilds, temples, and garrison commanders should skew adaptation behavior.

---

## Final Summary

This settlement system should be implemented as a **networked strategic pressure-and-adaptation simulator** for established kingdoms.

It is intended to:
- keep the world moving
- create visible local change
- support believable regional differentiation
- tie wars, trade, policy, migration, and unrest into physical settlement evolution
- generate inputs for chunk-based map variants and RPG content

Settlements should begin as already meaningful places and change through:
- trade opportunity
- food stress
- infrastructure strain
- migration
- military pressure
- political unrest
- taxation
- elite patronage
- damage and recovery

The result should be a world where towns and roads visibly react to strategic conditions even when borders remain mostly stable.

---

## Recommended Next Document

The next logical step is a second document covering:

1. numeric stat ranges
2. monthly update formulas
3. kingdom policy weights
4. adaptation package trigger logic
5. output state mappings for chunk selection
6. traffic generation rules
7. border conflict escalation rules
