import * as THREE from 'three';

export class Rendering {
  constructor(sceneSetup) {
    this.sceneSetup        = sceneSetup;
    this.cameraController  = null;
    this.onUpdate          = null; // (dt: number) => void  — hooked by game systems
    this._clock            = new THREE.Clock();
  }

  start() {
    const { scene, renderer } = this.sceneSetup;

    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this._clock.getDelta();
      if (this.onUpdate) this.onUpdate(dt);
      if (this.cameraController) this.cameraController.update(dt);
      renderer.render(scene, this.cameraController?.camera ?? this.sceneSetup.camera);
    };

    loop();
  }
}
