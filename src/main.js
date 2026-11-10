import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { WeaponSystem } from './weapons.js';
import { WaveManager } from './waves.js';
import { Particles } from './effects.js';
import { HUD } from './hud.js';
import { initAudio, sfx } from './audio.js';
import { createSky } from './sky.js';
import { Post, POST_ENABLED } from './post.js';
import { DayCycle } from './daycycle.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// With the post pass on, the scene is antialiased in its own MSAA render target instead.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !POST_ENABLED });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const post = new Post(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
scene.add(camera); // the weapon view model hangs off the camera

const hud = new HUD();
const sky = createSky(scene);
const world = buildWorld(scene, sky.uniforms);
const day = new DayCycle({ scene, lights: world.lights, uniforms: sky.uniforms, windowMat: world.windowMat });
const particles = new Particles(scene);
const player = new Player(camera, canvas, world, hud);

const game = {
  state: 'menu',
  score: 0,
  combo: 1,
  comboTimer: 0,
  best: Number(localStorage.getItem('barnyard-best')) || 0,
  menuT: 0,
};

function addScore(n) {
  game.score += Math.round(n);
  hud.setScore(game.score);
}

const enemies = new EnemyManager(scene, world, player, particles, {
  onHit() { hud.hitMarker(); },
  onKill(e) {
    game.combo = game.comboTimer > 0 ? Math.min(8, game.combo + 1) : 1;
    game.comboTimer = 2.5;
    addScore(e.def.score * game.combo);
    hud.setCombo(game.combo);
  },
  onDrop(pos) { waves.dropAt(pos); },
  onCropDestroyed(crop) {
    hud.banner(`${crop.name} patch destroyed!`, 2200, 'bad');
    sfx.cropLost();
  },
});
const weapons = new WeaponSystem(scene, camera, player, enemies, particles, hud, world);
weapons.vm.visible = false;
const waves = new WaveManager(scene, enemies, player, weapons, hud, {
  crops: world.crops,
  onWaveClear(n, bonus) { addScore(bonus); },
  onUpcomingWave(n) { day.setWave(n); }, // the sky eases to the next wave's time of day during the break
});

// ---------- state machine ----------
const overlays = { start: $('start'), paused: $('paused'), gameover: $('gameover') };
function showOverlay(name) {
  for (const k in overlays) overlays[k].classList.toggle('hidden', k !== name);
}

function resetAll() {
  game.score = 0;
  game.combo = 1;
  game.comboTimer = 0;
  hud.setScore(0);
  hud.setCombo(1);
  player.reset();
  weapons.reset();
  waves.reset();
  world.reset();
  particles.clear();
  hud.setCrops(world.crops);
}

function startGame() {
  initAudio();
  // Drop focus from the button so Space / Enter play the game instead of pressing it again.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  resetAll();
  day.setWave(1);
  day.set(day.target); // every run starts in the afternoon, wherever the menu time-lapse was
  game.state = 'playing';
  showOverlay(null);
  hud.show();
  player.enabled = true;
  weapons.enabled = true;
  weapons.vm.visible = true;
  player.lock().then((ok) => {
    if (!ok) hud.banner('No mouse capture here: turn with Q / E or the arrow keys, or rest the pointer at a screen edge', 5000, 'pickup');
  });
  waves.begin();
}

function pauseGame() {
  game.state = 'paused';
  weapons.firing = false;
  weapons.keyFiring = false;
  showOverlay('paused');
}

function resumeGame() {
  game.state = 'playing';
  showOverlay(null);
}

function gameOver(title) {
  game.state = 'gameover';
  player.enabled = false;
  weapons.enabled = false;
  weapons.firing = false;
  weapons.keyFiring = false;
  weapons.vm.visible = false;
  if (document.pointerLockElement) document.exitPointerLock();
  hud.hide();
  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem('barnyard-best', String(game.best));
  }
  $('gameover-title').textContent = title;
  $('go-wave').textContent = waves.wave;
  $('go-score').textContent = game.score.toLocaleString();
  $('go-best').textContent = game.best.toLocaleString();
  showOverlay('gameover');
  sfx.gameover();
}

player.onLockChange = (locked) => {
  if (!locked && game.state === 'playing') pauseGame();
  else if (locked && game.state === 'paused') resumeGame();
};

$('best-start').textContent = game.best.toLocaleString();
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', startGame);
function tryResume() {
  initAudio();
  player.lock().then((ok) => { if (!ok && game.state === 'paused') resumeGame(); });
}
$('resume-btn').addEventListener('click', tryResume);
overlays.paused.addEventListener('click', (e) => { if (e.target === overlays.paused) tryResume(); });
document.addEventListener('keydown', (e) => {
  // With pointer lock, Esc releases the lock and onLockChange pauses for us.
  if (e.code === 'Escape' && game.state === 'playing' && !player.locked) pauseGame();
});

// Handy for debugging from the console.
// e.g. barnyard.day.set(0.3) for sunset, barnyard.day.set(0.08) for night.
window.barnyard = { game, player, weapons, enemies, waves, world, camera, scene, day, sky, post, renderer };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize();
});

// ---------- main loop ----------
const timer = new THREE.Timer();
let cropHudTimer = 0;
function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(0.05, timer.getDelta());

  if (game.state === 'playing') {
    player.update(dt);
    weapons.update(dt);
    enemies.update(dt);
    waves.update(dt);
    particles.update(dt);
    world.update(dt);
    day.update(dt);

    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) { game.combo = 1; hud.setCombo(1); }
    }
    cropHudTimer -= dt;
    if (cropHudTimer <= 0 && world.crops.some((c) => c.dirty)) {
      cropHudTimer = 0.2;
      hud.setCrops(world.crops);
      for (const c of world.crops) c.dirty = false;
    }
    if (player.hp <= 0) gameOver('You got eaten!');
    else if (world.crops.every((c) => !c.alive)) gameOver('The crops are gone!');
  } else {
    world.update(dt);
    particles.update(dt);
    if (game.state === 'menu') {
      game.menuT += dt * 0.12;
      camera.position.set(Math.cos(game.menuT) * 38, 10, Math.sin(game.menuT) * 38);
      camera.lookAt(0, 3, 0);
      // slow time-lapse behind the menu: afternoon, sunset, night, dawn and round again
      day.set(0.47 + 0.4 * Math.sin(game.menuT * 0.9 + 0.9));
    }
  }
  const time = timer.getElapsed();
  sky.update(camera, time);
  post.render(scene, camera, time);
}
frame();
