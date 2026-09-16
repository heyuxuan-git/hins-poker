/** Tiny Web Audio SFX — table knocks & chip stacks (no external files). */

let ctx = null;
let muted = false;

export function setMuted(v) {
  muted = !!v;
  try {
    localStorage.setItem('hins_poker_muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isMuted() {
  return muted;
}

try {
  muted = localStorage.getItem('hins_poker_muted') === '1';
} catch {
  /* ignore */
}

function ac() {
  if (muted) return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(gain, t0, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

/** Soft wooden knock on the felt rail */
function knock(c, when, vol = 0.55) {
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  o.type = 'triangle';
  o.frequency.setValueAtTime(160, when);
  o.frequency.exponentialRampToValueAtTime(70, when + 0.06);
  env(g, when, vol, 0.004, 0.09);
  o.connect(f);
  f.connect(g);
  g.connect(c.destination);
  o.start(when);
  o.stop(when + 0.14);
}

/** Short metallic chip clink */
function clink(c, when, vol = 0.28, pitch = 1800) {
  const o = c.createOscillator();
  const g = c.createGain();
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = pitch;
  bp.Q.value = 8;
  o.type = 'square';
  o.frequency.value = pitch;
  env(g, when, vol, 0.002, 0.05);
  o.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  o.start(when);
  o.stop(when + 0.08);
}

function noiseBurst(c, when, vol, dur, freq) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  g.gain.value = vol;
  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(when);
}

/** Check / knock twice on the table */
export function playCheck() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  knock(c, t, 0.5);
  knock(c, t + 0.12, 0.42);
}

/** Bet / call / raise — chips colliding into the pot */
export function playChips(intensity = 1) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const n = 3 + Math.floor(intensity * 3);
  for (let i = 0; i < n; i++) {
    const dt = i * 0.028 + Math.random() * 0.012;
    clink(c, t + dt, 0.16 + Math.random() * 0.1, 1600 + Math.random() * 900);
  }
  noiseBurst(c, t + 0.01, 0.08 * intensity, 0.12, 2800);
}

export function playAllIn() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 8; i++) {
    clink(c, t + i * 0.035, 0.2, 1400 + i * 80);
  }
  knock(c, t + 0.05, 0.35);
  noiseBurst(c, t + 0.02, 0.12, 0.2, 2200);
  // Crowd gasp — layered "whoa" swell
  const len = Math.floor(c.sampleRate * 0.9);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const swell = Math.sin(Math.PI * p);
    data[i] = (Math.random() * 2 - 1) * swell * 0.55;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(600, t);
  lp.frequency.linearRampToValueAtTime(1800, t + 0.18);
  lp.frequency.linearRampToValueAtTime(400, t + 0.85);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  src.connect(lp);
  lp.connect(g);
  g.connect(c.destination);
  src.start(t);
}

export function playDeal() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.04, 0.05, 3500);
}
