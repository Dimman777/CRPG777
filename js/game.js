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
import { save, load, hasSave, deleteSave } from './core/save_load.js';
import { SaveLoadUI } from './ui/save_load_ui.js';
import {
  MACRO_INTERVAL,
  PLAYER_FACTION,
  PLAYER_COMBATANT_ID,
  COMBAT_REGION,
  MAX_COMMITMENT,
  START_MANPOWER,
} from './data/game_config.js';

export const GameState = Object.freeze({
  LOADING:     'loading',
  EXPLORATION: 'exploration',
  TURN_MOVE:   'turn_move',
  DIALOGUE:    'dialogue',
  COMBAT:      'combat',
  WAR_OVER:    'war_over',
});

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
  // ── Private fields ───────────────────────────────────────────────────────────
  #state           = GameState.LOADING;
  #macroTimer      = null;
  #macroLogIdx     = 0;
  #commitments     = { a: 1, b: 1 };
  #combatSession   = null;
  #followerMgr     = null;
  #followerVis     = null;
  #formationPanel  = null;
  #explorationInput = null;
  #turnMode        = null;
  #chunkOverrides  = null;
  #sharedWorld     = null;
  #playerCell      = null;
  #playerCharId    = 'grendoli';
  #charSheet       = null;
  #contextMenu     = null;
  #locationPanel   = null;
  #tilePanel       = null;
  #compass         = null;
  #perf            = null;
  #rng             = null;
  #onReady         = null;
  #onResize               = null;
  #onCameraKey            = null;
  #pendingMacroSnapshot    = null;
  #pendingFollowerSnapshot = null;
  #saveLoadUI              = null;

  // ── Public subsystems (referenced by index.html and overlay scripts) ─────────
  constructor() {
    this.scene            = null;
    this.rendering        = null;
    this.cameraController = null;
    this.gridVisuals      = null;
    this.actorVisuals     = null;
    this.combatHud        = null;
    this.macroPanel       = null;
    this.dialogueUI       = null;
    this.macroGame        = null;
    this.npcManager       = null;
    this.microWorld       = null;
    this.dialogueMgr      = null;
    this.started          = false;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get state()          { return this.#state; }
  get sharedWorld()    { return this.#sharedWorld; }
  get playerCell()     { return this.#playerCell; }
  get playerCharId()   { return this.#playerCharId; }
  get rngState()       { return this.#rng?.state ?? 0; }
  get followerMgrRef() { return this.#followerMgr; }

  set onReady(fn) { this.#onReady = fn; }

  // ── Save / Load ──────────────────────────────────────────────────────────────

  save() {
    if (this.#state !== GameState.EXPLORATION) {
      console.warn('[SaveLoad] Can only save during exploration.');
      return null;
    }
    const snapshot = save(this);
    debug('[Save] Game saved.');
    return snapshot;
  }

  hasSave() { return hasSave(); }

  loadFromStorage() {
    const snapshot = load();
    if (!snapshot) {
      debug('[Load] No save found.');
      return;
    }
    this.#restoreFromSnapshot(snapshot);
  }

  deleteSave() {
    deleteSave();
    debug('[Save] Save deleted.');
  }

  #restoreFromSnapshot(snapshot) {
    // Full restart with saved values injected as worldOpts.
    // Macro state is restored after init via #applyMacroSnapshot.
    this.#pendingMacroSnapshot = snapshot.macro;
    this.#pendingFollowerSnapshot = snapshot.followers;

    const worldOpts = {
      seed:          snapshot.seed,
      numFaults:     snapshot.numFaults,
      heroId:        snapshot.playerCharId,
      startMx:       Math.floor(snapshot.playerPos.px),
      startMy:       Math.floor(snapshot.playerPos.py),
      chunkOverrides: this.#chunkOverrides ?? new ChunkOverrides(),
    };

    // Tear down current session and restart cleanly.
    this.#teardown();
    this.start(worldOpts);

    // Restore RNG state after start() has created the RNG instance.
    if (this.#rng) this.#rng.state = snapshot.rngState;

    debug('[Load] Game loaded from save.');
  }

  #applyMacroSnapshot(snapshot) {
    if (!snapshot) return;
    this.macroGame.day = snapshot.day;
    for (const [id, data] of Object.entries(snapshot.factions)) {
      const f = this.macroGame.factions.get(id);
      if (!f) continue;
      Object.assign(f.resources, data.resources);
      f.territories = [...data.territories];
      f.projects    = [...(data.projects ?? [])];
    }
    for (const [id, data] of Object.entries(snapshot.leaders)) {
      const l = this.macroGame.leaders.get(id);
      if (!l) continue;
      l.alive       = data.alive;
      l.socialState = { ...data.socialState };
    }
    for (const [id, data] of Object.entries(snapshot.regions)) {
      const r = this.macroGame.regions.get(id);
      if (!r) continue;
      r.ownerFactionId   = data.ownerFactionId;
      r.security         = data.security;
      r.prosperity       = data.prosperity;
      r.unrest           = data.unrest;
      r.foodSupply       = data.foodSupply;
      r.arcanePressure   = data.arcanePressure;
      r.militaryPresence = data.militaryPresence;
    }
    this.macroPanel.update(this.macroGame);
  }

  #applyFollowerSnapshot(snapshot, player) {
    if (!snapshot || !this.#followerMgr) return;
    this.#formationPanel?.setActiveIds?.(snapshot.activeIds);
    const charData = snapshot.activeIds.map(id => getCharacter(id)).filter(Boolean);
    this.#followerMgr.setActiveFollowers(charData, player);
    if (snapshot.mode) this.#followerMgr.setMode(snapshot.mode);
  }

  #teardown() {
    if (this.#macroTimer) { clearInterval(this.#macroTimer); this.#macroTimer = null; }
    if (this.rendering)   { this.rendering.stop?.(); }
    if (this.scene)       { this.scene.dispose?.(); }
    window.removeEventListener('resize',  this.#onResize);
    window.removeEventListener('keydown', this.#onCameraKey);
    // Reset public subsystems so start() can reinitialise them cleanly.
    this.scene = this.rendering = this.cameraController = null;
    this.gridVisuals = this.actorVisuals = this.combatHud = null;
    this.macroPanel = this.dialogueUI = this.macroGame = null;
    this.npcManager = this.microWorld = this.dialogueMgr = null;
    this.started = false;
    this.#state = GameState.LOADING;
  }

  start(worldOpts = {}) {
    this.#playerCharId = worldOpts.heroId ?? 'grendoli';
    this.#charSheet    = new CharacterSheet();
    const viewport = document.getElementById('game-viewport');
    this.scene            = new SceneSetup(viewport);
    this.cameraController = new CameraController(viewport.clientWidth, viewport.clientHeight);
    this.rendering        = new Rendering(this.scene);
    this.rendering.cameraController = this.cameraController;

    this.#onResize = () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      this.scene.onResize(w, h);
      this.cameraController.onResize(w, h);
    };
    this.#onCameraKey = e => {
      if (e.key === 'q' || e.key === 'Q') this.cameraController.rotateLeft();
      if (e.key === 'e' || e.key === 'E') this.cameraController.rotateRight();
    };
    window.addEventListener('resize', this.#onResize);
    window.addEventListener('keydown', this.#onCameraKey);

    this.#perf = new PerfOverlay();
    this.#rng  = null; // created in #initMacro from world seed
    this.started = true;
    this.#initMacro();
    this.#initMicro();
    this.#initExploration(worldOpts);

    this.dialogueUI = new DialogueUI();
    this.dialogueUI.onSelect(id => this.#onDialogueSelect(id));

    // Render loop starts before setState so the first frame renders immediately.
    // State transitions to EXPLORATION which starts the macro timer.
    this.rendering.start();
    this.#setState(GameState.EXPLORATION);

    // Restore macro + follower state if this is a load-from-save.
    if (this.#pendingMacroSnapshot) {
      this.#applyMacroSnapshot(this.#pendingMacroSnapshot);
      this.#pendingMacroSnapshot = null;
    }
    if (this.#pendingFollowerSnapshot) {
      this.#applyFollowerSnapshot(this.#pendingFollowerSnapshot, this.microWorld.player);
      this.#pendingFollowerSnapshot = null;
    }

    // Save/Load UI — update on each state change via the render loop
    if (!this.#saveLoadUI) {
      this.#saveLoadUI = new SaveLoadUI(this);
    } else {
      this.#saveLoadUI.update();
    }

    debug('World loaded. WASD move · Q/E rotate camera · Z/C torso · Space toggle turn mode.');
  }

  // ── State machine ────────────────────────────────────────────────────────────

  #setState(next) {
    this.#state = next;
    const macroShouldRun = next === GameState.EXPLORATION;
    if (macroShouldRun && !this.#macroTimer) {
      this.#macroTimer = setInterval(() => {
        this.macroGame.advanceDay();
        this.macroPanel.update(this.macroGame);
        this.#flushMacroLog();
      }, MACRO_INTERVAL);
    } else if (!macroShouldRun && this.#macroTimer) {
      clearInterval(this.#macroTimer);
      this.#macroTimer = null;
    }
  }

  // ── Macro ────────────────────────────────────────────────────────────────────

  #initMacro() {
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

  // ── Exploration ──────────────────────────────────────────────────────────────

  #initExploration(opts = {}) {
    const SEED       = opts.seed      ?? 42;
    const NUM_FAULTS = opts.numFaults ?? 0;
    this.#rng = new RNG(SEED ^ 0x47414D45);
    this.#chunkOverrides = opts.chunkOverrides ?? new ChunkOverrides();

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
    this.#sharedWorld = { seed: SEED, numFaults: NUM_FAULTS, map: macroMap, worldData };
    window._sharedWorld = this.#sharedWorld; // legacy — index.html start screen reads this

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

    this.microWorld.onReady = () => { if (this.#onReady) this.#onReady(); };
    this.microWorld.init(this.scene.scene, macroMap, SEED, startMx, startMy, this.#chunkOverrides);
    const startPos = this.microWorld.player?.position;
    if (startPos && this.cameraController) {
      this.cameraController.setTarget(startPos.x, startPos.y, startPos.z);
      this.cameraController.snapY();
    }

    this.#locationPanel = new LocationPanel();
    this.#tilePanel     = new TilePanel();
    this.#compass       = new Compass();
    const updateLocation = ({ mx, my }) => {
      const cell = this.#sharedWorld?.map.get(mx, my);
      this.#locationPanel.update(cell, this.#sharedWorld?.worldData, mx, my);
    };
    window.addEventListener('playerCellChanged', e => {
      this.#playerCell = e.detail;
      updateLocation(e.detail);
    });
    if (this.#playerCell) updateLocation(this.#playerCell);

    window.addEventListener('goToCell', e => {
      this.microWorld.teleportTo(e.detail.mx, e.detail.my);
      const p = this.microWorld.player?.position;
      if (p && this.cameraController) {
        this.cameraController.setTarget(p.x, p.y, p.z);
        this.cameraController.snapY();
      }
    });

    const vpEl = document.getElementById('game-viewport');
    this.cameraController.setFrustumHalf(8);

    this.#followerMgr    = new FollowerManager(this.#rng);
    this.#followerVis    = new FollowerVisuals(this.scene.scene);
    this.#formationPanel = new FormationPanel(this.#charSheet);

    const playerChar = getCharacter(this.#playerCharId);
    this.#formationPanel.setPlayerCharacter(playerChar);
    const roster = CHARACTERS.filter(c => c.id !== this.#playerCharId);
    this.#formationPanel.setRoster(roster);

    this.#formationPanel.onRosterChange = activeIds => {
      const charData = activeIds.map(id => getCharacter(id)).filter(Boolean);
      this.#followerMgr.setActiveFollowers(charData, this.microWorld.player);
    };
    this.#formationPanel.onModeChange = mode => {
      this.#followerMgr.setMode(mode);
    };

    this.microWorld.onChunkTransition = (dPx, dPy) => {
      this.#followerMgr.onChunkTransition(dPx, dPy);
    };

    this.#explorationInput = new ExplorationInput({
      viewport:          vpEl,
      getCamera:         () => this.cameraController.camera,
      getPlayer:         () => this.microWorld.player,
      getCentreRenderer: () => this.microWorld.centreRenderer,
      getFollowers:      () => this.#followerMgr.followers,
      microWorld:        this.microWorld,
      charSheet:         this.#charSheet,
      formationPanel:    this.#formationPanel,
      onToggleTurn:      () => this.#turnMode.toggle(),
      isTurnActive:      () => this.#state === GameState.TURN_MOVE,
      onTurnPass:        () => this.#turnMode.pass(),
      onLog:             msg => debug(msg),
    });

    this.#turnMode = new TurnMode({
      scene:              this.scene.scene,
      viewport:           vpEl,
      explorationInput:   this.#explorationInput,
      getPlayer:          () => this.microWorld.player,
      getCentreGrid:      () => this.microWorld.centreGrid,
      getCentreRenderer:  () => this.microWorld.centreRenderer,
      getFollowers:       () => this.#followerMgr.followers,
      followerMgr:        this.#followerMgr,
      microWorld:         this.microWorld,
      onToggleMacro:      paused => {
        this.#setState(paused ? GameState.TURN_MOVE : GameState.EXPLORATION);
      },
      onLog: msg => debug(msg),
    });

    const input = this.#explorationInput;
    this.rendering.onUpdate = dt => {
      const perf = this.#perf;
      perf.frameStart();

      if (input.rmouseDown && this.#state === GameState.EXPLORATION) {
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
      endWorld?.();

      if (this.#state === GameState.TURN_MOVE) {
        this.#turnMode.update(dt);
      } else {
        this.#followerMgr.update(dt, this.microWorld.player, this.microWorld.centreGrid);
      }

      this.#followerVis.sync(this.#followerMgr.followers, this.microWorld.centreRenderer);
      this.#tilePanel.update(this.microWorld.getTileInfo());
      this.#compass.update(this.cameraController.azimuth);
      this.#saveLoadUI?.update();

      perf.frameEnd();
    };
  }

  // ── Micro ────────────────────────────────────────────────────────────────────

  #initMicro() {
    this.npcManager  = new NPCManager();
    this.microWorld  = new MicroWorld();
    this.dialogueMgr = new DialogueManager();

    this.npcManager.register(new NPC({
      id: 'l1', name: 'Lord Harven', factionId: 'a', role: 'leader',
    }));
    this.npcManager.register(new NPC({
      id: 'npc_edna', name: 'Edna', factionId: 'a', role: 'townsperson',
    }));
  }

  // ── Combat ───────────────────────────────────────────────────────────────────

  #startCombat() {
    this.#setState(GameState.COMBAT);
    if (!this.#combatSession) {
      this.#combatSession = new CombatSession({
        macroGame:         this.macroGame,
        commitments:       this.#commitments,
        roster:            ROSTER,
        playerFactionId:   PLAYER_FACTION,
        playerCombatantId: PLAYER_COMBATANT_ID,
        regionId:          COMBAT_REGION,
        rng:               this.#rng,
        microWorld:        this.microWorld,
        onLog:             msg => debug(msg),
        onVisualsSync:     cm => this.#syncCombatVisuals(cm),
        onPlayerTurn:      (name, opts, cb) => this.combatHud.showPlayerActions(name, opts, cb),
        onHideActions:     () => this.combatHud.hidePlayerActions(),
        onEnd:             winner => this.#onCombatEnd(winner),
      });
    }
    this.actorVisuals.reset();
    this.#combatSession.start();
  }

  #onCombatEnd(winnerFactionId) {
    this.macroPanel.update(this.macroGame);

    const mpA = this.macroGame.factions.get('a').resources.manpower;
    const mpB = this.macroGame.factions.get('b').resources.manpower;
    if (mpA <= 0 || mpB <= 0) {
      this.#endWar(winnerFactionId);
      return;
    }

    this.#startDialogue('l1');
  }

  // ── Dialogue ─────────────────────────────────────────────────────────────────

  #startDialogue(npcId) {
    const npc = this.npcManager.get(npcId);
    if (!npc) { this.#startCombat(); return; }

    this.#setState(GameState.DIALOGUE);

    this.dialogueMgr.start(npc, this.macroGame, COMBAT_REGION);
    this.dialogueUI.show(this.dialogueMgr.getState());
  }

  #onDialogueSelect(optionId) {
    const result = this.dialogueMgr.select(optionId);
    if (!result) return;

    if (result.consequence) {
      applyConsequence(result.consequence, this.macroGame);

      if (result.consequence.type === 'leader_rallied') {
        const fid = result.consequence.payload.factionId;
        if (this.#commitments[fid] < MAX_COMMITMENT) {
          this.#commitments[fid]++;
          const name = this.macroGame.factions.get(fid).name;
          debug(`[War] ${name} will commit ${this.#commitments[fid]} fighter(s) next encounter.`);
        }
      }

      this.macroPanel.update(this.macroGame);
      debug(`[Bridge] Dialogue consequence applied: ${result.consequence.type}`);
    }

    if (result.ends) {
      this.dialogueUI.hide();
      this.#setState(GameState.EXPLORATION);
      debug('[Dialogue] Conversation ended. Next encounter incoming...');
      setTimeout(() => this.#startCombat(), 1500);
    } else {
      this.dialogueUI.show(this.dialogueMgr.getState());
    }
  }

  #endWar(winnerFactionId) {
    this.#setState(GameState.WAR_OVER);
    const winner = this.macroGame.factions.get(winnerFactionId);
    const loser  = this.macroGame.factions.get(winnerFactionId === 'a' ? 'b' : 'a');
    debug('');
    debug('══════════════════════════════════');
    debug(`  WAR OVER — ${winner.name} wins!`);
    debug(`  ${loser.name} has no men left.`);
    debug('══════════════════════════════════');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  #syncCombatVisuals(cm) {
    if (!cm) return;
    const { combatants, grid, initiative } = cm;
    const active = initiative.current();
    this.gridVisuals.update(combatants, grid, active, PLAYER_COMBATANT_ID);
    this.actorVisuals.update(combatants, grid, active);
    const last = cm.log.at(-1) ?? '';
    this.combatHud.update(combatants, initiative.getOrder(), last);
  }

  #flushMacroLog() {
    const log = this.macroGame.log;
    while (this.#macroLogIdx < log.length) debug(log[this.#macroLogIdx++]);
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
