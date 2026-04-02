import { TERRAIN_PROPS } from '../data/terrain_data.js';

export class MacroCell {
  constructor({
    // ── Existing fields (kept for backward compat) ──────────────────────────
    terrain        = 'ocean',
    moistureZone   = 'temperate',   // derived from rainfall — kept for chunk_gen/view compat
    vegetation     = 'none',
    elevation      = 0,             // normalised 0–1 macro height
    slope          = 0,             // 0–1 gradient magnitude
    ownerFactionId = null,
    settlementType = null,
    settlementId   = null,
    roadMask       = 0,             // bitmask N=1 E=2 S=4 W=8
    riverMask      = 0,
    riverDownDir   = 0,
    riverFloorElev = null,
    dangerLevel    = 0,
    ancientSiteType = null,
    poiType        = null,

    // ── New hydrology fields ─────────────────────────────────────────────────
    waterType      = 'none',        // 'none' | 'ocean' | 'coast' | 'lake' | 'marsh' | 'river'
    oceanDistance  = 0,             // BFS cell-steps to nearest ocean cell
    downstreamDir  = null,          // dir8 string or null (flow direction)
    flowAccum      = 0,             // accumulated upstream rainfall contribution
    watershedId    = null,          // integer ID of owning watershed
    riverId        = null,
    riverClass     = 'none',        // 'none' | 'creek' | 'stream' | 'river' | 'major_river'
    riverSurfaceZ  = null,          // explicit water surface elevation (monotonic downstream)
    lakeId         = null,

    // ── New climate fields ───────────────────────────────────────────────────
    rainfall       = 0,             // 0–100 int
    temperature    = 0,             // 0–100 int (0=cold, 100=hot)

    // ── New structural / biome fields ────────────────────────────────────────
    biomeRegion    = 'plain',       // biome region tag
    terrainRegion  = 'plain',       // 'plain'|'hill'|'mountain'|'plateau'|'basin'|'coast'|
                                    // 'wetland'|'forest'|'desert'|'uplands'|'old_eroded'
    reliefStrength = 0,             // 0–100 local relief intensity
    slopeDir       = 'flat',        // 'flat'|'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'

    // ── New coast field ──────────────────────────────────────────────────────
    coastType      = 'none',        // 'none'|'beach'|'rocky'|'cliff'|'marsh'|'delta'|'sheltered_bay'

    // ── New pressure / influence fields ─────────────────────────────────────
    travelPressure      = 0,
    poiPressure         = 0,
    dangerPressure      = 0,
    settlementInfluence = 0,

    // ── Chunk edge contracts (populated in Phase 10) ─────────────────────────
    edgeContracts  = null,          // null or ChunkEdgeContract[4] (N/E/S/W)
  } = {}) {
    // Existing
    this.terrain         = terrain;
    this.moistureZone    = moistureZone;
    this.vegetation      = vegetation;
    this.elevation       = elevation;
    this.slope           = slope;
    this.ownerFactionId  = ownerFactionId;
    this.settlementType  = settlementType;
    this.settlementId    = settlementId;
    this.roadMask        = roadMask;
    this.riverMask       = riverMask;
    this.riverDownDir    = riverDownDir;
    this.riverFloorElev  = riverFloorElev;
    this.dangerLevel     = dangerLevel;
    this.ancientSiteType = ancientSiteType;
    this.poiType         = poiType;

    // New hydrology
    this.waterType       = waterType;
    this.oceanDistance   = oceanDistance;
    this.downstreamDir   = downstreamDir;
    this.flowAccum       = flowAccum;
    this.watershedId     = watershedId;
    this.riverId         = riverId;
    this.riverClass      = riverClass;
    this.riverSurfaceZ   = riverSurfaceZ;
    this.lakeId          = lakeId;

    // New climate
    this.rainfall        = rainfall;
    this.temperature     = temperature;

    // New structural / biome
    this.biomeRegion     = biomeRegion;
    this.terrainRegion   = terrainRegion;
    this.reliefStrength  = reliefStrength;
    this.slopeDir        = slopeDir;

    // New coast
    this.coastType       = coastType;

    // New pressure
    this.travelPressure      = travelPressure;
    this.poiPressure         = poiPressure;
    this.dangerPressure      = dangerPressure;
    this.settlementInfluence = settlementInfluence;

    // Chunk contracts
    this.edgeContracts   = edgeContracts;
  }

  isLand()     { return this.terrain !== 'ocean' && this.terrain !== 'steep_shore'; }
  isPassable() { return TERRAIN_PROPS[this.terrain]?.passable ?? false; }
  moveCost()   { return TERRAIN_PROPS[this.terrain]?.moveCost ?? Infinity; }
  hasRiver()   { return this.riverClass !== 'none' || this.riverMask !== 0; }
}
