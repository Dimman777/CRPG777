import { COMBATANT_HP, COMBATANT_STAMINA } from '../data/game_config.js';

export class Combatant {
  constructor({ id, name, factionId, stats }) {
    this.id = id;
    this.name = name;
    this.factionId = factionId;

    // Stats: keyed by stat name, value 1–6
    this.stats = stats;

    // Combat resources
    this.resources = {
      hp:      { current: COMBATANT_HP,      max: COMBATANT_HP },
      stamina: { current: COMBATANT_STAMINA, max: COMBATANT_STAMINA },
    };

    // Set by initiative.js each round
    this.initiativeValue = 0;

    // Active status effects (populated later)
    this.conditions = [];

    // Logical grid position — set by grid_state.js
    this.position = null;
  }

  getStat(name) {
    return this.stats[name] ?? 1;
  }

  isAlive() {
    return this.resources.hp.current > 0;
  }

  takeDamage(amount) {
    this.resources.hp.current = Math.max(0, this.resources.hp.current - amount);
  }

  useStamina(amount) {
    this.resources.stamina.current = Math.max(0, this.resources.stamina.current - amount);
  }
}
