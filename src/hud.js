const $ = (id) => document.getElementById(id);

// One list of controls, shown in three places: the start screen, the pause screen and the
// compact legend on the HUD during play. `hud: true` rows make it into the compact legend.
export const CONTROLS = [
  { keys: ['W', 'A', 'S', 'D'], does: 'Move', hud: true },
  { keys: ['←', '→'], alt: ['Q', 'E'], does: 'Turn', hud: true },
  { keys: ['↑', '↓'], does: 'Look up / down', hud: true },
  { keys: ['Space'], alt: ['F', 'Enter', 'Click'], does: 'Fire (hold for eggs)', short: 'Fire', hud: true },
  { keys: ['1', '2', '3'], alt: ['R'], does: 'Pick / next weapon', short: 'Weapons', hud: true },
  { keys: ['C'], does: 'Jump', hud: true },
  { keys: ['Shift'], does: 'Sprint', hud: true },
  { keys: ['Mouse'], alt: ['two-finger swipe'], does: 'Also look around (I flips swipe)' },
  { keys: ['−', '='], does: 'Look speed down / up', short: 'Look speed' },
  { keys: ['H'], does: 'Show / hide keys during play', short: 'Hide keys', hud: true },
  { keys: ['Esc'], does: 'Pause', hud: true },
];

const keycaps = (list) => list.map((k) => `<b>${k}</b>`).join(' ');

function renderFull(el) {
  el.innerHTML = CONTROLS.map((c) =>
    `<div><span class="k">${keycaps(c.keys)}${c.alt ? ` <i>or</i> ${keycaps(c.alt)}` : ''}</span><span class="d">${c.does}</span></div>`
  ).join('');
}

function renderCompact(el) {
  el.innerHTML = CONTROLS.filter((c) => c.hud).map((c) =>
    `<div><span class="k">${keycaps(c.keys)}</span><span class="d">${c.short || c.does}</span></div>`
  ).join('');
}

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), wave: $('wave'), score: $('score'), combo: $('combo'), crops: $('crops'),
      hp: $('hp-fill'), weaponName: $('weapon-name'), ammo: $('ammo'),
      slots: [...document.querySelectorAll('#weapon-slots .slot')],
      banner: $('banner'), vignette: $('vignette'), status: $('enemies-left'), crosshair: $('crosshair'),
      legend: $('legend'),
    };
    this.bannerTimer = null;
    this.hitTimer = null;
    this.statusText = null;

    for (const el of document.querySelectorAll('[data-controls]')) renderFull(el);
    renderCompact(this.el.legend);
    let saved = '1';
    try { saved = localStorage.getItem('barnyard-legend') ?? '1'; } catch (_) { /* private mode */ }
    this.setLegend(saved !== '0');
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat && !this.el.hud.classList.contains('hidden')) this.setLegend(!this.legendOn);
    });
  }
  setLegend(on) {
    this.legendOn = on;
    this.el.legend.classList.toggle('collapsed', !on);
    try { localStorage.setItem('barnyard-legend', on ? '1' : '0'); } catch (_) { /* private mode */ }
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }
  setWave(n) { this.el.wave.textContent = n; }
  setScore(s) { this.el.score.textContent = s.toLocaleString(); }
  setCombo(c) {
    const el = this.el.combo;
    if (c > 1) {
      el.textContent = 'x' + c + ' COMBO';
      el.classList.remove('hidden', 'bump');
      void el.offsetWidth;
      el.classList.add('bump');
    } else el.classList.add('hidden');
  }
  setHP(hp, max) {
    this.el.hp.style.width = Math.max(0, (hp / max) * 100) + '%';
    this.el.hp.classList.toggle('low', hp / max < 0.3);
  }
  setCrops(crops) {
    this.el.crops.innerHTML = crops.map((c) =>
      `<div class="crop ${c.alive ? '' : 'dead'}"><span>${c.name}</span><div class="bar small"><div style="width:${Math.max(0, (c.hp / c.maxHp) * 100)}%"></div></div></div>`
    ).join('');
  }
  setWeapon(i, w) {
    this.el.weaponName.textContent = w.name;
    this.el.ammo.textContent = w.ammo === Infinity ? '∞' : `${w.ammo} / ${w.maxAmmo}`;
    this.el.ammo.classList.toggle('empty', w.ammo === 0);
    this.el.slots.forEach((s, j) => s.classList.toggle('active', j === i));
  }
  // The line under the minimap: critters left this wave, or the countdown to the next one.
  // Only touches the page when the text actually changes.
  setStatus(text) {
    if (text === this.statusText) return;
    this.statusText = text;
    this.el.status.textContent = text;
  }
  banner(text, ms = 2500, cls = '') {
    const b = this.el.banner;
    b.textContent = text;
    b.className = 'hidden';
    void b.offsetWidth;
    b.className = 'show ' + cls;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { b.className = 'hidden'; }, ms);
  }
  damageFlash() {
    const v = this.el.vignette;
    v.classList.remove('flash');
    void v.offsetWidth;
    v.classList.add('flash');
  }
  hitMarker() {
    this.el.crosshair.classList.add('hit');
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.el.crosshair.classList.remove('hit'), 90);
  }
}
