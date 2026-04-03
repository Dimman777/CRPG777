// PlayerView — three-part body (legs / torso / head), each an independent
// octagonal prism with a dark facing indicator.
//
// Reads from PlayerState to position meshes.  No movement logic here.

import * as THREE from 'three';

const PLAYER_RADIUS  = 0.375;
const HEAD_RADIUS    = 0.24;
const LEG_H          = 0.75;
const TORSO_H        = 0.80;
const HEAD_H         = 0.45;

// Build an octagonal prism with a dark facing panel on the front face (+Z local).
function makeOctPrism(scene, radius, height, color) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1, false);
  geo.rotateY(Math.PI / 8);
  const mat  = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;

  const faceW    = 2 * Math.sin(Math.PI / 8) * radius;
  const faceDist = Math.cos(Math.PI / 8) * radius;
  const indGeo   = new THREE.BoxGeometry(faceW, height * 1.01, 0.04);
  const indMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const indicator = new THREE.Mesh(indGeo, indMat);
  indicator.position.set(0, 0, faceDist + 0.02);
  mesh.add(indicator);

  scene.add(mesh);
  return mesh;
}

function disposeMesh(scene, mesh) {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  for (const child of mesh.children) {
    child.geometry.dispose();
    child.material.dispose();
  }
}

export { LEG_H, TORSO_H, HEAD_H, makeOctPrism };

export class PlayerView {
  constructor(scene) {
    this._scene = scene;
    const C = 0xff8844; // orange
    this._legMesh   = makeOctPrism(scene, PLAYER_RADIUS, LEG_H,   C);
    this._torsoMesh = makeOctPrism(scene, PLAYER_RADIUS, TORSO_H, C);
    this._headMesh  = makeOctPrism(scene, HEAD_RADIUS,   HEAD_H,  C);
  }

  // Sync mesh positions/rotations to the current PlayerState.
  // Call once per frame after state.update().
  sync(state) {
    const baseY = state.worldY - (LEG_H + TORSO_H + HEAD_H) / 2;

    this._legMesh.position.set(  state.px, baseY + LEG_H * 0.5,                    state.py);
    this._torsoMesh.position.set(state.px, baseY + LEG_H + TORSO_H * 0.5,          state.py);
    this._headMesh.position.set( state.px, baseY + LEG_H + TORSO_H + HEAD_H * 0.5, state.py);

    const torsoAngle = state.legAngle + state.torsoOffset;
    const headAngle  = torsoAngle     + state.headOffset;
    this._legMesh.rotation.y   = state.legAngle;
    this._torsoMesh.rotation.y = torsoAngle;
    this._headMesh.rotation.y  = headAngle;
  }

  dispose() {
    disposeMesh(this._scene, this._legMesh);
    disposeMesh(this._scene, this._torsoMesh);
    disposeMesh(this._scene, this._headMesh);
  }
}
