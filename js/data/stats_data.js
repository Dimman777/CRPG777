// Stat hierarchy: 3 pillars → 9 groups → 27 stats

export const STATS = {
  // Body — physical capability
  strength:     { pillar: 'body', group: 'physique' },
  endurance:    { pillar: 'body', group: 'physique' },
  toughness:    { pillar: 'body', group: 'physique' },
  speed:        { pillar: 'body', group: 'agility' },
  coordination: { pillar: 'body', group: 'agility' },
  reflexes:     { pillar: 'body', group: 'agility' },
  intimidation: { pillar: 'body', group: 'presence' },
  command:      { pillar: 'body', group: 'presence' },
  composure:    { pillar: 'body', group: 'presence' },

  // Mind — mental capability
  reasoning:    { pillar: 'mind', group: 'intellect' },
  memory:       { pillar: 'mind', group: 'intellect' },
  perception:   { pillar: 'mind', group: 'intellect' },
  deception:    { pillar: 'mind', group: 'cunning' },
  strategy:     { pillar: 'mind', group: 'cunning' },
  awareness:    { pillar: 'mind', group: 'cunning' },
  arcane:       { pillar: 'mind', group: 'lore' },
  history:      { pillar: 'mind', group: 'lore' },
  nature:       { pillar: 'mind', group: 'lore' },

  // Soul — inner force
  devotion:     { pillar: 'soul', group: 'faith' },
  conviction:   { pillar: 'soul', group: 'faith' },
  willpower:    { pillar: 'soul', group: 'faith' },
  sensitivity:  { pillar: 'soul', group: 'attunement' },
  channeling:   { pillar: 'soul', group: 'attunement' },
  warding:      { pillar: 'soul', group: 'attunement' },
  persuasion:   { pillar: 'soul', group: 'influence' },
  empathy:      { pillar: 'soul', group: 'influence' },
  leadership:   { pillar: 'soul', group: 'influence' },
};

// Maps a stat value (1–5, or 6+ exceptional) to a die descriptor { count, sides }
export function getStatDie(value) {
  if (value >= 6) return { count: 2, sides: 8 }; // exceptional
  const map = { 1: 4, 2: 6, 3: 8, 4: 10, 5: 12 };
  return { count: 1, sides: map[Math.max(1, value)] ?? 4 };
}
