# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a **pre-implementation phase** project. The repository currently contains only design documents. No source code, build tooling, or test infrastructure exists yet.

Design documents:
- `crpg_macro_micro_architecture_preliminary_v0_1.md` — Three-layer architecture, entity ownership, data flow, synchronization model
- `crpg_macro_rules_preliminary_v0_1.md` — Macro simulation rules: factions, leaders, regions, resources, turn cadence
- `crpg_starter_module_plan_preliminary_v0_1.md` — Folder layout, first 15 modules to build, phased build order

## Tech Stack

- **Entry point:** `index.html` (browser-based, no server required)
- **Language:** Modular ES6+ JavaScript (no framework — no React, Vue, Angular)
- **3D rendering:** `three.js`
- **No build tools defined yet** — expected to start as plain `<script type="module">` imports

## Architecture Overview

The game is organized as three connected layers. Dependencies flow strictly downward:

```
Data / Rules
     ↓
Macro Simulation Layer  ←→  Bridge Layer  ←→  Micro Simulation Layer
     ↓
Presentation / UI / Rendering
```

**Macro layer** (`js/macro/`): Factions, leaders, regions, diplomatic state, strategic projects. Operates on a discrete **daily turn** cadence. Does not know about three.js, cameras, or local tactical details.

**Bridge layer** (`js/bridge/`): The critical integration layer. Translates macro region state into local world conditions (e.g., high unrest → stricter guards and harsher NPC dialogue). Packages micro outcomes into structured `ConsequenceEvent` records that the macro layer processes at sync time. Macro and micro must never talk directly — all cross-scale communication goes through the bridge.

**Micro layer** (`js/micro/`, `js/combat/`): What the player directly plays — 3D exploration, NPC dialogue, tactical turn-based combat on a grid. Reads world conditions from the bridge; does not own faction strategy or region production rules.

**Render layer** (`js/render/`): Consumes simulation state to drive three.js visuals. Never owns or mutates game truth.

**UI layer** (`js/ui/`): Displays state and routes player input. Does not contain game rules.

## Planned Folder Layout

```
index.html
js/
  main.js          # bootstrap only — stays small
  game.js          # top-level orchestrator, mode switching, delegates to subsystems
  core/            # rng.js, event_bus.js, time.js, save_load.js
  data/            # stats_data.js, skills_data.js, factions_data.js, etc. — constants only, no behavior
  combat/          # dice.js, combatant.js, initiative.js, action_resolution.js, combat_manager.js, grid_state.js
  macro/           # faction.js, leader.js, region.js, macro_rules.js, macro_game.js
  bridge/          # consequence_mapper.js, macro_to_micro.js, micro_to_macro.js
  micro/           # micro_world.js, npc_manager.js, dialogue_manager.js
  render/          # scene_setup.js, rendering.js, camera_controller.js, grid_visuals.js, actor_visuals.js
  ui/              # ui_root.js, combat_hud.js, macro_panel.js, dialogue_ui.js
```

## Phased Build Order

1. **Foundation** — `index.html`, `main.js`, `game.js`, `scene_setup.js`, `rendering.js` → confirm module loading and 3D scene
2. **Tactical core** — `rng.js`, `dice.js`, `stats_data.js`, `combatant.js`, `initiative.js`, `action_resolution.js`, `grid_state.js`, `combat_manager.js` → run a test encounter in pure logic
3. **Tactical presentation** — `grid_visuals.js`, `actor_visuals.js`, `combat_hud.js`
4. **Macro skeleton** — `macro_game.js`, `faction.js`, `leader.js`, `region.js`, `macro_rules.js`
5. **Bridge layer** — `consequence_mapper.js`, `macro_to_micro.js`, `micro_to_macro.js` → prove cross-scale influence with a minimal example
6. **Micro world** — `micro_world.js`, `npc_manager.js`, `dialogue_manager.js`

## File Ownership Rules

1. **Rendering never owns truth.** The renderer reads state; it does not author it.
2. **Combat logic does not live in UI files.** UI may request actions; rules live in logic modules.
3. **Macro logic does not directly rewrite tactical objects.** All macro→micro changes flow through the bridge as structured consequence records.
4. **Shared entities use stable IDs.** Faction leaders exist as one logical entity record readable by both macro AI and micro dialogue systems.
5. **Data files define constants, not behavior.** `stats_data.js`, `skills_data.js`, etc. are definition tables only.

## Key Data Structures

```js
// Cross-layer consequence event (bridge layer)
{ id, type, sourceLayer, targetLayer, payload, timestamp }

// Region state (macro → bridge translation)
{ id, name, ownerFactionId, security, prosperity, unrest, arcanePressure, foodSupply, activeProjects, incidents }

// Leader entity (shared by macro AI and micro NPC systems)
{ id, name, factionId, traits, loyalties, currentLocation, alive, macroProfile, socialState }
```

## Synchronization Model

Macro processes at **time-step boundaries**, not every frame. The sync sequence:

```
advance_day()
  → macro_turn_runner.process_day()
  → bridge.collect_macro_changes()
  → bridge.translate_region_effects()
  → micro_game.apply_world_updates()
  → ui.push_news_and_rumors()
```

## Architectural Red Flags

Refactor immediately if any of these appear:
- `game.js` accumulates rules logic
- Rendering files mutate simulation state
- Macro layer directly modifies tactical scene objects
- Micro layer rewrites faction resources without a consequence event
- Duplicate leader data appears in unrelated modules
- A single file grows too large to reason about in one pass
