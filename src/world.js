import * as THREE from 'three';
import { makeBox } from './collision.js';
import { POND, pondDistance, buildPond } from './water.js';

export const ARENA = 44;   // the player can roam within +/- ARENA
export const FENCE = 46;   // fence line
export const SPAWN_R = 54; // critters spawn on a ring outside the fence

const lam = (color) => new THREE.MeshLambertMaterial({ color });

function mesh(geo, color, x, y, z, parent, { shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const box = (w, h, d, color, x, y, z, parent, o) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent, o);

// Deterministic RNG so the farm looks the same every load.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(scene, skyUniforms) {
  const obstacles = [];
  const crops = [];
  const rng = mulberry32(1337);

  // The sky itself is the dome in sky.js. Fog colour, light colours, directions and
  // intensities are all driven each frame by DayCycle; these are just starting values.
  scene.fog = new THREE.Fog(0x8ed0f6, 70, 170);

  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x4f7a2a, 2.2);
  scene.add(hemi);
  const makeShadowLight = (color, intensity, mapSize) => {
    const l = new THREE.DirectionalLight(color, intensity);
    l.castShadow = true;
    l.shadow.mapSize.set(mapSize, mapSize);
    Object.assign(l.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 220 });
    l.shadow.bias = -0.0005;
    scene.add(l);
    return l;
  };
  const sun = makeShadowLight(0xfff1cc, 3.0, 2048);
  sun.position.set(40, 70, 25);
  const moon = makeShadowLight(0x99b8ff, 0, 1024);

  const ground = mesh(new THREE.PlaneGeometry(500, 500), 0x6fae3c, 0, 0, 0, scene, { shadow: false });
  ground.rotation.x = -Math.PI / 2;
  const road = mesh(new THREE.PlaneGeometry(6, 130), 0xb48a5a, 0, 0.02, 12, scene, { shadow: false });
  road.rotation.x = -Math.PI / 2;

  const tuftGeo = new THREE.ConeGeometry(0.25, 0.7, 5);
  for (let i = 0; i < 180; i++) {
    const x = (rng() - 0.5) * 2 * ARENA, z = (rng() - 0.5) * 2 * ARENA;
    const color = rng() < 0.2 ? 0xffe066 : 0x4f9a2f, rot = rng() * 6;
    if (pondDistance(x, z, 1.5) < 1) continue; // no grass growing in the pond
    const t = mesh(tuftGeo, color, x, 0.3, z, scene, { shadow: false });
    t.rotation.y = rot;
  }

  buildFence(scene);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x3b2a16 });
  buildBarn(scene, obstacles, -24, -22, windowMat);
  const pond = buildPond(scene, skyUniforms);
  const ducks = buildPondLife(scene, rng);
  buildSilo(scene, obstacles, -36, -14);
  buildTractor(scene, obstacles, 26, -10);
  buildScarecrow(scene, 0, -14);
  const blades = buildWindmill(scene, obstacles, 30, 28);
  buildTrough(scene, obstacles, -30, 20);
  buildCoop(scene, obstacles, 12, -32);

  const bales = [[12, -22, 0], [15, -20, 0.6], [13.5, -21, 1.2, true], [-10, 30, 0.3], [40, 17, 1.1], [-30, 6, 0.9], [8, 36, 0.2], [-8, -36, 1.4], [36, -30, 0.5]];
  for (const [x, z, rot, top] of bales) {
    const h = mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 12), 0xd9b64a, x, top ? 3.4 : 1.2, z, scene);
    h.rotation.z = Math.PI / 2;
    h.rotation.y = rot;
    if (!top) obstacles.push(makeBox(x, z, 2.8, 2.8));
  }

  const patchDefs = [
    { name: 'Corn', x: -6, z: 14, kind: 'corn' },
    { name: 'Pumpkins', x: 16, z: 20, kind: 'pumpkin' },
    { name: 'Carrots', x: -20, z: -2, kind: 'carrot' },
  ];
  for (const d of patchDefs) crops.push(buildCropPatch(scene, d));

  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2, r = FENCE + 10 + rng() * 60;
    buildTree(scene, Math.cos(a) * r, Math.sin(a) * r, 0.8 + rng() * 0.9, rng);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 170;
    mesh(new THREE.SphereGeometry(45 + (i % 3) * 14, 14, 10), 0x5b9a3a, Math.cos(a) * r, -22, Math.sin(a) * r, scene, { shadow: false, receive: false });
  }

  let t = 0;
  return {
    obstacles, crops, bounds: ARENA,
    lights: { sun, moon, hemi },
    windowMat,
    pond,
    update(dt) {
      t += dt;
      blades.rotation.z -= dt * 0.9;
      for (const c of crops) c.update(dt);
      for (const d of ducks) {
        const a = d.phase + t * d.speed;
        d.mesh.position.set(POND.x + Math.cos(a) * d.rx, 0.1 + Math.sin(t * 2.2 + d.phase) * 0.03, POND.z + Math.sin(a) * d.rz);
        d.mesh.rotation.y = -a + (d.speed > 0 ? 0 : Math.PI);
      }
    },
    reset() { for (const c of crops) c.reset(); },
  };
}

function buildFence(scene) {
  const postGeo = new THREE.BoxGeometry(0.35, 1.6, 0.35);
  const postMat = lam(0xa9743f);
  const railMat = lam(0xc08b4e);
  for (let i = -FENCE; i <= FENCE; i += 4) {
    for (const [x, z] of [[i, -FENCE], [i, FENCE], [-FENCE, i], [FENCE, i]]) {
      if (z === FENCE && Math.abs(x) < 4) continue; // gate gap where the road leaves the farm
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(x, 0.8, z);
      p.castShadow = true;
      scene.add(p);
    }
  }
  const len = FENCE * 2;
  const rails = [[0, -FENCE, 0, len], [-FENCE, 0, Math.PI / 2, len], [FENCE, 0, Math.PI / 2, len], [-FENCE / 2 - 2, FENCE, 0, FENCE - 4], [FENCE / 2 + 2, FENCE, 0, FENCE - 4]];
  for (const y of [0.55, 1.15]) {
    for (const [x, z, rotY, l] of rails) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(l, 0.18, 0.12), railMat);
      r.position.set(x, y, z);
      r.rotation.y = rotY;
      r.castShadow = true;
      scene.add(r);
    }
  }
}

// Reeds around the pond rim and a couple of ducks paddling in circles.
function buildPondLife(scene, rng) {
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const k = 0.98 + rng() * 0.1;
    const x = POND.x + Math.cos(a) * POND.rx * k, z = POND.z + Math.sin(a) * POND.rz * k;
    const h = 1.1 + rng() * 0.9;
    const reed = mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), 0x4f7a2a, x, h / 2, z, scene);
    reed.rotation.z = (rng() - 0.5) * 0.25;
    if (rng() < 0.6) mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 6), 0x5a3a1a, x, h - 0.1, z, scene);
  }
  const ducks = [];
  for (const [color, phase, speed, k] of [[0xffffff, 0.5, 0.22, 0.45], [0xf2c94c, 3.4, -0.17, 0.62]]) {
    const g = new THREE.Group();
    scene.add(g);
    mesh(new THREE.SphereGeometry(0.34, 10, 8), color, 0, 0.12, 0, g).scale.set(1, 0.7, 1.4);
    mesh(new THREE.SphereGeometry(0.2, 8, 6), color, 0, 0.45, 0.35, g);
    mesh(new THREE.ConeGeometry(0.07, 0.22, 5), 0xf08a24, 0, 0.42, 0.6, g).rotation.x = Math.PI / 2;
    mesh(new THREE.ConeGeometry(0.12, 0.3, 4), color, 0, 0.3, -0.5, g).rotation.x = -1.0;
    ducks.push({ mesh: g, phase, speed, rx: POND.rx * k, rz: POND.rz * k });
  }
  return ducks;
}

function buildBarn(scene, obstacles, x, z, windowMat) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  box(14, 8, 12, 0xb3382b, 0, 4, 0, g);
  const roofMat = lam(0x5a3a2a);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.4, 13), roofMat);
    r.position.set(s * 3.6, 9.7, 0);
    r.rotation.z = s * -0.62;
    r.castShadow = true;
    g.add(r);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-7, 8); tri.lineTo(7, 8); tri.lineTo(0, 12.2); tri.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 11.8, bevelEnabled: false }), lam(0xb3382b));
  gable.position.set(0, 0, -5.9);
  gable.castShadow = true;
  g.add(gable);
  box(4, 5, 0.3, 0x6b3f2a, 0, 2.5, 6.05, g);
  box(0.3, 5, 0.3, 0xf2f2f2, -2.1, 2.5, 6.1, g);
  box(0.3, 5, 0.3, 0xf2f2f2, 2.1, 2.5, 6.1, g);
  for (const s of [-1, 1]) {
    box(0.3, 8.2, 0.3, 0xf2f2f2, s * 7.05, 4, 6.05, g);
    box(0.3, 8.2, 0.3, 0xf2f2f2, s * 7.05, 4, -6.05, g);
  }
  // Hayloft window and two side windows: unlit, so DayCycle can make them glow at night.
  for (const [wx, wy, ww, wh] of [[0, 9.4, 1.6, 1.6], [-4.6, 4.6, 1.3, 1.5], [4.6, 4.6, 1.3, 1.5]]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 0.3), windowMat);
    win.position.set(wx, wy, 6.05);
    g.add(win);
    box(ww + 0.3, 0.15, 0.34, 0xf2f2f2, wx, wy - wh / 2 - 0.07, 6.05, g);
  }
  box(0.1, 2.2, 0.1, 0x333333, 0, 13.2, 0, g);  // weather vane
  const rooster = box(0.9, 0.5, 0.1, 0x333333, 0, 14.3, 0, g);
  rooster.rotation.y = 0.6;
  obstacles.push(makeBox(x, z, 14.6, 12.6));
}

function buildSilo(scene, obstacles, x, z) {
  mesh(new THREE.CylinderGeometry(3, 3, 14, 16), 0xc9ccd1, x, 7, z, scene);
  mesh(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb03a2e, x, 14, z, scene);
  for (let y = 2; y < 14; y += 3) {
    const ring = mesh(new THREE.TorusGeometry(3.05, 0.08, 6, 24), 0x8a8d93, x, y, z, scene, { shadow: false });
    ring.rotation.x = Math.PI / 2;
  }
  obstacles.push(makeBox(x, z, 6.4, 6.4));
}

function buildTractor(scene, obstacles, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = 0.5;
  scene.add(g);
  box(4.6, 1.6, 2.2, 0x2e8b3d, 0, 1.6, 0, g);
  box(2.4, 1.2, 2.0, 0x2e8b3d, -1.0, 2.9, 0, g);
  box(1.8, 2.2, 2.0, 0x1f6b2e, 1.3, 3.3, 0, g);
  box(1.9, 1.0, 1.7, 0x9ad8ff, 1.3, 3.7, 0, g);
  box(2.2, 0.2, 2.4, 0x1f6b2e, 1.3, 4.5, 0, g);
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), 0x333333, -1.6, 4.1, 0.6, g);
  const wheelMat = lam(0x222222), hubMat = lam(0xdddd44);
  for (const [wx, wz, r, w] of [[1.4, 1.35, 1.2, 0.7], [1.4, -1.35, 1.2, 0.7], [-1.5, 1.2, 0.7, 0.5], [-1.5, -1.2, 0.7, 0.5]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, r, wz);
    wheel.castShadow = true;
    g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.05, 10), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, r, wz);
    g.add(hub);
  }
  obstacles.push(makeBox(x, z, 6, 5));
}

function buildScarecrow(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), 0x8a5a2b, 0, 1.6, 0, g);
  box(2.2, 0.12, 0.12, 0x8a5a2b, 0, 2.6, 0, g);
  box(0.9, 1.3, 0.5, 0x3a6bbf, 0, 2.2, 0, g);
  box(0.8, 0.3, 0.42, 0xd9b64a, 0, 1.5, 0, g);
  for (const s of [-1, 1]) box(0.9, 0.3, 0.3, 0x3a6bbf, s * 0.9, 2.6, 0, g);
  mesh(new THREE.SphereGeometry(0.38, 10, 8), 0xf5d9a8, 0, 3.2, 0, g);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 10), 0x8a5a2b, 0, 3.5, 0, g);
  mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 10), 0x8a5a2b, 0, 3.75, 0, g);
  box(0.08, 0.08, 0.08, 0x222222, -0.14, 3.28, 0.34, g);
  box(0.08, 0.08, 0.08, 0x222222, 0.14, 3.28, 0.34, g);
}

function buildWindmill(scene, obstacles, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  mesh(new THREE.CylinderGeometry(0.7, 1.7, 14, 4), 0x7a6a55, 0, 7, 0, g);
  box(2.4, 0.2, 2.4, 0x5a4a35, 0, 14.1, 0, g);
  box(1.2, 1.2, 1.4, 0x5a4a35, 0, 14.8, 0, g);
  const blades = new THREE.Group();
  blades.position.set(0, 14.8, 0.9);
  g.add(blades);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), 0x333333, 0, 0, 0, blades).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const b = box(0.6, 5.5, 0.08, 0xeeeeee, 0, 3.0, 0, blades);
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 2;
    blades.add(holder);
    holder.add(b);
  }
  obstacles.push(makeBox(x, z, 3.6, 3.6));
  return blades;
}

function buildTrough(scene, obstacles, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = 0.3;
  scene.add(g);
  box(4, 1, 1.6, 0x8a5a2b, 0, 0.5, 0, g);
  box(3.7, 0.1, 1.3, 0x4fa3e0, 0, 1.0, 0, g);
  obstacles.push(makeBox(x, z, 4.4, 2.4));
}

function buildCoop(scene, obstacles, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  box(5, 3, 4, 0xd9b64a, 0, 1.5, 0, g);
  const roof = box(5.6, 0.3, 4.6, 0x8a5a2b, 0, 3.3, 0, g);
  roof.rotation.z = 0.12;
  box(1.2, 1.6, 0.2, 0x3b2a16, 0, 0.8, 2.05, g);
  const rng = mulberry32(42);
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Group();
    c.position.set((rng() - 0.5) * 8, 0, 3 + rng() * 4);
    c.rotation.y = rng() * 6;
    g.add(c);
    mesh(new THREE.SphereGeometry(0.35, 8, 6), 0xffffff, 0, 0.4, 0, c).scale.set(1, 0.9, 1.3);
    mesh(new THREE.SphereGeometry(0.2, 8, 6), 0xffffff, 0, 0.75, 0.35, c);
    box(0.1, 0.18, 0.2, 0xe53935, 0, 0.95, 0.35, c);
    mesh(new THREE.ConeGeometry(0.07, 0.2, 5), 0xf0a020, 0, 0.72, 0.58, c).rotation.x = Math.PI / 2;
  }
  obstacles.push(makeBox(x, z, 5.6, 4.6));
}

function buildCropPatch(scene, def) {
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);
  scene.add(g);
  box(11, 0.4, 9, 0x7a5230, 0, 0.2, 0, g);
  const plants = new THREE.Group();
  plants.position.y = 0.4;
  g.add(plants);
  const cols = 5, rows = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const p = new THREE.Group();
      p.position.set((i - (cols - 1) / 2) * 2, 0, (j - (rows - 1) / 2) * 2);
      plants.add(p);
      if (def.kind === 'corn') {
        mesh(new THREE.ConeGeometry(0.5, 2.8, 6), 0x3f9b3a, 0, 1.4, 0, p);
        mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 6), 0xf5d547, 0.35, 1.3, 0, p);
      } else if (def.kind === 'pumpkin') {
        mesh(new THREE.SphereGeometry(0.6, 10, 8), 0xf08a24, 0, 0.5, 0, p).scale.y = 0.75;
        mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6), 0x3f8f3a, 0, 1.0, 0, p);
        mesh(new THREE.SphereGeometry(0.4, 6, 5), 0x3f8f3a, 0.7, 0.2, 0.4, p).scale.set(1, 0.3, 1);
      } else {
        mesh(new THREE.ConeGeometry(0.22, 0.9, 6), 0xf0742a, 0, 0.3, 0, p).rotation.x = Math.PI;
        mesh(new THREE.ConeGeometry(0.45, 0.9, 6), 0x6fcf5a, 0, 1.0, 0, p);
      }
    }
  }
  return {
    name: def.name, x: def.x, z: def.z, radius: 4, hp: 100, maxHp: 100, alive: true, dirty: true, shake: 0,
    damage(amt) {
      if (!this.alive) return false;
      this.hp = Math.max(0, this.hp - amt);
      this.dirty = true;
      this.shake = 0.15;
      if (this.hp <= 0) { this.alive = false; return true; }
      return false;
    },
    update(dt) {
      const k = 0.1 + 0.9 * (this.hp / this.maxHp);
      plants.scale.set(k, k, k);
      if (this.shake > 0) { this.shake -= dt; plants.position.x = (Math.random() - 0.5) * 0.15; }
      else plants.position.x = 0;
    },
    reset() { this.hp = this.maxHp; this.alive = true; this.dirty = true; },
  };
}

function buildTree(scene, x, z, s, rng) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = rng() * 6;
  scene.add(g);
  mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 7), 0x6b4a2f, 0, 2, 0, g);
  if (rng() < 0.4) {
    mesh(new THREE.ConeGeometry(2.6, 6, 8), 0x2f7a3a, 0, 6, 0, g);
    mesh(new THREE.ConeGeometry(2.0, 4.5, 8), 0x3a8f45, 0, 8.5, 0, g);
  } else {
    mesh(new THREE.SphereGeometry(3, 9, 7), 0x3f9b3a, 0, 5.5, 0, g);
    mesh(new THREE.SphereGeometry(2.2, 9, 7), 0x4caf50, 1.6, 6.8, 0.8, g);
    mesh(new THREE.SphereGeometry(2.0, 9, 7), 0x2f7a3a, -1.5, 6.5, -0.6, g);
  }
}
