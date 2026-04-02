import * as THREE from 'three';

// Convert logical tile coords to three.js world position.
export function tileToWorld(x, y, gridWidth, gridHeight) {
  return {
    x: x - (gridWidth  - 1) / 2,
    z: y - (gridHeight - 1) / 2,
  };
}

export class GridVisuals {
  constructor(scene, gridWidth, gridHeight) {
    this.scene      = scene;
    this.gridWidth  = gridWidth;
    this.gridHeight = gridHeight;
    this._tiles     = new Map(); // 'x,y' → mesh

    this._defaultColor  = 0x1e1e3a;
    this._activeColor   = 0x5555bb;
    this._factionColors = { a: 0x1a3a5c, b: 0x5c1a1a };

    this._build();
  }

  _build() {
    const geo = new THREE.PlaneGeometry(0.88, 0.88);
    geo.rotateX(-Math.PI / 2);

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        const mat  = new THREE.MeshLambertMaterial({ color: this._defaultColor });
        const mesh = new THREE.Mesh(geo, mat);
        const wp   = tileToWorld(x, y, this.gridWidth, this.gridHeight);
        mesh.position.set(wp.x, 0.01, wp.z);
        this.scene.add(mesh);
        this._tiles.set(`${x},${y}`, mesh);
      }
    }
  }

  // Recolour tiles to reflect current combatant positions.
  update(combatants, gridState, activeCombatant, playerCombatantId = null) {
    // Reset all to default
    for (const mesh of this._tiles.values()) {
      mesh.material.color.setHex(this._defaultColor);
    }

    for (const c of combatants) {
      if (!c.isAlive()) continue;
      const pos = gridState.getPosition(c.id);
      if (!pos) continue;
      const tile = this._tiles.get(`${pos.x},${pos.y}`);
      if (!tile) continue;

      const isActive   = activeCombatant && c.id === activeCombatant.id;
      const isPlayer   = c.id === playerCombatantId;
      const color = isActive
        ? (isPlayer ? 0x44bb44 : this._activeColor)
        : this._factionColors[c.factionId] ?? 0x333333;
      tile.material.color.setHex(color);
    }
  }
}
