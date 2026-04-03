# CRPG777

A browser-based CRPG built with vanilla JavaScript and three.js, inspired by the single-scale world design of Ultima VI and Ultima VII.

## Status

**Pre-implementation / design phase.** Core architecture and design documents are in place. Source code is being built out incrementally.

## Concept

The world is one continuous navigable space — no mode-switching between a strategic map and a local map. Towns, wilderness, roads, and dungeons all exist at the same player scale, chunked under the hood for streaming and persistence. Faction simulation surfaces directly in the world: patrol banners change, checkpoints appear, roads become dangerous.

## Tech Stack

- **Language:** Modular ES6+ JavaScript — no framework
- **3D rendering:** [three.js](https://threejs.org/)
- **Entry point:** `index.html` — open directly in a browser, no build step required

## Running It

```
open index.html
```

No install, no build tools, no server required.

## Architecture

Three simulation layers with strict downward dependencies:

```
Data / Rules
     ↓
Macro Simulation  ←→  Bridge Layer  ←→  Micro Simulation
     ↓
Rendering / UI
```

- **Macro** (`js/macro/`) — factions, regions, diplomacy, daily turn cadence
- **Bridge** (`js/bridge/`) — translates macro state into local world conditions; packages micro outcomes as consequence events
- **Micro** (`js/micro/`, `js/combat/`) — 3D exploration, NPC dialogue, tactical grid combat
- **Render** (`js/render/`) — reads state, drives three.js visuals, never owns truth
- **UI** (`js/ui/`) — displays state, routes input, contains no game rules

## Design Documents

| Document | Contents |
|---|---|
| [`crpg_macro_micro_architecture_preliminary_v0_1.md`](crpg_macro_micro_architecture_preliminary_v0_1.md) | Three-layer architecture, entity ownership, sync model |
| [`crpg_macro_rules_preliminary_v0_1.md`](crpg_macro_rules_preliminary_v0_1.md) | Macro simulation rules: factions, leaders, regions, turns |
| [`crpg_starter_module_plan_preliminary_v0_1.md`](crpg_starter_module_plan_preliminary_v0_1.md) | Folder layout, first modules, phased build order |
| [`Map talk.txt`](Map%20talk.txt) | Single-scale world mapping philosophy |
| [`world_generator_design_640x480 (1).md`](<world_generator_design_640x480 (1).md>) | World generator design |
| [`settlement info/`](settlement%20info/) | Settlement templates, chunk catalog, growth tables |
| [`NPC_Dossiers_All.md`](NPC_Dossiers_All.md) | NPC profiles and faction affiliations |
