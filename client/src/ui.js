// Small UI kit: text, buttons, the spin button and modal panels.
import { Container, Graphics, Text } from 'pixi.js';
import { W, H, FONT } from './config.js';
import { sfx } from './audio.js';

export function label(text, size = 20, fill = 0xffffff, opts = {}) {
  const t = new Text({ text, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: 'bold', align: 'center',
    stroke: opts.stroke ?? { color: 0x000000, width: Math.max(2, size / 7) }, wordWrap: !!opts.wrap, wordWrapWidth: opts.wrap ?? 0,
    lineHeight: opts.lineHeight, ...(opts.style ?? {}) } });
  t.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.5);
  if (opts.x !== undefined) t.position.set(opts.x, opts.y ?? 0);
  return t;
}

export class Button extends Container {
  constructor(text, w, h, onTap, { fill = 0x1f6f5c, size = 20, radius = 12, edge = 0xf2c14e } = {}) {
    super();
    this.w = w; this.h = h; this.fillColour = fill; this.edge = edge; this.radius = radius;
    this.bg = new Graphics(); this.addChild(this.bg);
    this.text = label(text, size, 0xffffff); this.addChild(this.text);
    this.eventMode = 'static'; this.cursor = 'pointer'; this._enabled = true; this.hover = false;
    this.on('pointerover', () => { this.hover = true; this.draw(); });
    this.on('pointerout', () => { this.hover = false; this.draw(); });
    this.on('pointertap', () => { if (this._enabled) { sfx.click(); onTap(); } });
    this.draw();
  }
  set enabled(v) { this._enabled = v; this.alpha = v ? 1 : 0.4; this.cursor = v ? 'pointer' : 'default'; this.draw(); }
  get enabled() { return this._enabled; }
  draw() {
    const { w, h } = this, lift = this.hover && this._enabled ? 0.15 : 0;
    this.bg.clear().roundRect(-w / 2, -h / 2 + 3, w, h, this.radius).fill({ color: 0x000000, alpha: 0.45 })
      .roundRect(-w / 2, -h / 2, w, h, this.radius).fill(this.fillColour).stroke({ width: 2, color: this.edge, alpha: 0.7 + lift })
      .roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, this.radius - 3).fill({ color: 0xffffff, alpha: 0.12 + lift });
  }
}

export class SpinButton extends Container {
  constructor(onTap) {
    super();
    this.ring = new Graphics(); this.icon = new Graphics(); this.addChild(this.ring, this.icon);
    this.eventMode = 'static'; this.cursor = 'pointer'; this._enabled = true; this.hover = false;
    this.on('pointerover', () => { this.hover = true; this.draw(); });
    this.on('pointerout', () => { this.hover = false; this.draw(); });
    this.on('pointertap', () => { if (this._enabled) onTap(); });
    this.draw();
  }
  set enabled(v) { this._enabled = v; this.cursor = v ? 'pointer' : 'default'; this.draw(); }
  get enabled() { return this._enabled; }
  draw() {
    const on = this._enabled, r = 48;
    this.ring.clear().circle(0, 4, r).fill({ color: 0x000000, alpha: 0.5 })
      .circle(0, 0, r).fill(on ? (this.hover ? 0x2f9e6e : 0x1f7a55) : 0x34413d).stroke({ width: 5, color: on ? 0xf2c14e : 0x6d6a5a })
      .circle(0, -14, r * 0.62).fill({ color: 0xffffff, alpha: on ? 0.12 : 0.05 });
    // circular arrow icon
    this.icon.clear().arc(0, 0, 23, -Math.PI * 0.35, Math.PI * 1.45).stroke({ width: 8, color: on ? 0xffffff : 0x9a9a9a, cap: 'round' });
    const a = -Math.PI * 0.35, ax = Math.cos(a) * 23, ay = Math.sin(a) * 23;
    this.icon.poly([ax + 12, ay + 2, ax - 6, ay - 12, ax - 4, ay + 12]).fill(on ? 0xffffff : 0x9a9a9a);
  }
  update(now) { this.icon.rotation = this._enabled ? 0 : (now / 180) % (Math.PI * 2); }
}

// Value box: small caption above a big value
export function valueBox(caption, w, x, y) {
  const c = new Container(); c.position.set(x, y);
  const bg = new Graphics().roundRect(-w / 2, -32, w, 64, 12).fill({ color: 0x04121a, alpha: 0.78 }).stroke({ width: 2, color: 0xf2c14e, alpha: 0.45 });
  const cap = label(caption, 13, 0x9fb7c2, { x: 0, y: -17, stroke: { width: 0 } });
  const val = label('', 24, 0xffffff, { x: 0, y: 9 });
  c.addChild(bg, cap, val); c.value = val; return c;
}

// Modal panel that blocks the game underneath
export class Modal extends Container {
  constructor(w, h, title, { closable = true, onClose = null } = {}) {
    super();
    const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x000000, alpha: 0.72 });
    dim.eventMode = 'static';
    this.panel = new Container(); this.panel.position.set(W / 2, H / 2);
    const bg = new Graphics().roundRect(-w / 2, -h / 2, w, h, 20).fill({ color: 0x0a1f2b, alpha: 0.97 }).stroke({ width: 3, color: 0xf2c14e });
    this.panel.addChild(bg);
    if (title) this.panel.addChild(label(title, 30, 0xf2c14e, { x: 0, y: -h / 2 + 34 }));
    this.body = new Container(); this.panel.addChild(this.body);
    this.addChild(dim, this.panel);
    this.onClose = onClose;
    if (closable) {
      const x = new Button('✕', 44, 44, () => this.close(), { fill: 0x5a2222, size: 20 });
      x.position.set(w / 2 - 34, -h / 2 + 34); this.panel.addChild(x);
    }
  }
  close() { this.parent?.removeChild(this); this.destroy({ children: true }); this.onClose?.(); }
}
