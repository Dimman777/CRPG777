export class Faction {
  constructor({ id, name, leaderId }) {
    this.id       = id;
    this.name     = name;
    this.leaderId = leaderId;

    this.resources = {
      treasury:  100,
      food:       80,
      manpower:   50,
      stability:  60,
    };

    this.territories = []; // region IDs
    this.relations   = {}; // factionId → -100..100
    this.projects    = [];
  }
}
