// FollowerVisuals — three-part octagonal prism bodies (legs / torso / head) for
// party followers, each part with an independent facing indicator.
// Chatting followers display a "BANTER!" sprite; wandering followers display
// short quip sprites.

import * as THREE from 'three';

// ── Follower body dimensions ───────────────────────────────────────────────────

const FL_RADIUS  = 0.30;   // leg & torso radius
const FH_RADIUS  = 0.20;   // head radius (noticeably smaller)
const FL_LEG_H   = 0.65;
const FL_TORSO_H = 0.75;
const FL_HEAD_H  = 0.40;
const FOLLOWER_HEIGHT = FL_LEG_H + FL_TORSO_H + FL_HEAD_H; // 1.80

// ── Shared "BANTER!" texture ───────────────────────────────────────────────────

function makeBanterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width  = 160;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 160, 40, 7);
  ctx.fill();
  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BANTER!', 80, 21);
  return new THREE.CanvasTexture(canvas);
}

let _banterTex = null;
function sharedBanterTex() {
  if (!_banterTex) _banterTex = makeBanterTexture();
  return _banterTex;
}

// ── Per-follower quip sprite (dynamic text) ────────────────────────────────────

function makeQuipTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width  = 200;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 200, 40, 7);
  ctx.fill();
  ctx.fillStyle = '#aaddff';
  ctx.font = 'italic 17px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 100, 21);
  return new THREE.CanvasTexture(canvas);
}

// ── Octagonal prism builder (local copy — render layer must not import from micro) ──

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

// ─────────────────────────────────────────────────────────────────────────────

export class FollowerVisuals {
  constructor(scene) {
    this._scene   = scene;
    // id → { legMesh, torsoMesh, headMesh, banter, quip, quipTex, quipLastText }
    this._visuals = new Map();
  }

  // Sync mesh count, positions, rotations, and sprites to the current follower list.
  // chunkRenderer may be null during the first frame.
  sync(followers, chunkRenderer) {
    const seen = new Set();

    for (const f of followers) {
      seen.add(f.id);
      let vis = this._visuals.get(f.id);
      if (!vis) vis = this._create(f);

      const baseY = chunkRenderer ? chunkRenderer.elevationAt(f.px, f.py) : 0;

      // Position each part at its absolute world height
      vis.legMesh.position.set(  f.px, baseY + FL_LEG_H * 0.5,                              f.py);
      vis.torsoMesh.position.set(f.px, baseY + FL_LEG_H + FL_TORSO_H * 0.5,                 f.py);
      vis.headMesh.position.set( f.px, baseY + FL_LEG_H + FL_TORSO_H + FL_HEAD_H * 0.5,     f.py);

      // Independent facings: legs follow movement, torso/head turn toward conversation
      const legAngle   = f.legAngle   ?? 0;
      const torsoAngle = legAngle     + (f.torsoOffset ?? 0);
      const headAngle  = torsoAngle   + (f.headOffset  ?? 0);
      vis.legMesh.rotation.y   = legAngle;
      vis.torsoMesh.rotation.y = torsoAngle;
      vis.headMesh.rotation.y  = headAngle;

      // BANTER! sprite floats above the head
      vis.banter.visible = f.showBanter;
      if (f.showBanter) {
        vis.banter.position.set(f.px, baseY + FOLLOWER_HEIGHT + 0.5, f.py);
      }

      // Quip sprite (What's that? / Interesting.)
      vis.quip.visible = f.showQuip;
      if (f.showQuip) {
        if (f.quipText !== vis.quipLastText) {
          vis.quipTex.dispose();
          vis.quipTex = makeQuipTexture(f.quipText);
          vis.quip.material.map = vis.quipTex;
          vis.quip.material.needsUpdate = true;
          vis.quipLastText = f.quipText;
        }
        vis.quip.position.set(f.px, baseY + FOLLOWER_HEIGHT + 1.1, f.py);
      }
    }

    // Remove visuals for followers that were removed
    for (const [id, vis] of this._visuals) {
      if (!seen.has(id)) {
        this._removeVis(vis);
        this._visuals.delete(id);
      }
    }
  }

  // Remove everything (call before disposing the scene).
  dispose() {
    for (const vis of this._visuals.values()) this._removeVis(vis);
    this._visuals.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _create(follower) {
    const C = follower.color;
    const legMesh   = makeOctPrism(this._scene, FL_RADIUS, FL_LEG_H,   C);
    const torsoMesh = makeOctPrism(this._scene, FL_RADIUS, FL_TORSO_H, C);
    const headMesh  = makeOctPrism(this._scene, FH_RADIUS, FL_HEAD_H,  C);

    // BANTER! sprite (shared texture, per-instance sprite)
    const banterMat = new THREE.SpriteMaterial({ map: sharedBanterTex(), depthTest: false });
    const banter    = new THREE.Sprite(banterMat);
    banter.scale.set(2.2, 0.55, 1);
    banter.visible  = false;
    this._scene.add(banter);

    // Quip sprite (dynamic text, unique texture per follower)
    const quipTex = makeQuipTexture('');
    const quipMat = new THREE.SpriteMaterial({ map: quipTex, depthTest: false });
    const quip    = new THREE.Sprite(quipMat);
    quip.scale.set(2.6, 0.55, 1);
    quip.visible  = false;
    this._scene.add(quip);

    const vis = { legMesh, torsoMesh, headMesh, banter, quip, quipTex, quipLastText: '' };
    this._visuals.set(follower.id, vis);
    return vis;
  }

  _removeVis(vis) {
    disposeMesh(this._scene, vis.legMesh);
    disposeMesh(this._scene, vis.torsoMesh);
    disposeMesh(this._scene, vis.headMesh);
    this._scene.remove(vis.banter);
    this._scene.remove(vis.quip);
    vis.quipTex.dispose();
  }
}
