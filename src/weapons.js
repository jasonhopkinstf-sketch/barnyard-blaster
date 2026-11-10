import * as THREE from 'three';
import { pointInBox } from './collision.js';
import { sfx } from './audio.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const UP = new THREE.Vector3(0, 1, 0);

export class WeaponSystem {
  constructor(scene, camera, player, enemies, particles, hud, world) {
    Object.assign(this, { scene, camera, player, enemies, particles, hud, world });
    this.weapons = [
      { name: 'Egg Launcher', ammo: Infinity, maxAmmo: Infinity, rate: 0.15, auto: true, speed: 60, gravity: 3, damage: 20, radius: 0.22, colors: [0xfff8e6, 0xffd34d], count: 1, spread: 0.012, life: 2.5, geo: new THREE.SphereGeometry(0.22, 8, 6), scaleY: 1.3, sfx: 'egg' },
      { name: 'Corn Cannon', ammo: 18, maxAmmo: 40, rate: 0.7, auto: false, speed: 48, gravity: 6, damage: 10, radius: 0.14, colors: [0xffd23a], count: 9, spread: 0.13, life: 0.5, geo: new THREE.SphereGeometry(0.13, 6, 5), scaleY: 1, sfx: 'corn' },
      { name: 'Tomato Tosser', ammo: 6, maxAmmo: 14, rate: 0.9, auto: false, speed: 27, gravity: 20, damage: 55, radius: 0.35, colors: [0xe23b2e, 0xff6b5a, 0x7fbf3f], count: 1, spread: 0, life: 4, splash: 4.5, lob: 0.28, geo: new THREE.SphereGeometry(0.35, 10, 8), scaleY: 0.9, sfx: 'tomato' },
    ];
    this.initialAmmo = this.weapons.map((w) => w.ammo);
    this.current = 0;
    this.cooldown = 0;
    this.firing = false;
    this.projectiles = [];
    this.recoil = 0;
    this.enabled = false;
    this.buildViewModels();

    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.button !== 0 || !player.hasControl) return;
      this.firing = true;
      this.tryFire(true);
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.firing = false; });
    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0) this.select(i);
    });
    document.addEventListener('wheel', (e) => {
      if (!this.enabled || !player.hasControl) return;
      this.select((this.current + (e.deltaY > 0 ? 1 : 2)) % 3);
    }, { passive: true });
    this.select(0);
  }

  buildViewModels() {
    this.vm = new THREE.Group();
    this.vm.position.set(0.42, -0.36, -0.7);
    this.camera.add(this.vm);
    const models = [];

    // Egg launcher: a pipe on a wooden stock with an egg peeking out.
    const egg = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.6, 10), lam(0x7a7f87));
    tube.rotation.x = Math.PI / 2; tube.position.z = -0.25; egg.add(tube);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.45), lam(0x8a5a2b));
    stock.position.set(0, -0.1, 0.1); egg.add(stock);
    const eggm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam(0xfff8e6));
    eggm.scale.y = 1.3; eggm.position.z = -0.52; egg.add(eggm);
    models.push(egg);

    // Corn cannon: fat yellow barrel with a husk.
    const corn = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.7, 10), lam(0xffd23a));
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.25; corn.add(barrel);
    const husk = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8, 1, true), lam(0x6fcf5a));
    husk.rotation.x = -Math.PI / 2; husk.position.z = 0.08; corn.add(husk);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), lam(0x333333));
    muzzle.position.z = -0.6; corn.add(muzzle);
    models.push(corn);

    // Tomato tosser: a slingshot with a tomato loaded.
    const sling = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.35, 8), lam(0x8a5a2b));
    handle.position.set(0, -0.15, 0); sling.add(handle);
    for (const s of [-1, 1]) {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 8), lam(0x8a5a2b));
      prong.position.set(s * 0.1, 0.1, 0); prong.rotation.z = s * -0.6; sling.add(prong);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.02), lam(0x333333));
    band.position.set(0, 0.22, 0.05); sling.add(band);
    const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lam(0xe23b2e));
    tomato.position.set(0, 0.22, 0.08); sling.add(tomato);
    sling.rotation.x = -0.4;
    models.push(sling);

    for (const m of models) { m.traverse((o) => { if (o.isMesh) o.castShadow = false; }); this.vm.add(m); }
    this.models = models;
  }

  select(i) {
    this.current = i;
    this.models.forEach((m, j) => { m.visible = j === i; });
    this.hud.setWeapon(i, this.weapons[i]);
  }

  addAmmo(i, n) {
    const w = this.weapons[i];
    w.ammo = Math.min(w.maxAmmo, w.ammo + n);
    if (i === this.current) this.hud.setWeapon(i, w);
  }

  reset() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.weapons.forEach((w, i) => { w.ammo = this.initialAmmo[i]; });
    this.cooldown = 0;
    this.firing = false;
    this.select(0);
  }

  tryFire(fromClick) {
    const w = this.weapons[this.current];
    if (this.cooldown > 0) return;
    if (!w.auto && !fromClick) return;
    if (w.ammo <= 0) { if (fromClick) sfx.empty(); return; }
    if (w.ammo !== Infinity) w.ammo--;
    this.cooldown = w.rate;
    this.recoil = 1;
    sfx[w.sfx]();

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const origin = this.camera.position.clone().addScaledVector(dir, 0.6).addScaledVector(right, 0.25).addScaledVector(UP, -0.2);
    // Shots leave the muzzle (offset from the eye) but converge on the crosshair at mid range.
    const aimPoint = this.camera.position.clone().addScaledVector(dir, 35);
    const aimDir = aimPoint.sub(origin).normalize();
    for (let i = 0; i < w.count; i++) {
      const d = aimDir.clone();
      if (w.spread) {
        d.addScaledVector(right, (Math.random() - 0.5) * 2 * w.spread).addScaledVector(UP, (Math.random() - 0.5) * 2 * w.spread).normalize();
      }
      if (w.lob) d.y += w.lob;
      const mesh = new THREE.Mesh(w.geo, lam(w.colors[0]));
      mesh.scale.y = w.scaleY;
      mesh.castShadow = true;
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const speed = w.speed * (w.count > 1 ? 0.85 + Math.random() * 0.3 : 1);
      this.projectiles.push({ mesh, vel: d.multiplyScalar(speed), life: w.life, w });
    }
    this.hud.setWeapon(this.current, w);
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.firing) this.tryFire(false);

    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.vm.position.z = -0.7 + this.recoil * 0.14;
    this.vm.position.y = -0.36 + Math.sin(this.player.bob) * 0.012;
    this.vm.rotation.x = this.recoil * 0.3;

    const ps = this.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      p.vel.y -= p.w.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 9;
      const pos = p.mesh.position;

      let hitEnemy = null;
      for (const e of this.enemies.list) {
        const r = e.def.radius + p.w.radius;
        const ey = e.mesh.position.y + (e.def.fly ? 0 : e.def.radius * 0.8);
        const dx = pos.x - e.mesh.position.x, dy = pos.y - ey, dz = pos.z - e.mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < r * r) { hitEnemy = e; break; }
      }
      const hitGround = pos.y <= p.w.radius;
      const hitObstacle = pos.y < 9 && this.world.obstacles.some((b) => pointInBox(pos.x, pos.z, b));
      const out = p.life <= 0 || Math.abs(pos.x) > 120 || Math.abs(pos.z) > 120;
      if (hitEnemy || hitGround || hitObstacle || out) {
        if (!out || p.life <= 0) this.impact(p, hitEnemy);
        this.scene.remove(p.mesh);
        ps.splice(i, 1);
      }
    }
  }

  impact(p, hitEnemy) {
    const w = p.w, pos = p.mesh.position;
    if (!hitEnemy && pos.y < 0.8 && this.world.pond.contains(pos.x, pos.z)) {
      // landed in the pond: throw up some water
      this.particles.burst(pos, [0xbfe6ff, 0xffffff, 0x6fb7e8], w.splash ? 22 : 7, { speed: w.splash ? 8 : 5, size: 0.13, life: 0.7, spread: 0.5 });
      if (w.count === 1) sfx.splat();
      if (!w.splash) return;
    }
    if (w.splash) {
      pos.y = Math.max(pos.y, 0.3);
      this.particles.burst(pos, w.colors, 28, { speed: 9, size: 0.26, life: 0.9, spread: 1.2 });
      sfx.splat();
      for (const e of [...this.enemies.list]) {
        const d = e.mesh.position.distanceTo(pos);
        if (d < w.splash) this.enemies.damage(e, w.damage * (1 - 0.6 * (d / w.splash)));
      }
    } else {
      this.particles.burst(pos, w.colors, hitEnemy ? 8 : 4, { speed: 4, size: 0.12, life: 0.5 });
      if (hitEnemy) this.enemies.damage(hitEnemy, w.damage);
      else if (w.count === 1 && pos.y < 0.5) sfx.splat();
    }
  }
}
