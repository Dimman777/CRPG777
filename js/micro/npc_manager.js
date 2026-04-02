// NPC is the micro-layer face of a world entity.
// When an NPC is also a macro leader, they share the same logical ID
// so both systems can reference the same underlying record.
export class NPC {
  constructor({ id, name, factionId, role, disposition = 50 }) {
    this.id          = id;
    this.name        = name;
    this.factionId   = factionId;
    this.role        = role;        // 'leader' | 'townsperson' | 'merchant' | ...
    this.disposition = disposition; // 0–100 relationship value
    this.alive       = true;
  }
}

export class NPCManager {
  constructor() {
    this._npcs = new Map();
  }

  register(npc) {
    this._npcs.set(npc.id, npc);
    return npc;
  }

  get(id) {
    return this._npcs.get(id) ?? null;
  }

  getAll() {
    return [...this._npcs.values()];
  }
}
