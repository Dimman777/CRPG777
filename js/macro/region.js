export class Region {
  constructor({ id, name, ownerFactionId = null, initialState = {} }) {
    this.id             = id;
    this.name           = name;
    this.ownerFactionId = ownerFactionId;

    // Pressure values 0–100
    this.security          = initialState.security          ?? 60;
    this.prosperity        = initialState.prosperity        ?? 50;
    this.unrest            = initialState.unrest            ?? 20;
    this.foodSupply        = initialState.foodSupply        ?? 70;
    this.arcanePressure    = initialState.arcanePressure    ?? 10;
    this.militaryPresence  = initialState.militaryPresence  ?? 30;

    this.activeProjects = [];
    this.incidents      = [];
  }

  // Apply a delta and clamp to 0–100.
  clamp(key, delta) {
    this[key] = Math.max(0, Math.min(100, (this[key] ?? 0) + delta));
  }
}
