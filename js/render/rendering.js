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

    const MAX_DT = 0.05; // 50ms cap — prevents huge jumps on frame hitches
    const loop = () => {
      requestAnimationFrame(loop);
      const rawDt = this._clock.getDelta();
      if (rawDt > 0.5) return; // tab was hidden — skip frame, don't teleport entities
      const dt = Math.min(rawDt, MAX_DT);
      if (this.onUpdate) this.onUpdate(dt);
      if (this.cameraController) this.cameraController.update(dt);
      renderer.render(scene, this.cameraController?.camera ?? this.sceneSetup.camera);
    };

    loop();
  }
}
