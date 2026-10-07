// Tiny WebAudio synth: all sounds are generated, no audio files.
// Returns below stake never call win sounds (handled by the caller).
let ctx = null, master = null, muted = false;

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
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
};
