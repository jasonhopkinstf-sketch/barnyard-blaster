import { FENCE } from './world.js';
import { POND } from './water.js';

// Top-down map of the whole farm, north (the direction you face at the start) at the top.
// Red dots are critters, green blocks are crop patches, the white arrow is you.
const RANGE = 60;   // metres from the farm centre to the map edge (critters spawn at 54)
const SIZE = 190;   // CSS pixels
const DOT = { crow: 3.2, rabbit: 3.2, raccoon: 4, boar: 6 };

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * this.dpr;
    canvas.height = SIZE * this.dpr;
    canvas.style.width = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    this.timer = 0;
    this.t = 0;
  }

  // Redrawn about 30 times a second; plenty for a map and cheaper than every frame.
  update(dt, state) {
    this.t += dt;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / 30;
    this.draw(state);
  }

  draw({ player, enemies, world, pickups }) {
    const c = this.ctx, S = SIZE, k = S / (2 * RANGE);
    const X = (x) => S / 2 + x * k, Y = (z) => S / 2 + z * k;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, S, S);

    c.save();
    c.beginPath();
    c.roundRect(1, 1, S - 2, S - 2, 14);
    c.clip();
    c.fillStyle = 'rgba(18, 34, 14, 0.78)';
    c.fillRect(0, 0, S, S);

    // the fenced farm, the road and the pond
    c.fillStyle = 'rgba(111, 174, 60, 0.55)';
    c.fillRect(X(-FENCE), Y(-FENCE), FENCE * 2 * k, FENCE * 2 * k);
    c.fillStyle = 'rgba(190, 150, 100, 0.75)';
    c.fillRect(X(-3), Y(-53), 6 * k, S);
    c.fillStyle = 'rgba(90, 170, 230, 0.9)';
    c.beginPath();
    c.ellipse(X(POND.x), Y(POND.z), POND.rx * k, POND.rz * k, 0, 0, Math.PI * 2);
    c.fill();

    // buildings and other solid things
    c.fillStyle = 'rgba(70, 50, 35, 0.9)';
    for (const b of world.obstacles) c.fillRect(X(b.minX), Y(b.minZ), (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k);

    // crop patches: green fades to brown as they are eaten, and they flash while under attack
    for (const p of world.crops) {
      const hp = p.hp / p.maxHp;
      c.fillStyle = p.alive ? `rgb(${Math.round(150 - 90 * hp)}, ${Math.round(90 + 140 * hp)}, 60)` : '#4a2a20';
      c.fillRect(X(p.x - 5.5), Y(p.z - 4.5), 11 * k, 9 * k);
      if (p.alive && p.shake > 0 && Math.floor(this.t * 6) % 2 === 0) {
        c.strokeStyle = '#ffdd33';
        c.lineWidth = 2;
        c.strokeRect(X(p.x - 5.5) - 1, Y(p.z - 4.5) - 1, 11 * k + 2, 9 * k + 2);
      }
    }

    c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    c.lineWidth = 1;
    c.strokeRect(X(-FENCE), Y(-FENCE), FENCE * 2 * k, FENCE * 2 * k);

    // pickups
    c.fillStyle = '#ffe066';
    for (const it of pickups) c.fillRect(X(it.mesh.position.x) - 1.5, Y(it.mesh.position.z) - 1.5, 3, 3);

    // critters
    for (const e of enemies) {
      const r = DOT[e.type] || 2.6;
      c.beginPath();
      c.arc(X(e.mesh.position.x), Y(e.mesh.position.z), r, 0, Math.PI * 2);
      c.fillStyle = '#ff3b30';
      c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.lineWidth = e.type === 'boar' ? 1.6 : 0.8;
      c.stroke();
    }

    // you: a view wedge and an arrow pointing where you face
    const px = X(player.pos.x), py = Y(player.pos.z);
    const a = Math.atan2(-Math.cos(player.viewYaw), -Math.sin(player.viewYaw)); // canvas angle of the facing direction
    c.fillStyle = 'rgba(255, 255, 255, 0.16)';
    c.beginPath();
    c.moveTo(px, py);
    c.arc(px, py, 30, a - 0.62, a + 0.62);
    c.closePath();
    c.fill();
    c.save();
    c.translate(px, py);
    c.rotate(a);
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(-4.5, 4.5);
    c.lineTo(-2, 0);
    c.lineTo(-4.5, -4.5);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 1;
    c.stroke();
    c.restore();

    c.restore();
    c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(1, 1, S - 2, S - 2, 14);
    c.stroke();
  }
}
