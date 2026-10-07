// Scrolling reels. Each spin is a pre-computed band of symbols that scrolls to a fixed stop
// time, so the outcome is decided before animation starts and the spin cannot be slammed.
import { Container, Sprite, Graphics, Text, BlurFilter } from 'pixi.js';
import { CW, CH, GAP, X0, Y0, REEL_H, FONT } from './config.js';
import { ART_SCALE } from './art.js';

const PITCH = CH + GAP;
const SPEED = 17;            // symbols per second at full speed
const BOUNCE_MS = 200;

// Velocity profile: ramp up over a, cruise, ramp down over b, landing exactly on 1 at u = 1
function travel(u, a = 0.1, b = 0.2) {
  const v = 1 / (1 - a / 2 - b / 2);
  if (u <= 0) return 0;
  if (u < a) return v * u * u / (2 * a);
  if (u < 1 - b) return v * (a / 2 + (u - a));
  if (u < 1) { const w = u - (1 - b); return v * (a / 2 + (1 - a - b) + w - w * w / (2 * b)); }
  return 1;
}

export class Reel {
  constructor(index, textures, fishLabel) {
    this.index = index; this.textures = textures; this.fishLabel = fishLabel;
    this.view = new Container(); this.view.position.set(X0 + index * (CW + GAP), Y0);
    const mask = new Graphics().rect(0, 0, CW, REEL_H).fill(0xffffff);
    this.view.addChild(mask); this.strip = new Container(); this.strip.mask = mask; this.view.addChild(this.strip);
    this.blur = new BlurFilter({ strength: 0, quality: 2 }); this.blur.strengthX = 0; this.strip.filters = [this.blur];
    this.slots = [];
    for (let j = 0; j < 4; j++) {
      const slot = new Container(); slot.pivot.set(CW / 2, CH / 2);
      const sp = new Sprite(textures.FLOAT); sp.scale.set(1 / ART_SCALE);
      const weight = new Text({ text: '', style: { fontFamily: FONT, fontSize: 19, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x2a1a00, width: 4 } } });
      weight.anchor.set(0.5); weight.position.set(CW / 2, CH - 42);
      const value = new Text({ text: '', style: { fontFamily: FONT, fontSize: 22, fontWeight: 'bold', fill: 0xffe066, stroke: { color: 0x2a1a00, width: 5 } } });
      value.anchor.set(0.5); value.position.set(CW / 2, CH - 18);
      slot.addChild(sp, weight, value); this.strip.addChild(slot);
      this.slots.push({ view: slot, sprite: sp, weight, value, entry: null });
    }
    this.band = []; this.pos = 0; this.anim = null;
  }
  setEntry(slot, entry) {
    slot.entry = entry; slot.sprite.texture = this.textures[entry.sym];
    if (entry.sym === 'CASH' && entry.fish) { const [w, v] = this.fishLabel(entry.fish); slot.weight.text = w; slot.value.text = v; }
    else { slot.weight.text = ''; slot.value.text = ''; }
  }
  refreshLabels() { this.slots.forEach(s => s.entry && this.setEntry(s, s.entry)); }
  layout() {
    const base = Math.floor(this.pos), frac = this.pos - base;
    this.slots.forEach((s, j) => {
      const entry = this.band[base + j] ?? this.band[this.band.length - 1];
      if (s.entry !== entry) this.setEntry(s, entry);
      s.view.position.set(CW / 2, (j - frac) * PITCH + CH / 2);
    });
  }
  show(col) {     // col: 3 entries, top to bottom
    this.band = [...col, col[2]]; this.pos = 0; this.layout();
  }
  current() { return [0, 1, 2].map(j => this.band[Math.floor(this.pos) + j]); }
  // Scroll from the current symbols to `col`, stopping exactly at `duration` ms after `t0`.
  spinTo(col, duration, t0, filler) {
    const prev = this.current();
    const m = Math.max(6, Math.round(duration / 1000 * SPEED));
    const fill = Array.from({ length: m - 3 }, filler);
    this.band = [...col, ...fill, ...prev, filler()];
    this.pos = m; this.layout();
    return new Promise(res => { this.anim = { t0, duration, m, res, stopped: false }; });
  }
  update(now) {
    const a = this.anim; if (!a) return;
    const t = now - a.t0;
    if (t < a.duration) {
      const u = t / a.duration;
      this.pos = a.m * (1 - travel(u));
      const speed = u < 0.1 || u > 0.8 ? 0.4 : 1;
      this.blur.strengthY = 6 * speed; this.blur.strengthX = 0;
    } else {
      if (!a.stopped) { a.stopped = true; this.blur.strengthY = 0; a.res(); }
      const b = t - a.duration;
      this.pos = 0;
      this.strip.y = b < BOUNCE_MS ? 12 * Math.sin(Math.PI * b / BOUNCE_MS) : 0;
      if (b >= BOUNCE_MS) { this.anim = null; this.band = this.band.slice(0, 3).concat([this.band[2]]); }
    }
    this.layout();
  }
  slotAt(row) { return this.slots[row]; }
  cellCentre(row) { return { x: this.view.x + CW / 2, y: Y0 + row * PITCH + CH / 2 }; }
}

// Promise-based tween driven by the shared ticker
const tweens = new Set();
export function tween(ms, fn, ease = t => 1 - (1 - t) ** 3) {
  return new Promise(res => tweens.add({ t0: performance.now(), ms, fn, ease, res }));
}
export function tickTweens(now) {
  for (const tw of tweens) {
    const t = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.ease(t));
    if (t >= 1) { tweens.delete(tw); tw.res(); }
  }
}
