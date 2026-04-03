import * as THREE from 'three';

// True isometric elevation: arctan(1/√2) ≈ 35.264°
// At this angle all three world axes project at equal apparent length.
const ELEVATION_DEG  = 35.264;
const AZIMUTH_SNAPS  = [45, 90, 135, 180, 225, 270, 315, 0]; // 8 positions × 45°
const CAMERA_DIST    = 40;   // units from target
const FRUSTUM_HALF   = 20;   // orthographic half-width in world units
const ROTATE_SPEED   = 270;  // degrees per second during snap animation

export class CameraController {
  constructor(width, height) {
    this._aspect       = width / height;
    this._frustumHalf  = FRUSTUM_HALF;
    this._snapIndex    = 0;
    this._currentAz    = AZIMUTH_SNAPS[0];
    this._targetAz     = AZIMUTH_SNAPS[0];
    this.target        = new THREE.Vector3(0, 0, 0);
    this._smoothY      = 0;   // smoothed camera Y — lerped toward target.y

    const h = FRUSTUM_HALF, a = this._aspect;
    this._camera = new THREE.OrthographicCamera(
      -h * a, h * a, h, -h, 0.1, 1000
    );
    this._updatePosition();
  }

  get camera()   { return this._camera;   }
  get azimuth()  { return this._currentAz; }

  // Q — rotate 45° counter-clockwise
  rotateLeft() {
    this._snapIndex = (this._snapIndex + 1) % 8;
    this._targetAz  = AZIMUTH_SNAPS[this._snapIndex];
  }

  // E — rotate 45° clockwise
  rotateRight() {
    this._snapIndex = (this._snapIndex + 7) % 8;
    this._targetAz  = AZIMUTH_SNAPS[this._snapIndex];
  }

  setTarget(x, y, z) {
    this.target.set(x, y, z);
  }

  // Snap smoothY to the current target (use on teleport / init to avoid drift).
  snapY() { this._smoothY = this.target.y; }

  // Zoom the orthographic viewport.  Default is FRUSTUM_HALF (20).
  // Smaller values zoom in; larger values zoom out.
  setFrustumHalf(h) {
    this._frustumHalf = h;
    const a = this._aspect;
    this._camera.left   = -h * a;
    this._camera.right  =  h * a;
    this._camera.top    =  h;
    this._camera.bottom = -h;
    this._camera.updateProjectionMatrix();
  }

  // Call once per frame with delta time in seconds.
  update(dt) {
    // Shortest-path interpolation toward target azimuth
    let diff = ((this._targetAz - this._currentAz + 540) % 360) - 180;
    if (Math.abs(diff) < 0.5) {
      this._currentAz = this._targetAz;
    } else {
      this._currentAz += Math.sign(diff) * Math.min(Math.abs(diff), ROTATE_SPEED * dt);
    }

    // Smooth vertical tracking — exponential chase toward target.y so micro-tile
    // elevation changes don't jitter the camera.  Using 1-exp(-k*dt) gives
    // frame-rate-independent smoothing.  k=16 closes ~93% of the gap in 1/6s.
    const yDiff = this.target.y - this._smoothY;
    if (Math.abs(yDiff) < 0.005) {
      this._smoothY = this.target.y;
    } else {
      this._smoothY += yDiff * (1 - Math.exp(-16 * dt));
    }

    this._updatePosition();
  }

  onResize(width, height) {
    this._aspect = width / height;
    const h = this._frustumHalf, a = this._aspect;
    this._camera.left   = -h * a;
    this._camera.right  =  h * a;
    this._camera.top    =  h;
    this._camera.bottom = -h;
    this._camera.updateProjectionMatrix();
  }

  _updatePosition() {
    const azRad = (this._currentAz  * Math.PI) / 180;
    const elRad = (ELEVATION_DEG    * Math.PI) / 180;
    const horiz = CAMERA_DIST * Math.cos(elRad);
    const vert  = CAMERA_DIST * Math.sin(elRad);

    const lookY = this._smoothY;
    this._camera.position.set(
      this.target.x + Math.sin(azRad) * horiz,
      lookY + vert,
      this.target.z + Math.cos(azRad) * horiz
    );
    this._camera.lookAt(this.target.x, lookY, this.target.z);
  }
}
