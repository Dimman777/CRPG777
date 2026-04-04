import * as THREE from 'three';

export class SceneSetup {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this._addLights();
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    // The 3×3 chunk pool always occupies world x/z [-64, 128] because chunks are
    // repositioned so the centre chunk sits at world origin after every transition.
    // Pool midpoint is (32, 0, 32).  Light offset from midpoint keeps the same NW angle.
    dir.position.set(12, 40, 12);   // (32-20, 40, 32-20)
    dir.castShadow = true;
    dir.shadow.mapSize.width  = 2048;
    dir.shadow.mapSize.height = 2048;
    // ±96 centred on (32,32) covers exactly [-64, 128] — the full pool with no gaps.
    dir.shadow.camera.left   = -96;
    dir.shadow.camera.right  =  96;
    dir.shadow.camera.top    =  96;
    dir.shadow.camera.bottom = -96;
    dir.shadow.camera.near   = 1;
    dir.shadow.camera.far    = 200;
    dir.shadow.bias       =  0;
    dir.shadow.normalBias =  0.02;
    // Target must be added to the scene when its position is non-default.
    dir.target.position.set(32, 0, 32);
    this.scene.add(dir.target);
    this.scene.add(dir);
  }

  onResize(width, height) {
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }
}
