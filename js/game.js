import * as THREE            from 'three';
import { SceneSetup }        from './render/scene_setup.js';
import { Rendering }         from './render/rendering.js';
import { CameraController }  from './render/camera_controller.js';
import { GridVisuals }       from './render/grid_visuals.js';
import { ActorVisuals }      from './render/actor_visuals.js';
import { CombatHud }    from './ui/combat_hud.js';
import { MacroPanel }   from './ui/macro_panel.js';
import { DialogueUI }   from './ui/dialogue_ui.js';
import { Combatant }    from './combat/combatant.js';
import { CombatManager } from './combat/combat_manager.js';
import { MacroGame }    from './macro/macro_game.js';
import { Faction }      from './macro/faction.js';
import { Leader }       from './macro/leader.js';
import { Region }       from './macro/region.js';
import { NPC, NPCManager }  from './micro/npc_manager.js';
import { MicroWorld }       from './micro/micro_world.js';
import { DialogueManager }  from './micro/dialogue_manager.js';
import { getWorldConditions, applyWorldConditions } from './bridge/macro_to_micro.js';
import { buildCombatConsequence }                   from './bridge/micro_to_macro.js';
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
import { TurnController }  from './micro/turn_controller.js';
import { TurnHud }         from './ui/turn_hud.js';
import { ActionBar }       from './ui/action_bar.js';
import { ChunkOverrides }  from './core/chunk_overrides.js';
import { CHARACTERS, getCharacter } from './data/characters_data.js';
import { PerfOverlay }     from './ui/perf_overlay.js';

const GRID_W               = 10;
const GRID_H               = 10;
const COMBAT_INTERVAL      = 700;
const MACRO_INTERVAL       = 2000;
const PLAYER_FACTION       = 'a';
const PLAYER_COMBATANT_ID  = 'a0'; // Aldric — the one fighter the player controls
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
    this.combatMgr       = null;
    this.macroGame       = null;
    this.npcManager      = null;
    this.microWorld      = null;
    this.dialogueMgr     = null;
    this._combatTimer    = null;
    this._macroTimer     = null;
    this._logIndex       = 0;
    this._macroLogIdx    = 0;
    this._encounter      = 0;
    this._commitments    = { a: 1, b: 1 };
    this._followerMgr    = null;
    this._followerVis    = null;
    this._formationPanel = null;
    this._turnController    = null;
    this._turnHud           = null;
    this._actionBar         = null;
    this._runHighlightMids     = [];   // blue dim — run intermediate tiles (one per target)
    this._runHighlightDsts     = [];   // blue bright — run destination tiles (one per target)
    this._runTargets           = [];   // cached getRunTargets() result for click matching
    this._stopHighlightSudden  = null; // red-orange — current tile (sudden stop)
    this._stopHighlightGradual = null; // amber — 1 tile forward (gradual stop)
    this._actionMode           = 'none'; // 'none' | 'move' | 'run' | 'stop'
    this._facingAtTurnStart    = 0;     // player legAngle at the start of each PLAYER turn
    this._chunkOverrides       = null;  // ChunkOverrides — shared with the macro map editor
    this._playerCharId         = 'grendoli';
    this._charSheet            = null;
    this._contextMenu          = null;  // right-click follower context menu div
  }

  start(worldOpts = {}) {
    this._playerCharId = worldOpts.heroId ?? 'grendoli';
    this._charSheet    = new CharacterSheet();
    const viewport = document.getElementById('game-viewport');
    this.scene            = new SceneSetup(viewport);
    this.cameraController = new CameraController(viewport.clientWidth, viewport.clientHeight);
    this.rendering        = new Rendering(this.scene);
    this.rendering.cameraController = this.cameraController;
    this.rendering.start();

    window.addEventListener('resize', () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      this.scene.onResize(w, h);
      this.cameraController.onResize(w, h);
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'q' || e.key === 'Q') this.cameraController.rotateLeft();
      if (e.key === 'e' || e.key === 'E') this.cameraController.rotateRight();
    });

    this._perf = new PerfOverlay();
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
    window._sharedWorld = { seed: SEED, numFaults: NUM_FAULTS, map: macroMap, worldData };

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
      const cell = window._sharedWorld?.map.get(mx, my);
      this._locationPanel.update(cell, window._sharedWorld?.worldData, mx, my);
    };
    window.addEventListener('playerCellChanged', e => updateLocation(e.detail));
    // Apply immediately for the start cell (event already fired before listener registered).
    if (window._playerCell) updateLocation(window._playerCell);

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

    // WASD / Z / C — disabled in turn mode (mouse + buttons used instead); Space — toggle turn
    window.addEventListener('keydown', e => {
      const k    = e.key.toLowerCase();
      const turn = this._turnController?.isActive;
      if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
        e.preventDefault();
        if (!turn) this.microWorld.keyDown(k);
      }
      if (!turn) {
        if (k === 'z') this.microWorld.rotateFacingLeft();
        if (k === 'c') this.microWorld.rotateFacingRight();
      }
      if (k === ' ') { e.preventDefault(); this._toggleTurnMode(); }
      if (e.key === 'Enter' && turn) {
        e.preventDefault();
        const hadMomentum = this._turnController.playerRanLastTurn;
        this._turnController.pass(this._followerMgr.followers.length);
        debug(hadMomentum ? '[Turn] Stop — momentum broken.' : '[Turn] Pass.');
      }
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd') {
        this.microWorld.keyUp(k); // always clear so keys don't stick on mode switch
      }
    });

    // Mouse: right-click hold = free-roam movement; right-click in turn mode = face toward.
    // Left-click = move to adjacent tile (turn mode only).
    // _rmouseDown and cursor world pos must be declared here (outside the block)
    // so the onUpdate closure further below can capture them.
    let _rmouseDown = false;
    let _rmouseX = 0, _rmouseZ = 0;
    {
      const raycaster    = new THREE.Raycaster();
      const groundPlane  = new THREE.Plane();
      const groundNormal = new THREE.Vector3(0, 1, 0);
      const hitPoint     = new THREE.Vector3();
      const vpEl         = document.getElementById('game-viewport');

      // Returns world-space XZ position under the mouse (no flooring).
      const worldPosFromEvent = e => {
        const rect = vpEl.getBoundingClientRect();
        const ndcX =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.cameraController.camera);
        const cr   = this.microWorld.centreRenderer;
        const p    = this.microWorld.player;
        const elev = cr ? cr.elevationAt(p.px, p.py) : 0;
        groundPlane.set(groundNormal, -elev);
        if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
        return { x: hitPoint.x, z: hitPoint.z };
      };

      const tileFromEvent = e => {
        const pos = worldPosFromEvent(e);
        return pos ? { tx: Math.floor(pos.x), tz: Math.floor(pos.z) } : null;
      };

      // ── Follower context menu ─────────────────────────────────────────────────
      // A small floating div that appears when the player right-clicks near a follower.
      this._contextMenu = document.createElement('div');
      this._contextMenu.style.cssText = [
        'display:none',
        'position:fixed',
        'z-index:400',
        'background:#0e0e18',
        'border:1px solid #334',
        'border-radius:3px',
        'font-family:monospace',
        'font-size:12px',
        'color:#ccc',
        'min-width:160px',
        'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
        'overflow:hidden',
      ].join(';');
      document.body.appendChild(this._contextMenu);

      const hideContextMenu = () => {
        this._contextMenu.style.display = 'none';
      };
      document.addEventListener('click',     hideContextMenu);
      document.addEventListener('keydown',   hideContextMenu);
      vpEl.addEventListener('contextmenu',   hideContextMenu);

      const showContextMenu = (follower, screenX, screenY) => {
        const char = follower.charData;
        this._contextMenu.innerHTML = `
          <div style="padding:8px 12px 6px;border-bottom:1px solid #222">
            <div style="font-size:13px;color:#e8dcc8">${follower.name}</div>
            ${char ? `<div style="font-size:10px;color:#556;margin-top:1px">${char.role.toUpperCase()}</div>` : ''}
          </div>
          <button id="ctx-sheet"
            style="display:block;width:100%;padding:7px 12px;text-align:left;
                   font-family:monospace;font-size:11px;background:transparent;
                   color:#aab8cc;border:none;cursor:pointer;
                   border-bottom:1px solid #1a1a28">
            Character Sheet
          </button>
          <button id="ctx-dismiss"
            style="display:block;width:100%;padding:7px 12px;text-align:left;
                   font-family:monospace;font-size:11px;background:transparent;
                   color:#886655;border:none;cursor:pointer">
            Dismiss
          </button>`;

        // Position near cursor but keep on-screen
        const menuW = 170, menuH = 90;
        let mx = screenX + 4, my = screenY + 4;
        if (mx + menuW > window.innerWidth)  mx = screenX - menuW - 4;
        if (my + menuH > window.innerHeight) my = screenY - menuH - 4;
        this._contextMenu.style.left    = mx + 'px';
        this._contextMenu.style.top     = my + 'px';
        this._contextMenu.style.display = 'block';

        this._contextMenu.querySelector('#ctx-sheet')?.addEventListener('click', e => {
          e.stopPropagation();
          hideContextMenu();
          if (char) this._charSheet?.show(char);
        });
        this._contextMenu.querySelector('#ctx-dismiss')?.addEventListener('click', e => {
          e.stopPropagation();
          hideContextMenu();
          if (follower.charId) this._formationPanel.setActive(
            this._followerMgr.followers
              .map(f => f.charId)
              .filter(id => id && id !== follower.charId),
          );
        });
      };

      // Hit-test: find the follower closest to the world-space click point.
      const followerAtPos = pos => {
        if (!pos) return null;
        const HIT_R = 0.85;
        let best = null, bestD = HIT_R;
        for (const f of this._followerMgr.followers) {
          const d = Math.hypot(pos.x - f.px, pos.z - f.py);
          if (d < bestD) { bestD = d; best = f; }
        }
        return best;
      };

      // ── Right-click hold: free-roam mouse movement ───────────────────────────
      // Direction = player → cursor.  Speed ramps with distance (0.5–5 tiles).
      // Intercept: if the initial click lands on a follower, show the context menu instead.
      let _followerHit = null;
      vpEl.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        if (this._turnController?.isActive) return; // turn mode uses contextmenu
        e.preventDefault();
        const pos = worldPosFromEvent(e);
        _followerHit = followerAtPos(pos);
        if (_followerHit) return; // context menu shown on mouseup
        _rmouseDown = true;
        if (pos) { _rmouseX = pos.x; _rmouseZ = pos.z; }
      });

      vpEl.addEventListener('mousemove', e => {
        if (!_rmouseDown) return;
        const pos = worldPosFromEvent(e);
        if (pos) { _rmouseX = pos.x; _rmouseZ = pos.z; }
      });

      vpEl.addEventListener('mouseup', e => {
        if (e.button !== 2) return;
        if (_followerHit) {
          showContextMenu(_followerHit, e.clientX, e.clientY);
          _followerHit = null;
          return;
        }
        _rmouseDown = false;
        this.microWorld.player?.clearMouseMove();
      });
      vpEl.addEventListener('mouseleave', () => {
        _followerHit = null;
        _rmouseDown = false;
        this.microWorld.player?.clearMouseMove();
      });

      // Suppress the browser context menu on the viewport in all modes.
      vpEl.addEventListener('contextmenu', e => e.preventDefault());

      // Right-click — face the player toward the clicked tile (costs no turn action).
      // Only allowed when Move or Run is selected — prevents infinite free facing changes.
      // If the rotation would exceed the ±45° Run limit the mode demotes to Move.
      vpEl.addEventListener('contextmenu', e => {
        if (!this._turnController?.isActive) return;
        if (this._turnController.state !== 'player') return;
        if (this._actionMode !== 'move' && this._actionMode !== 'run') return;
        e.preventDefault();
        const hit = tileFromEvent(e);
        if (!hit) return;
        const player = this.microWorld.player;
        const dx   = hit.tx + 0.5 - player.px;
        const dz   = hit.tz + 0.5 - player.py;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.01) return;

        // All rotation limits are cumulative from the turn-start facing so that
        // facing changes in Run mode count toward the Move ±180° budget and Run
        // is locked out (disabled, not demoted) once total rotation exceeds ±45°.
        const target    = Math.atan2(dx / dist, dz / dist);
        let totalDiff   = ((target - this._facingAtTurnStart + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        const maxRot    = this._actionMode === 'run' ? Math.PI / 4 : Math.PI;
        totalDiff       = Math.max(-maxRot, Math.min(maxRot, totalDiff));
        const newAngle  = this._facingAtTurnStart + totalDiff;
        player.legAngle = newAngle;
        player.headingX = Math.sin(newAngle);
        player.headingZ = Math.cos(newAngle);
        player.refresh(this.microWorld.centreRenderer);
        this._updateRunHighlight();
        this._updateStopHighlights();
        debug(`[Turn] Facing (${hit.tx}, ${hit.tz}).`);
      });

      // Left-click — execute the selected action on the clicked tile.
      vpEl.addEventListener('click', e => {
        const tc = this._turnController;
        if (!tc?.isActive) return;
        if (tc.state !== 'player') return;
        if (this._actionMode === 'none') {
          debug('[Turn] Select Move or Run first.');
          return;
        }
        const hit = tileFromEvent(e);
        if (!hit) return;

        if (this._actionMode === 'move' && !tc.playerRanLastTurn) {
          const player = this.microWorld.player;
          const diffX  = hit.tx - Math.floor(player.px);
          const diffZ  = hit.tz - Math.floor(player.py);
          if (diffX === 0 && diffZ === 0) return;
          if (Math.abs(diffX) > 1 || Math.abs(diffZ) > 1) {
            debug('[Turn] Click an adjacent tile to move.');
            return;
          }
          // Preserve facing — the player sidesteps / backs up without pivoting.
          const savedAngle = player.legAngle;
          const savedHX    = player.headingX;
          const savedHZ    = player.headingZ;
          const moved = tc.playerMove(
            diffX, diffZ, player,
            this.microWorld.centreGrid,
            this.microWorld.centreRenderer,
            this._followerMgr.followers,
          );
          if (moved) {
            player.legAngle = savedAngle;
            player.headingX = savedHX;
            player.headingZ = savedHZ;
            player.refresh(this.microWorld.centreRenderer);
          } else {
            debug('[Turn] Blocked.');
          }

        } else if (this._actionMode === 'stop') {
          const player = this.microWorld.player;
          const diffX  = hit.tx - Math.floor(player.px);
          const diffZ  = hit.tz - Math.floor(player.py);

          if (diffX === 0 && diffZ === 0) {
            // Sudden stop — stay on current tile, break momentum immediately
            tc.pass(this._followerMgr.followers.length);
            debug('[Turn] Sudden stop.');
          } else {
            // Only accept the highlighted gradual-stop tile
            const gradual = tc.getStopGradualTile(
              player, this.microWorld.centreGrid, this._followerMgr.followers,
            );
            if (!gradual || hit.tx !== gradual.tx || hit.tz !== gradual.tz) {
              debug('[Turn] Click your tile (sudden) or the highlighted tile (gradual stop).');
              return;
            }
            // Gradual stop — move 1 tile forward; playerMove clears momentum
            const moved = tc.playerMove(
              diffX, diffZ, player,
              this.microWorld.centreGrid,
              this.microWorld.centreRenderer,
              this._followerMgr.followers,
            );
            if (moved) debug('[Turn] Gradual stop.');
            else       debug('[Turn] Blocked.');
          }

        } else if (this._actionMode === 'run') {
          const target = this._runTargets.find(t => t.tx === hit.tx && t.tz === hit.tz);
          if (!target) {
            debug('[Turn] Click a highlighted tile to run.');
            return;
          }
          const ran = tc.playerRunTo(
            this.microWorld.player,
            this.microWorld.centreGrid,
            this.microWorld.centreRenderer,
            target.tx, target.tz,
            this._followerMgr.followers,
          );
          if (!ran) debug('[Turn] Run blocked.');
        }
      });
    }

    // Zoom in for ground-level exploration (default FRUSTUM_HALF is 20)
    this.cameraController.setFrustumHalf(8);

    // Followers
    this._followerMgr    = new FollowerManager();
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

    // Turn system
    this._turnController = new TurnController();
    this._turnHud        = new TurnHud();

    // Run-path highlight — two semi-transparent quads (intermediate + destination tile)
    const mkHighlight = (color, opacity) => {
      const geo  = new THREE.PlaneGeometry(0.88, 0.88);
      geo.rotateX(-Math.PI / 2);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1;
      mesh.visible     = false;
      this.scene.scene.add(mesh);
      return mesh;
    };
    // Pool of 5 meshes for intermediate + destination tiles (±45° arc has at most 5 targets)
    for (let i = 0; i < 5; i++) {
      this._runHighlightMids.push(mkHighlight(0x44aaff, 0.22)); // blue dim — intermediate
      this._runHighlightDsts.push(mkHighlight(0x44aaff, 0.45)); // blue bright — destination
    }
    this._stopHighlightSudden  = mkHighlight(0xff4422, 0.35); // red-orange — sudden stop (current tile)
    this._stopHighlightGradual = mkHighlight(0xffaa22, 0.45); // amber — gradual stop (1 tile forward)

    // Action bar — Move / Run buttons select the action; tile-click executes it
    this._actionBar = new ActionBar();
    this._actionBar.onMove = () => {
      if (!this._turnController?.isActive) return;
      this._actionMode = 'move';
      this._actionBar.setActive('move');
      this._updateRunHighlight();
      this._updateStopHighlights();
    };
    this._actionBar.onRun = () => {
      if (!this._turnController?.isActive) return;
      this._actionMode = 'run';
      this._actionBar.setActive('run');
      this._updateRunHighlight();
      this._updateStopHighlights();
    };
    // Stop enters selection mode: player clicks current tile (sudden) or 1-ahead (gradual)
    this._actionBar.onStop = () => {
      if (!this._turnController?.isActive) return;
      this._actionMode = 'stop';
      this._actionBar.setActive('stop');
      this._updateRunHighlight();
      this._updateStopHighlights();
    };

    this._turnController.onStateChange = () => {
      const tc           = this._turnController;
      const isPlayerTurn = tc.isActive && tc.state === 'player';
      if (isPlayerTurn) {
        this._actionMode        = 'none';
        this._facingAtTurnStart = this.microWorld.player?.legAngle ?? 0;
        this._actionBar.setActive('none');
        // Show Move+Run or Run+Stop depending on momentum
        this._actionBar.setMomentum(tc.playerRanLastTurn);
      }
      this._updateRunHighlight();
      this._updateStopHighlights();
      this._actionBar.setVisible(isPlayerTurn);
      this._turnHud.update(tc, this._followerMgr.followers, this._actionMode, tc.playerRanLastTurn);
      this.microWorld.setGridVisible(tc.isActive);
    };
    // Delegate follower movement to FollowerManager so tight/loose logic is used
    this._turnController.onFollowerTurn = (idx, player, grid) => {
      return this._followerMgr.advanceOneTurnStep(
        idx,
        player.px, player.py,
        player.headingX, player.headingZ,
        grid,
      );
    };

    // Per-frame update — real-time or turn mode
    this.rendering.onUpdate = dt => {
      const perf = this._perf;
      perf.frameStart();

      // Apply mouse-driven movement (free roam only).
      if (_rmouseDown && !this._turnController?.isActive) {
        const p = this.microWorld.player;
        if (p) {
          const dx   = _rmouseX - p.px;
          const dz   = _rmouseZ - p.py;
          const dist = Math.sqrt(dx * dx + dz * dz);
          // Speed ramps from 0 at 0.5 tiles to full at 5 tiles.
          const speedFactor = dist > 0.5 ? Math.min(1, (dist - 0.5) / 4.5) : 0;
          if (dist > 0.1) p.setMouseMove(dx / dist, dz / dist, speedFactor);
          else            p.clearMouseMove();
        }
      }

      // microWorld.update() is safe in turn mode: all keys are false so the
      // player won't move, but head-look and terrain-snap still run.
      this.microWorld.perfBegin = (name) => perf.begin(name);
      const endWorld = perf.begin('microWorld');
      this.microWorld.update(dt, this.cameraController);
      endWorld();

      if (this._turnController.isActive) {
        this._followerMgr.updateIdleOnly(dt);
        this._turnController.tick(
          dt,
          this._followerMgr.followers,
          this.microWorld.player,
          this.microWorld.centreGrid,
          this.microWorld.centreRenderer,
        );
      } else {
        this._followerMgr.update(dt, this.microWorld.player, this.microWorld.centreGrid);
      }

      this._followerVis.sync(this._followerMgr.followers, this.microWorld.centreRenderer);

      this._tilePanel.update(this.microWorld.getTileInfo());
      this._compass.update(this.cameraController.azimuth);
      this._turnHud.update(this._turnController, this._followerMgr.followers, this._actionMode, this._turnController.playerRanLastTurn);

      perf.frameEnd();
    };
  }

  // ── Turn mode ──────────────────────────────────────────────────────────────

  _toggleTurnMode() {
    const tc        = this._turnController;
    const wasActive = tc.isActive;

    // Always reset action mode when toggling (enter or exit)
    this._actionMode = 'none';
    this._actionBar?.setActive('none');

    if (!wasActive) {
      // Entering turn mode: pause macro sim + release movement keys
      clearInterval(this._macroTimer);
      this._macroTimer = null;
      ['w','a','s','d'].forEach(k => this.microWorld.keyUp(k));
    }

    tc.toggle(
      this.microWorld.player,
      this._followerMgr.followers,
      this.microWorld.centreRenderer,
    );

    if (wasActive) {
      // Exiting turn mode: resume macro sim
      this._macroTimer = setInterval(() => {
        this.macroGame.advanceDay();
        this.macroPanel.update(this.macroGame);
        this._flushMacroLog();
      }, MACRO_INTERVAL);
    }

    debug(tc.isActive
      ? '[Turn] Turn mode ON — macro paused.'
      : '[Turn] Turn mode OFF — macro resumed.',
    );
  }

  // Reposition (or hide) the stop highlight meshes.
  // Red-orange quad on the player's current tile (sudden stop).
  // Amber quad on the tile 1 step forward (gradual stop), hidden if that tile is blocked.
  _updateStopHighlights() {
    const tc           = this._turnController;
    const isStopMode   = tc?.isActive && tc.state === 'player' && this._actionMode === 'stop';
    if (!isStopMode) {
      this._stopHighlightSudden.visible  = false;
      this._stopHighlightGradual.visible = false;
      return;
    }
    const player = this.microWorld.player;
    const cr     = this.microWorld.centreRenderer;
    const place  = (mesh, tx, tz) => {
      const elev = cr ? cr.elevationAt(tx + 0.5, tz + 0.5) : 0;
      mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
      mesh.visible = true;
    };
    place(this._stopHighlightSudden, Math.floor(player.px), Math.floor(player.py));
    const gradual = tc.getStopGradualTile(player, this.microWorld.centreGrid, this._followerMgr.followers);
    if (gradual) {
      place(this._stopHighlightGradual, gradual.tx, gradual.tz);
    } else {
      this._stopHighlightGradual.visible = false;
    }
  }

  // Reposition (or hide) the run-path highlight meshes based on the current
  // player facing and whether both tiles in the run path are passable.
  _updateRunHighlight() {
    const tc           = this._turnController;
    const isPlayerTurn = tc?.isActive && tc.state === 'player';

    // Run is only available if total facing rotation since turn start is within ±45°.
    // This is cumulative: facing changes made in Move mode also consume the budget.
    const player  = this.microWorld.player;
    const facingDrift = isPlayerTurn
      ? Math.abs(((player.legAngle - this._facingAtTurnStart + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
      : Infinity;
    const withinRunLimit = facingDrift <= Math.PI / 4 + 0.001; // small epsilon for float noise
    const targets = (isPlayerTurn && withinRunLimit)
      ? tc.getRunTargets(player, this.microWorld.centreGrid, this._followerMgr.followers)
      : [];
    this._runTargets = targets;
    this._actionBar?.setRunEnabled(targets.length > 0);

    // Show path highlights only when Run mode is active and targets exist
    if (isPlayerTurn && this._actionMode === 'run' && targets.length > 0) {
      const cr = this.microWorld.centreRenderer;
      const place = (mesh, tx, tz) => {
        const elev = cr ? cr.elevationAt(tx + 0.5, tz + 0.5) : 0;
        mesh.position.set(tx + 0.5, elev + 0.06, tz + 0.5);
        mesh.visible = true;
      };
      targets.forEach((t, i) => {
        if (i < this._runHighlightMids.length) place(this._runHighlightMids[i], t.midX, t.midZ);
        if (i < this._runHighlightDsts.length) place(this._runHighlightDsts[i], t.tx,   t.tz);
      });
      for (let i = targets.length; i < this._runHighlightMids.length; i++) {
        this._runHighlightMids[i].visible = false;
        this._runHighlightDsts[i].visible = false;
      }
    } else {
      for (const m of this._runHighlightMids) m.visible = false;
      for (const m of this._runHighlightDsts) m.visible = false;
    }
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
    this._encounter++;
    this._logIndex = 0;

    const ca  = this._commitments.a;
    const cb  = this._commitments.b;
    const mpA = this.macroGame.factions.get('a').resources.manpower;
    const mpB = this.macroGame.factions.get('b').resources.manpower;

    const teamA = ROSTER.a.slice(0, ca).map((r, i) => new Combatant({
      id: `a${i}`, name: r.name, factionId: 'a', stats: { ...r.stats },
    }));
    const teamB = ROSTER.b.slice(0, cb).map((r, i) => new Combatant({
      id: `b${i}`, name: r.name, factionId: 'b', stats: { ...r.stats },
    }));

    // Bridge: macro → micro
    const region     = this.macroGame.regions.get(COMBAT_REGION);
    const conditions = getWorldConditions(region);
    applyWorldConditions(conditions, teamA, teamB);
    this.microWorld.applyConditions(conditions);

    debug(`--- Encounter ${this._encounter}: ${ca}v${cb} in ${region.name} ---`);
    debug(`    Iron Throne: ${mpA} men  |  Silver Council: ${mpB} men`);
    if (conditions.length) {
      for (const c of conditions) debug(`[Bridge] ${c.desc}`);
    }

    this.combatMgr = new CombatManager([...teamA, ...teamB], GRID_W, GRID_H);
    this.combatMgr.setup();
    this.actorVisuals.reset();
    this._syncCombatVisuals();
    this._flushCombatLog();

    this._combatTimer = setInterval(() => this._combatTick(), COMBAT_INTERVAL);
  }

  _combatTick() {
    const actor = this.combatMgr.initiative.current();

    // Pause for player input when it's Aldric's turn and he's still alive
    if (actor?.id === PLAYER_COMBATANT_ID && actor.isAlive()) {
      clearInterval(this._combatTimer);
      this._combatTimer = null;
      this._syncCombatVisuals();
      const options = this.combatMgr.getPlayerOptions();
      this.combatHud.showPlayerActions(actor.name, options, a => this._onPlayerAction(a));
      return;
    }

    const ongoing = this.combatMgr.step();
    this._syncCombatVisuals();
    this._flushCombatLog();
    if (!ongoing) {
      clearInterval(this._combatTimer);
      this._onCombatEnd();
    }
  }

  _onPlayerAction(action) {
    this.combatHud.hidePlayerActions();

    let ongoing;
    if (action.type === 'attack') {
      ongoing = this.combatMgr.playerAttack(action.targetId);
    } else if (action.type === 'move') {
      ongoing = this.combatMgr.playerMove(action.targetId);
    } else {
      ongoing = this.combatMgr.playerWait();
    }

    this._syncCombatVisuals();
    this._flushCombatLog();

    if (!ongoing) {
      this._onCombatEnd();
    } else {
      // Resume AI turns
      this._combatTimer = setInterval(() => this._combatTick(), COMBAT_INTERVAL);
    }
  }

  _onCombatEnd() {
    const { winnerFactionId } = this.combatMgr;
    const loserFactionId = winnerFactionId === 'a' ? 'b' : 'a';
    const victory = winnerFactionId === PLAYER_FACTION;

    // Bridge: micro → macro
    const consequence = buildCombatConsequence(
      winnerFactionId, PLAYER_FACTION, COMBAT_REGION, this.macroGame.day
    );
    applyConsequence(consequence, this.macroGame);
    this.macroPanel.update(this.macroGame);

    // Loser escalates
    const loserFaction = this.macroGame.factions.get(loserFactionId);
    const canEscalate  = loserFaction.resources.manpower > 0 &&
                         this._commitments[loserFactionId] < MAX_COMMITMENT;
    if (canEscalate) {
      this._commitments[loserFactionId]++;
      loserFaction.resources.manpower--;
      this.macroPanel.update(this.macroGame);
    }

    const newCount = this._commitments[loserFactionId];
    const mpLeft   = loserFaction.resources.manpower;

    debug(`[Bridge] ${victory ? 'Victory' : 'Defeat'} → consequences applied to Ashenvale.`);
    if (canEscalate) {
      debug(`[War]   ${loserFaction.name} commits another man (now ${newCount}, ${mpLeft} remaining).`);
    }

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

  _syncCombatVisuals() {
    const { combatants, grid, initiative } = this.combatMgr;
    const active = initiative.current();
    this.gridVisuals.update(combatants, grid, active, PLAYER_COMBATANT_ID);
    this.actorVisuals.update(combatants, grid, active);
    const last = this.combatMgr.log.at(-1) ?? '';
    this.combatHud.update(combatants, initiative.getOrder(), last);
  }

  _flushCombatLog() {
    const log = this.combatMgr.log;
    while (this._logIndex < log.length) debug(log[this._logIndex++]);
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
