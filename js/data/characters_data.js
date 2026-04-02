// characters_data.js — Pre-generated hero roster.
// Each entry can be chosen as the Player Character or recruited as a follower.
//
// Stats follow the Domain → Group → Stat hierarchy at scale 1–40.
// Specialisation pressure is intentional: no character is balanced across all domains.
//
// Derived consumables (computed at runtime from these base stats):
//   Injury         = Vitality + Build + Endurance / 2
//   Sickness       = Vitality + Endurance + Fitness / 2
//   Muscle Fatigue = Strength + Endurance + Fitness / 2
//   Cardio Fatigue = Fitness + Endurance + Build / 2
//   Focus          = Control + Memory + Composure / 2
//   Eija Max       = Source × 3
//
// Skill levels: Unknown | Exposed | Learned | Practiced | Internalized

export const CHARACTERS = [
  // ── Grendoli Vrynn ──────────────────────────────────────────────────────────
  {
    id:    'grendoli',
    name:  'Grendoli Vrynn',
    role:  'Spear-Fighter & Performer',
    color: 0x4499cc,
    brief: 'Noble-born athlete and travelling entertainer. Masterful with a spear, effortlessly charming, and quietly insecure about whether his considerable gifts are enough.',
    stats: {
      // BODY — Vigour
      Power: 18, Strength: 16, Endurance: 15,
      // BODY — Dexterity
      Balance: 20, Coordination: 19, Precision: 17,
      // BODY — Stock
      Build: 14, Vitality: 15, Fitness: 18,
      // MIND — Perception
      Alertness: 16, Observation: 14, Intuition: 15,
      // MIND — Lore
      Learning: 12, Memory: 11, Knowledge: 13,
      // MIND — Intellect
      Wit: 17, Control: 12, Expression: 20,
      // SOUL — Eija
      Channel: 10, Project: 9, Source: 8,
      // SOUL — Integrity
      Courage: 15, Composure: 13, Identity: 12,
      // SOUL — Ardour
      Passion: 16, Empathy: 14, Aura: 20,
    },
    skills: [
      { trunk: 'Spear',       name: 'Spear Fighting',  level: 'Internalized' },
      { trunk: 'Spear',       name: 'Mounted Lance',   level: 'Practiced'    },
      { trunk: 'Performance', name: 'Display Combat',  level: 'Practiced'    },
      { trunk: 'Athletics',   name: 'Climbing',        level: 'Learned'      },
      { trunk: 'Riding',      name: 'Horsemanship',    level: 'Practiced'    },
      { trunk: 'Eija',        name: 'Spark Cantrips',  level: 'Exposed'      },
      { trunk: 'Social',      name: 'Presence',        level: 'Practiced'    },
    ],
    equipment: [
      'War spear (ash haft, steel tip)',
      'Padded gambeson',
      'Riding boots and gloves',
      "Performer's travelling pack",
      'Noble signet (minor house, limited authority)',
    ],
  },

  // ── Kiva Mikensis ───────────────────────────────────────────────────────────
  {
    id:    'kiva',
    name:  'Kiva Mikensis',
    role:  'Acrobat & Aspiring Mage',
    color: 0xcc7744,
    brief: 'Lively entertainer from a loving road family. Exceptional agility and precision, more magical potential than she lets on, and quietly obsessive about gaining real arcane power.',
    stats: {
      Power: 10, Strength: 10, Endurance: 14,
      Balance: 22, Coordination: 22, Precision: 20,
      Build: 10, Vitality: 13, Fitness: 18,
      Alertness: 18, Observation: 16, Intuition: 17,
      Learning: 16, Memory: 15, Knowledge: 13,
      Wit: 16, Control: 14, Expression: 17,
      Channel: 16, Project: 14, Source: 15,
      Courage: 14, Composure: 13, Identity: 15,
      Passion: 18, Empathy: 13, Aura: 16,
    },
    skills: [
      { trunk: 'Throwing',    name: 'Knife Throwing',  level: 'Practiced'    },
      { trunk: 'Athletics',   name: 'Tumbling',        level: 'Internalized' },
      { trunk: 'Athletics',   name: 'Slack-Line',      level: 'Practiced'    },
      { trunk: 'Performance', name: 'Juggling',        level: 'Internalized' },
      { trunk: 'Eija',        name: 'Cantrip Study',   level: 'Learned'      },
      { trunk: 'Social',      name: 'Road Charm',      level: 'Learned'      },
    ],
    equipment: [
      'Set of balanced throwing knives (×6)',
      'Light leather vest',
      'Soft road shoes',
      'Juggling props and performance kit',
      'Partial grimoire (copied notes, incomplete)',
    ],
  },

  // ── Syanne Shianna Thannoway ─────────────────────────────────────────────────
  {
    id:    'shianna',
    name:  'Syanne Shianna Thannoway',
    role:  'Exiled Bladesinger & Necromancer',
    color: 0x44cc66,
    brief: 'A legendary elven warrior-mage, celebrated and then exiled. Lethal in combat, deeply haunted by the dead, and walking a fine line between grief and a sacred death-wish.',
    stats: {
      Power: 20, Strength: 18, Endurance: 22,
      Balance: 26, Coordination: 26, Precision: 24,
      Build: 16, Vitality: 22, Fitness: 22,
      Alertness: 22, Observation: 20, Intuition: 24,
      Learning: 20, Memory: 22, Knowledge: 24,
      Wit: 18, Control: 16, Expression: 18,
      Channel: 24, Project: 22, Source: 20,
      Courage: 18, Composure: 12, Identity: 14,
      Passion: 22, Empathy: 20, Aura: 22,
    },
    skills: [
      { trunk: 'Blade',       name: 'Bladesong',       level: 'Internalized' },
      { trunk: 'Blade',       name: 'Dual Wield',      level: 'Practiced'    },
      { trunk: 'Eija',        name: 'Combat Casting',  level: 'Internalized' },
      { trunk: 'Eija',        name: 'Necromantic Rites', level: 'Practiced'  },
      { trunk: 'Eija',        name: 'Spirit Contact',  level: 'Learned'      },
      { trunk: 'Lore',        name: 'Elven History',   level: 'Internalized' },
      { trunk: 'Lore',        name: 'Death Lore',      level: 'Practiced'    },
    ],
    equipment: [
      'Twin elven blades (ancient make, minor enchantment)',
      'Elven half-plate (articulated, masterwork)',
      'Exile documents (honorable, legally binding)',
      'Necromantic focus (bone and silver)',
      'Field notes on spirit contact (worn)',
    ],
  },

  // ── Syl Liran Minallowen ────────────────────────────────────────────────────
  {
    id:    'liran',
    name:  'Syl Liran Minallowen',
    role:  'Undefeated Elven Knight',
    color: 0x44cccc,
    brief: 'Mythic in battle and never defeated in armed combat. Chose a life of oath-bound service over the destiny his talents could have claimed. Trains obsessively and finances travel through tournament victories.',
    stats: {
      Power: 28, Strength: 26, Endurance: 28,
      Balance: 26, Coordination: 28, Precision: 24,
      Build: 24, Vitality: 28, Fitness: 26,
      Alertness: 24, Observation: 22, Intuition: 20,
      Learning: 14, Memory: 14, Knowledge: 16,
      Wit: 16, Control: 22, Expression: 15,
      Channel: 10, Project: 8, Source: 8,
      Courage: 30, Composure: 28, Identity: 26,
      Passion: 14, Empathy: 16, Aura: 20,
    },
    skills: [
      { trunk: 'Blade',       name: 'Knight Cavalier', level: 'Internalized' },
      { trunk: 'Blade',       name: 'Mounted Combat',  level: 'Internalized' },
      { trunk: 'Shield',      name: 'Shield Mastery',  level: 'Practiced'    },
      { trunk: 'Athletics',   name: 'Overweight Training', level: 'Practiced'},
      { trunk: 'Riding',      name: 'Warhorse Handling', level: 'Internalized'},
      { trunk: 'Social',      name: 'Tournament Protocol', level: 'Learned'  },
    ],
    equipment: [
      'Knightly longsword (heirloom, named "Calance")',
      'Full elven plate armour (overweight practice set, separate)',
      'Tournament kit and travel documentation',
      'Warhorse tack and grooming supplies',
      'Oath record (formal exile companion document)',
    ],
  },

  // ── Zystran ─────────────────────────────────────────────────────────────────
  {
    id:    'zystran',
    name:  'Zystran',
    role:  'Gallant & Social Predator',
    color: 0x9944cc,
    brief: 'Polished, handsome, and charming enough to pass for a serious knight. His gifts are seduction, mood-reading, and recovering from defeat — not actual heroism. He wants the rewards without paying the full cost.',
    stats: {
      Power: 14, Strength: 14, Endurance: 12,
      Balance: 18, Coordination: 17, Precision: 16,
      Build: 16, Vitality: 14, Fitness: 14,
      Alertness: 16, Observation: 18, Intuition: 20,
      Learning: 12, Memory: 12, Knowledge: 13,
      Wit: 20, Control: 15, Expression: 22,
      Channel: 6, Project: 5, Source: 5,
      Courage: 12, Composure: 18, Identity: 10,
      Passion: 18, Empathy: 18, Aura: 24,
    },
    skills: [
      { trunk: 'Blade',       name: 'Duelling',        level: 'Practiced'    },
      { trunk: 'Social',      name: 'Seduction',       level: 'Practiced'    },
      { trunk: 'Social',      name: 'Noble Etiquette', level: 'Internalized' },
      { trunk: 'Social',      name: 'Status Recovery', level: 'Practiced'    },
      { trunk: 'Riding',      name: 'Tournament Riding', level: 'Learned'    },
      { trunk: 'Lore',        name: 'Heraldry',        level: 'Learned'      },
    ],
    equipment: [
      'Dress sword (fine but not exceptional)',
      'Tournament armour (polished, impressive appearance)',
      'Jewelled accessories (some stolen, some gifted)',
      'Multiple letters of introduction (some forged)',
      'Small purse (usually lighter than it appears)',
    ],
  },

  // ── Wendle the Ox ───────────────────────────────────────────────────────────
  {
    id:    'wendle',
    name:  'Wendle the Ox',
    role:  'Mercenary & Dragon Hunter',
    color: 0xaaaa22,
    brief: 'Roughly thirty, big, hard, and weathered rather than glamorous. Years of mercenary work followed by active dragon hunting. He thinks about kills in terms of logistics, angles, and survival — not glory.',
    stats: {
      Power: 28, Strength: 28, Endurance: 26,
      Balance: 14, Coordination: 16, Precision: 14,
      Build: 26, Vitality: 26, Fitness: 24,
      Alertness: 18, Observation: 20, Intuition: 16,
      Learning: 8,  Memory: 8,  Knowledge: 12,
      Wit: 10, Control: 14, Expression: 8,
      Channel: 5, Project: 4, Source: 4,
      Courage: 26, Composure: 18, Identity: 22,
      Passion: 12, Empathy: 8,  Aura: 12,
    },
    skills: [
      { trunk: 'Polearm',     name: 'Two-Handed Axe',  level: 'Internalized' },
      { trunk: 'Shield',      name: 'Shield Bashing',  level: 'Practiced'    },
      { trunk: 'Fieldcraft',  name: 'Creature Hunting', level: 'Practiced'   },
      { trunk: 'Fieldcraft',  name: 'Bait and Kill Zones', level: 'Learned'  },
      { trunk: 'Athletics',   name: 'Endurance March', level: 'Practiced'    },
    ],
    equipment: [
      'Heavy war axe (wide-blade, reinforced haft)',
      'Dented iron shield',
      'Layered leather and ring armour',
      'Dragon-hunting kit (bolts, rope, fire-ward oil)',
      'Camp tools and rations',
    ],
  },

  // ── Weavy the Black ─────────────────────────────────────────────────────────
  {
    id:    'weavy',
    name:  'Weavy the Black',
    role:  'Sharpshooter',
    color: 0x888888,
    brief: 'Waifish and ghostlike in appearance, with every narrow line of her built for precision violence. Operates a monstrous steel-limbed crossbow capable of punching through strong armour at a hundred yards.',
    stats: {
      Power: 12, Strength: 14, Endurance: 16,
      Balance: 20, Coordination: 18, Precision: 28,
      Build: 12, Vitality: 16, Fitness: 18,
      Alertness: 26, Observation: 28, Intuition: 22,
      Learning: 12, Memory: 14, Knowledge: 16,
      Wit: 14, Control: 22, Expression: 10,
      Channel: 5, Project: 4, Source: 4,
      Courage: 18, Composure: 20, Identity: 20,
      Passion: 8,  Empathy: 14, Aura: 12,
    },
    skills: [
      { trunk: 'Crossbow',    name: 'Precision Shot',  level: 'Internalized' },
      { trunk: 'Crossbow',    name: 'Armour Penetration', level: 'Practiced' },
      { trunk: 'Fieldcraft',  name: 'Setup and Position', level: 'Practiced' },
      { trunk: 'Fieldcraft',  name: 'Line of Sight',   level: 'Practiced'    },
      { trunk: 'Athletics',   name: 'Cart Handling',   level: 'Learned'      },
    ],
    equipment: [
      'Heavy steel-limbed crossbow (bipod, pulley cocking system)',
      'Wheeled equipment cart',
      'Armour-piercing bolt supply',
      'Dark travel clothes (close-fitting)',
      'Short blade (backup, rarely used)',
    ],
  },

  // ── Grieg the Dark Brother ──────────────────────────────────────────────────
  {
    id:    'grieg',
    name:  'Grieg the Dark Brother',
    role:  'Veteran Fighter & Penitent',
    color: 0xcc4488,
    brief: 'About fifty, heavily scarred, and carrying decades of war crimes he can name precisely. He turned against his mage-brother too late to save the people he should have protected. He wants useful action — not absolution.',
    stats: {
      Power: 22, Strength: 22, Endurance: 24,
      Balance: 16, Coordination: 18, Precision: 16,
      Build: 22, Vitality: 20, Fitness: 20,
      Alertness: 20, Observation: 22, Intuition: 18,
      Learning: 14, Memory: 14, Knowledge: 18,
      Wit: 14, Control: 16, Expression: 12,
      Channel: 8, Project: 6, Source: 6,
      Courage: 22, Composure: 16, Identity: 18,
      Passion: 14, Empathy: 18, Aura: 14,
    },
    skills: [
      { trunk: 'Blade',       name: 'Veteran Swordsmanship', level: 'Internalized' },
      { trunk: 'Polearm',     name: 'Spear Tactics',   level: 'Practiced'    },
      { trunk: 'Fieldcraft',  name: 'Siege Experience', level: 'Practiced'   },
      { trunk: 'Social',      name: 'Identity Concealment', level: 'Practiced'},
      { trunk: 'Lore',        name: 'Arcane Artefact Lore', level: 'Learned' },
    ],
    equipment: [
      'Scarred longsword (functional, no decoration)',
      'Old mercenary armour (repaired many times)',
      'Concealed identity papers (false name)',
      'Letters from Sennianna (kept but never re-read)',
      'Burn-scar ointment (chronic use)',
    ],
  },

  // ── Masaan Godaina ──────────────────────────────────────────────────────────
  {
    id:    'masaan',
    name:  'Masaan Godaina',
    role:  'Magical Prodigy',
    color: 0xbb44bb,
    brief: 'An extraordinary magical talent whose family name was stripped for necromantic offences. His bitterness comes from what was stolen from him, not from inadequacy. He is slowly — reluctantly — growing past it.',
    stats: {
      Power: 10, Strength: 10, Endurance: 12,
      Balance: 12, Coordination: 11, Precision: 14,
      Build: 10, Vitality: 12, Fitness: 11,
      Alertness: 16, Observation: 18, Intuition: 20,
      Learning: 28, Memory: 26, Knowledge: 28,
      Wit: 22, Control: 26, Expression: 14,
      Channel: 26, Project: 28, Source: 24,
      Courage: 12, Composure: 18, Identity: 14,
      Passion: 16, Empathy: 12, Aura: 14,
    },
    skills: [
      { trunk: 'Eija',        name: 'Advanced Spellcraft', level: 'Internalized' },
      { trunk: 'Eija',        name: 'Overcasting',       level: 'Practiced'    },
      { trunk: 'Eija',        name: 'Arcane Refinement', level: 'Practiced'    },
      { trunk: 'Lore',        name: 'Magical Theory',    level: 'Internalized' },
      { trunk: 'Lore',        name: 'Forbidden Archives', level: 'Learned'     },
      { trunk: 'Social',      name: 'Academic Argument', level: 'Learned'      },
    ],
    equipment: [
      'Primary spellcasting focus (custom, expensive)',
      'Study grimoire (densely annotated)',
      'Light robes (prioritises freedom of gesture)',
      'Encoded personal notes (cipher, unique)',
      'Scholar identification (name changed from Godaina)',
    ],
  },

  // ── Avylisse Antay ──────────────────────────────────────────────────────────
  {
    id:    'avylisse',
    name:  'Avylisse Antay',
    role:  'Scholar & Library Head',
    color: 0xddbb44,
    brief: 'Elven by blood, raised by humans, and now the head of an important library. A life of serious study and quiet authority. She carries civilisational memory that becomes urgent when history threatens to repeat itself.',
    stats: {
      Power: 10, Strength: 10, Endurance: 14,
      Balance: 14, Coordination: 13, Precision: 16,
      Build: 10, Vitality: 14, Fitness: 13,
      Alertness: 18, Observation: 22, Intuition: 20,
      Learning: 28, Memory: 28, Knowledge: 30,
      Wit: 20, Control: 22, Expression: 16,
      Channel: 18, Project: 16, Source: 16,
      Courage: 18, Composure: 24, Identity: 26,
      Passion: 14, Empathy: 18, Aura: 18,
    },
    skills: [
      { trunk: 'Lore',        name: 'Historical Archive', level: 'Internalized' },
      { trunk: 'Lore',        name: 'Elven Cultural Memory', level: 'Internalized' },
      { trunk: 'Lore',        name: 'Magical Taxonomy', level: 'Practiced'     },
      { trunk: 'Eija',        name: 'Scholarly Magic',  level: 'Practiced'    },
      { trunk: 'Social',      name: 'Institutional Authority', level: 'Practiced' },
      { trunk: 'Lore',        name: 'Degarien Research', level: 'Exposed'      },
    ],
    equipment: [
      'Library seal and keys',
      'Annotated reference texts (selected field copies)',
      'Elven research focus',
      'Practical travel clothes (scholar cut, not road-worn)',
      'Detailed map notes (regions connected to known history)',
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) ?? null;
}

// Compute derived consumable maximums from a character's base stats.
export function computeConsumables(stats) {
  const s = stats;
  return {
    Injury:       Math.round(s.Vitality + s.Build      + s.Endurance / 2),
    Sickness:     Math.round(s.Vitality + s.Endurance  + s.Fitness   / 2),
    'Mus. Fatigue': Math.round(s.Strength + s.Endurance + s.Fitness  / 2),
    'Car. Fatigue': Math.round(s.Fitness  + s.Endurance + s.Build    / 2),
    Focus:        Math.round(s.Control + s.Memory      + s.Composure / 2),
    'Eija Max':   s.Source * 3,
  };
}
