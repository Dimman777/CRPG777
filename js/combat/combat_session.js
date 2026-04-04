// CombatSession — orchestrates a single combat encounter from setup to resolution.
// Owns the tick interval, player action flow, and consequence application.
// Does not own UI — receives visual/hud callbacks from the caller.

import { Combatant }             from './combatant.js';
import { CombatManager }         from './combat_manager.js';
import { getWorldConditions, applyWorldConditions } from '../bridge/macro_to_micro.js';
import { buildCombatConsequence } from '../bridge/micro_to_macro.js';
import { applyConsequence }       from '../bridge/consequence_mapper.js';
import { GRID_W, GRID_H, COMBAT_INTERVAL, MAX_COMMITMENT } from '../data/game_config.js';

export class CombatSession {
  /**
   * @param {Object} opts
   * @param {Object} opts.macroGame       — MacroGame instance
   * @param {Object} opts.commitments     — { a: number, b: number } mutable
   * @param {Array}  opts.roster          — { a: [...], b: [...] } stat templates
   * @param {string} opts.playerFactionId — 'a'
   * @param {string} opts.playerCombatantId — 'a0'
   * @param {string} opts.regionId        — combat region
   * @param {Object} opts.rng             — RNG instance
   * @param {Object} opts.microWorld      — MicroWorld (for applyConditions)
   * @param {Function} opts.onLog         — (msg) => void
   * @param {Function} opts.onVisualsSync — (combatMgr) => void
   * @param {Function} opts.onPlayerTurn  — (actorName, options, callback) => void
   * @param {Function} opts.onHideActions — () => void
   * @param {Function} opts.onEnd         — (winnerFactionId, consequence) => void
   */
  constructor(opts) {
    this._opts         = opts;
    this._combatMgr    = null;
    this._timer        = null;
    this._logIndex     = 0;
    this._encounter    = opts.encounter ?? 0;
  }

  get combatMgr() { return this._combatMgr; }
  get encounter() { return this._encounter; }

  start() {
    const o  = this._opts;
    this._encounter++;

    const ca  = o.commitments.a;
    const cb  = o.commitments.b;

    const teamA = o.roster.a.slice(0, ca).map((r, i) => new Combatant({
      id: `a${i}`, name: r.name, factionId: 'a', stats: { ...r.stats },
    }));
    const teamB = o.roster.b.slice(0, cb).map((r, i) => new Combatant({
      id: `b${i}`, name: r.name, factionId: 'b', stats: { ...r.stats },
    }));

    // Bridge: macro → micro
    const region     = o.macroGame.regions.get(o.regionId);
    const conditions = getWorldConditions(region);
    applyWorldConditions(conditions, teamA, teamB);
    o.microWorld.applyConditions(conditions);

    this._log(`--- Encounter ${this._encounter}: ${ca}v${cb} in ${region.name} ---`);
    const mpA = o.macroGame.factions.get('a').resources.manpower;
    const mpB = o.macroGame.factions.get('b').resources.manpower;
    this._log(`    Iron Throne: ${mpA} men  |  Silver Council: ${mpB} men`);
    if (conditions.length) {
      for (const c of conditions) this._log(`[Bridge] ${c.desc}`);
    }

    this._combatMgr = new CombatManager([...teamA, ...teamB], GRID_W, GRID_H, o.rng);
    this._combatMgr.setup();
    this._logIndex = 0;
    this._syncVisuals();
    this._flushLog();

    this._timer = setInterval(() => this._tick(), COMBAT_INTERVAL);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  // Called when the player selects an action during their turn.
  playerAction(action) {
    const o = this._opts;
    o.onHideActions();

    let ongoing;
    if (action.type === 'attack') {
      ongoing = this._combatMgr.playerAttack(action.targetId);
    } else if (action.type === 'move') {
      ongoing = this._combatMgr.playerMove(action.targetId);
    } else {
      ongoing = this._combatMgr.playerWait();
    }

    this._syncVisuals();
    this._flushLog();

    if (!ongoing) {
      this._onEnd();
    } else {
      this._timer = setInterval(() => this._tick(), COMBAT_INTERVAL);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _tick() {
    const o     = this._opts;
    const actor = this._combatMgr.initiative.current();

    if (actor?.id === o.playerCombatantId && actor.isAlive()) {
      clearInterval(this._timer);
      this._timer = null;
      this._syncVisuals();
      const options = this._combatMgr.getPlayerOptions();
      o.onPlayerTurn(actor.name, options, a => this.playerAction(a));
      return;
    }

    const ongoing = this._combatMgr.step();
    this._syncVisuals();
    this._flushLog();
    if (!ongoing) {
      clearInterval(this._timer);
      this._onEnd();
    }
  }

  _onEnd() {
    const o = this._opts;
    const { winnerFactionId } = this._combatMgr;
    const loserFactionId = winnerFactionId === 'a' ? 'b' : 'a';
    const victory = winnerFactionId === o.playerFactionId;

    // Bridge: micro → macro
    const consequence = buildCombatConsequence(
      winnerFactionId, o.playerFactionId, o.regionId, o.macroGame.day,
    );
    applyConsequence(consequence, o.macroGame);

    // Loser escalates
    const loserFaction = o.macroGame.factions.get(loserFactionId);
    const canEscalate  = loserFaction.resources.manpower > 0 &&
                         o.commitments[loserFactionId] < MAX_COMMITMENT;
    if (canEscalate) {
      o.commitments[loserFactionId]++;
      loserFaction.resources.manpower--;
    }

    this._log(`[Bridge] ${victory ? 'Victory' : 'Defeat'} → consequences applied.`);
    if (canEscalate) {
      const newCount = o.commitments[loserFactionId];
      const mpLeft   = loserFaction.resources.manpower;
      this._log(`[War]   ${loserFaction.name} commits another (now ${newCount}, ${mpLeft} remaining).`);
    }

    o.onEnd(winnerFactionId, consequence);
  }

  _log(msg)         { this._opts.onLog?.(msg); }
  _syncVisuals()    { this._opts.onVisualsSync?.(this._combatMgr); }
  _flushLog() {
    const log = this._combatMgr.log;
    while (this._logIndex < log.length) this._log(log[this._logIndex++]);
  }
}
