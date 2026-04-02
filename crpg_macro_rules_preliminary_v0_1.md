# CRPG Macro Strategy Rules Design (Preliminary)

**Version:** 0.1  
**Status:** Extremely preliminary. Subject to major revision.  
**Purpose:** Early design scaffold for the macro-level strategy simulation that influences the player-scale CRPG world.

---

## 1. Document Status

This document is **not a finalized ruleset**. It is a **preliminary design framework** intended to:

- capture the current concept clearly
- establish vocabulary and system boundaries
- identify likely subsystems
- give implementation direction without locking design too early

Nearly every rule in this document may change after testing.

The macro game should be treated as an **experimental supporting layer** for the CRPG, not yet as a fully balanced strategy game.

---

## 2. Design Goal

The project includes two linked gameplay scales:

1. **Micro scale** — the player explores locations, talks to NPCs, fights tactical battles, and interacts with the world directly.
2. **Macro scale** — factions, leaders, regions, projects, wars, and strategic pressures evolve over time in the background.

The macro system exists to:

- make the world feel active and reactive
- create changing political and material conditions
- generate consequences that alter local play
- allow faction leaders to exist as both strategic actors and in-world NPCs
- potentially allow the player to influence or assume macro leadership roles

The macro layer should not be a full 4X game at the start. It should be a **manageable pressure-and-consequence system**.

---

## 3. Core Premise

Each important macro actor is a **Faction** led by a **Leader**.

Each Leader also exists on the micro level as an NPC who may:

- be met and spoken to
- be influenced socially or politically
- be aided or undermined
- be removed, replaced, or killed
- potentially be replaced by the player character

This means the macro and micro layers must share certain entities rather than duplicating them.

---

## 4. Time Scale

### Current Direction

The current leading idea is that the macro layer processes a **turn once per day**.

This is still preliminary, but daily cadence is currently favored because it aligns well with:

- travel time
- resting
- town and shop changes
- rumors and news
- military movement over land
- project progression over time

### Alternative Under Consideration

- macro turns **twice per week**

This remains an option if daily turns prove too granular or too noisy.

### Current Recommendation

Use a **daily macro tick** for now, with many strategic actions taking multiple days to complete.

Examples:

- recruit militia: several days
- construct fortification: weeks
- diplomatic mission: several days
- magical project: days or weeks
- troop movement: distance-based

---

## 5. Macro System Philosophy

The macro system should model **pressures**, not exhaustive detail.

It should not attempt to simulate every household, merchant, or soldier individually.

Instead, it should track broad strategic values and let those values affect local conditions.

Example pattern:

- region food falls
- unrest rises
- crime rises
- shop stock worsens
- rumors change
- desperate events become more likely

This approach is more practical and better suited to integration with a CRPG.

---

## 6. Main Macro Entities

### 6.1 Faction

A Faction is a major political or strategic actor.

Possible examples:

- kingdom
- city-state
- noble house
- cult
- guild
- magical order
- tribal confederation
- demonic power

A Faction likely tracks:

- faction ID
- name
- ruler / leader role
- controlled regions
- strategic resources
- diplomatic relations
- current goals
- active projects
- military posture
- ideological tendencies

### 6.2 Leader

A Leader is the decision-making figure for a faction or major sub-faction.

A Leader should exist as both:

- a macro decision-maker
- a micro NPC

A Leader likely tracks:

- leader ID
- faction ID
- name and title
- alive / dead / displaced status
- current location
- personality traits
- ambitions
- fears
- loyalties
- relationship with player
- governance style

### 6.3 Region

A Region is the primary territory unit connecting macro and micro play.

A Region likely contains:

- region ID
- owner faction
- contested status
- key settlements
- roads / routes
- local military presence
- current pressures and conditions

Regions should be the main bridge between strategy outcomes and local world changes.

### 6.4 Settlement / Site

Settlements and sites are mostly experienced on the micro scale, but their state should reflect macro conditions.

Examples:

- town
- village
- fortress
- mine
- ruin
- shrine
- tower

Their local state may depend partly on region-level values.

---

## 7. Faction-Level Resource Model (Preliminary)

The macro game likely needs a small number of strategic resources.

These are not final, but current candidates include:

### Treasury

Represents stored wealth and spending capacity.

Used for:

- projects
- troop support
- diplomacy
- bribes
- infrastructure

### Food

Represents agricultural and logistical support.

Affects:

- stability
- army maintenance
- famine pressure
- regional prosperity

### Manpower

Represents available bodies for labor, armies, and replacement.

Affects:

- recruitment
- recovery from conflict
- work capacity

### Influence

Represents political leverage and soft power.

Used for:

- diplomacy
- internal control
- succession pressure
- intrigue

### Arcane Power

Represents magical infrastructure, capability, or reserve at the faction level.

Used for:

- magical projects
- rituals
- supernatural defenses
- elite magical actions

### Stability

Represents internal order and faction cohesion.

Affected by:

- shortages
- defeat
- corruption
- succession crises
- successful governance

### Legitimacy

Represents the accepted right to rule.

Affected by:

- lineage
- religion
- conquest
- justice or cruelty
- public acts
- exposure of corruption

### Intelligence / Intel

Represents awareness of threats, plots, military movement, and hidden developments.

Used for:

- detecting schemes
- anticipating war
- countering subversion

These may be too many or too few. This list should be treated as provisional.

---

## 8. Leader Traits (Preliminary)

Leaders should not all act the same. A small personality model can drive different strategic choices.

Candidate leader traits:

- Boldness
- Caution
- Greed
- Mercy
- Paranoia
- Honor
- Ambition
- Discipline
- Arcane Curiosity
- Zeal
- Trust toward PC

These traits could influence decisions such as:

- declaring war
- taking risky projects
- negotiating peace
- suppressing dissent
- investing in magical research
- tolerating corruption
- listening to player advice

This list is not final.

---

## 9. Region State Model (Preliminary)

Regions are likely to carry a limited set of world pressures that can visibly affect micro play.

Candidate region values:

- Security
- Prosperity
- Unrest
- Corruption
- Food Supply
- Disease Pressure
- Military Presence
- Arcane Saturation
- Religious Pressure
- Infrastructure
- Refugee Pressure

Example effects:

### High Security

- fewer raids
- more patrols
- safer roads
- stronger checkpoint presence

### High Unrest

- protest events
- banditry or revolt
- harsher law enforcement
- anti-ruler sentiment

### Low Food Supply

- price increases
- shop scarcity
- theft and desperation
- migration pressure

### High Arcane Saturation

- magical anomalies
- monster risk
- cult activity
- magical opportunity

These values should modify local generation and event weighting rather than hardcoding each outcome.

---

## 10. Macro Turn Structure (Preliminary)

A daily macro turn might process in this order:

1. advance date
2. update ongoing projects
3. process movement of armies, envoys, and major actors
4. update resource production and consumption
5. apply region pressure changes
6. evaluate diplomacy shifts
7. let faction leaders review priorities
8. assign or continue faction actions / projects
9. generate strategic consequences
10. push resulting state changes into world regions and settlements
11. generate player-facing rumors, notices, and world news

This sequence is subject to revision.

---

## 11. Faction Actions (Preliminary)

Factions probably need a compact action list rather than a huge menu.

Current candidate actions:

### Develop Region

Improve prosperity, infrastructure, or productivity over time.

### Fortify Region

Increase defenses, military readiness, or road security.

### Recruit Forces

Convert manpower and resources into military strength.

### Move Forces

Shift military power between regions.

### Suppress Unrest

Attempt to restore order, possibly at cost to legitimacy or prosperity.

### Negotiate

Attempt diplomatic improvement, treaty formation, or de-escalation.

### Scheme

Pursue intrigue, sabotage, subversion, blackmail, or succession pressure.

### Fund Arcane Project

Invest in magical development, rituals, or supernatural defenses.

### Influence Succession

Shape political leadership outcomes in a faction or region.

### Secure Supply

Prioritize food or logistical stabilization.

This list is preliminary and intended as a starting point.

---

## 12. Projects

Many macro actions should take the form of **projects** rather than instant results.

A project likely has:

- project ID
- owner faction
- target region or target faction
- duration in days
- resource cost
- progress
- success / failure conditions
- possible side effects

Examples:

- build watchtowers
- reform tax collection
- court a neighboring ruler
- raise a militia
- prepare a ritual
- rebuild granaries
- infiltrate a rival court

Projects create better pacing than instantaneous strategic actions.

---

## 13. War and Conflict (Very Early Concept)

War should begin simple.

Do not start with detailed tactical army simulation.

Instead, early war could be driven by:

- military strength by region
- supply / food pressure
- leader personality
- contested status
- project preparation
- morale / stability

Initial outcomes could be region-level shifts such as:

- raids
- siege pressure
- occupation
- refugee movement
- ruined infrastructure
- patrol changes

Detailed army simulation can come later if needed.

---

## 14. Diplomacy (Very Early Concept)

Factions should track at least rough relations with one another.

Possible diplomacy states:

- allied
- favorable
- neutral
- strained
- hostile
- at war

Relations should be influenced by:

- territorial pressure
- trade dependence
- leader traits
- religious or ideological conflict
- player intervention
- espionage or betrayal

Diplomacy should matter because it changes what the player sees in the world.

---

## 15. Player Interaction With the Macro Layer

The player should affect the macro game mainly through micro actions.

Examples:

- persuading a ruler to negotiate
- exposing corruption
- assassinating or saving a leader
- preventing famine locally
- carrying diplomatic messages
- sabotaging a military project
- taking a title or office
- eventually ruling a faction directly

These should feed upward as structured consequences, not just local flags.

Example:

- governor removed
- legitimacy drops in region
- succession pressure rises
- unrest rises or falls depending on circumstances

This feedback loop is one of the main reasons to have the macro system at all.

---

## 16. Player Assumption of Leadership

The current concept allows that the player may eventually take over a faction leadership role.

This implies:

- leadership is a position that can change hands
- the faction continues even if the current leader is removed
- some macro decisions can become player-controlled under the right circumstances

This is a major feature and should be treated as optional early on.

Do not design the first macro prototype around full faction-player control unless needed immediately.

---

## 17. Integration Principles

The macro system should affect the micro game through **world state changes**, not through hardcoded story overrides.

Examples of macro-to-micro effects:

- low regional food -> higher prices, lower inventory, hungry NPC dialogue
- high unrest -> guards, riots, propaganda, curfews
- war pressure -> checkpoints, patrols, refugees, damaged roads
- magical projects -> strange weather, anomalies, magical opportunities

Examples of micro-to-macro effects:

- player kills leader -> succession instability
- player wins local support -> legitimacy shift
- player secures mine -> treasury or supply improves
- player reveals cult activity -> stability improves or panic spreads

This conversion layer will require explicit architecture later.

---

## 18. Scope Guardrails

The macro layer should start small.

Recommended starting scope:

- 3 to 5 factions
- a modest number of regions
- a small resource model
- a small leader trait model
- a short action / project list
- a daily tick
- simple region consequence mapping

Avoid:

- full economy simulation
- full army tactics
- complex population demographics
- massive diplomacy trees
- dozens of resource types at start

The purpose is to create a world that moves, not to bury the CRPG under strategy complexity.

---

## 19. Likely Early Prototype Version

A first useful macro prototype could include only:

- factions
- leaders
- regions
- daily macro tick
- 4 to 6 faction actions
- 5 to 8 region pressures
- rumors / news output
- simple micro consequence hooks

That would already be enough to make the world feel more alive.

---

## 20. Open Questions

These are unresolved and expected to change.

### Cadence

- once per day?
- twice per week?
- daily with slower planning intervals?

### Resource Count

- which faction resources are truly necessary?
- should some be merged?

### Region Granularity

- how many regions should exist?
- are regions large provinces or smaller local territories?

### War Abstraction

- should war remain a pressure model?
- when, if ever, should armies become explicit map entities?

### Leader Model

- how many traits are enough to feel distinct?
- should some traits mirror the CRPG stat system, or remain separate?

### Player Rule

- when can the player directly control a faction?
- how often would they issue orders?
- how is that surfaced in the UI?

### Integration Depth

- how direct should macro changes be in settlements?
- how much should be handled via tags versus custom events?

---

## 21. Current Working Direction

At this stage, the strongest current working direction is:

- daily macro turn
- factions led by leaders who also exist as NPCs
- regions as the bridge between macro and micro
- small pressure-based resource model
- project-driven faction actions
- player actions feeding macro consequences upward
- rule set intentionally limited and highly revisable

This should remain the baseline until tested.

---

## 22. Next Document Recommended

The next most useful companion document is:

**Macro / Micro Integration Architecture**

That document should define:

- shared IDs and entity ownership
- macro-to-micro state translation
- micro-to-macro consequence flow
- save/load boundaries
- file/module architecture for implementation

That will keep the strategy design from becoming disconnected from the actual game structure.
