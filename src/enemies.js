import * as THREE from 'three';
import { resolveCircle } from './collision.js';
import { SPAWN_R } from './world.js';
import { sfx } from './audio.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
function part(geo, color, x, y, z, parent) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// Unlit part: stays bright whatever the lighting, so eyes shine in the dark.
function glow(geo, color, x, y, z, parent) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export const TYPES = {
  // dmgCrop is per second while nibbling; dmgPlayer is per bite.
  crow:    { name: 'Crow',    hp: 30,  speed: 8.5, radius: 0.7,  score: 100,  dmgCrop: 1.5, dmgPlayer: 6,  reach: 1.6, fly: 2.4, targets: 'crop',   drop: 0.18, colors: [0x1b1b22, 0x444450, 0xffffff] },
  rabbit:  { name: 'Rabbit',  hp: 22,  speed: 10,  radius: 0.55, score: 80,   dmgCrop: 2.5, dmgPlayer: 4,  reach: 1.3, fly: 0,   targets: 'crop',   drop: 0.22, colors: [0xe8e8e8, 0xbdbdbd, 0xffc0cb] },
  raccoon: { name: 'Raccoon', hp: 75,  speed: 5.5, radius: 0.85, score: 160,  dmgCrop: 4,   dmgPlayer: 12, reach: 1.8, fly: 0,   targets: 'mixed',  drop: 0.4,  colors: [0x8a8a8a, 0x333333, 0xdddddd] },
  boar:    { name: 'Boar',    hp: 500, speed: 6.5, radius: 1.5,  score: 1000, dmgCrop: 10,  dmgPlayer: 25, reach: 2.4, fly: 0,   targets: 'player', drop: 1,    colors: [0x6b4a2f, 0x4a3320, 0xffffff] },
};

const BUILDERS = {
  crow() {
    const g = new THREE.Group(), parts = {};
    part(new THREE.SphereGeometry(0.45, 10, 8), 0x1b1b22, 0, 0, 0, g).scale.set(1, 0.8, 1.5);
    part(new THREE.SphereGeometry(0.28, 8, 6), 0x1b1b22, 0, 0.3, 0.6, g);
    part(new THREE.ConeGeometry(0.1, 0.45, 6), 0xf0a020, 0, 0.28, 0.95, g).rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.3, 0.05, 0.6), 0x1b1b22, 0, 0.05, -0.75, g);
    for (const s of [-1, 1]) {
      glow(new THREE.SphereGeometry(0.07, 6, 4), 0xfff2a8, s * 0.15, 0.38, 0.78, g);
      part(new THREE.SphereGeometry(0.035, 6, 4), 0x000000, s * 0.17, 0.39, 0.84, g);
      const wing = new THREE.Group();
      wing.position.set(s * 0.3, 0.15, 0);
      g.add(wing);
      part(new THREE.BoxGeometry(1.2, 0.06, 0.65), 0x26262e, s * 0.6, 0, 0, wing);
      parts[s < 0 ? 'wingL' : 'wingR'] = wing;
    }
    return { g, parts };
  },
  rabbit() {
    const g = new THREE.Group(), parts = {};
    part(new THREE.SphereGeometry(0.42, 10, 8), 0xe8e8e8, 0, 0.42, 0, g).scale.set(1, 0.9, 1.3);
    part(new THREE.SphereGeometry(0.3, 8, 6), 0xe8e8e8, 0, 0.8, 0.45, g);
    part(new THREE.SphereGeometry(0.16, 6, 5), 0xffffff, 0, 0.5, -0.55, g);
    for (const s of [-1, 1]) {
      part(new THREE.BoxGeometry(0.16, 0.65, 0.08), 0xe8e8e8, s * 0.13, 1.3, 0.4, g).rotation.z = s * -0.15;
      part(new THREE.BoxGeometry(0.08, 0.45, 0.04), 0xffb6c1, s * 0.13, 1.3, 0.44, g).rotation.z = s * -0.15;
      glow(new THREE.SphereGeometry(0.06, 6, 4), 0xff3b3b, s * 0.15, 0.88, 0.7, g);
    }
    part(new THREE.SphereGeometry(0.06, 6, 4), 0xffb6c1, 0, 0.75, 0.75, g);
    parts.body = g;
    return { g, parts };
  },
  raccoon() {
    const g = new THREE.Group(), parts = {};
    part(new THREE.SphereGeometry(0.55, 10, 8), 0x8a8a8a, 0, 0.55, 0, g).scale.set(1, 0.8, 1.5);
    part(new THREE.SphereGeometry(0.35, 8, 6), 0x9a9a9a, 0, 0.85, 0.7, g);
    part(new THREE.BoxGeometry(0.62, 0.18, 0.3), 0x333333, 0, 0.9, 0.9, g);
    part(new THREE.SphereGeometry(0.1, 6, 4), 0x111111, 0, 0.8, 1.04, g);
    for (const s of [-1, 1]) {
      part(new THREE.ConeGeometry(0.12, 0.25, 4), 0x8a8a8a, s * 0.22, 1.15, 0.6, g);
      glow(new THREE.SphereGeometry(0.05, 6, 4), 0xc8ffb0, s * 0.15, 0.92, 1.03, g);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.6, -0.8);
    tail.rotation.x = -0.8;
    g.add(tail);
    for (let i = 0; i < 4; i++) part(new THREE.CylinderGeometry(0.16, 0.14, 0.22, 8), i % 2 ? 0x333333 : 0x9a9a9a, 0, -0.1 - i * 0.22, 0, tail);
    parts.tail = tail;
    return { g, parts };
  },
  boar() {
    const g = new THREE.Group(), parts = {};
    part(new THREE.SphereGeometry(1.0, 12, 9), 0x6b4a2f, 0, 1.0, 0, g).scale.set(1, 0.9, 1.6);
    part(new THREE.SphereGeometry(0.65, 10, 8), 0x5e3f27, 0, 1.0, 1.5, g);
    part(new THREE.CylinderGeometry(0.3, 0.35, 0.4, 10), 0xd9a3a3, 0, 0.85, 2.15, g).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      part(new THREE.ConeGeometry(0.08, 0.5, 6), 0xffffff, s * 0.3, 0.7, 2.0, g).rotation.x = -0.9;
      glow(new THREE.SphereGeometry(0.08, 6, 4), 0xff2222, s * 0.3, 1.25, 1.95, g);
      part(new THREE.ConeGeometry(0.18, 0.4, 4), 0x5e3f27, s * 0.4, 1.6, 1.3, g);
      for (const f of [-1, 1]) part(new THREE.CylinderGeometry(0.16, 0.14, 0.8, 7), 0x4a3320, s * 0.5, 0.35, f * 0.9, g);
    }
    part(new THREE.BoxGeometry(0.5, 0.35, 1.4), 0x4a3320, 0, 1.75, -0.2, g);
    return { g, parts };
  },
};

class Enemy {
  constructor(type, pos) {
    this.type = type;
    this.def = TYPES[type];
    const built = BUILDERS[type]();
    this.mesh = built.g;
    this.parts = built.parts;
    this.mesh.position.copy(pos);
    this.mesh.position.y = this.def.fly;
    this.hp = this.def.hp;
    this.target = null;
    this.retarget = 0;
    this.attackCd = 0.5 + Math.random();
    this.flash = 0;
    this.t = Math.random() * 10;
    this.dead = false;
    this.moving = true;
    this.lunge = 0;
    this.cropSfx = 0;
    this.charge = 0;
    this.chargeCd = 2;
    this.stun = 0;
    this.chargeDir = new THREE.Vector3();
    this.mats = [];
    this.mesh.traverse((o) => { if (o.isMesh) this.mats.push(o.material); });
  }
  setEmissive(hex) { for (const m of this.mats) if (m.emissive) m.emissive.setHex(hex); }
}

export class EnemyManager {
  constructor(scene, world, player, particles, hooks) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.particles = particles;
    this.hooks = hooks;
    this.list = [];
    this._dir = new THREE.Vector3();
  }
  get count() { return this.list.length; }

  spawn(type) {
    const a = Math.random() * Math.PI * 2;
    const e = new Enemy(type, new THREE.Vector3(Math.cos(a) * SPAWN_R, 0, Math.sin(a) * SPAWN_R));
    this.scene.add(e.mesh);
    this.list.push(e);
    if (type === 'boar') sfx.boar();
    return e;
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.mesh);
    this.list = [];
  }

  damage(e, amt) {
    if (e.dead) return;
    e.hp -= amt;
    e.flash = 0.1;
    e.setEmissive(0xff4444);
    sfx.hit();
    if (this.hooks.onHit) this.hooks.onHit(e);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    this.scene.remove(e.mesh);
    const p = e.mesh.position.clone();
    p.y += 0.5;
    this.particles.burst(p, e.def.colors, e.type === 'boar' ? 40 : 16, { speed: e.type === 'boar' ? 10 : 6, size: e.type === 'boar' ? 0.3 : 0.16, life: 1 });
    if (e.type === 'crow') sfx.squawk(); else if (e.type === 'boar') sfx.boar(); else sfx.pop();
    this.hooks.onKill(e);
    if (Math.random() < e.def.drop) this.hooks.onDrop(e.mesh.position.clone());
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  pickTarget(e) {
    const live = this.world.crops.filter((c) => c.alive);
    const p = this.player.pos;
    const dp = Math.hypot(p.x - e.mesh.position.x, p.z - e.mesh.position.z);
    if (e.def.targets === 'player' || live.length === 0 || (e.def.targets === 'mixed' && dp < 14)) return { kind: 'player' };
    let best = null, bd = Infinity;
    for (const c of live) {
      const d = Math.hypot(c.x - e.mesh.position.x, c.z - e.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return { kind: 'crop', crop: best };
  }

  update(dt) {
    const p = this.player.pos;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.dead) continue;
      const d = e.def, m = e.mesh;
      e.t += dt;
      if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) e.setEmissive(0x000000); }

      e.retarget -= dt;
      if (e.retarget <= 0 || !e.target || (e.target.kind === 'crop' && !e.target.crop.alive)) {
        e.target = this.pickTarget(e);
        e.retarget = 0.6;
      }
      const tgt = e.target;
      const tx = tgt.kind === 'player' ? p.x : tgt.crop.x;
      const tz = tgt.kind === 'player' ? p.z : tgt.crop.z;
      const stopDist = tgt.kind === 'player' ? d.reach + 0.6 : tgt.crop.radius;
      const dx = tx - m.position.x, dz = tz - m.position.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      const nx = dx / dist, nz = dz / dist;
      // ground critters wade slowly through the pond; crows fly over it
      const speed = d.speed * (!d.fly && this.world.pond.contains(m.position.x, m.position.z) ? 0.6 : 1);

      if (e.stun > 0) {
        e.stun -= dt;
        e.moving = false;
        m.rotation.y += dt * 6;
      } else if (e.type === 'boar' && e.charge > 0) {
        e.charge -= dt;
        m.position.x += e.chargeDir.x * speed * 2.4 * dt;
        m.position.z += e.chargeDir.z * speed * 2.4 * dt;
        m.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z);
        e.moving = true;
        if (tgt.kind === 'player' && dist < d.reach + 0.8) {
          this.player.takeDamage(d.dmgPlayer, this._dir.set(nx, 0, nz));
          e.charge = 0;
          e.stun = 1.0;
          e.chargeCd = 3;
        } else if (e.charge <= 0) {
          e.stun = 0.7;
          e.chargeCd = 3;
        }
      } else if (dist > stopDist) {
        e.moving = true;
        m.position.x += nx * speed * dt;
        m.position.z += nz * speed * dt;
        m.rotation.y = Math.atan2(nx, nz);
        if (e.type === 'boar') {
          e.chargeCd -= dt;
          if (tgt.kind === 'player' && dist < 16 && e.chargeCd <= 0) {
            e.charge = 1.1;
            e.chargeDir.set(nx, 0, nz);
            sfx.boar();
          }
        }
      } else {
        e.moving = false;
        m.rotation.y = Math.atan2(nx, nz);
        if (tgt.kind === 'crop') {
          const destroyed = tgt.crop.damage(d.dmgCrop * dt);
          e.cropSfx -= dt;
          if (e.cropSfx <= 0) { sfx.cropHurt(); e.cropSfx = 0.6; }
          if (destroyed) this.hooks.onCropDestroyed(tgt.crop);
        } else {
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            e.attackCd = 1.1;
            e.lunge = 0.25;
            this.player.takeDamage(d.dmgPlayer, this._dir.set(nx, 0, nz));
          }
        }
      }

      if (!d.fly) resolveCircle(m.position, d.radius, this.world.obstacles);

      // keep critters from stacking on one another
      for (let j = i - 1; j >= 0; j--) {
        const o = list[j];
        if (o.dead || !!o.def.fly !== !!d.fly) continue;
        const ox = m.position.x - o.mesh.position.x, oz = m.position.z - o.mesh.position.z;
        const od = Math.hypot(ox, oz), minD = (d.radius + o.def.radius) * 0.9;
        if (od > 0.001 && od < minD) {
          const push = (minD - od) * 0.5;
          m.position.x += (ox / od) * push; m.position.z += (oz / od) * push;
          o.mesh.position.x -= (ox / od) * push; o.mesh.position.z -= (oz / od) * push;
        }
      }

      this.animate(e, dt);
    }
  }

  animate(e, dt) {
    const m = e.mesh, t = e.t;
    if (e.lunge > 0) e.lunge -= dt;
    const lungeK = e.lunge > 0 ? 1 + e.lunge * 1.2 : 1;
    m.scale.set(1, 1, lungeK);
    switch (e.type) {
      case 'crow':
        m.position.y = e.def.fly + Math.sin(t * 3) * 0.3 + (e.moving ? 0 : -1.4);
        e.parts.wingL.rotation.z = Math.sin(t * 14) * 0.7;
        e.parts.wingR.rotation.z = -Math.sin(t * 14) * 0.7;
        break;
      case 'rabbit':
        m.position.y = e.moving ? Math.abs(Math.sin(t * 7)) * 0.55 : Math.abs(Math.sin(t * 2)) * 0.05;
        m.rotation.x = e.moving ? -Math.sin(t * 7) * 0.2 : 0;
        break;
      case 'raccoon':
        m.rotation.z = e.moving ? Math.sin(t * 8) * 0.08 : 0;
        e.parts.tail.rotation.z = Math.sin(t * 4) * 0.4;
        break;
      case 'boar':
        m.position.y = e.moving ? Math.abs(Math.sin(t * 10)) * 0.12 : 0;
        m.rotation.z = e.charge > 0 ? Math.sin(t * 30) * 0.05 : 0;
        break;
    }
  }
}
