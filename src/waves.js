import * as THREE from 'three';
import { ARENA } from './world.js';
import { sfx } from './audio.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
function part(geo, color, x, y, z, parent) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const PICKUPS = {
  corn: {
    label: '+12 corn',
    build() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 10), 0xffd23a, 0, 0, 0, g);
      part(new THREE.ConeGeometry(0.3, 0.7, 8, 1, true), 0x6fcf5a, 0, -0.35, 0, g).rotation.x = Math.PI;
      return g;
    },
    apply(ctx) { ctx.weapons.addAmmo(1, 12); },
  },
  tomato: {
    label: '+4 tomatoes',
    build() {
      const g = new THREE.Group();
      part(new THREE.SphereGeometry(0.4, 10, 8), 0xe23b2e, 0, 0, 0, g).scale.y = 0.85;
      part(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 6), 0x3f8f3a, 0, 0.4, 0, g);
      return g;
    },
    apply(ctx) { ctx.weapons.addAmmo(2, 4); },
  },
  milk: {
    label: '+30 health',
    build() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 10), 0xf8f8f8, 0, 0, 0, g);
      part(new THREE.CylinderGeometry(0.12, 0.2, 0.2, 10), 0xf8f8f8, 0, 0.45, 0, g);
      part(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), 0x4fa3e0, 0, 0.6, 0, g);
      return g;
    },
    apply(ctx) { ctx.player.heal(30); },
  },
};

export class WaveManager {
  constructor(scene, enemies, player, weapons, hud, hooks) {
    Object.assign(this, { scene, enemies, player, weapons, hud, hooks });
    this.wave = 0;
    this.state = 'idle';
    this.queue = [];
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.interval = 1;
    this.pickups = [];
  }

  compose(n) {
    const q = [];
    const add = (t, c) => { for (let i = 0; i < c; i++) q.push(t); };
    add('crow', 3 + n * 2);
    if (n >= 2) add('rabbit', 1 + n);
    if (n >= 3) add('raccoon', n - 2);
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    if (n % 5 === 0) {
      const boars = n / 5;
      const at = Math.floor(q.length / 3);
      for (let i = 0; i < boars; i++) q.splice(at + i * 3, 0, 'boar');
    }
    return q;
  }

  begin() {
    this.wave = 0;
    this.state = 'break';
    this.breakTimer = 4;
    this.hud.setWave(1);
    this.hud.banner('Protect the crops!', 3000);
  }

  nextWave() {
    this.wave++;
    this.queue = this.compose(this.wave);
    this.interval = Math.max(0.3, 1.3 - this.wave * 0.07);
    this.spawnTimer = 0.8;
    this.state = 'active';
    this.hud.setWave(this.wave);
    const boss = this.wave % 5 === 0;
    this.hud.banner(boss ? `WAVE ${this.wave} — BOSS BOAR!` : `WAVE ${this.wave}`, 2500, boss ? 'boss' : '');
    sfx.wave();
  }

  update(dt) {
    this.updatePickups(dt);
    if (this.state === 'active') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.queue.length) {
        this.enemies.spawn(this.queue.shift());
        this.spawnTimer = this.interval;
      }
      this.hud.setEnemiesLeft(this.queue.length + this.enemies.count);
      if (!this.queue.length && this.enemies.count === 0) {
        this.state = 'break';
        this.breakTimer = 8;
        const bonus = this.wave * 200;
        this.hooks.onWaveClear(this.wave, bonus);
        this.hud.banner(`Wave ${this.wave} cleared! +${bonus}`, 2500, 'good');
        sfx.clear();
        const a = Math.random() * Math.PI * 2;
        this.spawnPickup('milk', new THREE.Vector3(this.player.pos.x + Math.cos(a) * 8, 0, this.player.pos.z + Math.sin(a) * 8));
        this.spawnPickup(Math.random() < 0.5 ? 'corn' : 'tomato', new THREE.Vector3(this.player.pos.x - Math.cos(a) * 8, 0, this.player.pos.z - Math.sin(a) * 8));
      }
    } else if (this.state === 'break') {
      this.breakTimer -= dt;
      for (const c of this.hooks.crops) {
        if (c.alive && c.hp < c.maxHp) { c.hp = Math.min(c.maxHp, c.hp + 4 * dt); c.dirty = true; }
      }
      if (this.breakTimer <= 0) this.nextWave();
    }
  }

  dropAt(pos) {
    const r = Math.random();
    this.spawnPickup(r < 0.45 ? 'corn' : r < 0.75 ? 'tomato' : 'milk', pos);
  }

  spawnPickup(kind, pos) {
    const def = PICKUPS[kind];
    const mesh = def.build();
    mesh.position.set(Math.max(-ARENA + 2, Math.min(ARENA - 2, pos.x)), 0.8, Math.max(-ARENA + 2, Math.min(ARENA - 2, pos.z)));
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, def, life: 30, t: Math.random() * 6 });
  }

  updatePickups(dt) {
    const p = this.player.pos;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.t += dt;
      it.life -= dt;
      it.mesh.rotation.y += dt * 2;
      it.mesh.position.y = 0.8 + Math.sin(it.t * 3) * 0.15;
      it.mesh.visible = it.life > 5 || Math.floor(it.life * 6) % 2 === 0;
      const d = Math.hypot(it.mesh.position.x - p.x, it.mesh.position.z - p.z);
      if (d < 1.7 && p.y < 2) {
        it.def.apply(this);
        this.hud.banner(it.def.label, 1200, 'pickup');
        sfx.pickup();
        this.scene.remove(it.mesh);
        this.pickups.splice(i, 1);
      } else if (it.life <= 0) {
        this.scene.remove(it.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  reset() {
    for (const it of this.pickups) this.scene.remove(it.mesh);
    this.pickups = [];
    this.enemies.clear();
    this.wave = 0;
    this.queue = [];
    this.state = 'idle';
    this.hud.setEnemiesLeft(0);
  }
}
