import * as THREE from 'three';
import { resolveCircle } from './collision.js';
import { ARENA } from './world.js';
import { sfx } from './audio.js';

const EYE = 1.7, RADIUS = 0.6, SPEED = 9, SPRINT = 14, JUMP = 7.5, GRAVITY = 22;
const MOUSE_SENS = 0.0026;  // radians per pixel of pointer movement
const SWIPE_SENS = 0.0034;  // radians per pixel of two-finger trackpad scroll
const TURN_RATE = 2.8;      // radians per second when turning with keys
const LOOK_RATE = 1.5;      // radians per second when looking up / down with keys
const EDGE_ZONE = 0.12;     // fraction of the window width that acts as a turn zone (no pointer lock)
const EDGE_RATE = 2.6;
const VIEW_SMOOTH = 28;     // how quickly the camera eases to the aim; higher is snappier
const PITCH_LIMIT = 1.5;
const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyR', 'Enter',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Minus', 'Equal']);

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (_) { return fallback; } },
  set(key, v) { try { localStorage.setItem(key, String(v)); } catch (_) { /* private mode */ } },
};

export class Player {
  constructor(camera, canvas, world, hud) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.hud = hud;
    this.pos = new THREE.Vector3(0, 0, 32);
    this.vel = new THREE.Vector3();
    // yaw / pitch are where the player is aiming; viewYaw / viewPitch are what the camera
    // shows, eased toward the aim so coarse trackpad input still turns smoothly.
    this.yaw = 0;
    this.pitch = 0;
    this.viewYaw = 0;
    this.viewPitch = 0;
    this.turnVel = 0;
    this.lookVel = 0;
    this.sens = Math.max(0.4, Math.min(3, Number(store.get('barnyard-sens', 1)) || 1));
    this.swipeInvert = store.get('barnyard-swipe-invert', '0') === '1';
    this.cursorX = 0.5; // pointer position across the window, 0..1 (used when there is no pointer lock)
    this.lastPadWheel = -1e9;
    this.lastNotch = -1e9;
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
    this.onWheelNotch = null; // (direction) => void, for a real mouse wheel
    camera.rotation.order = 'YXZ';

    document.addEventListener('mousemove', (e) => this.onMouse(e));
    document.documentElement.addEventListener('mouseleave', () => { this.cursorX = 0.5; });
    document.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Minus' || e.code === 'Equal') this.adjustSensitivity(e.code === 'Equal' ? 1 : -1);
      if (e.code === 'KeyI') {
        this.swipeInvert = !this.swipeInvert;
        store.set('barnyard-swipe-invert', this.swipeInvert ? 1 : 0);
        hud.banner(`Two-finger look: ${this.swipeInvert ? 'inverted' : 'normal'}`, 1400, 'pickup');
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.cursorX = 0.5; });
    this.syncCamera();
  }

  // True when the pointer drives the game: pointer-locked, or pointer lock is unavailable
  // (embedded previews, some iframes) and we fall back to raw pointer deltas plus edge turning.
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

  adjustSensitivity(dir) {
    this.sens = Math.max(0.4, Math.min(3, Math.round((this.sens + dir * 0.2) * 10) / 10));
    store.set('barnyard-sens', this.sens);
    this.hud.banner(`Look sensitivity ${Math.round(this.sens * 100)}%`, 1200, 'pickup');
  }

  aim(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + dPitch));
  }

  onMouse(e) {
    this.cursorX = e.clientX / Math.max(1, window.innerWidth);
    if (!this.hasControl || !this.enabled) return;
    this.aim(-e.movementX * MOUSE_SENS * this.sens, -e.movementY * MOUSE_SENS * this.sens);
  }

  // A trackpad's two-finger scroll looks around; a real mouse wheel still cycles weapons.
  onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault(); // no page scroll or pinch-zoom while playing
    if (!this.hasControl || e.ctrlKey) return;
    const now = performance.now();
    const isNotch = e.deltaMode !== 0
      || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 100 && now - this.lastPadWheel > 400);
    if (isNotch) {
      if (now - this.lastNotch > 120 && this.onWheelNotch) { this.lastNotch = now; this.onWheelNotch(Math.sign(e.deltaY)); }
      return;
    }
    this.lastPadWheel = now;
    // Default: fingers left turns left, fingers up looks up (with Windows' standard scroll direction).
    const s = (this.swipeInvert ? -1 : 1) * SWIPE_SENS * this.sens;
    const clamp = (v) => Math.max(-120, Math.min(120, v));
    this.aim(clamp(e.deltaX) * s, clamp(e.deltaY) * s);
  }

  reset() {
    this.pos.set(0, 0, 32);
    this.vel.set(0, 0, 0);
    this.yaw = this.viewYaw = 0;
    this.pitch = this.viewPitch = 0;
    this.turnVel = this.lookVel = 0;
    this.wade = 0;
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

  updateLook(dt) {
    const k = this.keys;
    // Keyboard turning: arrows or Q / E, eased in and out so it does not jerk.
    const turn = (k.has('ArrowLeft') || k.has('KeyQ') ? 1 : 0) - (k.has('ArrowRight') || k.has('KeyE') ? 1 : 0);
    const look = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0);
    const ease = 1 - Math.exp(-dt * 14);
    this.turnVel += (turn * TURN_RATE - this.turnVel) * ease;
    this.lookVel += (look * LOOK_RATE - this.lookVel) * ease;
    let dYaw = this.turnVel * dt;

    // Without pointer lock the cursor stops at the window edge, so the edges become turn
    // zones: rest the pointer there and you keep turning, all the way round.
    if (this.lockFailed && !this.locked) {
      const x = this.cursorX;
      if (x < EDGE_ZONE) dYaw += ((EDGE_ZONE - x) / EDGE_ZONE) * EDGE_RATE * dt;
      else if (x > 1 - EDGE_ZONE) dYaw -= ((x - (1 - EDGE_ZONE)) / EDGE_ZONE) * EDGE_RATE * dt;
    }
    this.aim(dYaw, this.lookVel * dt);

    const follow = 1 - Math.exp(-dt * VIEW_SMOOTH);
    this.viewYaw += (this.yaw - this.viewYaw) * follow;
    this.viewPitch += (this.pitch - this.viewPitch) * follow;
  }

  update(dt) {
    if (!this.enabled) return;
    this.updateLook(dt);
    const k = this.keys;
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    // Wading through the pond is slow going, and you sink in a little.
    const wading = this.onGround && this.world.pond.contains(this.pos.x, this.pos.z);
    this.wade += ((wading ? 1 : 0) - this.wade) * Math.min(1, dt * 8);
    const speed = ((k.has('ShiftLeft') || k.has('ShiftRight')) ? SPRINT : SPEED) * (wading ? 0.6 : 1);
    const sin = Math.sin(this.viewYaw), cos = Math.cos(this.viewYaw);
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
    this.camera.rotation.set(this.viewPitch, this.viewYaw, 0);
  }
}
