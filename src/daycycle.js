import * as THREE from 'three';

// One number drives the whole look: sun = 0 (night) .. 1 (high noon), the shader's uSun.
// The maths below mirrors sunDir() and the day / dusk / night blends in sky.glsl.js so the
// mesh lighting and fog always agree with what the sky shader draws.

// Sun value for each wave, repeating: afternoon, sinking, sunset on 4, night for the boss
// on 5, pre-dawn, dawn, morning.
const WAVE_SUN = [0.8, 0.62, 0.46, 0.3, 0.08, 0.14, 0.33, 0.6];

const SUN_INTENSITY = 3.0;
const MOON_INTENSITY = 0.9;
const HEMI_INTENSITY = 2.2;
const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.78).normalize(); // same as the shader's moon

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export class DayCycle {
  constructor({ scene, lights, uniforms, windowMat }) {
    this.scene = scene;
    this.lights = lights;
    this.uniforms = uniforms;
    this.windowMat = windowMat;
    this.sun = WAVE_SUN[0];
    this.target = this.sun;
    this.state = { day: 1, dusk: 0, night: 0 };
    this._dir = new THREE.Vector3();
    scene.add(lights.sun.target, lights.moon.target);
    lights.moon.position.copy(MOON_DIR).multiplyScalar(100);
    this.apply();
  }

  // Ease toward the sky for an upcoming wave.
  setWave(n) { this.target = WAVE_SUN[(Math.max(1, n) - 1) % WAVE_SUN.length]; }

  // Jump straight to a sun value (menu time-lapse, restart, debugging).
  set(u) { this.sun = this.target = clamp01(u); this.apply(); }

  update(dt) {
    const diff = this.target - this.sun;
    if (Math.abs(diff) > 1e-4) {
      const step = Math.max(0.012, Math.abs(diff) * 0.45) * dt;
      this.sun = Math.abs(diff) <= step ? this.target : this.sun + Math.sign(diff) * step;
      this.apply();
    }
  }

  apply() {
    const u = this.sun;
    this.uniforms.uSun.value = u;

    const e = mix(-0.36, 1.05, u);
    const sd = this._dir.set(0.18, Math.sin(e), -Math.cos(e)).normalize();
    const y = sd.y;
    const day = ss(-0.12, 0.32, y);
    const dusk = ss(-0.28, 0.02, y) * (1 - ss(0.02, 0.42, y));
    const night = 1 - ss(-0.3, 0.04, y);
    const up = ss(-0.16, 0.0, y);
    this.state.day = day; this.state.dusk = dusk; this.state.night = night;

    const sunCol = mix3([1.0, 0.33, 0.08], [1.0, 0.94, 0.84], ss(0.0, 0.4, y));
    let zen = mix3([0.008, 0.012, 0.035], [0.09, 0.26, 0.62], day);
    let hor = mix3([0.02, 0.03, 0.07], [0.6, 0.74, 0.92], day);
    zen = mix3(zen, [0.1, 0.1, 0.3], dusk * 0.7);
    // The shader's horizon tint depends on the view direction; fog and ambient use an average.
    const horDusk = mix3([0.55, 0.25, 0.35], [1.25, 0.48, 0.12], 0.3);
    hor = mix3(hor, horDusk, dusk * 0.85);

    const { sun, moon, hemi } = this.lights;

    // Sun: follows the shader's sun, but never shines from below a low grazing angle.
    sun.intensity = SUN_INTENSITY * up * mix(0.5, 1.0, day);
    sun.visible = sun.intensity > 0.01;
    sun.color.setRGB(sunCol[0], sunCol[1], sunCol[2]);
    const ly = Math.max(sd.y, 0.14);
    sun.position.set(sd.x, ly, sd.z).normalize().multiplyScalar(100);

    moon.intensity = MOON_INTENSITY * night;
    moon.visible = moon.intensity > 0.01;

    hemi.intensity = HEMI_INTENSITY;
    hemi.color.setRGB(
      zen[0] * 0.5 + hor[0] * 0.7 + 0.1 * night,
      zen[1] * 0.5 + hor[1] * 0.7 + 0.14 * night,
      zen[2] * 0.5 + hor[2] * 0.7 + 0.26 * night,
    );
    const g = 0.12 + 0.88 * day;
    hemi.groundColor.setRGB(
      0.3 * g + 0.22 * dusk + 0.03 * night,
      0.42 * g + 0.1 * dusk + 0.04 * night,
      0.16 * g + 0.05 * dusk + 0.07 * night,
    );

    this.scene.fog.color.setRGB(hor[0], hor[1], hor[2]);

    if (this.windowMat) {
      const glow = clamp01(night + dusk * 0.7);
      this.windowMat.color.setRGB(mix(0.03, 2.4, glow), mix(0.02, 1.5, glow), mix(0.012, 0.45, glow));
    }
  }
}
