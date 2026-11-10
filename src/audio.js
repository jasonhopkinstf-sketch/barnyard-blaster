// All sound effects are synthesized with Web Audio so the repo ships no audio files.
let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.001, t + a + d);
}

function tone(type, f0, f1, dur, peak = 0.5, a = 0.005) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, a, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + a + dur + 0.05);
}

function burst(dur, peak = 0.4, cutoff = 2000) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = noise();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  env(g, t, 0.003, dur, peak);
  n.connect(f).connect(g).connect(master);
  n.start(t);
  n.stop(t + dur + 0.05);
}

const later = (ms, fn) => setTimeout(fn, ms);

export const sfx = {
  egg() { tone('square', 520, 180, 0.08, 0.22); burst(0.05, 0.12, 3000); },
  corn() { burst(0.2, 0.5, 1200); tone('sawtooth', 160, 60, 0.15, 0.3); },
  tomato() { tone('sine', 320, 120, 0.25, 0.3); },
  empty() { tone('square', 200, 150, 0.06, 0.15); },
  splat() { burst(0.14, 0.35, 900); tone('sine', 220, 60, 0.12, 0.25); },
  hit() { tone('triangle', 700, 400, 0.05, 0.18); },
  squawk() { tone('sawtooth', 900, 1400, 0.09, 0.14); later(70, () => tone('sawtooth', 1200, 500, 0.12, 0.14)); },
  pop() { tone('square', 400, 900, 0.07, 0.22); burst(0.08, 0.2, 1500); },
  hurt() { tone('sawtooth', 200, 80, 0.25, 0.35); burst(0.2, 0.2, 600); },
  pickup() { tone('sine', 600, 900, 0.08, 0.25); later(80, () => tone('sine', 900, 1300, 0.1, 0.25)); },
  wave() { [0, 120, 240].forEach((d, i) => later(d, () => tone('square', 330 * (1 + i * 0.25), 330 * (1 + i * 0.25), 0.15, 0.2))); },
  clear() { [0, 100, 200, 300].forEach((d, i) => later(d, () => tone('triangle', 440 * Math.pow(1.26, i), 440 * Math.pow(1.26, i), 0.18, 0.22))); },
  cropHurt() { tone('triangle', 150, 100, 0.1, 0.12); },
  cropLost() { tone('sawtooth', 220, 90, 0.4, 0.3); },
  gameover() { [0, 250, 500, 750].forEach((d, i) => later(d, () => tone('sawtooth', 300 - i * 50, 200 - i * 40, 0.35, 0.3))); },
  boar() { tone('sawtooth', 90, 60, 0.4, 0.4); burst(0.3, 0.3, 400); },
  jump() { tone('sine', 300, 500, 0.08, 0.08); },
};
