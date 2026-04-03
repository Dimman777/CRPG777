import * as THREE            from 'three';
import { SceneSetup }        from './render/scene_setup.js';
import { Rendering }         from './render/rendering.js';
import { CameraController }  from './render/camera_controller.js';
import { GridVisuals }       from './render/grid_visuals.js';
import { ActorVisuals }      from './render/actor_visuals.js';
import { CombatHud }    from './ui/combat_hud.js';
import { MacroPanel }   from './ui/macro_panel.js';
import { DialogueUI }   from './ui/dialogue_ui.js';
import { CombatSession } from './combat/combat_session.js';
import { MacroGame }    from './macro/macro_game.js';
import { Faction }      from './macro/faction.js';
import { Leader }       from './macro/leader.js';
import { Region }       from './macro/region.js';
import { NPC, NPCManager }  from './micro/npc_manager.js';
import { MicroWorld }       from './micro/micro_world.js';
import { DialogueManager }  from './micro/dialogue_manager.js';
import { applyConsequence }                         from './bridge/consequence_mapper.js';
import { WorldGen }        from './macro/world_gen.js';
import { WorldPopulator }  from './macro/world_populator.js';
import { LocationPanel }   from './ui/location_panel.js';
import { TilePanel }       from './ui/tile_panel.js';
import { Compass }         from './ui/compass.js';
import { FollowerManager } from './micro/follower_manager.js';
import { FollowerVisuals } from './render/follower_visuals.js';
import { FormationPanel }  from './ui/formation_panel.js';
import { CharacterSheet }  from './ui/character_sheet.js';
import { ExplorationInput } from './micro/exploration_input.js';
import { TurnMode }        from './micro/turn_mode.js';
import { ChunkOverrides }  from './core/chunk_overrides.js';
import { CHARACTERS, getCharacter } from './data/characters_data.js';
import { RNG }             from './core/rng.js';
import { PerfOverlay }     from './ui/perf_overlay.js';

const MACRO_INTERVAL       = 2000;
const PLAYER_FACTION       = 'a';
const PLAYER_COMBATANT_ID  = 'a0';
const COMBAT_REGION        = 'r1';
const MAX_COMMITMENT       = 5;
const START_MANPOWER       = 8;

const ROSTER = {
  a: [
    { name: 'Aldric',  stats: { strength: 3, toughness: 2, reflexes: 3, coordination: 2 } },
    { name: 'Bram',    stats: { strength: 4, toughness: 2, reflexes: 2, coordination: 2 } },
    { name: 'Vera',    stats: { strength: 2, toughness: 3, reflexes: 3, coordination: 3 } },
    { name: 'Dunstan', stats: { strength: 3, toughness: 3, reflexes: 2, coordination: 3 } },
    { name: 'Lyra',    stats: { strength: 2, toughness: 2, reflexes: 4, coordination: 3 } },
  ],
  b: [
    { name: 'Brynn',   stats: { strength: 2, toughness: 3, reflexes: 2, coordination: 3 } },
    { name: 'Dag',     stats: { strength: 3, toughness: 2, reflexes: 3, coordination: 2 } },
    { name: 'Mira',    stats: { strength: 2, toughness: 2, reflexes: 3, coordination: 4 } },
    { name: 'Cort',    stats: { strength: 3, toughness: 3, reflexes: 2, coordination: 2 } },
    { name: 'Syla',    stats: { strength: 2, toughness: 3, reflexes: 3, coordination: 3 } },
  ],
};

export class Game {
  constructor() {
    this.scene           = null;
    this.rendering       = null;
    this.cameraController = null;
    this.gridVisuals     = null;
    this.actorVisuals    = null;
    this.combatHud       = null;
    this.macroPanel      = null;
    this.dialogueUI      = null;
    this.macroGame       = null;
    this.npcManager      = null;
    this.microWorld      = null;
    this.dialogueMgr     = null;
    this._combatSession  = null;
    this._macroTimer     = null;
    this._macroLogIdx    = 0;
    this._commitments    = { a: 1, b: 1 };
    this._followerMgr    = null;
    this._followerVis    = null;
    this._formationPanel = null;
    this._explorationInput  = null;
    this._turnMode          = null;
    this._chunkOverrides       = null;  // ChunkOverrides — shared with the macro map editor
    this._sharedWorld          = null;  // { seed, map, worldData } — set in _initExploration
    this._playerCell           = null;  // { mx, my } — updated on cell change events
    this._playerCharId         = 'grendoli';
    this._charSheet            = null;
    this._contextMenu          = null;  // right-click follower context menu div
  }

  // Public getters for state that index.html / overlay scripts may need.
  get sharedWorld() { return this._sharedWorld; }
  get playerCell()  { return this._playerCell; }

  start(worldOpts = {}) {
    this._playerCharId = worldOpts.heroId ?? 'grendoli';
    this._charSheet    = new CharacterSheet();
    const viewport = document.getElementById('game-viewport');
    this.scene            = new SceneSetup(viewport);
    this.cameraController = new CameraController(viewport.clientWidth, viewport.clientHeight);
    this.rendering        = new Rendering(this.scene);
    this.rendering.cameraController = this.cameraController;
    this.rendering.start();

    // Store listener references for cleanup on restart/destroy.
    this._onResize = () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      this.scene.onResize(w, h);
      this.cameraController.onResize(w, h);
    };
    this._onCameraKey = e => {
      if (e.key === 'q' || e.key === 'Q') this.cameraController.rotateLeft();
      if (e.key === 'e' || e.key === 'E') this.cameraController.rotateRight();
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onCameraKey);

    this._perf = new PerfOverlay();
    this._rng  = null; // created in _initMacro from world seed
    this.started = true;
    this._initMacro();
    this._initMicro();
    this._initExploration(worldOpts);

    this.dialogueUI = new DialogueUI();
    this.dialogueUI.onSelect(id => this._onDialogueSelect(id));

    this._macroTimer = setInterval(() => {
      this.macroGame.advanceDay();
      this.macroPanel.update(this.macroGame);
      this._flushMacroLog();
    }, MACRO_INTERVAL);

    debug('World loaded. WASD move · Q/E rotate camera · Z/C torso · Space toggle turn mode.');
  }

  // ── Macro ──────────────────────────────────────────────────────────────────

  _initMacro() {
    const factions = [
      new Faction({ id: 'a', name: 'Iron Throne',    leaderId: 'l1' }),
      new Faction({ id: 'b', name: 'Silver Council', leaderId: 'l2' }),
    ];
    const leaders = [
      new Leader({ id: 'l1', name: 'Lord Harven', factionId: 'a',
        traits: ['aggressive'], macroProfile: { aggression: 7, expansion: 6 } }),
      new Leader({ id: 'l2', name: 'Arch Selyn',  factionId: 'b',
        traits: ['cautious'],   macroProfile: { caution: 8, diplomacy: 7 } }),
    ];
    const regions = [
      new Region({ id: 'r1', name: 'Ashenvale',  ownerFactionId: 'a',
        initialState: { security: 65, prosperity: 55, unrest: 25, foodSupply: 75 } }),
      new Region({ id: 'r2', name: 'Silverport', ownerFactionId: 'b',
        initialState: { security: 70, prosperity: 60, unrest: 15, foodSupply: 80 } }),
    ];
    factions[0].territories         = ['r1'];
    factions[1].territories         = ['r2'];
    factions[0].resources.manpower  = START_MANPOWER;
    factions[1].resources.manpower  = START_MANPOWER;

    this.macroGame  = new MacroGame(factions, leaders, regions);
    this.macroPanel = new MacroPanel();
    this.macroPanel.update(this.macroGame);

    debug('[Macro] World initialised — Iron Throne vs Silver Council.');
    debug(`[War]   Each side begins with ${START_MANPOWER} men. Max ${MAX_COMMITMENT}v${MAX_COMMITMENT}.`);
  }

  // ── Exploration ────────────────────────────────────────────────────────────

  _initExploration(opts = {}) {
    const SEED       = opts.seed      ?? 42;
    const NUM_FAULTS = opts.numFaults ?? 0;
    // Master gameplay RNG — seeded from world seed so all gameplay randomness
    // is deterministic from the same seed.  Cosmetic randomness (head-look etc.)
    // still uses Math.random() and does not affect game state.
    this._rng = new RNG(SEED ^ 0x47414D45); // "GAME" in hex, distinct from world-gen seed
    this._chunkOverrides = opts.chunkOverrides ?? new ChunkOverrides();

    // Use a pre-built map (from start screen or bitmap loader) if provided,
    // otherwise generate one fresh so the game can still start without a start screen.
    let macroMap, worldData;
    if (opts.macroMap) {
      macroMap  = opts.macroMap;
      worldData = opts.worldData ?? { kingdoms: [], ancientSites: [], pois: [] };
    } else {
      const gen  = new WorldGen({ numFaults: NUM_FAULTS });
      macroMap   = gen.generate(SEED);
      const pop  = new WorldPopulator();
      worldData  = pop.populate(macroMap, SEED);
    }
    this._sharedWorld = { seed: SEED, numFaults: NUM_FAULTS, map: macroMap, worldData };
    window._sharedWorld = this._sharedWorld; // legacy — index.html start screen reads this

    // Use provided start position or find nearest passable cell from map centre.
    let startMx = opts.startMx, startMy = opts.startMy;
    if (startMx === undefined || startMy === undefined) {
      const cx = Math.floor(macroMap.width  / 2);
      const cy = Math.floor(macroMap.height / 2);
      startMx = cx; startMy = cy;
      outer:
      for (let r = 0; r <= 150; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const cell = macroMap.get(cx + dx, cy + dy);
            const goodStart = cell && cell.isPassable() &&
              cell.terrain !== 'ocean' && cell.terrain !== 'shallow_shore' &&
              cell.terrain !== 'steep_shore';
            if (goodStart) { startMx = cx + dx; startMy = cy + dy; break outer; }
          }
        }
      }
    }

    this.microWorld.init(this.scene.scene, macroMap, SEED, startMx, startMy, this._chunkOverrides);
    // Snap camera Y to starting elevation so it doesn't lerp from y=0.
    const startPos = this.microWorld.player?.position;
    if (startPos && this.cameraController) {
      this.cameraController.setTarget(startPos.x, startPos.y, startPos.z);
      this.cameraController.snapY();
    }

    // Location HUD — shows macro-cell info beside the macro simulation panel.
    this._locationPanel = new LocationPanel();
    this._tilePanel     = new TilePanel();
    this._compass       = new Compass();
    const updateLocation = ({ mx, my }) => {
      const cell = this._sharedWorld?.map.get(mx, my);
      this._locationPanel.update(cell, this._sharedWorld?.worldData, mx, my);
    };
    window.addEventListener('playerCellChanged', e => {
      this._playerCell = e.detail;
      updateLocation(e.detail);
    });
    // Apply immediately for the start cell (event already fired before listener registered).
    // Apply for the start cell (micro_world fires the event before this listener is registered).
    if (this._playerCell) updateLocation(this._playerCell);

    // Teleport from macro map "Go Here" button
    window.addEventListener('goToCell', e => {
      this.microWorld.teleportTo(e.detail.mx, e.detail.my);
      // Snap camera Y so it doesn't lerp from the old elevation after a long teleport.
      const p = this.microWorld.player?.position;
      if (p && this.cameraController) {
        this.cameraController.setTarget(p.x, p.y, p.z);
        this.cameraController.snapY();
      }
    });

    // Input + turn mode — extracted to dedicated modules
    const vpEl = document.getElementById('game-viewport');

    // Zoom in for ground-level exploration (default FRUSTUM_HALF is 20)
    this.cameraController.setFrustumHalf(8);

    // Followers
    this._followerMgr    = new FollowerManager(this._rng);
    this._followerVis    = new FollowerVisuals(this.scene.scene);
    this._formationPanel = new FormationPanel(this._charSheet);

    // Show the PC as slot #1, then the rest of the roster as recruitable companions
    const playerChar = getCharacter(this._playerCharId);
    this._formationPanel.setPlayerCharacter(playerChar);
    const roster = CHARACTERS.filter(c => c.id !== this._playerCharId);
    this._formationPanel.setRoster(roster);

    this._formationPanel.onRosterChange = activeIds => {
      const charData = activeIds.map(id => getCharacter(id)).filter(Boolean);
      this._followerMgr.setActiveFollowers(charData, this.microWorld.player);
    };
    this._formationPanel.onModeChange = mode => {
      this._followerMgr.setMode(mode);
    };

    // Propagate chunk transitions to follower positions
    this.microWorld.onChunkTransition = (dPx, dPy) => {
      this._followerMgr.onChunkTransition(dPx, dPy);
    };

    // Input + turn mode modules
    this._explorationInput = new ExplorationInput({
      viewport:          vpEl,
      getCamera:         () => this.cameraController.camera,
      getPlayer:         () => this.microWorld.player,
      getCentreRenderer: () => this.microWorld.centreRenderer,
      getFollowers:      () => this._followerMgr.followers,
      microWorld:        this.microWorld,
      charSheet:         this._charSheet,
      formationPanel:    this._formationPanel,
      onToggleTurn:      () => this._turnMode.toggle(),
      isTurnActive:      () => this._turnMode?.isActive ?? false,
      onTurnPass:        () => this._turnMode.pass(),
      onLog:             msg => debug(msg),
    });

    this._turnMode = new TurnMode({
      scene:              this.scene.scene,
      viewport:           vpEl,
      explorationInput:   this._explorationInput,
      getPlayer:          () => this.microWorld.player,
      getCentreGrid:      () => this.microWorld.centreGrid,
      getCentreRenderer:  () => this.microWorld.centreRenderer,
      getFollowers:       () => this._followerMgr.followers,
      followerMgr:        this._followerMgr,
      microWorld:         this.microWorld,
      onToggleMacro:      (paused) => {
        if (paused) {
          clearInterval(this._macroTimer);
          this._macroTimer = null;
        } else {
          this._macroTimer = setInterval(() => {
            this.macroGame.advanceDay();
            this.macroPanel.update(this.macroGame);
            this._flushMacroLog();
          }, MACRO_INTERVAL);
        }
      },
      onLog: msg => debug(msg),
    });

    // Per-frame update — real-time or turn mode
    const input = this._explorationInput;
    const tm    = this._turnMode;
    this.rendering.onUpdate = dt => {
      const perf = this._perf;
      perf.frameStart();

      // Apply mouse-driven movement (free roam only).
      if (input.rmouseDown && !tm.isActive) {
        const p = this.microWorld.player;
        if (p) {
          const dx   = input.rmouseX - p.px;
          const dz   = input.rmouseZ - p.py;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const speedFactor = dist > 0.5 ? Math.min(1, (dist - 0.5) / 4.5) : 0;
          if (dist > 0.1) p.setMouseMove(dx / dist, dz / dist, speedFactor);
          else            p.clearMouseMove();
        }
      }

      this.microWorld.perfBegin = (name) => perf.begin(name);
      const endWorld = perf.begin('microWorld');
      this.microWorld.update(dt, this.cameraController);
      endWorld();

      if (tm.isActive) {
        tm.update(dt);
      } else {
        this._followerMgr.update(dt, this.microWorld.player, this.microWorld.centreGrid);
      }

      this._followerVis.sync(this._followerMgr.followers, this.microWorld.centreRenderer);
      this._tilePanel.update(this.microWorld.getTileInfo());
      this._compass.update(this.cameraController.azimuth);

      perf.frameEnd();
    };
  }

  // ── Micro ──────────────────────────────────────────────────────────────────

  _initMicro() {
    this.npcManager  = new NPCManager();
    this.microWorld  = new MicroWorld();
    this.dialogueMgr = new DialogueManager();

    // Lord Harven is a leader NPC — same ID as his macro Leader record
    this.npcManager.register(new NPC({
      id: 'l1', name: 'Lord Harven', factionId: 'a', role: 'leader',
    }));
    this.npcManager.register(new NPC({
      id: 'npc_edna', name: 'Edna', factionId: 'a', role: 'townsperson',
    }));
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  _startCombat() {
    if (!this._combatSession) {
      this._combatSession = new CombatSession({
        macroGame:         this.macroGame,
        commitments:       this._commitments,
        roster:            ROSTER,
        playerFactionId:   PLAYER_FACTION,
        playerCombatantId: PLAYER_COMBATANT_ID,
        regionId:          COMBAT_REGION,
        rng:               this._rng,
        microWorld:        this.microWorld,
        onLog:             msg => debug(msg),
        onVisualsSync:     cm => this._syncCombatVisuals(cm),
        onPlayerTurn:      (name, opts, cb) => this.combatHud.showPlayerActions(name, opts, cb),
        onHideActions:     () => this.combatHud.hidePlayerActions(),
        onEnd:             (winner) => this._onCombatEnd(winner),
      });
    }
    this.actorVisuals.reset();
    this._combatSession.start();
  }

  _onCombatEnd(winnerFactionId) {
    this.macroPanel.update(this.macroGame);

    // Check war end
    const mpA = this.macroGame.factions.get('a').resources.manpower;
    const mpB = this.macroGame.factions.get('b').resources.manpower;
    if (mpA <= 0 || mpB <= 0) {
      this._endWar(winnerFactionId);
      return;
    }

    // Show dialogue before next encounter
    this._startDialogue('l1');
  }

  // ── Dialogue ───────────────────────────────────────────────────────────────

  _startDialogue(npcId) {
    const npc = this.npcManager.get(npcId);
    if (!npc) { this._startCombat(); return; }

    // Pause macro simulation during dialogue
    clearInterval(this._macroTimer);

    this.dialogueMgr.start(npc, this.macroGame, COMBAT_REGION);
    this.dialogueUI.show(this.dialogueMgr.getState());
  }

  _onDialogueSelect(optionId) {
    const result = this.dialogueMgr.select(optionId);
    if (!result) return;

    if (result.consequence) {
      applyConsequence(result.consequence, this.macroGame);

      // Rally immediately increases the player's combat commitment
      if (result.consequence.type === 'leader_rallied') {
        const fid = result.consequence.payload.factionId;
        if (this._commitments[fid] < MAX_COMMITMENT) {
          this._commitments[fid]++;
          const name = this.macroGame.factions.get(fid).name;
          debug(`[War] ${name} will commit ${this._commitments[fid]} fighter(s) next encounter.`);
        }
      }

      this.macroPanel.update(this.macroGame);
      debug(`[Bridge] Dialogue consequence applied: ${result.consequence.type}`);
    }

    if (result.ends) {
      this.dialogueUI.hide();
      // Resume macro simulation
      this._macroTimer = setInterval(() => {
        this.macroGame.advanceDay();
        this.macroPanel.update(this.macroGame);
        this._flushMacroLog();
      }, MACRO_INTERVAL);
      debug('[Dialogue] Conversation ended. Next encounter incoming...');
      setTimeout(() => this._startCombat(), 1500);
    } else {
      this.dialogueUI.show(this.dialogueMgr.getState());
    }
  }

  _endWar(winnerFactionId) {
    clearInterval(this._macroTimer);
    const winner = this.macroGame.factions.get(winnerFactionId);
    const loser  = this.macroGame.factions.get(winnerFactionId === 'a' ? 'b' : 'a');
    debug('');
    debug('══════════════════════════════════');
    debug(`  WAR OVER — ${winner.name} wins!`);
    debug(`  ${loser.name} has no men left.`);
    debug('══════════════════════════════════');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _syncCombatVisuals(cm) {
    if (!cm) return;
    const { combatants, grid, initiative } = cm;
    const active = initiative.current();
    this.gridVisuals.update(combatants, grid, active, PLAYER_COMBATANT_ID);
    this.actorVisuals.update(combatants, grid, active);
    const last = cm.log.at(-1) ?? '';
    this.combatHud.update(combatants, initiative.getOrder(), last);
  }

  _flushMacroLog() {
    const log = this.macroGame.log;
    while (this._macroLogIdx < log.length) debug(log[this._macroLogIdx++]);
  }
}

export function debug(msg) {
  const panel = document.getElementById('debug-panel');
  if (!panel) return;
  const line = document.createElement('div');
  line.textContent = msg;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}
