import * as THREE from 'three';
import { resolveCircle } from './collision.js';
import { ARENA } from './world.js';
import { sfx } from './audio.js';

const EYE = 1.7, RADIUS = 0.6, SPEED = 9, SPRINT = 14, JUMP = 7.5, GRAVITY = 22;

export class Player {
  constructor(camera, canvas, world, hud) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.hud = hud;
    this.pos = new THREE.Vector3(0, 0, 32);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.onGround = true;
    this.maxHp = 100;
    this.hp = 100;
    this.bob = 0;
    this.wade = 0;
    this.hurtCooldown = 0;
    this.locked = false;
    this.lockFailed = false;
    this.enabled = false;
    this.onLockChange = null;
    camera.rotation.order = 'YXZ';

    document.addEventListener('mousemove', (e) => this.onMouse(e));
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (this.enabled && ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    window.addEventListener('blur', () => this.keys.clear());
    this.syncCamera();
  }

  // True when the mouse drives the game: pointer-locked, or pointer lock is unavailable
  // (embedded previews, some iframes) and we fall back to raw mouse deltas.
  get hasControl() { return this.locked || this.lockFailed; }

  lock() {
    if (document.pointerLockElement === this.canvas) return Promise.resolve(true);
    return new Promise((resolve) => {
      let p;
      try { p = this.canvas.requestPointerLock(); } catch (_) { p = Promise.reject(); }
      if (!p || !p.then) { resolve(true); return; }
      p.then(() => { this.lockFailed = false; resolve(true); }, () => { this.lockFailed = true; resolve(false); });
    });
  }

  onMouse(e) {
    if (!this.hasControl || !this.enabled) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.0022;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  }

  reset() {
    this.pos.set(0, 0, 32);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.hurtCooldown = 0;
    this.onGround = true;
    this.syncCamera();
    this.hud.setHP(this.hp, this.maxHp);
  }

  takeDamage(amt, dir) {
    if (this.hurtCooldown > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amt);
    this.hurtCooldown = 0.35;
    this.hud.setHP(this.hp, this.maxHp);
    this.hud.damageFlash();
    sfx.hurt();
    if (dir) { this.vel.x += dir.x * 7; this.vel.z += dir.z * 7; this.vel.y = Math.max(this.vel.y, 2.5); this.onGround = false; }
  }

  heal(amt) {
    this.hp = Math.min(this.maxHp, this.hp + amt);
    this.hud.setHP(this.hp, this.maxHp);
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    // Wading through the pond is slow going, and you sink in a little.
    const wading = this.onGround && this.world.pond.contains(this.pos.x, this.pos.z);
    this.wade += ((wading ? 1 : 0) - this.wade) * Math.min(1, dt * 8);
    const speed = ((k.has('ShiftLeft') || k.has('ShiftRight')) ? SPRINT : SPEED) * (wading ? 0.6 : 1);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = -sin * fwd + cos * str;
    let mz = -cos * fwd - sin * str;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const blend = 1 - Math.exp(-dt * (this.onGround ? 12 : 3));
    this.vel.x += (mx * speed - this.vel.x) * blend;
    this.vel.z += (mz * speed - this.vel.z) * blend;

    if (k.has('Space') && this.onGround) {
      this.vel.y = JUMP;
      this.onGround = false;
      sfx.jump();
    }
    this.vel.y -= GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }

    resolveCircle(this.pos, RADIUS, this.world.obstacles);
    this.pos.x = Math.max(-ARENA, Math.min(ARENA, this.pos.x));
    this.pos.z = Math.max(-ARENA, Math.min(ARENA, this.pos.z));

    const moving = len > 0 && this.onGround;
    if (moving) this.bob += dt * speed * 1.1;
    if (this.hurtCooldown > 0) this.hurtCooldown -= dt;
    this.syncCamera(moving);
  }

  syncCamera(moving = false) {
    const bobY = moving ? Math.sin(this.bob) * 0.05 : 0;
    this.camera.position.set(this.pos.x, this.pos.y + EYE + bobY - this.wade * 0.3, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
