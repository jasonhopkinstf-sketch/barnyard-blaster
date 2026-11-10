import * as THREE from 'three';

// Cheap particle bursts (little cubes) for splats, feathers and fur.
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
  }
  mat(color) {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshLambertMaterial({ color }); this.mats.set(color, m); }
    return m;
  }
  burst(pos, colors, count = 12, { speed = 6, size = 0.18, life = 0.8, gravity = 14, spread = 1 } = {}) {
    if (this.items.length > 500) return;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, this.mat(colors[i % colors.length]));
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      m.position.copy(pos);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2 * spread, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 2 * spread)
        .normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.scene.add(m);
      this.items.push({ m, v, life: life * (0.7 + Math.random() * 0.6), gravity, spin: (Math.random() - 0.5) * 12 });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) { this.scene.remove(it.m); this.items.splice(i, 1); continue; }
      it.v.y -= it.gravity * dt;
      it.m.position.addScaledVector(it.v, dt);
      if (it.m.position.y < 0.05) { it.m.position.y = 0.05; it.v.y *= -0.3; it.v.x *= 0.7; it.v.z *= 0.7; }
      it.m.rotation.x += it.spin * dt;
      it.m.rotation.y += it.spin * dt;
      if (it.life < 0.25) it.m.scale.multiplyScalar(0.9);
    }
  }
  clear() {
    for (const it of this.items) this.scene.remove(it.m);
    this.items = [];
  }
}
