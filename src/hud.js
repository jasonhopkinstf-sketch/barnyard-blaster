const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), wave: $('wave'), score: $('score'), combo: $('combo'), crops: $('crops'),
      hp: $('hp-fill'), weaponName: $('weapon-name'), ammo: $('ammo'),
      slots: [...document.querySelectorAll('#weapon-slots .slot')],
      banner: $('banner'), vignette: $('vignette'), left: $('enemies-left'), crosshair: $('crosshair'),
    };
    this.bannerTimer = null;
    this.hitTimer = null;
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
  setEnemiesLeft(n) { this.el.left.textContent = n > 0 ? `${n} critters left` : ''; }
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
