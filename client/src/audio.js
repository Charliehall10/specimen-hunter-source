// Tiny WebAudio synth: sounds are generated, apart from the one recorded voice line.
// Returns below stake never call win sounds (handled by the caller).
// "Fish on!" voice: Piper TTS, en_GB northern_english_male (dataset: OpenSLR 83, CC-BY-SA 4.0).
import fishOnUrl from './assets/fish-on.wav';
let ctx = null, master = null, muted = false, fishOnBuf = null;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  // Pause all audio while the window is hidden or minimised
  document.addEventListener('visibilitychange', () => { document.hidden ? ctx.suspend() : ctx.resume(); });
  fetch(fishOnUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { fishOnBuf = buf; })
    .catch(() => {});   // voice is optional; the game plays fine without it
}
function playClip(buf, { vol = 1, at = 0 } = {}) {
  if (!ctx || muted || !buf) return;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(master); s.start(ctx.currentTime + at);
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, attack = 0.005, slideTo = null } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, at = 0, filter = 1200, q = 0.8 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at, len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = q; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

export const sfx = {
  click: () => tone(900, 0.05, { type: 'triangle', vol: 0.15 }),
  spinStart: () => { noise(0.25, { vol: 0.12, filter: 600 }); tone(220, 0.2, { type: 'triangle', vol: 0.12, slideTo: 330 }); },
  reelStop: i => { tone(140 + i * 12, 0.12, { type: 'triangle', vol: 0.25 }); noise(0.06, { vol: 0.12, filter: 2500 }); },
  // Bite alarm: the classic rising beep, pitch climbs with each rod
  alarm: n => { for (let k = 0; k < 3; k++) tone(1400 + n * 220, 0.07, { type: 'square', vol: 0.09, at: k * 0.09 }); },
  anticipation: () => { for (let k = 0; k < 10; k++) tone(700 + k * 70, 0.09, { type: 'square', vol: 0.05, at: k * 0.11 }); },
  lineWin: () => [523, 659, 784].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.18, at: i * 0.07 })),
  collect: i => { tone(660 + (i % 6) * 90, 0.14, { type: 'sine', vol: 0.22 }); noise(0.18, { vol: 0.08, filter: 900, at: 0.02 }); },
  splash: () => { noise(0.5, { vol: 0.25, filter: 700, q: 0.5 }); noise(0.3, { vol: 0.15, filter: 2400, at: 0.05 }); },
  feature: () => { for (let k = 0; k < 9; k++) tone(1500 + (k % 3) * 250, 0.08, { type: 'square', vol: 0.08, at: k * 0.12 });
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.2, at: 1.2 + i * 0.12 })); },
  retrigger: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.08, at: i * 0.1 })),
  record: () => { noise(0.8, { vol: 0.3, filter: 500, q: 0.4 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.2, at: 0.2 + i * 0.1 })); },
  bigWin: () => [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.2, at: i * 0.1 })),
  tally: () => tone(1200 + Math.random() * 400, 0.04, { type: 'sine', vol: 0.06 }),
  // Third bite alarm: the angler's shout, just after the alarm beep
  fishOn: () => { duckMusic(1200); playClip(fishOnBuf, { vol: 1.3, at: 0.18 }); },
};

// ---------------------------------------------------------------- background music
// Generative music, scheduled a little ahead of time on an 8th-note grid.
// 'base': calm lakeside dawn. 'feature': livelier free-spins groove.
const MOODS = {
  base: {
    bpm: 70,
    chords: [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 61]],   // Dmaj7 Bm7 Gmaj7 A
    scale: [74, 76, 78, 81, 83, 86], melodyChance: 0.3, arp: false, beat: false, ambience: true, pad: 0.05,
  },
  feature: {
    bpm: 100,
    chords: [[47, 54, 59, 62], [43, 50, 55, 59], [50, 57, 62, 66], [45, 52, 57, 61]],   // Bm G D A
    scale: [74, 76, 78, 81, 83, 86], melodyChance: 0.15, arp: true, beat: true, ambience: false, pad: 0.04,
  },
};
const hz = m => 440 * 2 ** ((m - 69) / 12);
let musicOn = true, musicBus = null, padBus = null, echoIn = null, noiseBuf = null;
let mood = 'base', nextMood = null, timer = null, nextTime = 0, step = 0;

function musicNodes() {
  if (musicBus || !ctx) return;
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
  padBus = ctx.createGain(); padBus.connect(lp); lp.connect(musicBus);
  // feedback echo for the melody
  echoIn = ctx.createGain(); const dly = ctx.createDelay(2), fb = ctx.createGain(), wet = ctx.createGain();
  dly.delayTime.value = 0.43; fb.gain.value = 0.32; wet.gain.value = 0.3;
  echoIn.connect(musicBus); echoIn.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function env(g, t, vol, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}
function osc(type, freq, t, end, dest, gainNode, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  o.connect(gainNode); gainNode.connect(dest); o.start(t); o.stop(end + 0.05); return o;
}
function pad(notes, t, len, vol) {
  for (const m of notes) for (const det of [-7, 7]) {
    const g = ctx.createGain(); const end = env(g, t, vol, 1.2, Math.max(0.1, len - 1.2), 1.8);
    osc('triangle', hz(m), t, end, padBus, g, det);
  }
}
function pluck(m, t, vol, dest = echoIn) {
  const g = ctx.createGain(); const end = env(g, t, vol, 0.008, 0.02, 0.9);
  osc('sine', hz(m), t, end, dest, g);
  const g2 = ctx.createGain(); const end2 = env(g2, t, vol * 0.3, 0.005, 0.01, 0.25);
  osc('triangle', hz(m + 12), t, end2, dest, g2);
}
function bass(m, t, len, vol) {
  const g = ctx.createGain(); const end = env(g, t, vol, 0.03, len * 0.6, len * 0.5);
  osc('sine', hz(m), t, end, musicBus, g);
}
function noiseHit(t, { vol, dur, type = 'highpass', freq = 7000 }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  env(g, t, vol, Math.min(0.4, dur * 0.4), 0, dur * 0.6);
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  env(g, t, 0.18, 0.004, 0.02, 0.22); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function bird(t) {
  for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), s = t + k * 0.13, f0 = 2600 + Math.random() * 900;
    o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, s + 0.07);
    env(g, s, 0.012, 0.01, 0.03, 0.05); o.connect(g); g.connect(musicBus); o.start(s); o.stop(s + 0.12);
  }
}

function scheduleStep(t) {
  const M = MOODS[mood], beat = 60 / M.bpm, eighth = beat / 2, s = step % 8, bar = Math.floor(step / 8);
  const chord = M.chords[bar % M.chords.length];
  if (s === 0) {
    pad(chord, t, beat * 4, M.pad);
    bass(chord[0] - 12, t, beat * 2, 0.12);
    if (M.ambience && Math.random() < 0.35) bird(t + Math.random() * beat * 3);
    if (M.ambience && bar % 2 === 0) noiseHit(t + beat, { vol: 0.03, dur: 2.2, type: 'lowpass', freq: 380 });
  }
  if (s === 4) bass((M.beat ? chord[0] : chord[1]) - 12, t, beat * 2, 0.09);
  if (M.arp) pluck(chord[[0, 1, 2, 3, 2, 1, 2, 3][s]] + 12, t, 0.045, musicBus);
  if (Math.random() < M.melodyChance && (s % 2 === 0 || M.arp)) pluck(M.scale[Math.floor(Math.random() * M.scale.length)], t, 0.05);
  if (M.beat) {
    if (s === 0 || s === 4) kick(t);
    if (s % 2 === 1) noiseHit(t, { vol: 0.025, dur: 0.06 });
  }
  return eighth;
}
function scheduler() {
  while (nextTime < ctx.currentTime + 1) {   // 1 s lookahead survives background timer throttling
    if (nextMood && step % 8 === 0) { mood = nextMood; nextMood = null; }
    nextTime += scheduleStep(nextTime);
    step++;
  }
}

export const isMusicOn = () => musicOn;
export function setMusic(on) {
  musicOn = on;
  if (!ctx) return;
  musicNodes();
  const now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now); musicBus.gain.setValueAtTime(musicBus.gain.value, now);
  musicBus.gain.linearRampToValueAtTime(on ? 0.7 : 0, now + (on ? 2 : 0.4));
  if (on && !timer) { nextTime = now + 0.1; step = 0; timer = setInterval(scheduler, 60); }
  if (!on && timer) setTimeout(() => { if (!musicOn) { clearInterval(timer); timer = null; } }, 500);
}
// Switch track at the next bar line
export function setMood(m) { if (m !== mood) nextMood = m; }
// Briefly lower the music (e.g. under a big-win celebration)
export function duckMusic(ms) {
  if (!musicBus || !musicOn) return;
  const now = ctx.currentTime, g = musicBus.gain;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.25, now + 0.3); g.setValueAtTime(0.25, now + ms / 1000); g.linearRampToValueAtTime(0.7, now + ms / 1000 + 1);
}
