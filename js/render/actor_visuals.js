import * as THREE from 'three';
import { tileToWorld } from './grid_visuals.js';

const FACTION_COLORS = { a: 0x4488cc, b: 0xcc4444 };

export class ActorVisuals {
  constructor(scene, gridWidth, gridHeight) {
    this.scene      = scene;
    this.gridWidth  = gridWidth;
    this.gridHeight = gridHeight;
    this._meshes    = new Map(); // id → mesh
  }

  // Sync all meshes to current combatant state.
  update(combatants, gridState, activeCombatant) {
    for (const c of combatants) {
      let mesh = this._meshes.get(c.id);
      if (!mesh) mesh = this._create(c);

      if (!c.isAlive()) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;

      const pos = gridState.getPosition(c.id);
      if (pos) {
        const wp = tileToWorld(pos.x, pos.y, this.gridWidth, this.gridHeight);
        mesh.position.set(wp.x, 0.5, wp.z);
      }

      // Pulse the active combatant with a yellow emissive tint
      const isActive = activeCombatant && c.id === activeCombatant.id;
      mesh.material.emissive.setHex(isActive ? 0x443300 : 0x000000);
    }
  }

  // Remove all meshes from the scene (call before starting a new encounter).
  reset() {
    for (const mesh of this._meshes.values()) this.scene.remove(mesh);
    this._meshes.clear();
  }

  _create(combatant) {
    const geo   = new THREE.BoxGeometry(0.55, 1.0, 0.55);
    const color = FACTION_COLORS[combatant.factionId] ?? 0x888888;
    const mat   = new THREE.MeshLambertMaterial({ color, emissive: 0x000000 });
    const mesh  = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
    this._meshes.set(combatant.id, mesh);
    return mesh;
  }
}
