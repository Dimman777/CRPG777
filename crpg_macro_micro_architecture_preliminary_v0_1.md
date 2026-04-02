# CRPG Macro/Micro Software Architecture (Preliminary)

**Version:** 0.1  
**Status:** Extremely preliminary. Subject to major revision.  
**Purpose:** Define a workable software architecture for integrating the turn-based CRPG micro game with a higher-level strategic macro simulation.

---

## 1. Status and Intent

This document is **not a final engineering specification**. It is an early architectural framing document intended to prevent the project from collapsing into an unstructured codebase.

Many assumptions in this document will likely change after:
- the first playable combat prototype
- the first basic world exploration prototype
- the first working macro simulation prototype
- the first save/load pass
- the first serious integration pass between macro and micro systems

The goal at this stage is not perfection. The goal is to establish **clear boundaries, ownership, and data flow** so the project can scale across many files and systems.

---

## 2. High-Level Goal

The project consists of **two linked games**:

1. **Micro game**  
   A 3D turn-based CRPG where the player explores, talks to NPCs, fights on a grid, and interacts directly with locations and characters.

2. **Macro game**  
   A background strategic simulation in which factions, leaders, regions, projects, diplomacy, and broader world pressures evolve over time.

The player mainly experiences the micro game, but the macro game changes the conditions of the world the player inhabits.

The architecture must allow:
- macro state to alter the local world
- local player actions to feed back into macro systems
- important NPCs to exist at both scales
- leadership transfer, death, persuasion, and succession to affect both layers
- modular file-based development using HTML + JavaScript + three.js

---

## 3. Architectural Principle

The project should be organized as **three connected layers**, not two.

```text
Macro Simulation Layer
        ↓
Integration / World State Bridge
        ↓
Micro Simulation Layer
```

This is the core architectural rule.

The macro layer should **not** directly micromanage every town and NPC. The micro layer should **not** directly rewrite faction strategy rules. Instead, both communicate through shared entities, world-state values, and structured consequences.

---

## 4. Primary Layers

### 4.1 Macro Simulation Layer

The macro layer handles the strategic world.

Responsibilities:
- faction state
- leader strategy profiles
- region-level state
- diplomacy
- projects and long-term actions
- military movement if implemented
- strategic resource flow
- turn cadence and processing
- global pressure changes
- succession and leadership transitions

The macro layer should operate in **discrete time steps**, currently expected to be **daily** unless later testing proves a larger interval works better.

The macro layer should not know about:
- three.js scene objects
- camera systems
- local combat visuals
- detailed town navigation
- local line-of-sight or tactical positioning

---

### 4.2 Integration / World State Bridge

This is the critical architectural layer.

Responsibilities:
- translate macro changes into local world changes
- translate player actions into macro consequences
- maintain shared IDs and entity references
- apply region-level conditions to settlements and sites
- generate local incidents or tags from strategic pressures
- control synchronization timing between layers

Examples:
- faction unrest becomes more guards, protests, and harsher dialogue in settlements
- famine reduces shop stock and raises prices
- magical instability increases anomaly chances and strange encounters
- death of a leader updates both macro AI and NPC presence
- the player taking a leadership role transfers faction decision rights

Without this bridge, the project becomes two disconnected games.

---

### 4.3 Micro Simulation Layer

The micro layer handles what the player directly plays.

Responsibilities:
- exploration state
- local NPC state
- conversation systems
- quests and local events
- tactical combat
- local inventory and encounter state
- settlement state presentation
- site and dungeon interaction
- player party state

The micro layer should read world conditions provided by the bridge, then express them through content and gameplay.

The micro layer should not own:
- faction strategy rules
- world-level diplomacy resolution
- region production formulas
- strategic planning AI

---

## 5. Entity Ownership Model

A central architectural requirement is that major game entities exist as **shared logical objects**, not duplicate versions.

### 5.1 Shared Entity Rule

If a character exists as both:
- a macro decision-maker
- and a micro-level NPC

then that character should be represented by **one logical entity record** with multiple system-facing views.

Example concept:

```text
LeaderEntity
- id
- name
- faction_id
- title
- alive
- current_location
- traits
- ambitions
- trust_map
- macro_profile
- npc_profile
```

The macro AI reads the entity's strategic traits.
The micro dialogue system reads the same entity's personal traits and relationship state.

This preserves coherence.

---

### 5.2 Positions vs Persons

Faction leadership should be treated as a **role slot**, not a fixed permanent identity.

Example concept:

```text
Faction
- id
- name
- ruler_entity_id
- heir_entity_id
- council_ids
```

This allows:
- death
- assassination
- succession
- coups
- player takeover
- regency or replacement

without breaking faction continuity.

---

## 6. Data Ownership Boundaries

One of the biggest risks in a modular JavaScript project is unclear ownership. Each major category of data should have a clear home.

### 6.1 Macro Owns
- faction resources
- strategic projects
- diplomacy values
- region pressures
- leader AI preferences
- strategic military state
- calendar-based strategic progression

### 6.2 Bridge Owns
- synchronization rules
- consequence mapping
- region-to-settlement translations
- macro-to-micro event generation
- micro-to-macro consequence packaging
- shared world-state tags

### 6.3 Micro Owns
- current tactical encounter state
- local NPC placement
- combat turn state
- scene interaction state
- local dialogue presentation
- map occupancy and navigation state
- active local quest stage data

### 6.4 UI Owns
- visible menus
- panels
- overlays
- HUD behavior
- player input routing for display logic

UI should not own game rules.

### 6.5 Rendering Owns
- three.js scene setup
- model loading
- lighting
- camera
- animation playback hooks
- visual effects
- tile highlighting visuals

Rendering should not own simulation truth.

---

## 7. Dependency Direction

Dependencies should flow in one general direction.

```text
Data / Rules
    ↓
Simulation
    ↓
Bridge
    ↓
Presentation / UI / Rendering
```

Practical rule:
- low-level rules modules should not import rendering modules
- rendering modules may read simulation state, but should not define that state
- UI can request actions, but action legality should be resolved by gameplay systems
- bridge modules may call both macro and micro systems, but should remain focused on translation

This reduces circular dependency risk.

---

## 8. Suggested File / Folder Structure

This is a preliminary modular JavaScript layout for HTML + three.js.

```text
index.html

js/
  main.js
  game.js

  core/
    constants.js
    rng.js
    time.js
    event_bus.js
    ids.js
    save_load.js

  data/
    stats_data.js
    skills_data.js
    factions_data.js
    leaders_data.js
    regions_data.js
    projects_data.js
    dialogue_tags.js
    encounter_tables.js

  macro/
    macro_game.js
    macro_turn_runner.js
    faction_state.js
    faction_ai.js
    leader_state.js
    region_state.js
    diplomacy_system.js
    project_system.js
    military_system.js
    macro_rules.js

  bridge/
    world_state_bridge.js
    macro_to_micro.js
    micro_to_macro.js
    consequence_mapper.js
    tag_mapper.js
    incident_generator.js
    sync_manager.js

  micro/
    micro_game.js
    world_instance.js
    settlement_state.js
    site_state.js
    npc_manager.js
    dialogue_manager.js
    quest_manager.js
    exploration_manager.js
    interaction_manager.js

  combat/
    combat_manager.js
    initiative.js
    dice.js
    action_resolution.js
    combatant.js
    grid.js
    status_effects.js

  render/
    scene_setup.js
    renderer.js
    camera_controller.js
    map_visuals.js
    actor_visuals.js
    combat_visuals.js
    effect_visuals.js

  ui/
    ui_root.js
    macro_panel.js
    faction_screen.js
    region_screen.js
    dialogue_ui.js
    combat_hud.js
    journal_ui.js
    tooltip_ui.js
```

This is a starting layout, not a final one.

---

## 9. Core Runtime Flow

A likely game loop structure is:

```text
main.js
  → initialize data
  → initialize game state
  → initialize renderer and UI
  → enter main update loop
```

At runtime, there are two broad types of progression:

### 9.1 Continuous Local Runtime
Used for:
- moving in scenes
- camera control
- dialogue interaction
- combat input and animation timing
- UI updates

### 9.2 Discrete Strategic Advancement
Used for:
- advancing a day
- processing macro turns
- resolving projects
- applying region pressure changes
- pushing consequences into the micro world

The architecture should support both without forcing every system into the same timing model.

---

## 10. Synchronization Model

The macro simulation should not necessarily update every frame. It should update on clearly defined synchronization events.

Candidate synchronization triggers:
- day advance
- rest at an inn or camp
- long-distance travel completion
- scripted world update points
- explicit strategic management access if the player becomes a leader

### 10.1 Recommended Rule

The macro layer processes at **time-step boundaries**, not continuously.

This reduces complexity and makes debugging much easier.

### 10.2 Sync Sequence Example

```text
advance_day()
  → macro_turn_runner.process_day()
  → bridge.collect_macro_changes()
  → bridge.translate_region_effects()
  → micro_game.apply_world_updates()
  → ui.push_news_and_rumors()
```

This should be a predictable pipeline.

---

## 11. Macro to Micro Translation

Macro outputs should not be raw scripting instructions. They should be expressed as world-state changes and tags.

Example region state:

```text
RegionState
- owner_faction_id
- security
- unrest
- prosperity
- food_supply
- arcane_pressure
- disease_pressure
- military_presence
- active_projects
- incidents
```

The bridge then converts these into micro implications.

Examples:
- low security → more bandits, weaker patrol coverage
- high unrest → protests, stricter guards, political dialogue changes
- high arcane pressure → anomalies, magical hazards, rare encounters
- low food supply → higher prices, empty shelves, refugee presence

This prevents hardcoded coupling.

---

## 12. Micro to Macro Translation

The micro game should not directly rewrite faction internals whenever something local happens. Instead, it should emit structured consequences.

Example concept:

```text
ConsequenceEvent
- type
- source
- target_ids
- region_id
- settlement_id
- severity
- metadata
```

Example events:
- leader_killed
- corruption_exposed
- military_cache_destroyed
- famine_relief_delivered
- heir_rescued
- ritual_interrupted
- player_assumed_leadership

The macro layer processes these events at sync time.

This makes the system testable and extensible.

---

## 13. Event Bus and Messaging

A lightweight event system will likely help prevent systems from becoming too directly entangled.

Possible uses:
- UI updates when world state changes
- combat start and end notifications
- leader death notifications
- day advance notifications
- dialogue outcome propagation

However, the event bus should not become a replacement for explicit state ownership.

Good uses:
- notifications
- decoupled reactions
- analytics or logging

Bad uses:
- hiding important game logic in vague listeners
- causing major state changes from too many places

---

## 14. Save / Load Boundaries

Save structure should be designed early enough that systems do not become impossible to serialize.

A save should likely include:
- world date/time
- macro state
- region state
- leader entities
- faction state
- player state
- active quests
- local site state
- combat state if saving during combat is allowed
- pending consequence events
- generated incidents or news state

Rendering state should not be treated as authoritative save data.

The save system should serialize logical state, then rebuild visuals from that state.

---

## 15. Testability Strategy

This architecture will be easier to develop if core systems are testable without running the full 3D game.

Good candidates for isolated testing:
- dice logic
- initiative resolution
- combat action legality
- macro daily turn processing
- faction AI decision selection
- consequence mapping
- region pressure updates

The more the project separates simulation from rendering, the easier it becomes to validate behavior.

---

## 16. Refactor Triggers

The following are signs the architecture is degrading:

- one file starts controlling too many systems
- UI code begins deciding game rules
- rendering code changes simulation truth
- multiple systems mutate the same object without clear ownership
- macro logic starts directly manipulating tactical scene objects
- local gameplay code rewrites faction resources directly
- duplicated leader data appears in unrelated modules

When these happen, ownership boundaries need to be restored.

---

## 17. Initial Implementation Order

A practical order for building this architecture:

### Phase 1
- core utilities
- data loading pattern
- micro combat prototype
- dice and initiative modules

### Phase 2
- world exploration scaffold
- NPC and dialogue basics
- local scene architecture

### Phase 3
- basic macro state objects: factions, leaders, regions
- daily clock
- simple macro turn processing

### Phase 4
- bridge layer
- region tags affecting settlements
- micro consequence events affecting macro state

### Phase 5
- save/load
- succession and leader replacement
- player leadership takeover flow

This order reduces integration pain.

---

## 18. Open Questions

The following architectural questions are still unresolved:

1. Will the player always remain in the micro layer, or directly control macro turns after taking leadership?
2. Can macro turns advance while the player is in a dungeon, or only on time advancement events?
3. How much local persistence should each settlement and site maintain?
4. Will important leaders physically move through the world, or only update location at time-step boundaries?
5. How detailed should army and travel simulation be?
6. Will dialogue outcomes immediately trigger bridge consequences, or queue them until a sync step?
7. How much of the macro game should be visible to the player versus hidden simulation?

These should be answered gradually through prototyping.

---

## 19. Scope Guardrail

The architecture should support ambitious behavior without requiring full simulation of everything.

That means:
- strategic pressure is more important than exhaustive realism
- bridge translation is more important than detailed 4X mechanics
- coherent world response is more important than perfect simulation depth
- modularity is more important than premature optimization

A simpler system with strong boundaries will outperform a sprawling design with no ownership discipline.

---

## 20. Summary

This project should be built as:
- a **macro simulation layer** for factions, leaders, and regions
- a **bridge layer** for translating state and consequences
- a **micro simulation layer** for exploration, dialogue, and combat
- a **presentation layer** that reads simulation state without owning it

The most important architectural rule is this:

**Macro and micro should not talk to each other directly in ad hoc ways. They should communicate through shared entities, region/world-state translation, and structured consequence events.**

That rule will do more to keep the codebase healthy than any specific class or file naming decision.

