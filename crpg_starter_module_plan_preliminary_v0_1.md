# CRPG Starter Module Plan (Preliminary)

**Version:** 0.1  
**Status:** Extremely preliminary. This document is an early implementation planning aid, not a locked production specification. It is expected to change substantially as the project is prototyped, tested, and refactored.  
**Target Stack:** `index.html` + modular `.js` files + `three.js` for 3D rendering  
**Related Docs:**
- `crpg_threejs_dev_doc_v0_3.md`
- `crpg_macro_rules_preliminary_v0_1.md`
- `crpg_macro_micro_architecture_preliminary_v0_1.md`

---

## 1. Purpose of This Document

This document converts the broader design and architecture material into a **practical starter implementation plan**.

Its purpose is to answer:
- What files should exist first?
- What does each file own?
- What should each file *not* own?
- In what order should these files be built?
- How do the macro and micro systems remain separated while still influencing each other?

This is not intended to define the entire final codebase. It is a **starting slice** that gives the project enough structure to grow without collapsing into one giant script.

---

## 2. Scope and Philosophy

This starter plan aims to satisfy several constraints:

1. **Small enough to start building immediately**
2. **Modular enough to avoid a single giant file**
3. **Clear enough for AI-assisted coding**
4. **Separated enough to avoid renderer/game-logic entanglement**
5. **Expandable enough to later support the full macro + micro design**

The recommended approach is:
- Start with **one HTML entry point**
- Use **small focused `.js` modules**
- Keep **game state independent of three.js**
- Keep **macro rules independent of tactical combat code**
- Use a **bridge layer** for cross-scale consequences

---

## 3. Recommended Early Folder Layout

```text
project/
  index.html

  js/
    main.js
    game.js

    core/
      event_bus.js
      rng.js
      time.js
      save_load.js

    data/
      stats_data.js
      skills_data.js
      actions_data.js
      factions_data.js
      leaders_data.js
      regions_data.js

    render/
      scene_setup.js
      camera_controller.js
      grid_visuals.js
      actor_visuals.js
      rendering.js

    combat/
      dice.js
      combatant.js
      initiative.js
      action_resolution.js
      combat_manager.js
      grid_state.js

    macro/
      faction.js
      leader.js
      region.js
      macro_rules.js
      macro_game.js

    bridge/
      macro_to_micro.js
      micro_to_macro.js
      consequence_mapper.js

    micro/
      micro_world.js
      npc_manager.js
      dialogue_manager.js
      local_event_manager.js

    ui/
      ui_root.js
      combat_hud.js
      macro_panel.js
      dialogue_ui.js
```

This is a starter structure, not a final one.

---

## 4. First 15 Modules to Build

The files below are the best first implementation slice. They are ordered by importance, not alphabetically.

---

### 4.1 `index.html`

**Purpose:**
- Browser entry point
- Canvas/container host
- UI mounting points
- Script loading

**Owns:**
- Root HTML structure
- DOM containers
- Script includes or module entry

**Does not own:**
- Rules logic
- Rendering logic
- State mutation logic

**Notes:**
Keep it minimal. It should mostly provide containers such as:
- game viewport
- HUD area
- dialogue panel
- macro panel
- debug panel

---

### 4.2 `js/main.js`

**Purpose:**
- Application bootstrap
- Initializes the game
- Connects major systems

**Owns:**
- startup sequence
- top-level initialization calls
- creation of game controller instance

**Does not own:**
- detailed combat logic
- detailed macro rules
- three.js scene construction internals

**Notes:**
This file should remain small. It should mostly say “start the game,” not contain the game.

---

### 4.3 `js/game.js`

**Purpose:**
- Top-level orchestrator for the running game
- Holds references to major systems
- Coordinates update flow

**Owns:**
- game lifecycle
- mode switching (exploration / combat / dialogue / macro review)
- high-level ticking
- system wiring

**Does not own:**
- low-level dice rules
- macro AI internals
- rendering details

**Notes:**
This is the main coordinator, not the place to dump all mechanics. It should delegate aggressively.

---

### 4.4 `js/core/rng.js`

**Purpose:**
- Central random number source

**Owns:**
- dice rolling helpers
- seeded/random utilities if later needed

**Does not own:**
- combat resolution rules
- initiative rules

**Notes:**
A central RNG module makes reproducibility and debugging much easier later.

---

### 4.5 `js/combat/dice.js`

**Purpose:**
- Implements the game’s dice conventions

**Owns:**
- roll one die by size
- roll multiple dice
- sum dice pools
- support special cases such as “2d8 per die” for exceptional stats

**Does not own:**
- whether an attack hits
- stamina/focus costs
- initiative adjustments

**Notes:**
This module should be purely mechanical. Given a dice request, it returns results. It should not know why the roll is happening.

---

### 4.6 `js/data/stats_data.js`

**Purpose:**
- Defines the stat hierarchy and die mapping

**Owns:**
- Body / Mind / Soul structure
- the 9 stat groups
- the 27 stats
- stat-to-die mapping bands

**Does not own:**
- character progression logic
- combat calculations

**Notes:**
This is one of the most stable places to centralize rules data that multiple systems need.

---

### 4.7 `js/combat/combatant.js`

**Purpose:**
- Defines the tactical state container for a combat participant

**Owns:**
- combat-facing participant data
- current resources relevant to combat
- initiative state
- temporary combat conditions

**Does not own:**
- rendering representation
- full macro faction leadership logic
- map/pathfinding logic

**Notes:**
This should represent a unit in combat, not the entire world entity in all contexts. It may later wrap or reference a broader actor/entity record.

---

### 4.8 `js/combat/initiative.js`

**Purpose:**
- Implements dynamic initiative order

**Owns:**
- initiative rolls
- turn queue ordering
- re-roll after action/turn completion
- initiative penalties/bonuses from action costs

**Does not own:**
- attack resolution
- movement rules
- UI display details

**Notes:**
Since the initiative system is unusual and central to combat feel, it deserves its own file immediately.

---

### 4.9 `js/combat/action_resolution.js`

**Purpose:**
- Resolves tactical actions using dice, skills, stats, and resource costs

**Owns:**
- active opposition resolution
- passive DC resolution
- composite action assembly
- optional augmentation pools
- margins of success if later used

**Does not own:**
- turn queue control
- rendering/animation
- high-level combat flow

**Notes:**
This is one of the most important modules in the entire game. Keep it rules-focused.

---

### 4.10 `js/combat/combat_manager.js`

**Purpose:**
- Runs the overall combat encounter flow

**Owns:**
- encounter setup
- combat state transitions
- actor turn flow
- integration of initiative and action resolution
- win/loss/end conditions

**Does not own:**
- low-level die rolling
- UI widgets
- three.js meshes

**Notes:**
This should coordinate combat, not implement every combat rule directly.

---

### 4.11 `js/combat/grid_state.js`

**Purpose:**
- Tracks tactical grid occupancy and logical positioning

**Owns:**
- tile coordinates
- occupancy state
- movement adjacency helpers
- range measurement helpers

**Does not own:**
- rendered grid lines/tiles
- combat action resolution itself

**Notes:**
Keep logical grid state separate from visuals. That will save trouble later.

---

### 4.12 `js/render/scene_setup.js`

**Purpose:**
- Creates and configures the three.js scene

**Owns:**
- scene
- camera
- renderer
- lights
- root scene objects

**Does not own:**
- combat rules
- world simulation state

**Notes:**
This should only prepare the rendering environment.

---

### 4.13 `js/render/rendering.js`

**Purpose:**
- Synchronizes game state with visual state

**Owns:**
- render loop
- updating visuals from logical state
- camera/render refresh timing

**Does not own:**
- tactical rules
- macro simulation decisions

**Notes:**
This should consume state, not invent it.

---

### 4.14 `js/macro/macro_game.js`

**Purpose:**
- Runs the daily macro turn process

**Owns:**
- advancing macro time
- processing faction turns
- processing resource updates
- invoking macro rules
- emitting macro consequences

**Does not own:**
- local tactical combat
- direct rendering logic

**Notes:**
Initially this can be very simple. It does not need to be a deep grand-strategy engine on day one.

---

### 4.15 `js/bridge/consequence_mapper.js`

**Purpose:**
- Converts system outputs into world-impact events understood across layers

**Owns:**
- structured consequence records
- translation between macro effects and micro changes
- translation between micro outcomes and macro consequences

**Does not own:**
- primary decision-making for either layer
- rendering

**Notes:**
This file is extremely important conceptually. It prevents the macro and micro layers from mutating each other in messy direct ways.

---

## 5. Second-Wave Modules

These should usually come after the first 15 are working.

### Core
- `event_bus.js`
- `time.js`
- `save_load.js`

### Macro
- `faction.js`
- `leader.js`
- `region.js`
- `macro_rules.js`

### Bridge
- `macro_to_micro.js`
- `micro_to_macro.js`

### Micro
- `micro_world.js`
- `npc_manager.js`
- `dialogue_manager.js`
- `local_event_manager.js`

### UI
- `ui_root.js`
- `combat_hud.js`
- `macro_panel.js`
- `dialogue_ui.js`

### Render
- `camera_controller.js`
- `grid_visuals.js`
- `actor_visuals.js`

---

## 6. Minimum Viable Build Order

A practical development sequence is below.

### Phase 1: Foundation
Build:
- `index.html`
- `main.js`
- `game.js`
- `scene_setup.js`
- `rendering.js`

Goal:
- launch page
- create 3D scene
- confirm module loading works

---

### Phase 2: Tactical Core
Build:
- `rng.js`
- `dice.js`
- `stats_data.js`
- `combatant.js`
- `initiative.js`
- `action_resolution.js`
- `grid_state.js`
- `combat_manager.js`

Goal:
- run a test encounter in pure logic
- optionally display placeholder pieces on a grid

---

### Phase 3: Tactical Presentation
Build:
- `grid_visuals.js`
- `actor_visuals.js`
- `combat_hud.js`

Goal:
- visualize combat clearly
- inspect initiative and action results through UI

---

### Phase 4: Macro Skeleton
Build:
- `macro_game.js`
- `faction.js`
- `leader.js`
- `region.js`
- `macro_rules.js`

Goal:
- simulate a minimal daily faction turn
- update region/faction state

---

### Phase 5: Bridge Layer
Build:
- `consequence_mapper.js`
- `macro_to_micro.js`
- `micro_to_macro.js`

Goal:
- demonstrate that macro state changes affect a local scene
- demonstrate that a player/local result affects macro state

---

### Phase 6: Micro World and Dialogue
Build:
- `micro_world.js`
- `npc_manager.js`
- `dialogue_manager.js`
- `dialogue_ui.js`

Goal:
- begin connecting local NPC interaction to shared leader/faction state

---

## 7. File Ownership Rules

These rules should be followed from the beginning.

### Rule 1: Rendering never owns truth
The renderer reflects state. It should not be the authoritative source of gameplay facts.

### Rule 2: Combat logic does not live in UI files
UI can request actions and show results, but the rules belong in logic modules.

### Rule 3: Macro logic does not directly rewrite tactical objects
Macro outputs should become structured consequences, then be applied through the bridge layer.

### Rule 4: Shared entities need stable IDs
Faction leaders, factions, and regions should use stable IDs so both macro and micro layers can reference the same underlying records.

### Rule 5: Data files define constants, not behavior
Files like `stats_data.js` or `skills_data.js` should centralize definitions, not long procedural logic.

---

## 8. Suggested Starter Responsibilities by Layer

### Core Layer
Provides generic utilities used by many systems.

Examples:
- RNG
- event dispatching
- time progression
- save/load helpers

### Combat Layer
Handles tactical resolution.

Examples:
- dice pools
- skill/stat roll assembly
- initiative queue
- action execution
- grid logic

### Macro Layer
Handles strategic-scale simulation.

Examples:
- factions
- leaders
- regions
- daily turns
- strategic projects

### Bridge Layer
Translates between scales.

Examples:
- macro state becomes local world tags
- player outcomes become strategic consequences

### Micro Layer
Handles local world interactions outside combat.

Examples:
- NPC state
- dialogue
- local events
- town/site state

### Render Layer
Visualizes current state.

Examples:
- three.js scene
- units/tiles visualization
- camera controls

### UI Layer
Presents controls and information.

Examples:
- combat HUD
- dialogue choices
- faction info panel
- debug readouts

---

## 9. Recommended Early Data Structures

These are not final schemas, but useful early anchors.

### Combatant
```js
{
  id,
  name,
  factionId,
  position,
  stats,
  skills,
  resources,
  initiativeState,
  conditions
}
```

### Faction
```js
{
  id,
  name,
  leaderId,
  resources,
  relations,
  territories,
  projects,
  pressures
}
```

### Leader
```js
{
  id,
  name,
  factionId,
  traits,
  loyalties,
  currentLocation,
  alive,
  macroProfile,
  socialState
}
```

### Region
```js
{
  id,
  name,
  ownerFactionId,
  security,
  prosperity,
  unrest,
  arcanePressure,
  foodSupply,
  activeProjects,
  incidents
}
```

### Consequence Record
```js
{
  id,
  type,
  sourceLayer,
  targetLayer,
  payload,
  timestamp
}
```

---

## 10. Recommended Early Debug Tools

Build some debug support early. It will pay off immediately.

Suggested debug features:
- log every dice pool rolled
- show initiative queue after every action
- show active combat resources
- show current region state
- show current faction resource state
- show last 20 consequence records
- show current day and pending macro turn effects

This does not need to be pretty. It just needs to exist.

---

## 11. Refactor Triggers

If any of the following happen, the project is drifting toward unhealthy structure:

- `game.js` becomes a giant rules file
- rendering files start changing game truth directly
- combat resolution spreads across multiple unrelated files
- macro and micro layers directly mutate each other without structured events
- a single file becomes too large to reason about in one pass
- AI-assisted changes repeatedly break unrelated systems because ownership is unclear

When that happens, split responsibilities sooner rather than later.

---

## 12. Strong Recommendation on the First Playable Slice

The first playable slice should **not** attempt the full dream immediately.

Recommended first playable target:
- one simple tactical map
- two or three combatants per side
- initiative reroll system functioning
- dice pools functioning
- one or two resources functioning
- one faction and one leader in the macro layer
- one region whose state affects the local map

That is enough to prove the architecture works.

Do not wait until everything exists before integrating. Integrate early with a tiny example.

---

## 13. Immediate Next Document

The most useful next document after this one would be a **technical starter spec** defining the first actual modules in more detail, such as:

- `dice.js`
- `combatant.js`
- `initiative.js`
- `action_resolution.js`
- `macro_game.js`
- `consequence_mapper.js`

That next doc should include:
- exported functions/classes
- expected inputs and outputs
- minimal example data
- notes on testing each module in isolation

---

## 14. Final Reminder

This module plan is **preliminary**. It is meant to create a sane starting structure, not freeze the final architecture.

The project should be expected to change as:
- combat rules become clearer
- the macro rules are tested
- the bridge between scales is exercised
- UI needs become visible
- performance and complexity pressures emerge

A modular structure is valuable precisely because it makes those changes easier.

