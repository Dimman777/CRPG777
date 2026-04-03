# CRPG777 — Progress Tracker

_Last updated: 2026-04-03_

This document is the **design-doc crosswalk and architecture health reference**. It answers "how far along are we relative to the vision?"

Task tracking, prioritization, and file-split scheduling live in **GitHub Issues + Milestones**:
- [Open Issues](https://github.com/Dimman777/CRPG777/issues)
- [Milestones](https://github.com/Dimman777/CRPG777/milestones) — Tier 1 (Prerequisites) through Tier 5 (Feature Depth)

> **Note:** CLAUDE.md still says "pre-implementation phase." That is outdated. The game is playable. This tracker supersedes that claim.

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
| 7 | Save / Load | ❌ Not started — [#17](https://github.com/Dimman777/CRPG777/issues/17) |
| 8 | Dialogue expansion — quests, exploration trees | ❌ Not started — [#27](https://github.com/Dimman777/CRPG777/issues/27) |
| 9 | War & Diplomacy depth | 🔶 Scaffolded — [#28](https://github.com/Dimman777/CRPG777/issues/28) |
| 10 | Strategic Projects system | 🔶 Scaffolded — [#26](https://github.com/Dimman777/CRPG777/issues/26) |
| 11 | Settlement integration with macro pressures | 🔶 Partial |
| 12 | Arcane system | ❌ Not started |
| 13 | Succession / Leadership transfer | ❌ Not started — [#29](https://github.com/Dimman777/CRPG777/issues/29) |

---

## Module Completion Detail

### Core (`js/core/`)

| File | Status | Notes |
|------|--------|-------|
| `rng.js` | ✅ Done | Seeded, deterministic — used throughout |
| `event_bus.js` | ❌ Not present | Not yet implemented |
| `time.js` | ❌ Not present | Macro interval hardcoded in game.js — [#9](https://github.com/Dimman777/CRPG777/issues/9) |
| `save_load.js` | ❌ Not started | [#17](https://github.com/Dimman777/CRPG777/issues/17) |
| `version.js` | ✅ Done | |
| `chunk_overrides.js` | ✅ Done | Chunk editor persistence |

### Data (`js/data/`)

| File | Status | Notes |
|------|--------|-------|
| `stats_data.js` | ✅ Done | |
| `skills_data.js` | ❌ Not present | Planned; not yet created |
| `factions_data.js` | ❌ Not present | Constants live inside macro modules |
| `terrain_data.js` | ✅ Done | |
| `micro_tile_data.js` | ✅ Done | |
| `characters_data.js` | ✅ Done | |

### Combat (`js/combat/`)

| File | Status | Notes |
|------|--------|-------|
| `dice.js` | ✅ Done | |
| `combatant.js` | ✅ Done | |
| `initiative.js` | ✅ Done | |
| `action_resolution.js` | ✅ Done | |
| `grid_state.js` | ✅ Done | |
| `combat_manager.js` | ✅ Done | |
| `combat_session.js` | ✅ Done | NPC AI, consequence emission |

### Macro (`js/macro/`)

| File | Size | Status | Notes |
|------|------|--------|-------|
| `faction.js` | — | ✅ Done | |
| `leader.js` | — | ✅ Done | |
| `region.js` | — | ✅ Done | Pressure tracking |
| `macro_game.js` | — | ✅ Done | Daily turn processor |
| `macro_rules.js` | — | ✅ Done | Thin — needs strategic project wiring |
| `macro_cell.js` | — | ✅ Done | |
| `macro_map.js` | — | ✅ Done | |
| `world_gen.js` | 54kb | ✅ Done | Split tracked: [#20](https://github.com/Dimman777/CRPG777/issues/20) |
| `world_populator.js` | 35kb | ✅ Done | Split tracked: [#23](https://github.com/Dimman777/CRPG777/issues/23) |
| `bitmap_world_loader.js` | — | ✅ Done | |

### Bridge (`js/bridge/`)

| File | Status | Notes |
|------|--------|-------|
| `consequence_mapper.js` | ✅ Done | Type registry |
| `macro_to_micro.js` | ✅ Done | Region-level only — QuadX upgrade: [#25](https://github.com/Dimman777/CRPG777/issues/25) |
| `micro_to_macro.js` | ✅ Done | |

### Micro (`js/micro/`)

| File | Size | Status | Notes |
|------|------|--------|-------|
| `micro_world.js` | 29kb | ✅ Done | 3×3 chunk pool, streaming |
| `micro_grid.js` | — | ✅ Done | |
| `chunk_gen.js` | 36kb | ✅ Done | Split tracked: [#21](https://github.com/Dimman777/CRPG777/issues/21) |
| `chunk_noise.js` | — | ✅ Done | |
| `player.js` | — | ✅ Done | |
| `player_state.js` | — | ✅ Done | |
| `npc_manager.js` | — | ✅ Done | |
| `dialogue_manager.js` | — | 🔶 Partial | Content is combat-only — [#27](https://github.com/Dimman777/CRPG777/issues/27) |
| `follower_manager.js` | 30kb | ✅ Done | Split tracked: [#10](https://github.com/Dimman777/CRPG777/issues/10) |
| `settlement_gen.js` | 41kb | 🔶 Partial | Not wired to macro pressures — split: [#22](https://github.com/Dimman777/CRPG777/issues/22) |
| `exploration_input.js` | — | ✅ Done | |
| `turn_mode.js` | — | 🔶 Partial | |
| `turn_controller.js` | — | 🔶 Stub | [#19](https://github.com/Dimman777/CRPG777/issues/19) |

### Render (`js/render/`)

| File | Size | Status | Notes |
|------|------|--------|-------|
| `scene_setup.js` | — | ✅ Done | |
| `rendering.js` | — | ✅ Done | |
| `camera_controller.js` | — | ✅ Done | |
| `chunk_renderer.js` | 37kb | ✅ Done | Split tracked: [#24](https://github.com/Dimman777/CRPG777/issues/24) |
| `grid_visuals.js` | — | ✅ Done | |
| `actor_visuals.js` | — | ✅ Done | |
| `follower_visuals.js` | — | ✅ Done | |

### UI (`js/ui/`)

| File | Status | Notes |
|------|--------|-------|
| `combat_hud.js` | ✅ Done | |
| `macro_panel.js` | ✅ Done | |
| `dialogue_ui.js` | ✅ Done | |
| `character_sheet.js` | ✅ Done | |
| `hero_select.js` | ✅ Done | |
| `formation_panel.js` | ✅ Done | |
| `macro_map_view.js` | ✅ Done | |
| `location_panel.js` | ✅ Done | |
| `compass.js` | ✅ Done | |
| `perf_overlay.js` | ✅ Done | |
| `tile_panel.js` | ✅ Done | |
| `chunk_editor.js` | ✅ Done | |
| `action_bar.js` | 🔶 Unclear | Scope undetermined |
| `turn_hud.js` | 🔶 Stub | [#19](https://github.com/Dimman777/CRPG777/issues/19) |

---

## Design Doc Coverage

### Architecture Doc (`crpg_macro_micro_architecture_preliminary_v0_1.md`)

| Design Goal | Status | Notes |
|-------------|--------|-------|
| Three-layer separation (macro/bridge/micro) | ✅ Done | Clean, followed faithfully |
| Rendering never owns truth | ✅ Done | |
| Stable IDs for shared entities | ✅ Done | Leaders bridge macro AI + micro NPC |
| Macro→micro via bridge only | ✅ Done | No direct coupling |
| Daily tick sync model | ✅ Done | Runs every 2s game-time |
| ConsequenceEvent structure | ✅ Done | `{ id, type, sourceLayer, targetLayer, payload, timestamp }` |
| Player movement during macro turns | ❓ Open | Appears to run in parallel — never formally resolved |
| Macro visibility to player | 🔶 Partial | location_panel shows region state; full visibility limited |
| Persistence per settlement | ❌ Not started | Blocked by save/load [#17](https://github.com/Dimman777/CRPG777/issues/17) |

### Macro Rules Doc (`crpg_macro_rules_preliminary_v0_1.md`)

| Design Goal | Status | Notes |
|-------------|--------|-------|
| Faction resources (treasury, food, manpower, etc.) | ✅ Done | |
| Leader traits (boldness, mercy, paranoia…) | ✅ Done | |
| Region pressures (security, unrest, food, arcane…) | ✅ Done | |
| Faction actions (develop, fortify, recruit, etc.) | 🔶 Partial | Framework exists; action set thin |
| Strategic projects (multi-turn) | 🔶 Partial | [#26](https://github.com/Dimman777/CRPG777/issues/26) |
| War system (region occupation, sieges) | 🔶 Scaffolded | [#28](https://github.com/Dimman777/CRPG777/issues/28) |
| Diplomacy (relation states) | 🔶 Scaffolded | Tracked; not wired to AI decisions |
| Arcane power resource | 🔶 Data only | Not meaningfully simulated |
| Legitimacy / Corruption | 🔶 Thin | Not driving game events |
| Succession / heir handling | ❌ Not started | [#29](https://github.com/Dimman777/CRPG777/issues/29) |
| Player leadership assumption | ❌ Not started | |
| Macro→micro pressure feedback (QuadX) | 🔶 Partial | Region-level only — [#25](https://github.com/Dimman777/CRPG777/issues/25) |

### Starter Module Plan (`crpg_starter_module_plan_preliminary_v0_1.md`)

All 15 original priority modules are implemented. Project is now in the **depth-expansion phase**.

### Settlement Docs (`settlement info/`)

| Doc | Status | Notes |
|-----|--------|-------|
| `strategic_settlement_simulation_design.md` | 🔶 Partial | Generator exists; macro-pressure feedback not wired |
| `settlement_template_library_spec.md` | ❌ Not started | |
| `settlement_chunk_catalog_and_naming_convention.md` | ❌ Not started | |
| `building_footprint_and_interiors_grammar_catalog.md` | ❌ Not started | |
| `settlement_growth_mapping_tables.md` | ❌ Not started | |

### World Generator Doc

| Feature | Status |
|---------|--------|
| Bitmap world loading | ✅ Done |
| Procedural fallback | ✅ Done |
| Terrain / elevation / rivers | ✅ Done |

---

## Architecture Health Check

Run this after major sessions:

- [ ] `game.js` is not accumulating rules logic — [#8](https://github.com/Dimman777/CRPG777/issues/8) tracks the state machine extraction
- [ ] Rendering files do not mutate simulation state
- [ ] Macro layer does not directly modify tactical scene objects
- [ ] Micro layer does not rewrite faction resources without a consequence event
- [ ] No duplicate leader data in unrelated modules
- [ ] No single file has grown too large to reason about in one pass — see file-split issues [#10](https://github.com/Dimman777/CRPG777/issues/10), [#20–24](https://github.com/Dimman777/CRPG777/issues/20)

---

_Update this file when phases change status or new design decisions are made. Day-to-day tasks live in GitHub Issues._
