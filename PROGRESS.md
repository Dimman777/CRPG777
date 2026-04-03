# CRPG777 — Progress Tracker

_Last updated: 2026-04-03_

This document is the living source of truth for what's done, what's in progress, and what comes next. It is cross-referenced against the design docs:
- `crpg_macro_micro_architecture_preliminary_v0_1.md`
- `crpg_macro_rules_preliminary_v0_1.md`
- `crpg_starter_module_plan_preliminary_v0_1.md`
- `settlement info/` docs
- `world_generator_design_640x480 (1).md`

> **Note:** CLAUDE.md still says "pre-implementation phase." That's outdated. The game is playable. This tracker supersedes that claim.

---

## Phase Status Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — module loading, 3D scene | ✅ Complete |
| 2 | Tactical core — pure logic combat | ✅ Complete |
| 3 | Tactical presentation — visuals & HUD | ✅ Complete |
| 4 | Macro skeleton — factions, regions, daily turns | ✅ Complete |
| 5 | Bridge layer — macro↔micro consequence system | ✅ Complete (thin) |
| 6 | Micro world — exploration, NPCs, dialogue | 🔶 Partial |
| 7 | Save / Load | ❌ Not started |
| 8 | Dialogue expansion — quests, exploration trees | ❌ Not started |
| 9 | War & Diplomacy depth | 🔶 Scaffolded |
| 10 | Strategic Projects system | 🔶 Scaffolded |
| 11 | Settlement integration with macro pressures | 🔶 Partial |
| 12 | Arcane system | ❌ Not started |
| 13 | Succession / Leadership transfer | ❌ Not started |

---

## Module Completion Detail

### Core (`js/core/`)

| File | Status | Notes |
|------|--------|-------|
| `rng.js` | ✅ Done | Seeded, deterministic — used throughout |
| `event_bus.js` | ❌ Not present | Not yet implemented |
| `time.js` | ❌ Not present | Macro interval is hardcoded (2s) in game.js |
| `save_load.js` | ❌ Not started | Critical missing piece |
| `version.js` | ✅ Done | Version stamp |
| `chunk_overrides.js` | ✅ Done | Chunk editor persistence — not in original plan but useful |

### Data (`js/data/`)

| File | Status | Notes |
|------|--------|-------|
| `stats_data.js` | ✅ Done | Stat→die mapping |
| `skills_data.js` | ❌ Not present | Planned; not yet created |
| `factions_data.js` | ❌ Not present | Faction constants live inside macro modules |
| `terrain_data.js` | ✅ Done | Terrain type definitions |
| `micro_tile_data.js` | ✅ Done | Tile definitions |
| `characters_data.js` | ✅ Done | Starting character roster |

### Combat (`js/combat/`)

| File | Status | Notes |
|------|--------|-------|
| `dice.js` | ✅ Done | Pool rolling, exceptional results |
| `combatant.js` | ✅ Done | Combatant state |
| `initiative.js` | ✅ Done | Initiative queue |
| `action_resolution.js` | ✅ Done | Action validity & outcome rolls |
| `grid_state.js` | ✅ Done | Tactical grid occupancy |
| `combat_manager.js` | ✅ Done | Encounter flow & turn order |
| `combat_session.js` | ✅ Done | Session state, NPC AI, consequence emission |

### Macro (`js/macro/`)

| File | Status | Notes |
|------|--------|-------|
| `faction.js` | ✅ Done | Faction state with resources |
| `leader.js` | ✅ Done | Leader NPC with traits |
| `region.js` | ✅ Done | Region with pressure tracking |
| `macro_game.js` | ✅ Done | Daily turn processor, faction coordinator |
| `macro_rules.js` | ✅ Done | Faction action & pressure rules (thin) |
| `macro_cell.js` | ✅ Done | Map cell representation |
| `macro_map.js` | ✅ Done | 2D world grid |
| `world_gen.js` | ✅ Done | Procedural world generation |
| `world_populator.js` | ✅ Done | Settlement/POI placement |
| `bitmap_world_loader.js` | ✅ Done | Pre-built world import from bitmap |

### Bridge (`js/bridge/`)

| File | Status | Notes |
|------|--------|-------|
| `consequence_mapper.js` | ✅ Done | Type registry with `applyToMacro` handlers |
| `macro_to_micro.js` | ✅ Done | Region state → local world conditions |
| `micro_to_macro.js` | ✅ Done | Combat/dialogue outcomes → macro events |

### Micro (`js/micro/`)

| File | Status | Notes |
|------|--------|-------|
| `micro_world.js` | ✅ Done | 3×3 chunk pool, streaming |
| `micro_grid.js` | ✅ Done | Local tile grid logic |
| `chunk_gen.js` | ✅ Done | Terrain, elevation, rivers, obstacles |
| `chunk_noise.js` | ✅ Done | Noise functions |
| `player.js` | ✅ Done | Player view/state wrapper |
| `player_state.js` | ✅ Done | Position & movement state |
| `npc_manager.js` | ✅ Done | NPC registry |
| `dialogue_manager.js` | 🔶 Partial | State machine works; content is combat-only |
| `follower_manager.js` | ✅ Done | Party composition & follower AI |
| `settlement_gen.js` | 🔶 Partial | Generator present; not deeply wired to macro pressures |
| `exploration_input.js` | ✅ Done | Full keyboard/mouse input |
| `turn_mode.js` | 🔶 Partial | Grid combat mode present; turn_controller.js is minimal |
| `turn_controller.js` | 🔶 Stub | Needs completion |

### Render (`js/render/`)

| File | Status | Notes |
|------|--------|-------|
| `scene_setup.js` | ✅ Done | THREE.js init |
| `rendering.js` | ✅ Done | Main render loop |
| `camera_controller.js` | ✅ Done | Camera tracking & azimuth |
| `chunk_renderer.js` | ✅ Done | Chunk mesh gen with performance pooling |
| `grid_visuals.js` | ✅ Done | Combat grid overlay |
| `actor_visuals.js` | ✅ Done | Combatant mesh |
| `follower_visuals.js` | ✅ Done | Companion mesh & animation |

### UI (`js/ui/`)

| File | Status | Notes |
|------|--------|-------|
| `combat_hud.js` | ✅ Done | Action menu & status |
| `macro_panel.js` | ✅ Done | Faction & region status |
| `dialogue_ui.js` | ✅ Done | Dialogue option presentation |
| `character_sheet.js` | ✅ Done | Stat display |
| `hero_select.js` | ✅ Done | Pre-game character selection |
| `formation_panel.js` | ✅ Done | Party composition manager |
| `macro_map_view.js` | ✅ Done | World map overlay |
| `location_panel.js` | ✅ Done | Current macro-cell info |
| `compass.js` | ✅ Done | Directional indicator |
| `perf_overlay.js` | ✅ Done | Frame-time metrics |
| `tile_panel.js` | ✅ Done | Current tile info |
| `chunk_editor.js` | ✅ Done | In-game chunk editing with hot-reload |
| `action_bar.js` | 🔶 Unclear | Present; scope undetermined |
| `turn_hud.js` | 🔶 Stub | Needs content |

---

## Design Doc Coverage

### Architecture Doc (`crpg_macro_micro_architecture_preliminary_v0_1.md`)

| Design Goal | Status | Notes |
|-------------|--------|-------|
| Three-layer separation (macro/bridge/micro) | ✅ Done | Clean, followed faithfully |
| Rendering never owns truth | ✅ Done | Render reads state only |
| Stable IDs for shared entities | ✅ Done | Leaders bridge macro AI + micro NPC |
| Macro→micro via bridge only | ✅ Done | No direct coupling seen |
| Daily tick sync model | ✅ Done | Runs every 2s game-time |
| ConsequenceEvent structure | ✅ Done | `{ id, type, sourceLayer, targetLayer, payload, timestamp }` |
| Player movement during macro turns | ❓ Open | Never resolved in design; appears to run in parallel |
| Macro visibility to player | 🔶 Partial | location_panel shows region state; full macro visibility is limited |
| Persistence per settlement | ❌ Not started | Needs save/load first |

### Macro Rules Doc (`crpg_macro_rules_preliminary_v0_1.md`)

| Design Goal | Status | Notes |
|-------------|--------|-------|
| Faction resources (treasury, food, manpower, etc.) | ✅ Done | Full resource model present |
| Leader traits (boldness, mercy, paranoia…) | ✅ Done | Trait system in leader.js |
| Region pressures (security, unrest, food, arcane…) | ✅ Done | Pressure tracking in region.js |
| Faction actions (develop, fortify, recruit, etc.) | 🔶 Partial | Framework exists; full action set thin |
| Strategic projects (multi-turn) | 🔶 Partial | Defined in design; code has stubs |
| War system (region occupation, sieges) | 🔶 Scaffolded | Only manpower→encounter model; no territory control |
| Diplomacy (relation states) | 🔶 Scaffolded | Relations tracked; not wired to faction AI decisions |
| Arcane power resource | 🔶 Data only | Defined; not meaningfully simulated |
| Legitimacy / Corruption | 🔶 Thin | Defined but not driving game events |
| Succession / heir handling | ❌ Not started | |
| Player leadership assumption | ❌ Not started | |
| Macro→micro pressure examples (food→prices, unrest→guards) | 🔶 Partial | Bridge translates state; micro world response is thin |

### Starter Module Plan (`crpg_starter_module_plan_preliminary_v0_1.md`)

All 15 original priority modules are implemented. The build is well past the initial plan. The project is now operating in the depth-expansion phase, not initial scaffolding.

### Settlement Docs (`settlement info/`)

| Doc | Implementation Status |
|-----|----------------------|
| `strategic_settlement_simulation_design.md` | 🔶 Generator exists; macro-pressure feedback not wired |
| `settlement_template_library_spec.md` | ❌ Templates not implemented |
| `settlement_chunk_catalog_and_naming_convention.md` | ❌ Naming/catalog conventions not enforced in code |
| `building_footprint_and_interiors_grammar_catalog.md` | ❌ Interior grammar not implemented |
| `settlement_growth_mapping_tables.md` | ❌ Growth tables not connected to macro sim |

### World Generator Doc (`world_generator_design_640x480 (1).md`)

| Feature | Status |
|---------|--------|
| Bitmap world loading | ✅ Done |
| Procedural fallback | ✅ Done |
| Terrain / elevation / rivers | ✅ Done |

---

## Known Bugs / Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| Player spawns at (32,32) without passability check — can land inside obstacles | High | Can cause stuck-at-start situations |
| No save/load — all progress lost on reload | High | Critical for any real playtest loop |
| `game.js` is 1100+ lines — accumulating rules/orchestration logic | Medium | Watch for architecture red flag (from CLAUDE.md) |
| Unseeded visual RNG blocks deterministic save/load | Medium | Must be isolated before serialization |
| CLAUDE.md "pre-implementation" claim is outdated | Low | Update when convenient |

---

## Next Up — Recommended Priority Order

1. **Save/Load** (`core/save_load.js`) — serialize faction, region, player, follower state; without this, playtesting is ephemeral
2. **Spawn fix** — passability check on player start position
3. **Turn controller completion** — `turn_controller.js` and `turn_hud.js` need to be finished for full tactical loop
4. **Strategic projects wiring** — connect multi-turn projects in macro_game daily loop with real region effects
5. **Dialogue expansion** — exploration/NPC/quest trees beyond combat aftermath
6. **Settlement ↔ macro pressure feedback** — low food → empty shelves, high unrest → hostile guards
7. **War/region control** — territory occupation, faction advance/retreat on macro map
8. **Succession system** — leader death/replacement, heir tracking
9. **Arcane system** — wire arcane_pressure to world events and micro encounters
10. **Full diplomacy** — relations affecting faction AI decisions, player negotiation options

---

## Architecture Health Check

Run this check after major sessions:

- [ ] `game.js` is NOT accumulating rules logic (currently ~1100 lines — watch it)
- [ ] Rendering files do NOT mutate simulation state
- [ ] Macro layer does NOT directly modify tactical scene objects
- [ ] Micro layer does NOT rewrite faction resources without a consequence event
- [ ] No duplicate leader data in unrelated modules
- [ ] No single file too large to reason about in one pass

---

_Update this file at the start or end of each session. It's the shared map._
