// Dialogue state machine. Caller passes macroGame context so dialogue
// content can reflect current world state.
// Returns consequence records from select() — caller applies them.

export class DialogueManager {
  constructor() {
    this._npc        = null;
    this._macroGame  = null;
    this._regionId   = null;
    this._text       = '';
    this._topics     = [];
    this._usedIds    = new Set();
    this._active     = false;
  }

  start(npc, macroGame, regionId) {
    this._npc       = npc;
    this._macroGame = macroGame;
    this._regionId  = regionId;
    this._usedIds.clear();
    this._active    = true;
    this._topics    = this._buildTopics();
    this._text      = this._buildOpening();
  }

  isActive() { return this._active; }

  getState() {
    return {
      npcName: this._npc.name,
      text:    this._text,
      options: this._visibleTopics().map(t => ({
        id:        t.id,
        label:     t.label,
        available: t.canUse?.() !== false,
      })),
    };
  }

  // Returns a consequence record (or null) that the caller should apply.
  select(optionId) {
    const topic = this._visibleTopics().find(t => t.id === optionId);
    if (!topic || topic.canUse?.() === false) return null;

    if (topic.once) this._usedIds.add(optionId);

    if (topic.ends) {
      this._text   = '"Safe travels, friend."';
      this._active = false;
      return { consequence: null, ends: true };
    }

    this._text = typeof topic.response === 'function'
      ? topic.response()
      : topic.response;

    return { consequence: topic.consequence?.() ?? null, ends: false };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _visibleTopics() {
    return this._topics.filter(t => !this._usedIds.has(t.id));
  }

  _buildOpening() {
    const npc     = this._npc;
    const faction = this._macroGame.factions.get(npc.factionId);
    const region  = this._macroGame.regions.get(this._regionId);
    const enemy   = [...this._macroGame.factions.values()]
      .find(f => f.id !== npc.factionId);

    if (npc.role === 'leader') {
      const ahead = faction.resources.manpower >= (enemy?.resources.manpower ?? 0);
      return ahead
        ? `Lord Harven surveys the field with a grim satisfaction.\n\n"We hold the advantage. Press it."`
        : `Lord Harven's jaw is tight.\n\n"We're bleeding men. Choose your next move carefully."`;
    }

    // Townsperson
    return region.unrest > 60
      ? `${npc.name} speaks in a low voice.\n\n"Dangerous times. Half the village has bolted their doors."`
      : `${npc.name} nods in greeting.\n\n"Quiet enough today. How can I help you?"`;
  }

  _buildTopics() {
    const npc     = this._npc;
    const faction = this._macroGame.factions.get(npc.factionId);
    const region  = this._macroGame.regions.get(this._regionId);

    if (npc.role === 'leader') {
      return [
        {
          id:       'report',
          label:    'How does Ashenvale fare?',
          once:     true,
          response: () => {
            const r = region;
            return (
              `"Security ${r.security}, unrest at ${r.unrest}. ` +
              `Prosperity ${r.prosperity}, food supply ${r.foodSupply}. ` +
              (r.unrest > 60 ? 'The population grows restless.' : 'The people hold.') + '"'
            );
          },
        },
        {
          id:       'rally',
          label:    'Rally the troops. [10 gold → +1 fighter next encounter]',
          once:     true,
          canUse:   () => faction.resources.treasury >= 10,
          response: () => '"Consider it done. The men will fight harder knowing you\'re watching."',
          consequence: () => ({
            id:          `dlg_rally_${npc.factionId}`,
            type:        'leader_rallied',
            sourceLayer: 'micro',
            targetLayer: 'macro',
            payload:     { factionId: npc.factionId },
            timestamp:   this._macroGame.day,
          }),
        },
        {
          id:   'leave',
          label: 'Back to the fight.',
          ends:  true,
        },
      ];
    }

    // Townsperson topics
    return [
      {
        id:       'mood',
        label:    'What is the mood here?',
        once:     true,
        response: () => {
          if (region.unrest > 60)  return '"People are scared. Too many soldiers, too little food."';
          if (region.unrest < 20)  return '"Honestly? Better than it\'s been in years."';
          return '"Tense, but holding. For now."';
        },
      },
      {
        id:       'hope',
        label:    'Spread hopeful news. [1 influence → unrest -5]',
        once:     true,
        canUse:   () => faction.resources.stability >= 1,
        response: () => '"Word spreads fast. A few shoulders relax. It helps."',
        consequence: () => ({
          id:          `dlg_hope_${this._regionId}`,
          type:        'hope_spread',
          sourceLayer: 'micro',
          targetLayer: 'macro',
          payload:     { regionId: this._regionId },
          timestamp:   this._macroGame.day,
        }),
      },
      {
        id:   'leave',
        label: 'Safe travels.',
        ends:  true,
      },
    ];
  }
}
