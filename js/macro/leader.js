export class Leader {
  constructor({ id, name, factionId, traits = [], macroProfile = {} }) {
    this.id        = id;
    this.name      = name;
    this.factionId = factionId;
    this.alive     = true;
    this.currentLocation = null; // region ID

    this.traits = traits; // e.g. ['aggressive', 'cautious', 'cunning']

    // Decision weights 0–10; higher = stronger preference
    this.macroProfile = {
      aggression: 5,
      expansion:  5,
      diplomacy:  5,
      caution:    5,
      ...macroProfile,
    };

    // Used by micro dialogue and relationship systems
    this.socialState = { disposition: {} };
  }
}
