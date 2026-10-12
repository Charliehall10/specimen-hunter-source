// Procedural artwork: every symbol, the lakeside scenes, reel frame and logo are drawn
// with Canvas2D at start-up and turned into Pixi textures. No external image assets.
import { Texture, CanvasSource } from 'pixi.js';
import { W, H, CW, CH, REEL_W, REEL_H, FONT, GAME_NAME } from './config.js';

// Symbols are redrawn at the size they appear on screen (device pixels per design pixel, set by main.js),
// so they are never shrunk or stretched by the GPU and stay crisp on phones and large monitors alike.
let artScale = 2;
export const getArtScale = () => artScale;

function canvas(w, h, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d'); ctx.scale(scale, scale);
  return [c, ctx];
}
const lin = (ctx, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
};
const rad = (ctx, x, y, r0, r1, stops) => {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
};
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function shadow(ctx, blur = 8, y = 4, colour = 'rgba(0,0,0,0.45)') {
  ctx.shadowColor = colour; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0;
}
const noShadow = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
const seeded = seed => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
// Point on a cubic bezier, and a contour's y at a given x (sampled; contours run in either direction)
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map(i => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
function contourY(segs, x) {
  const pts = segs.flatMap(s => Array.from({ length: 33 }, (_, i) => bez(...s, i / 32))).sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const [a, b] = [pts[i - 1], pts[i]], t = (x - a[0]) / Math.max(1e-9, b[0] - a[0]); return a[1] + (b[1] - a[1]) * t;
  }
  return pts[pts.length - 1][1];
}

// Draw `draw` on its own layer, then put it down with a solid outline and a soft drop shadow, so the
// symbol reads clearly on the water without a plate behind it (the "sticker" look used on most slots).
function sticker(ctx, scale, draw, { outline = '#07141b', width = 2.6, shadowCol = 'rgba(0,0,0,0.6)', w = CW, h = CH } = {}) {
  const [art, a] = canvas(w, h, scale); draw(a);
  const [sil, s] = canvas(w, h, scale);
  s.setTransform(1, 0, 0, 1, 0, 0); s.drawImage(art, 0, 0);
  s.globalCompositeOperation = 'source-in'; s.fillStyle = outline; s.fillRect(0, 0, sil.width, sil.height);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (shadowCol) { ctx.shadowColor = shadowCol; ctx.shadowBlur = 9 * scale; ctx.shadowOffsetY = 5 * scale; ctx.drawImage(sil, 0, 0); ctx.shadowColor = 'transparent'; }
  const r = width * scale;
  for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; ctx.drawImage(sil, Math.cos(t) * r, Math.sin(t) * r); }
  ctx.drawImage(art, 0, 0);
  ctx.restore();
}
function arched(ctx, scale, draw, bend, w = CW, h = CH) {
  const [art, a] = canvas(w, h, scale); draw(a);
  const [bent, b] = canvas(w, h, scale); b.setTransform(1, 0, 0, 1, 0, 0);
  for (let x = 0; x < art.width; x++) {
    const u = x / art.width * 2 - 1;
    b.drawImage(art, x, 0, 1, art.height, x, bend * scale * u * u, 1, art.height);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10 * scale; ctx.shadowOffsetY = 6 * scale;
  ctx.drawImage(bent, 0, 0);
  ctx.restore();
}
// ---------------------------------------------------------------- fish
// Coordinates are in fish units: snout at x = -1, tail tip at x = +1, y down. Scaled by len / 2.
const SPECIES = {
  ROACH: { bh: 0.29, vh: 0.25, bx: -0.24, vx: -0.08, ph: 0.075, sy: 0.02, th: 0.33, dorsal: 'short', anal: 'short', scales: 'full', scaleR: 5.4,
    eye: [-0.79, -0.05, 0.075], gill: -0.6,
    col: { back: '#243b4b', flank: '#b9c7d1', belly: '#f6f8f9', fin: '#ff5a36', finDark: '#a3200f', iris: '#ff3b1f', lips: '#c9a7a0' } },
  BREAM: { bh: 0.47, vh: 0.36, bx: -0.12, vx: 0.02, ph: 0.07, sy: -0.03, th: 0.4, dorsal: 'tall', anal: 'long', scales: 'full', scaleR: 4.6,
    eye: [-0.8, -0.08, 0.07], gill: -0.62,
    col: { back: '#2e2410', flank: '#b58b3e', belly: '#ecd9a4', fin: '#5a4a32', finDark: '#2a2014', iris: '#e6cf7a', lips: '#b59a6a' } },
  TENCH: { bh: 0.3, vh: 0.28, bx: -0.16, vx: -0.05, ph: 0.13, sy: 0.02, th: 0.32, dorsal: 'round', anal: 'round', tail: 'round', scales: 'tiny', scaleR: 2.4,
    eye: [-0.8, -0.05, 0.065], gill: -0.6, barbels: true, bigPelvic: true,
    col: { back: '#17240a', flank: '#577a1e', belly: '#d9c04e', fin: '#3b4d16', finDark: '#141d06', iris: '#ff4a1c', lips: '#b39a4a' } },
  MIRROR: { bh: 0.39, vh: 0.31, bx: -0.3, vx: -0.08, ph: 0.1, sy: 0.03, th: 0.37, dorsal: 'long', anal: 'short', scales: 'mirror', scaleR: 0,
    eye: [-0.79, -0.05, 0.065], gill: -0.6, barbels: true,
    col: { back: '#3a2408', flank: '#b5772a', belly: '#f6dc92', fin: '#a24a24', finDark: '#4a200c', iris: '#f2c14e', lips: '#d8a070' } },
  LEATHER: { bh: 0.38, vh: 0.31, bx: -0.3, vx: -0.08, ph: 0.105, sy: 0.03, th: 0.37, dorsal: 'long', anal: 'short', scales: 'none', scaleR: 0,
    eye: [-0.79, -0.05, 0.065], gill: -0.6, barbels: true,
    col: { back: '#22200e', flank: '#77703a', belly: '#eadc9c', fin: '#5a4a22', finDark: '#221a08', iris: '#f2c14e', lips: '#c8a870' } },
  COMMON: { bh: 0.37, vh: 0.3, bx: -0.3, vx: -0.08, ph: 0.1, sy: 0.03, th: 0.36, dorsal: 'long', anal: 'short', scales: 'full', scaleR: 6.2,
    eye: [-0.79, -0.05, 0.065], gill: -0.6, barbels: true,
    col: { back: '#4a2c06', flank: '#de9b2a', belly: '#fff0b8', fin: '#b8641c', finDark: '#5a2a08', iris: '#ffd84d', lips: '#e0aa70' } },
};

function fishShape(sp) {
  const { bh, vh, bx, vx, ph, sy } = sp;
  const top = [[[-1, sy], [-0.97, sy - bh * 0.85], [bx - 0.38, -bh], [bx, -bh]], [[bx, -bh], [bx + 0.42, -bh], [0.3, -ph * 1.3], [0.53, -ph]]];
  const bot = [[[0.53, ph], [0.3, ph * 1.4], [vx + 0.42, vh], [vx, vh]], [[vx, vh], [vx - 0.42, vh], [-0.94, sy + vh * 0.75], [-1, sy + 0.04]]];
  return { top, bot, topY: x => contourY(top, x), botY: x => contourY(bot, x) };
}
function bodyPath(ctx, { top, bot }, sy) {
  ctx.beginPath(); ctx.moveTo(...top[0][0]);
  top.forEach(s => ctx.bezierCurveTo(...s[1], ...s[2], ...s[3]));
  ctx.lineTo(...bot[0][0]);
  bot.forEach(s => ctx.bezierCurveTo(...s[1], ...s[2], ...s[3]));
  ctx.quadraticCurveTo(-1.035, sy + 0.02, ...top[0][0]); ctx.closePath();
}
// A fin: base b0 -> tip -> b1 (two cubics), filled dark-at-base to light-at-edge, with rays
function fin(ctx, f, c, k, { rays = 7, alpha = 0.92 } = {}) {
  const { b0, c1, c2, tip, c3, c4, b1 } = f;
  ctx.beginPath(); ctx.moveTo(...b0); ctx.bezierCurveTo(...c1, ...c2, ...tip); ctx.bezierCurveTo(...c3, ...c4, ...b1); ctx.closePath();
  const mid = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = lin(ctx, ...mid, ...tip, [[0, c.finDark], [0.55, c.fin], [1, c.fin]]); ctx.fill();
  ctx.globalAlpha = 1;
  const edge = [...Array.from({ length: 13 }, (_, i) => bez(b0, c1, c2, tip, i / 12)), ...Array.from({ length: 12 }, (_, i) => bez(tip, c3, c4, b1, (i + 1) / 12))];
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1 / k;
  for (let i = 1; i < rays; i++) {
    const t = i / rays, b = [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t], e = edge[Math.round(t * (edge.length - 1))];
    ctx.beginPath(); ctx.moveTo(...b); ctx.lineTo(...e); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2 / k;
  ctx.beginPath(); edge.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); edge.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
  ctx.strokeStyle = 'rgba(20,10,0,0.6)'; ctx.lineWidth = 1.4 / k; ctx.stroke();
}
function fins(sp, g) {
  const t = g.topY, b = g.botY, F = {};
  if (sp.dorsal === 'long') {
    const x0 = -0.36, x1 = 0.3;
    F.dorsal = { b0: [x0, t(x0) + 0.03], c1: [x0 + 0.01, t(x0) - 0.14], c2: [x0 + 0.05, t(x0 + 0.08) - 0.3], tip: [x0 + 0.12, t(x0 + 0.12) - 0.31],
      c3: [x0 + 0.26, t(x0 + 0.26) - 0.12], c4: [x1 - 0.1, t(x1) - 0.1], b1: [x1, t(x1) + 0.02] };
  } else if (sp.dorsal === 'short' || sp.dorsal === 'tall') {
    const x0 = -0.1, x1 = 0.14, hgt = sp.dorsal === 'tall' ? 0.42 : 0.3;
    F.dorsal = { b0: [x0, t(x0) + 0.03], c1: [x0 - 0.01, t(x0) - hgt * 0.5], c2: [x0 + 0.02, t(x0) - hgt * 0.9], tip: [x0 + 0.06, t(x0) - hgt],
      c3: [x0 + 0.12, t(x0 + 0.1) - hgt * 0.5], c4: [x1 - 0.02, t(x1) - 0.06], b1: [x1, t(x1) + 0.02] };
  } else {
    const x0 = -0.1, x1 = 0.18;
    F.dorsal = { b0: [x0, t(x0) + 0.03], c1: [x0 - 0.02, t(x0) - 0.17], c2: [x0 + 0.04, t(x0) - 0.29], tip: [0.04, t(0.04) - 0.28],
      c3: [0.14, t(0.1) - 0.3], c4: [x1 + 0.03, t(x1) - 0.12], b1: [x1, t(x1) + 0.02] };
  }
  if (sp.anal === 'long') {
    F.anal = { b0: [-0.04, b(-0.04) - 0.03], c1: [-0.04, b(-0.04) + 0.12], c2: [-0.01, b(0) + 0.22], tip: [0.04, b(0.04) + 0.24],
      c3: [0.18, b(0.2) + 0.14], c4: [0.38, b(0.38) + 0.08], b1: [0.44, b(0.44) - 0.01] };
  } else {
    const round = sp.anal === 'round';
    F.anal = { b0: [0.17, b(0.17) - 0.03], c1: [0.17, b(0.17) + 0.1], c2: [0.2, b(0.2) + 0.2], tip: [round ? 0.27 : 0.25, b(0.25) + 0.21],
      c3: [round ? 0.36 : 0.3, b(0.3) + 0.2], c4: [0.36, b(0.36) + 0.08], b1: [0.37, b(0.37) - 0.01] };
  }
  const pv = sp.bigPelvic ? 1.35 : 1;
  F.pelvic = { b0: [-0.24, b(-0.24) - 0.04], c1: [-0.24, b(-0.24) + 0.08 * pv], c2: [-0.18, b(-0.18) + 0.2 * pv], tip: [-0.08, b(-0.1) + 0.21 * pv],
    c3: [-0.06, b(-0.08) + 0.12 * pv], c4: [-0.08, b(-0.1) + 0.02], b1: [-0.12, b(-0.12) - 0.03] };
  F.pectoral = { b0: [-0.6, b(-0.6) - 0.1], c1: [-0.58, b(-0.58) + 0.02], c2: [-0.52, b(-0.5) + 0.12], tip: [-0.42, b(-0.44) + 0.13],
    c3: [-0.42, b(-0.44) + 0.04], c4: [-0.48, b(-0.5) - 0.04], b1: [-0.54, b(-0.54) - 0.08] };
  const th = sp.th, ph = sp.ph;
  F.tail = sp.tail === 'round'
    ? { b0: [0.5, -ph * 0.95], c1: [0.66, -th * 0.6], c2: [0.86, -th * 1.05], tip: [0.97, -th * 0.55], c3: [1.04, 0], c4: [1.04, 0.2], b1: [0.5, ph * 0.95], round: true }
    : { b0: [0.5, -ph * 0.95], c1: [0.66, -th * 0.4], c2: [0.86, -th * 0.95], tip: [1.0, -th], c3: [0.9, -th * 0.4], c4: [0.84, -0.04], b1: [0.84, 0] };
  return F;
}
function tail(ctx, sp, F, c, k) {
  if (F.tail.round) { fin(ctx, F.tail, c, k, { rays: 11 }); return; }
  const th = sp.th * (sp.dorsal === 'tall' ? 1.08 : 1), ph = sp.ph;
  const upper = F.tail;
  const lower = { b0: [0.84, 0], c1: [0.84, 0.04], c2: [0.9, th * 0.4], tip: [1.0, th], c3: [0.86, th * 0.95], c4: [0.66, th * 0.4], b1: [0.5, ph * 0.95] };
  fin(ctx, { ...upper, b1: [0.5, ph * 0.95], c3: upper.c3, c4: [0.84, -0.02] }, c, k, { rays: 8 });
  fin(ctx, { ...lower, b0: [0.5, -ph * 0.95] }, c, k, { rays: 8 });
}
function scalesFull(ctx, sp, g, k) {
  const r = sp.scaleR / k, dx = r * 1.25, dy = r * 1.05;
  for (let row = 0, y = -0.55; y < 0.5; y += dy, row++) for (let x = sp.gill + 0.06 + (row % 2) * dx / 2; x < 0.56; x += dx) {
    if (y < g.topY(x) - r || y > g.botY(x) + r) continue;
    const shrink = 1 - Math.max(0, x - 0.2) * 0.9;
    const rr = r * shrink;
    ctx.beginPath(); ctx.arc(x, y, rr, -1.25, 1.25);
    ctx.strokeStyle = 'rgba(40,20,0,0.32)'; ctx.lineWidth = 1.1 / k; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 1.2 / k, y, rr * 0.8, -1.0, 0.4);
    ctx.strokeStyle = 'rgba(255,255,235,0.22)'; ctx.lineWidth = 1 / k; ctx.stroke();
  }
}
function scalesMirror(ctx, g, k) {
  // a few big, uneven mirror scales along the back and the lateral line, as on a real mirror carp
  const rnd = seeded(5), mid = x => (g.topY(x) + g.botY(x)) / 2;
  [[-0.42, 0.075, 0.07], [-0.24, 0.07, 0.085], [-0.05, 0.075, 0.08], [0.14, 0.07, 0.07], [0.32, 0.06, 0.055]]
    .forEach(([x, dy, s]) => plateScale(ctx, x, g.topY(x) + dy + s * 0.6, s, rnd, k));
  [[-0.36, 0.0, 0.065], [-0.12, 0.02, 0.09], [0.1, 0.03, 0.075], [0.3, 0.02, 0.06], [0.45, 0.0, 0.045]]
    .forEach(([x, dy, s]) => plateScale(ctx, x, mid(x) + dy, s, rnd, k));
  plateScale(ctx, -0.02, mid(-0.02) + 0.16, 0.05, rnd, k);
}
function plateScale(ctx, x, y, s, rnd, k) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = i / 9 * Math.PI * 2, rr = s * (0.85 + rnd() * 0.3);
    return [x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr];
  });
  ctx.beginPath();
  pts.forEach((p, i) => {   // smooth outline through the midpoints
    const q = pts[(i + 1) % pts.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    i ? ctx.quadraticCurveTo(...p, ...m) : ctx.moveTo(...m);
  });
  const m0 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
  ctx.quadraticCurveTo(...pts[0], ...m0); ctx.closePath();
  ctx.fillStyle = rad(ctx, x - s * 0.4, y - s * 0.45, 0, s * 1.5, [[0, 'rgba(255,250,225,0.95)'], [0.35, 'rgba(250,204,110,0.85)'], [1, 'rgba(176,104,24,0.75)']]);
  ctx.fill(); ctx.strokeStyle = 'rgba(80,40,6,0.65)'; ctx.lineWidth = 1.2 / k; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.35, s * 0.42, s * 0.16, -0.3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}

function fish(ctx, kind, { cx = CW / 2, cy = CH / 2 + 4, len = 152, tilt = -0.1 } = {}) {
  const sp = SPECIES[kind], c = sp.col, k = len / 2, g = fishShape(sp), F = fins(sp, g);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // far-side fins and tail, behind the body (no canvas shadows in here: see arched())
  tail(ctx, sp, F, c, k); fin(ctx, F.dorsal, c, k, { rays: sp.dorsal === 'long' ? 14 : 8 }); fin(ctx, F.anal, c, k);
  // body, with a hard offset shade where it overlaps the fins behind it
  ctx.save(); ctx.translate(2 / k, 3 / k); bodyPath(ctx, g, sp.sy); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  bodyPath(ctx, g, sp.sy);
  ctx.fillStyle = lin(ctx, 0, -sp.bh, 0, sp.vh, [[0, c.back], [0.42, c.flank], [0.78, c.belly], [1, c.belly]]); ctx.fill();
  ctx.save(); bodyPath(ctx, g, sp.sy); ctx.clip();
  if (sp.scales === 'full') scalesFull(ctx, sp, g, k);
  else if (sp.scales === 'tiny') {
    ctx.globalAlpha = 0.55; scalesFull(ctx, sp, g, k); ctx.globalAlpha = 1;
  } else if (sp.scales === 'mirror') scalesMirror(ctx, g, k);
  else {   // leather: smooth skin with faint mottling
    const rnd = seeded(9);
    for (let i = 0; i < 26; i++) ellipse(ctx, -0.5 + rnd() * 1.0, -0.25 + rnd() * 0.4, 0.03 + rnd() * 0.05, 0.02 + rnd() * 0.03, 'rgba(30,24,6,0.16)');
  }
  // lighting: dark back towards the tail, bright upper flank, warm reflected light on the belly, rim light
  ctx.fillStyle = lin(ctx, -0.2, 0, 0.56, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.28)']]); ctx.fillRect(-1.1, -1, 2.2, 2);
  ctx.fillStyle = rad(ctx, -0.42, -sp.bh * 0.45, 0.02, 0.75, [[0, 'rgba(255,255,240,0.32)'], [1, 'rgba(255,255,240,0)']]); ctx.fillRect(-1.1, -1, 2.2, 2);
  ctx.save(); ctx.translate(-0.18, -sp.bh * 0.52); ctx.scale(1, 0.2);
  ellipse(ctx, 0, 0, 0.5, 0.5, rad(ctx, 0, 0, 0, 0.5, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']])); ctx.restore();
  ctx.fillStyle = lin(ctx, 0, sp.vh * 0.4, 0, sp.vh, [[0, 'rgba(255,240,200,0)'], [1, 'rgba(255,240,200,0.35)']]); ctx.fillRect(-1.1, -1, 2.2, 2);
  ctx.translate(0, 3 / k); bodyPath(ctx, g, sp.sy);
  ctx.strokeStyle = lin(ctx, 0, -sp.bh, 0, 0, [[0, 'rgba(255,250,220,0.55)'], [0.6, 'rgba(255,250,220,0)']]); ctx.lineWidth = 3 / k; ctx.stroke();
  ctx.restore();
  // head: shaded gill cover, mouth, barbels, eye
  ctx.save(); bodyPath(ctx, g, sp.sy); ctx.clip();
  const gx = sp.gill, gt = g.topY(gx) + 0.03, gb = g.botY(gx) - 0.03;
  ctx.beginPath(); ctx.moveTo(gx, gt); ctx.quadraticCurveTo(gx + 0.13, (gt + gb) / 2, gx - 0.03, gb); ctx.lineTo(-1.2, gb); ctx.lineTo(-1.2, gt); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(gx, gt); ctx.quadraticCurveTo(gx + 0.13, (gt + gb) / 2, gx - 0.03, gb);
  ctx.strokeStyle = 'rgba(30,14,0,0.3)'; ctx.lineWidth = 1.6 / k; ctx.stroke();
  ctx.restore();
  bodyPath(ctx, g, sp.sy); ctx.strokeStyle = 'rgba(16,8,0,0.8)'; ctx.lineWidth = 2.2 / k; ctx.stroke();
  // mouth and lips
  const my = sp.sy + 0.02;
  ctx.beginPath(); ctx.ellipse(-1.0, my, 0.035, 0.03, 0, 0, Math.PI * 2); ctx.fillStyle = c.lips; ctx.fill();
  ctx.strokeStyle = 'rgba(30,14,0,0.6)'; ctx.lineWidth = 1.2 / k; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1.0, my + 0.015); ctx.quadraticCurveTo(-0.95, my + 0.06, -0.9, my + 0.045); ctx.stroke();
  if (sp.barbels) {
    ctx.strokeStyle = c.lips; ctx.lineWidth = 2.4 / k;
    ctx.beginPath(); ctx.moveTo(-0.98, my + 0.03); ctx.quadraticCurveTo(-1.0, my + 0.12, -1.06, my + 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.94, my + 0.04); ctx.quadraticCurveTo(-0.93, my + 0.12, -0.97, my + 0.17); ctx.stroke();
  }
  const [ex, ey, er] = sp.eye;
  ellipse(ctx, ex, ey, er * 1.12, er * 1.12, 'rgba(20,10,0,0.55)');
  ellipse(ctx, ex, ey, er, er, rad(ctx, ex - er * 0.3, ey - er * 0.3, 0, er * 1.1, [[0, '#fff6d0'], [0.35, c.iris], [1, '#3a1a00']]));
  ellipse(ctx, ex - er * 0.08, ey + er * 0.02, er * 0.5, er * 0.5, '#050505');
  ellipse(ctx, ex - er * 0.32, ey - er * 0.32, er * 0.22, er * 0.22, 'rgba(255,255,255,0.95)');
  // near-side fins on top
  fin(ctx, F.pectoral, c, k, { rays: 6, alpha: 0.85 });
  fin(ctx, F.pelvic, c, k, { rays: 6, alpha: 0.88 });
  ctx.restore();
}

// ---------------------------------------------------------------- plates
// Colour plates for the fish symbols only; tackle symbols sit straight on the water.
const PLATES = {
  ROACH: ['#2c5fb8', '#0b1d45', '#9fc4ff'],
  BREAM: ['#1f8a46', '#06301a', '#9ff0b8'],
  TENCH: ['#c4601c', '#3a1404', '#ffd0a0'],
  MIRROR: ['#7a34b8', '#1f0838', '#ffd27a'],
  WILD: ['#d9a21a', '#4a2c02', '#fff3b0'],
  ALARM: ['#a3121a', '#2a0204', '#ff9a9a'],
  CASH: ['#0f6f8a', '#062636', '#ffe58a'],
};
function plate(ctx, sym) {
  const [a, b, glow] = PLATES[sym], x = 6, y = 6, w = CW - 12, h = CH - 12;
  shadow(ctx, 10, 4, 'rgba(0,0,0,0.6)');
  rrect(ctx, x, y, w, h, 18); ctx.fillStyle = rad(ctx, CW / 2, CH * 0.42, 6, CW * 0.62, [[0, a], [1, b]]); ctx.fill();
  noShadow(ctx);
  ctx.save(); rrect(ctx, x, y, w, h, 18); ctx.clip();
  // soft light burst behind the subject: rays that fade out towards the rim
  for (let i = 0; i < 12; i++) {
    const a0 = i / 12 * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(CW / 2, CH * 0.45); ctx.arc(CW / 2, CH * 0.45, CW * 0.7, a0, a0 + 0.24); ctx.closePath();
    ctx.fillStyle = rad(ctx, CW / 2, CH * 0.45, 0, CW * 0.7, [[0, glow], [1, 'rgba(0,0,0,0)']]);
    ctx.globalAlpha = 0.1; ctx.fill();
  }
  ctx.globalAlpha = 1;
  ellipse(ctx, CW / 2, CH * 0.45, CW * 0.42, CH * 0.36, rad(ctx, CW / 2, CH * 0.45, 0, CW * 0.42, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]));
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h * 0.45, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(x, y, w, h * 0.45);
  ctx.restore();
  // gold rim: dark bevel, bright metal, fine inner line
  rrect(ctx, x, y, w, h, 18); ctx.strokeStyle = '#3a2204'; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = lin(ctx, 0, y, 0, y + h, [[0, '#fff3c0'], [0.3, '#f2c14e'], [0.55, '#a8701a'], [0.8, '#f7d77a'], [1, '#8a5a12']]); ctx.lineWidth = 3; ctx.stroke();
  rrect(ctx, x + 4, y + 4, w - 8, h - 8, 14); ctx.strokeStyle = 'rgba(255,240,190,0.35)'; ctx.lineWidth = 1; ctx.stroke();
}
function ribbon(ctx, text, y, { fill = ['#fff6c0', '#f2c14e', '#b8780e'], fg = '#3a1a00', size = 20, edge = '#2a1200' } = {}) {
  ctx.font = `900 ${size}px ${FONT}`; const tw = ctx.measureText(text).width, w = tw + 30, h = size + 10, x = CW / 2 - w / 2;
  shadow(ctx, 6, 3, 'rgba(0,0,0,0.6)');
  // tails
  ctx.fillStyle = fill[2];
  for (const s of [-1, 1]) {
    const ex = CW / 2 + s * (w / 2 + 8);
    ctx.beginPath(); ctx.moveTo(CW / 2 + s * (w / 2 - 6), y - h / 2 + 4); ctx.lineTo(ex, y - h / 2 + 4); ctx.lineTo(ex - s * 7, y + 4); ctx.lineTo(ex, y + h / 2 + 4);
    ctx.lineTo(CW / 2 + s * (w / 2 - 6), y + h / 2 + 4); ctx.closePath(); ctx.fill();
  }
  rrect(ctx, x, y - h / 2, w, h, 6); ctx.fillStyle = lin(ctx, 0, y - h / 2, 0, y + h / 2, [[0, fill[0]], [0.5, fill[1]], [1, fill[2]]]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeText(text, CW / 2, y + 2);
  ctx.fillStyle = fg; ctx.fillText(text, CW / 2, y + 1.5); ctx.textBaseline = 'alphabetic';
}
function sparkles(ctx, pts) {
  for (const [x, y, s] of pts) {
    ellipse(ctx, x, y, s * 2.4, s * 2.4, rad(ctx, x, y, 0, s * 2.4, [[0, 'rgba(255,255,230,0.75)'], [1, 'rgba(255,255,230,0)']]));
    const r = s * 2.6, q = s * 0.35;
    ctx.beginPath(); ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + q, y - q, x + r, y); ctx.quadraticCurveTo(x + q, y + q, x, y + r);
    ctx.quadraticCurveTo(x - q, y + q, x - r, y); ctx.quadraticCurveTo(x - q, y - q, x, y - r); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,245,0.95)'; ctx.fill();
  }
}
function droplets(ctx, pts) {
  for (const [x, y, r] of pts) {
    ellipse(ctx, x, y, r, r * 1.2, rad(ctx, x - r * 0.3, y - r * 0.4, 0, r * 1.3, [[0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(170,225,255,0.7)'], [1, 'rgba(60,140,190,0.35)']]), 'rgba(10,40,60,0.5)', 0.8);
  }
}

// ---------------------------------------------------------------- tackle symbols (drawn without a plate)
function drawFloat(ctx) {
  const cx = CW / 2 + 4;
  // water surface with ripple rings
  ellipse(ctx, cx - 4, 100, 62, 15, rad(ctx, cx - 4, 100, 4, 62, [[0, 'rgba(120,200,235,0.75)'], [1, 'rgba(40,110,150,0.55)']]));
  for (const [rx, a] of [[60, 0.65], [44, 0.75], [28, 0.9]]) ellipse(ctx, cx - 4, 100, rx, rx * 0.24, null, `rgba(225,248,255,${a})`, 2.2);
  ctx.save(); ctx.translate(cx, 100); ctx.rotate(0.16);
  // underwater part, seen through the water
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-9, 16, 0, 28); ctx.quadraticCurveTo(9, 16, 6, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(210,190,140,0.55)'; ctx.fill();
  // float body above the water: cream body, black band, fluorescent orange tip
  const body = () => { ctx.beginPath(); ctx.moveTo(-7, 0); ctx.bezierCurveTo(-9, -30, -5, -62, -3.5, -82); ctx.lineTo(3.5, -82); ctx.bezierCurveTo(5, -62, 9, -30, 7, 0); ctx.closePath(); };
  body(); ctx.fillStyle = lin(ctx, -9, 0, 9, 0, [[0, '#d8c9a0'], [0.45, '#fffdf4'], [1, '#b9a777']]); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = lin(ctx, -9, 0, 9, 0, [[0, '#ff4d00'], [0.45, '#ffb15c'], [1, '#d13a00']]); ctx.fillRect(-10, -84, 20, 30);
  ctx.fillStyle = '#17110a'; ctx.fillRect(-10, -56, 20, 5); ctx.fillRect(-10, -24, 20, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-4, -80, 2.5, 78);
  ctx.restore();
  ellipse(ctx, 0, -82, 3.5, 1.6, '#ff6a1a');
  ctx.restore();
  // a few splash droplets: the float has just dipped
  droplets(ctx, [[cx - 34, 74, 3], [cx + 26, 70, 2.6], [cx - 20, 62, 2], [cx + 38, 84, 2.2]]);
}
function boilie(ctx, x, y, r, [a, b, c], seed) {
  ellipse(ctx, x, y, r, r, rad(ctx, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.15, [[0, a], [0.55, b], [1, c]]));
  const rnd = seeded(seed);
  for (let i = 0; i < 18; i++) {
    const ang = rnd() * Math.PI * 2, d = r * Math.sqrt(rnd()) * 0.85;
    ellipse(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1.1 + rnd(), 1.1 + rnd(), `rgba(70,25,8,${0.35 + rnd() * 0.3})`);
  }
  ellipse(ctx, x - r * 0.38, y - r * 0.42, r * 0.3, r * 0.17, 'rgba(255,255,255,0.6)');
}
function hook(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
  const steel = lin(ctx, -14, 0, 14, 0, [[0, '#5e666d'], [0.5, '#f2f6f8'], [1, '#7c858c']]);
  ctx.strokeStyle = steel; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 6); ctx.arc(-11, 6, 11, 0, Math.PI * 0.95); ctx.lineTo(-23, -6); ctx.stroke();
  ctx.fillStyle = '#c9d1d6'; ctx.beginPath(); ctx.moveTo(-23, -10); ctx.lineTo(-19, -1); ctx.lineTo(-25, -2); ctx.closePath(); ctx.fill();
  ellipse(ctx, 0, -33, 3.5, 3.5, null, steel, 2.5);
  ctx.restore();
}
function drawBoilies(ctx) {
  // hair rig: line, hook and a snowman of two boilies (bottom bait + fluoro pop-up)
  ctx.strokeStyle = 'rgba(230,240,230,0.85)'; ctx.lineWidth = 1.6;
  hook(ctx, 120, 82, 1.15);
  ctx.beginPath(); ctx.moveTo(114, 104); ctx.quadraticCurveTo(96, 104, 86, 92); ctx.stroke();
  boilie(ctx, 64, 88, 31, ['#ffd0b0', '#e2583a', '#8a1f10'], 3);
  boilie(ctx, 76, 44, 23, ['#fffcc8', '#ffe02a', '#c08a00'], 7);
  boilie(ctx, 30, 108, 13, ['#ffd6ec', '#ff5aa5', '#9a1f58'], 11);
}
function kernel(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-s * 0.75, -s * 0.8); ctx.quadraticCurveTo(0, -s * 1.15, s * 0.75, -s * 0.8);
  ctx.quadraticCurveTo(s * 0.95, s * 0.1, s * 0.4, s * 0.95); ctx.quadraticCurveTo(0, s * 1.1, -s * 0.4, s * 0.95);
  ctx.quadraticCurveTo(-s * 0.95, s * 0.1, -s * 0.75, -s * 0.8); ctx.closePath();
  ctx.fillStyle = rad(ctx, -s * 0.25, -s * 0.35, 0, s * 1.4, [[0, '#fffbd0'], [0.35, '#ffd21f'], [0.8, '#f29a00'], [1, '#c26a00']]); ctx.fill();
  ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 1.1; ctx.stroke();
  ellipse(ctx, 0, s * 0.68, s * 0.3, s * 0.2, 'rgba(255,250,215,0.95)');
  ellipse(ctx, -s * 0.3, -s * 0.45, s * 0.25, s * 0.14, 'rgba(255,255,255,0.85)');
  ctx.restore();
}
function drawCorn(ctx) {
  const x0 = 26, x1 = 104, cx = (x0 + x1) / 2, top = 50, bot = 112, ry = 11;
  // lid bent back behind the tin
  ctx.save(); ctx.translate(cx + 26, top - 18); ctx.rotate(0.5);
  ellipse(ctx, 0, 0, 34, 13, lin(ctx, -34, 0, 34, 0, [[0, '#7d868c'], [0.5, '#f4f7f8'], [1, '#8d969c']]), '#1d2226', 1.5);
  ellipse(ctx, 0, 0, 27, 9, null, 'rgba(0,0,0,0.25)', 1.5);
  ctx.restore();
  // tin body
  const side = () => { ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.ellipse(cx, bot, (x1 - x0) / 2, ry, 0, Math.PI, 0, true); ctx.lineTo(x1, top); ctx.closePath(); };
  side(); ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, '#6d767c'], [0.3, '#eef2f4'], [0.6, '#a7b0b6'], [1, '#4d555b']]); ctx.fill();
  ctx.save(); side(); ctx.clip();
  ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, '#0e4a1c'], [0.35, '#2fa14a'], [0.7, '#1d7a34'], [1, '#0a3414']]); ctx.fillRect(x0, top + 12, x1 - x0, 44);
  ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, '#b88a00'], [0.35, '#ffe14a'], [1, '#a87a00']]); ctx.fillRect(x0, top + 20, x1 - x0, 7);
  ellipse(ctx, cx + 4, top + 40, 15, 9, '#ffd21f', '#6a3a00', 1.2);
  for (let i = -2; i <= 2; i++) ellipse(ctx, cx + 4 + i * 5, top + 40, 2, 6, 'rgba(255,250,210,0.6)');
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = top + 4; y < bot; y += 6) ctx.fillRect(x0, y, x1 - x0, 1);
  ctx.restore();
  side(); ctx.strokeStyle = '#1d2226'; ctx.lineWidth = 1.6; ctx.stroke();
  // rim and the corn heaped inside
  ellipse(ctx, cx, top, (x1 - x0) / 2, ry, '#c9a020', '#1d2226', 1.6);
  ellipse(ctx, cx, top, (x1 - x0) / 2 - 3, ry - 2.5, null, 'rgba(255,255,255,0.7)', 1.5);
  const rnd = seeded(31), ks = [];
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()); ks.push([cx + Math.cos(a) * d * 30, top - 4 + Math.sin(a) * d * 7 - (1 - d) * 12, 7.5, (rnd() - 0.5) * 2]); }
  ks.sort((a, b) => a[1] - b[1]).forEach(([x, y, sz, r]) => kernel(ctx, x, y, sz, r));
  // spilled corn in front
  [[118, 104, 8.5, 0.6], [138, 112, 8, -0.8], [126, 118, 8.5, 2.1], [148, 98, 7.5, 1.3], [112, 120, 7.5, -0.3], [100, 122, 7, 2.6], [150, 120, 7, 0.2]]
    .sort((a, b) => a[1] - b[1]).forEach(([x, y, sz, r]) => kernel(ctx, x, y, sz, r));
}
// A cuboid of luncheon meat seen from above at an angle: footprint w x d turned by yaw, height h
function meatCube(ctx, x, y, w, d, h, yaw, seed) {
  const c = Math.cos(yaw), sn = Math.sin(yaw), squash = 0.55;
  const P = (gx, gy, z) => [x + gx * c - gy * sn, y + (gx * sn + gy * c) * squash - z];
  const base = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  const rnd = seeded(seed);
  const face = (pts, fill, flecks) => {
    const path = () => { ctx.beginPath(); pts.forEach((pt, i) => i ? ctx.lineTo(...pt) : ctx.moveTo(...pt)); ctx.closePath(); };
    path(); ctx.fillStyle = fill; ctx.fill();
    ctx.save(); path(); ctx.clip();
    const xs = pts.map(pt => pt[0]), ys = pts.map(pt => pt[1]);
    for (let i = 0; i < flecks; i++) {   // fat specks, and the odd darker fleck
      const fx = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), fy = Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys));
      ellipse(ctx, fx, fy, 0.5 + rnd() * 0.9, 0.4 + rnd() * 0.6, i % 5 ? 'rgba(255,238,232,0.8)' : 'rgba(160,62,56,0.35)');
    }
    ctx.restore();
    path(); ctx.strokeStyle = 'rgba(70,20,16,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  };
  // side faces that point towards the viewer, then the top
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = base[i], [bx, by] = base[(i + 1) % 4];
    const ny = ((ax + bx) / 2) * sn + ((ay + by) / 2) * c;   // how far the face points down the screen
    if (ny > 0) sides.push({ i, ny, nx: ((ax + bx) / 2) * c - ((ay + by) / 2) * sn, pts: [P(ax, ay, 0), P(bx, by, 0), P(bx, by, h), P(ax, ay, h)] });
  }
  sides.sort((m, n) => m.ny - n.ny).forEach(f => face(f.pts, f.nx < 0 ? '#e0857a' : '#c2645a', Math.round(w * h / 18)));
  const top = base.map(([gx, gy]) => P(gx, gy, h));
  face(top, lin(ctx, top[0][0], top[0][1], top[2][0], top[2][1], [[0, '#ffcfc4'], [1, '#f3a093']]), Math.round(w * d / 16));
  ctx.beginPath(); ctx.moveTo(...top[0]); ctx.lineTo(...top[1]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
}
function drawMeat(ctx) {
  // the block it was cut from, then a heap of cubes in front
  meatCube(ctx, 58, 64, 62, 44, 34, -0.35, 3);
  [[116, 70, 0.5, 5], [142, 84, 0.15, 6], [52, 108, 0.7, 8], [86, 106, 0.25, 9], [120, 110, -0.3, 10], [148, 118, 0.4, 7]]
    .sort((m, n) => m[1] - n[1]).forEach(([x, y, yaw, seed]) => meatCube(ctx, x, y, 24, 24, 20, yaw, seed));
}
function drawFlask(ctx) {
  const cx = CW / 2 - 6;
  // cup (the lid) beside the flask, steaming
  ctx.save(); ctx.translate(cx + 48, 92);
  ctx.beginPath(); ctx.moveTo(-15, -16); ctx.lineTo(15, -16); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.closePath();
  ctx.fillStyle = lin(ctx, -15, 0, 15, 0, [[0, '#6d767c'], [0.4, '#f1f4f6'], [0.7, '#a7b0b6'], [1, '#596066']]); ctx.fill();
  ctx.strokeStyle = '#1d2226'; ctx.lineWidth = 1.5; ctx.stroke();
  ellipse(ctx, 0, -16, 15, 4.5, '#5a3418', '#1d2226', 1.5);
  ellipse(ctx, -3, -17, 8, 2, 'rgba(255,220,170,0.5)');
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const dx of [-6, 6]) { ctx.beginPath(); ctx.moveTo(cx + 48 + dx, 66); ctx.bezierCurveTo(cx + 40 + dx, 54, cx + 58 + dx, 46, cx + 48 + dx, 30); ctx.stroke(); }
  // flask
  rrect(ctx, cx - 27, 34, 54, 86, 12);
  ctx.fillStyle = lin(ctx, cx - 27, 0, cx + 27, 0, [[0, '#123d1f'], [0.3, '#3ea35a'], [0.55, '#2a7a40'], [1, '#0e2e18']]); ctx.fill();
  ctx.strokeStyle = '#08160c'; ctx.lineWidth = 2; ctx.stroke();
  const steel = lin(ctx, cx - 29, 0, cx + 29, 0, [[0, '#6d767c'], [0.35, '#ffffff'], [0.65, '#a7b0b6'], [1, '#4d555b']]);
  rrect(ctx, cx - 29, 104, 58, 18, 7); ctx.fillStyle = steel; ctx.fill(); ctx.strokeStyle = '#1d2226'; ctx.stroke();
  rrect(ctx, cx - 23, 16, 46, 24, 7); ctx.fillStyle = steel; ctx.fill(); ctx.stroke();
  rrect(ctx, cx - 15, 8, 30, 11, 4); ctx.fillStyle = '#23272b'; ctx.fill(); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - 21 + i * 8, 18, 2, 20); }
  rrect(ctx, cx - 19, 58, 38, 30, 5); ctx.fillStyle = '#f5ecd2'; ctx.fill(); ctx.strokeStyle = '#7a5a20'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#7a2a10'; ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('TEA', cx, 78);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - 19, 40, 5, 62);
}
function drawCatapult(ctx, loaded = true) {
  ctx.save(); ctx.translate(CW / 2, CH / 2 + 2); ctx.rotate(-0.14);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // handle with a ribbed rubber grip
  rrect(ctx, -11, 8, 22, 56, 10); ctx.fillStyle = lin(ctx, -11, 0, 11, 0, [[0, '#121212'], [0.45, '#55595e'], [1, '#0e0e0e']]); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-10, 16 + i * 7.5, 20, 2.5); }
  // aluminium yoke
  const alu = lin(ctx, -44, 0, 44, 0, [[0, '#5f6870'], [0.3, '#f4f8fa'], [0.6, '#9aa3aa'], [1, '#4f575e']]);
  const yoke = () => { ctx.beginPath(); ctx.moveTo(0, 14); ctx.quadraticCurveTo(-2, -12, -40, -48); ctx.moveTo(0, 14); ctx.quadraticCurveTo(2, -12, 40, -48); };
  yoke(); ctx.strokeStyle = '#0d1114'; ctx.lineWidth = 16; ctx.stroke();
  yoke(); ctx.strokeStyle = alu; ctx.lineWidth = 11; ctx.stroke();
  yoke(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.5; ctx.translate(-2, -1); ctx.stroke(); ctx.translate(2, 1);
  // latex tubing to a leather pouch loaded with boilies
  const elastic = () => { ctx.beginPath(); ctx.moveTo(-40, -48); ctx.quadraticCurveTo(-30, -26, -20, -10); ctx.moveTo(40, -48); ctx.quadraticCurveTo(30, -26, 20, -10); };
  elastic(); ctx.strokeStyle = '#3a1600'; ctx.lineWidth = 10; ctx.stroke();
  elastic(); ctx.strokeStyle = lin(ctx, -40, 0, 40, 0, [[0, '#ff8a00'], [0.5, '#ffc04d'], [1, '#ff8a00']]); ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-24, -12); ctx.quadraticCurveTo(0, 14, 24, -12); ctx.quadraticCurveTo(0, 0, -24, -12); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, -12, 0, 8, [[0, '#6a4428'], [1, '#2a160a']]); ctx.fill(); ctx.strokeStyle = '#120800'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  if (loaded) {
    boilie(ctx, CW / 2 - 12, CH / 2 - 14, 10, ['#fffcc8', '#ffe02a', '#c08a00'], 2);
    boilie(ctx, CW / 2 + 9, CH / 2 - 17, 10, ['#ffd0b0', '#e2583a', '#8a1f10'], 5);
    boilie(ctx, CW / 2 - 1, CH / 2 - 6, 9, ['#ffd6ec', '#ff5aa5', '#9a1f58'], 8);
  }
  ctx.save(); ctx.translate(CW / 2, CH / 2 + 2); ctx.rotate(-0.14);
  for (const sx of [-1, 1]) ellipse(ctx, sx * 40, -48, 7, 7, rad(ctx, sx * 40 - 2, -50, 0, 8, [[0, '#ffffff'], [1, '#6d767c']]), '#0d1114', 2);
  ctx.restore();
}
function drawNet(ctx) {
  ctx.save(); ctx.translate(CW / 2 + 4, CH / 2); ctx.rotate(-0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // handle
  ctx.strokeStyle = '#0b0f12'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(56, 60); ctx.stroke();
  ctx.strokeStyle = lin(ctx, 0, 0, 60, 60, [[0, '#3a3f44'], [0.5, '#8a939b'], [1, '#2a2e32']]); ctx.lineWidth = 6.5; ctx.stroke();
  // net mesh hanging below the arms
  const arms = [[-70, -50], [0, 10], [56, -54]];
  ctx.beginPath(); ctx.moveTo(...arms[0]); ctx.lineTo(...arms[1]); ctx.lineTo(...arms[2]);
  ctx.quadraticCurveTo(-2, -44, ...arms[0]); ctx.closePath();
  ctx.beginPath(); ctx.moveTo(-70, -50); ctx.bezierCurveTo(-62, 10, -20, 52, 2, 46); ctx.bezierCurveTo(24, 40, 52, 0, 56, -54); ctx.quadraticCurveTo(-2, -44, -70, -50); ctx.closePath();
  ctx.fillStyle = 'rgba(16,40,26,0.62)'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(170,215,170,0.7)'; ctx.lineWidth = 1.2;
  for (let i = -160; i < 160; i += 9) {
    ctx.beginPath(); ctx.moveTo(i, -80); ctx.quadraticCurveTo(i + 40, 0, i + 90, 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 90, -80); ctx.quadraticCurveTo(i + 50, 0, i, 70); ctx.stroke();
  }
  ctx.fillStyle = lin(ctx, 0, -50, 0, 50, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]); ctx.fillRect(-90, -60, 180, 120);
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,30,18,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  // arms, spreader block and the cord across the top
  ctx.strokeStyle = '#0b0f12'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...arms[0]); ctx.lineTo(...arms[1]); ctx.lineTo(...arms[2]); ctx.stroke();
  ctx.strokeStyle = lin(ctx, -70, 0, 56, 0, [[0, '#596169'], [0.5, '#dfe6ea'], [1, '#596169']]); ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-70, -50); ctx.quadraticCurveTo(-2, -44, 56, -54); ctx.strokeStyle = '#f2efe4'; ctx.lineWidth = 2.2; ctx.stroke();
  rrect(ctx, -9, 2, 18, 16, 4); ctx.fillStyle = lin(ctx, -9, 0, 9, 0, [[0, '#222'], [0.5, '#5a5a5a'], [1, '#1a1a1a']]); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  ellipse(ctx, -70, -50, 4, 4, '#2a2e32'); ellipse(ctx, 56, -54, 4, 4, '#2a2e32');
  ctx.restore();
}
function drawBivvy(ctx) {
  const cx = CW / 2;
  ellipse(ctx, cx, 116, 70, 9, 'rgba(0,0,0,0.4)');
  // guy ropes and pegs
  ctx.strokeStyle = 'rgba(235,225,195,0.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(34, 56); ctx.lineTo(8, 116); ctx.moveTo(CW - 34, 56); ctx.lineTo(CW - 8, 116); ctx.stroke();
  ellipse(ctx, 8, 116, 2.5, 2.5, '#ccc'); ellipse(ctx, CW - 8, 116, 2.5, 2.5, '#ccc');
  const dome = () => { ctx.beginPath(); ctx.moveTo(16, 116); ctx.bezierCurveTo(18, 40, 50, 18, cx, 18); ctx.bezierCurveTo(CW - 50, 18, CW - 18, 40, CW - 16, 116); ctx.closePath(); };
  dome(); ctx.fillStyle = lin(ctx, 0, 18, 0, 116, [[0, '#8aa45a'], [0.5, '#5e7a34'], [1, '#33471c']]); ctx.fill();
  ctx.save(); dome(); ctx.clip();
  ctx.fillStyle = lin(ctx, 16, 0, CW - 16, 0, [[0, 'rgba(0,0,0,0.3)'], [0.45, 'rgba(255,255,230,0.12)'], [1, 'rgba(0,0,0,0.35)']]); ctx.fillRect(0, 0, CW, CH);
  // panel seams with stitching
  ctx.strokeStyle = 'rgba(20,30,8,0.6)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx, 18); ctx.bezierCurveTo(52, 36, 40, 80, 38, 116); ctx.moveTo(cx, 18); ctx.bezierCurveTo(CW - 52, 36, CW - 40, 80, CW - 38, 116); ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(230,240,190,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx + 3, 20); ctx.bezierCurveTo(56, 38, 44, 80, 42, 116); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  dome(); ctx.strokeStyle = '#141e08'; ctx.lineWidth = 2; ctx.stroke();
  // open door with a warm lantern glow inside
  const door = () => { ctx.beginPath(); ctx.moveTo(58, 116); ctx.bezierCurveTo(60, 70, 70, 52, cx, 52); ctx.bezierCurveTo(CW - 70, 52, CW - 60, 70, CW - 58, 116); ctx.closePath(); };
  door(); ctx.fillStyle = rad(ctx, cx, 100, 4, 60, [[0, '#ffcf6a'], [0.25, '#c9701e'], [0.6, '#3a1e08'], [1, '#120a02']]); ctx.fill();
  ctx.strokeStyle = '#141e08'; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, cx, 100, 7, 9, rad(ctx, cx, 98, 0, 9, [[0, '#fffbe0'], [0.5, '#ffd36a'], [1, '#c77a12']]), '#3a2206', 1.5);
  ctx.fillStyle = '#3a2206'; ctx.fillRect(cx - 5, 88, 10, 3); ctx.fillRect(cx - 6, 109, 12, 4);
  // rolled-back door flap
  ctx.beginPath(); ctx.moveTo(CW - 58, 116); ctx.bezierCurveTo(CW - 54, 92, CW - 44, 80, CW - 40, 66); ctx.lineTo(CW - 34, 116); ctx.closePath();
  ctx.fillStyle = '#4a6326'; ctx.fill(); ctx.strokeStyle = '#141e08'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawAlarm(ctx) {
  const cx = CW / 2;
  // rod resting across the alarm
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#05070a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(22, 34); ctx.lineTo(CW - 22, 25); ctx.stroke();
  ctx.strokeStyle = lin(ctx, 0, 20, 0, 36, [[0, '#6c757e'], [0.5, '#2a3036'], [1, '#111']]); ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(34, 28, 6, 7);
  // bank stick
  ctx.fillStyle = lin(ctx, cx - 5, 0, cx + 5, 0, [[0, '#4c5257'], [0.5, '#d9dfe3'], [1, '#4c5257']]); ctx.fillRect(cx - 5, 92, 10, 34);
  // swinger hanging below the rod
  ctx.strokeStyle = '#0b0d10'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + 46, 30); ctx.lineTo(cx + 50, 74); ctx.stroke();
  ctx.strokeStyle = '#7c868e'; ctx.lineWidth = 2.5; ctx.stroke();
  rrect(ctx, cx + 44, 72, 13, 22, 5); ctx.fillStyle = lin(ctx, 0, 72, 0, 94, [[0, '#ff6b6b'], [1, '#9a0c0c']]); ctx.fill(); ctx.strokeStyle = '#2a0000'; ctx.lineWidth = 1.5; ctx.stroke();
  // alarm body
  shadow(ctx, 10, 5, 'rgba(0,0,0,0.6)');
  rrect(ctx, cx - 44, 36, 82, 60, 13);
  ctx.fillStyle = lin(ctx, 0, 36, 0, 96, [[0, '#4a4f56'], [0.45, '#22262b'], [1, '#0c0d0f']]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
  rrect(ctx, cx - 40, 39, 74, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  // V roller head
  ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.moveTo(cx - 28, 38); ctx.lineTo(cx - 12, 26); ctx.lineTo(cx + 8, 26); ctx.lineTo(cx + 22, 38); ctx.closePath(); ctx.fill();
  // glowing LED
  ellipse(ctx, cx - 18, 66, 30, 30, rad(ctx, cx - 18, 66, 2, 30, [[0, 'rgba(255,120,120,1)'], [0.35, 'rgba(255,40,40,0.55)'], [1, 'rgba(255,0,0,0)']]));
  ellipse(ctx, cx - 18, 66, 10, 10, rad(ctx, cx - 21, 63, 1, 11, [[0, '#ffffff'], [0.35, '#ff7b7b'], [1, '#b80a0a']]), '#2a0000', 2);
  // speaker grille and volume knob
  for (let i = 0; i < 4; i++) { rrect(ctx, cx + 2, 52 + i * 8, 26, 4, 2); ctx.fillStyle = '#050607'; ctx.fill(); }
  ellipse(ctx, cx + 30, 88, 4, 4, '#8a9096', '#000', 1);
}

const DRAW = {
  FLOAT: drawFloat, BOILIE: drawBoilies, CORN: drawCorn, MEAT: drawMeat,
  FLASK: drawFlask, CATAPULT: drawCatapult, NET: drawNet, BIVVY: drawBivvy,
  ROACH: (c, s) => arched(c, s, a => fish(a, 'ROACH', { len: 146, cy: CH / 2 + 4 }), 7),
  BREAM: (c, s) => arched(c, s, a => fish(a, 'BREAM', { len: 140, cy: CH / 2 + 6, tilt: -0.06 }), 5),
  TENCH: (c, s) => arched(c, s, a => fish(a, 'TENCH', { len: 152, cy: CH / 2 + 4 }), 7),
  MIRROR: (c, s) => {
    arched(c, s, a => fish(a, 'MIRROR', { len: 156, cy: CH / 2 + 6 }), 8);
    droplets(c, [[22, 30, 3.2], [148, 112, 2.8], [140, 30, 2.4], [30, 110, 2.2]]); sparkles(c, [[128, 26, 3], [36, 96, 2.2]]);
  },
  WILD: (c, s) => {
    arched(c, s, a => fish(a, 'LEATHER', { len: 150, cy: CH / 2 - 6 }), 7);
    ribbon(c, 'WILD', CH - 26, { size: 24 }); sparkles(c, [[30, 26, 3], [140, 36, 2.6]]);
  },
  ALARM: c => { drawAlarm(c); ribbon(c, 'BITE ALARM', CH - 20, { size: 14, fill: ['#ffd6d6', '#ff4d4d', '#8a0808'], fg: '#ffffff', edge: '#2a0000' }); },
  CASH: (c, s) => arched(c, s, a => fish(a, 'COMMON', { len: 140, cy: CH / 2 - 16, tilt: -0.08 }), 6),
};
const PLAIN = new Set(['FLOAT', 'BOILIE', 'CORN', 'MEAT', 'FLASK', 'CATAPULT', 'NET', 'BIVVY']);
export const SYMBOL_ORDER = ['MIRROR', 'TENCH', 'BREAM', 'ROACH', 'WILD', 'BIVVY', 'NET', 'CATAPULT', 'FLASK', 'ALARM',
  'CORN', 'MEAT', 'BOILIE', 'FLOAT', 'CASH'];

// One symbol as a canvas at `scale` device pixels per design pixel
export function drawSymbolCanvas(sym, scale = artScale) {
  const [c, ctx] = canvas(CW, CH, scale);
  if (PLAIN.has(sym)) sticker(ctx, scale, DRAW[sym]);
  else { plate(ctx, sym); ctx.save(); DRAW[sym](ctx, scale); ctx.restore(); }
  return c;
}
export function makeSymbolTextures(scale = artScale) {
  artScale = scale;
  const out = {};
  for (const sym of Object.keys(DRAW)) out[sym] = new Texture({ source: new CanvasSource({ resource: drawSymbolCanvas(sym, scale), autoGenerateMipmaps: true }) });
  return out;
}

// ---------------------------------------------------------------- reel window and swims
// Under-water backdrop for the reel window: deep green-blue water, light shafts, weed and bubbles.
export function drawReelBackground(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#145466'], [0.45, '#0b3a4a'], [1, '#04161f']]); ctx.fillRect(0, 0, w, h);
  // light shafts, each built from thin slivers so its edges fade out instead of ending in a hard line
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = w * (0.08 + i * 0.17), width = 70;
    for (let j = 0; j < 14; j++) {
      const t = j / 13, a = 0.05 * Math.exp(-((t - 0.5) ** 2) / 0.06), sx = x + t * width;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + width / 13, 0); ctx.lineTo(sx + width / 13 - 120, h); ctx.lineTo(sx - 120, h); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, `rgba(160,230,220,${a})`], [1, 'rgba(160,230,220,0)']]); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // lake bed: a dark, soft-edged band with a few faint weed clumps
  ctx.fillStyle = lin(ctx, 0, h * 0.7, 0, h, [[0, 'rgba(2,14,10,0)'], [1, 'rgba(2,14,10,0.55)']]); ctx.fillRect(0, h * 0.7, w, h * 0.3);
  const rnd = seeded(77);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w, r = 30 + rnd() * 40;
    ellipse(ctx, x, h + 6, r, r * 0.7, rad(ctx, x, h + 6, 0, r, [[0, 'rgba(6,40,24,0.45)'], [1, 'rgba(6,40,24,0)']]));
  }
  for (let i = 0; i < 26; i++) ellipse(ctx, rnd() * w, rnd() * h, 0.8 + rnd() * 1.4, 0.8 + rnd() * 1.4, 'rgba(200,240,255,0.12)');
  ctx.fillStyle = rad(ctx, w / 2, h / 2, h * 0.3, w * 0.62, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]); ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
export function drawSwimPatch(ctx, w = CW, h = CH) {
  const cx = w / 2, cy = h / 2;
  ctx.save();
  rrect(ctx, 3, 3, w - 6, h - 6, 16); ctx.clip();
  ctx.fillStyle = rad(ctx, cx, cy + 6, 6, w * 0.6, [[0, 'rgba(255,214,130,0.55)'], [0.55, 'rgba(255,190,90,0.22)'], [1, 'rgba(255,190,90,0.04)']]); ctx.fillRect(0, 0, w, h);
  const rnd = seeded(13), cols = ['#e2583a', '#ffe02a', '#ff5aa5', '#9a5a26', '#ffd21f'];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()), x = cx + Math.cos(a) * d * w * 0.44, y = cy + Math.sin(a) * d * h * 0.42, r = 2 + rnd() * 3.2;
    ellipse(ctx, x, y, r, r * 0.85, cols[i % cols.length], 'rgba(30,12,0,0.6)', 1);
    ellipse(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, 'rgba(255,255,255,0.6)');
  }
  ctx.restore();
}
export function makeSwimPatchTexture(scale = artScale) {
  const [c, ctx] = canvas(CW, CH, scale); drawSwimPatch(ctx);
  return new Texture({ source: new CanvasSource({ resource: c, autoGenerateMipmaps: true }) });
}
// Marker float: shows where a swim is baited (sits on the swim's corner)
export function makeMarkerTexture(scale = 3) {
  const [c, ctx] = canvas(34, 64, scale);
  ctx.translate(17, 4);
  ellipse(ctx, 0, 52, 14, 4, 'rgba(180,230,255,0.5)', 'rgba(230,250,255,0.8)', 1.5);
  shadow(ctx, 4, 2, 'rgba(0,0,0,0.6)');
  ctx.beginPath(); ctx.moveTo(-5, 52); ctx.bezierCurveTo(-7, 32, -4, 12, -2.5, 2); ctx.lineTo(2.5, 2); ctx.bezierCurveTo(4, 12, 7, 32, 5, 52); ctx.closePath();
  ctx.fillStyle = lin(ctx, -6, 0, 6, 0, [[0, '#d12a00'], [0.45, '#ffb15c'], [1, '#c02400']]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = '#2a0800'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#ffe14a'; ctx.fillRect(-5.5, 18, 11, 7); ctx.fillStyle = '#111'; ctx.fillRect(-6, 34, 12, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-2.5, 6, 1.6, 42);
  return new Texture({ source: new CanvasSource({ resource: c, resolution: scale }) });
}

// ---------------------------------------------------------------- scenery
function trees(ctx, baseY, colour, seed, amp, step) {
  ctx.beginPath(); ctx.moveTo(-10, baseY + 40);
  let s = seed;
  for (let x = -10; x <= W + 20; x += step) {
    s = (s * 9301 + 49297) % 233280; const r = s / 233280;
    ctx.lineTo(x, baseY - amp * (0.4 + r * 0.8));
    ctx.lineTo(x + step / 2, baseY - amp * (0.2 + r * 0.5));
  }
  ctx.lineTo(W + 20, baseY + 40); ctx.closePath(); ctx.fillStyle = colour; ctx.fill();
}
function reeds(ctx, x0, x1, baseY, colour, seed) {
  let s = seed; ctx.strokeStyle = colour; ctx.lineCap = 'round';
  for (let x = x0; x < x1; x += 5) {
    s = (s * 9301 + 49297) % 233280; const r = s / 233280;
    const h = 60 + r * 140, lean = (r - 0.5) * 40;
    ctx.lineWidth = 2 + r * 3; ctx.beginPath(); ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + lean * 0.3, baseY - h * 0.6, x + lean, baseY - h); ctx.stroke();
    if (r > 0.82) { ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + lean * 0.9, baseY - h + 4); ctx.lineTo(x + lean * 0.95, baseY - h + 26); ctx.stroke(); }
  }
}
export function makeSceneTexture(kind = 'dawn') {
  const P = kind === 'dawn'
    ? { sky: [[0, '#1b2a4a'], [0.45, '#5d6f9a'], [0.75, '#f0a879'], [1, '#ffd49a']], sun: '#fff1c9', glow: 'rgba(255,200,120,0.55)',
      far: '#4a5a6e', mid: '#2c3c3c', near: '#16241f', water: [[0, '#d99c7a'], [0.2, '#6d7f9c'], [1, '#0d1b2a']], reed: '#0b1410', mist: 'rgba(255,235,220,0.28)' }
    : { sky: [[0, '#0b0820'], [0.45, '#3b2357'], [0.75, '#c2523c'], [1, '#ff9a4a']], sun: '#ffcf7a', glow: 'rgba(255,120,60,0.55)',
      far: '#3a2a4a', mid: '#22182e', near: '#120c18', water: [[0, '#d9764a'], [0.2, '#5a3a62'], [1, '#07060f']], reed: '#07050a', mist: 'rgba(255,190,170,0.18)' };
  const HZ = 330;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = lin(ctx, 0, 0, 0, HZ, P.sky); ctx.fillRect(0, 0, W, HZ);
  if (kind === 'dusk') for (let i = 0; i < 90; i++) {
    const x = (i * 137.5) % W, y = (i * 61.3) % (HZ * 0.55);
    ellipse(ctx, x, y, 0.6 + (i % 3) * 0.5, 0.6 + (i % 3) * 0.5, `rgba(255,255,255,${0.3 + (i % 5) * 0.12})`);
  }
  ellipse(ctx, W * 0.68, HZ - 18, 160, 160, rad(ctx, W * 0.68, HZ - 18, 10, 160, [[0, P.glow], [1, 'rgba(0,0,0,0)']]));
  ellipse(ctx, W * 0.68, HZ - 18, 34, 34, P.sun);
  trees(ctx, HZ - 6, P.far, 7, 40, 26);
  trees(ctx, HZ + 2, P.mid, 3, 28, 18);
  // water
  ctx.fillStyle = lin(ctx, 0, HZ, 0, H, P.water); ctx.fillRect(0, HZ, W, H - HZ);
  // tree reflections
  ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(0, HZ * 2 + 4); ctx.scale(1, -0.6);
  trees(ctx, HZ + 2, P.mid, 3, 28, 18); ctx.restore();
  // sun streak
  for (let i = 0; i < 26; i++) {
    const y = HZ + 6 + i * i * 0.55, w = 30 + i * 6;
    ctx.fillStyle = `rgba(255,${kind === 'dawn' ? 220 : 160},${kind === 'dawn' ? 160 : 90},${0.5 - i * 0.017})`;
    ctx.fillRect(W * 0.68 - w / 2 + Math.sin(i) * 10, y, w, 2);
  }
  // ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const x = (i * 211) % W, y = HZ + 20 + ((i * 47) % (H - HZ - 20)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + (i % 5) * 12, y); ctx.stroke(); }
  // mist band
  ctx.fillStyle = lin(ctx, 0, HZ - 30, 0, HZ + 40, [[0, 'rgba(0,0,0,0)'], [0.5, P.mist], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, HZ - 30, W, 70);
  // foreground reeds
  reeds(ctx, -10, 190, H + 10, P.reed, 11);
  reeds(ctx, W - 190, W + 10, H + 10, P.reed, 29);
  // vignette
  ctx.fillStyle = rad(ctx, W / 2, H / 2, H * 0.45, W * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]); ctx.fillRect(0, 0, W, H);
  return Texture.from(c);
}

export function makeFrameTexture(scale = 2) {
  const pad = 18, w = REEL_W + pad * 2, h = REEL_H + pad * 2;
  const [c, ctx] = canvas(w, h, scale);
  shadow(ctx, 30, 12, 'rgba(0,0,0,0.6)');
  rrect(ctx, 2, 2, w - 4, h - 4, 22); ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#7a4f26'], [0.5, '#4f3116'], [1, '#2e1c0b']]); ctx.fill();
  noShadow(ctx);
  ctx.strokeStyle = '#d8a656'; ctx.lineWidth = 3; ctx.stroke();
  // wood grain
  ctx.save(); rrect(ctx, 2, 2, w - 4, h - 4, 22); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
  for (let y = 4; y < h; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 3, w * 0.7, y - 3, w, y + 1); ctx.stroke(); }
  ctx.restore();
  rrect(ctx, pad - 4, pad - 4, REEL_W + 8, REEL_H + 8, 14); ctx.fillStyle = '#06131c'; ctx.fill();
  ctx.strokeStyle = 'rgba(242,193,78,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); rrect(ctx, pad, pad, REEL_W, REEL_H, 12); ctx.clip(); ctx.translate(pad, pad);
  drawReelBackground(ctx, REEL_W, REEL_H);
  ctx.restore();
  return { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: scale }) }), pad };
}

// ---------------------------------------------------------------- baiting (catapult) and the kingfisher
const texOf = (c, scale) => new Texture({ source: new CanvasSource({ resource: c, resolution: scale, autoGenerateMipmaps: true }) });
// Catapult for baiting the swims, loaded and just fired; and the handful of boilies it throws
export function makeCatapultTextures(scale = artScale) {
  const out = {};
  for (const [k, loaded] of [['loaded', true], ['empty', false]]) {
    const [c, ctx] = canvas(CW, CH, scale); sticker(ctx, scale, a => drawCatapult(a, loaded)); out[k] = texOf(c, scale);
  }
  return out;
}
export function makeBaitTexture(scale = artScale) {
  const [c, ctx] = canvas(44, 34, scale);
  boilie(ctx, 15, 20, 9, ['#fffcc8', '#ffe02a', '#c08a00'], 2);
  boilie(ctx, 29, 17, 9, ['#ffd0b0', '#e2583a', '#8a1f10'], 5);
  boilie(ctx, 22, 25, 7.5, ['#ffd6ec', '#ff5aa5', '#9a1f58'], 8);
  return texOf(c, scale);
}

// Kingfisher, side on and facing right: 'up' and 'down' are the two wing beats, 'dive' is wings folded
const KF = { blue: '#1a9be0', deep: '#0b4f94', cyan: '#62f0ff', orange: '#ff8f2e', rust: '#d9531a' };
function kingfisherBody(ctx, pose) {
  const wing = (up) => {
    ctx.beginPath(); ctx.moveTo(92, 52);
    if (up) { ctx.bezierCurveTo(84, 22, 62, 4, 30, 2); ctx.bezierCurveTo(44, 14, 50, 26, 46, 34); ctx.bezierCurveTo(58, 40, 70, 48, 78, 58); }
    else { ctx.bezierCurveTo(84, 78, 66, 100, 40, 108); ctx.bezierCurveTo(50, 92, 52, 82, 48, 74); ctx.bezierCurveTo(60, 70, 70, 66, 78, 60); }
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 90, 55, 34, up ? 4 : 104, [[0, KF.blue], [0.6, '#137cc0'], [1, '#08355f']]); ctx.fill();
    ctx.strokeStyle = 'rgba(4,20,40,0.55)'; ctx.lineWidth = 1.4;
    for (let i = 1; i < 4; i++) {   // primary feather tips
      const t = i / 4; ctx.beginPath();
      ctx.moveTo(up ? 78 - t * 28 : 78 - t * 28, up ? 46 - t * 30 : 66 + t * 30); ctx.lineTo(up ? 66 - t * 30 : 66 - t * 26, up ? 38 - t * 30 : 74 + t * 30); ctx.stroke();
    }
  };
  if (pose === 'up') wing(true);
  // tail
  ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(20, 52); ctx.lineTo(22, 64); ctx.lineTo(50, 66); ctx.closePath();
  ctx.fillStyle = KF.deep; ctx.fill();
  // body: orange underneath, blue on top with the bright cyan back stripe
  const body = () => { ctx.beginPath(); ctx.ellipse(78, 60, 34, 18, -0.12, 0, Math.PI * 2); };
  body(); ctx.fillStyle = lin(ctx, 0, 44, 0, 78, [[0, KF.orange], [1, KF.rust]]); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.beginPath(); ctx.moveTo(40, 40); ctx.lineTo(120, 30); ctx.lineTo(120, 56); ctx.bezierCurveTo(96, 58, 70, 62, 40, 66); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 40, 0, 64, [[0, KF.deep], [1, KF.blue]]); ctx.fill();
  ctx.beginPath(); ctx.moveTo(48, 54); ctx.bezierCurveTo(66, 46, 86, 44, 104, 44);
  ctx.strokeStyle = KF.cyan; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
  // head: blue crown with pale speckles, orange cheek, white throat and neck patch, dagger bill
  ellipse(ctx, 112, 46, 19, 17, lin(ctx, 0, 29, 0, 63, [[0, KF.deep], [0.55, KF.blue], [1, KF.blue]]));
  const rnd = seeded(4);
  for (let i = 0; i < 12; i++) ellipse(ctx, 100 + rnd() * 22, 33 + rnd() * 10, 1.2, 0.8, 'rgba(160,240,255,0.8)');
  ctx.beginPath(); ctx.ellipse(110, 52, 13, 6, -0.1, 0, Math.PI * 2); ctx.fillStyle = KF.orange; ctx.fill();
  ellipse(ctx, 96, 52, 5, 6, '#f6fbff');
  ctx.beginPath(); ctx.ellipse(122, 58, 9, 5, 0.2, 0, Math.PI * 2); ctx.fillStyle = '#f6fbff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(126, 44); ctx.lineTo(160, 52); ctx.lineTo(127, 54); ctx.closePath();
  ctx.fillStyle = lin(ctx, 126, 0, 160, 0, [[0, '#1b1b1f'], [1, '#3a3a40']]); ctx.fill();
  ctx.beginPath(); ctx.moveTo(127, 49); ctx.lineTo(158, 52); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  ellipse(ctx, 119, 45, 3.6, 3.6, '#050505'); ellipse(ctx, 118, 43.8, 1.2, 1.2, '#ffffff');
  // feet tucked under
  ellipse(ctx, 84, 77, 4, 2.2, '#e8442a');
  if (pose === 'down') wing(false);
  if (pose === 'dive') {   // wings folded along the back
    ctx.beginPath(); ctx.moveTo(98, 50); ctx.bezierCurveTo(80, 44, 54, 46, 30, 56); ctx.bezierCurveTo(56, 60, 80, 62, 96, 60); ctx.closePath();
    ctx.fillStyle = lin(ctx, 98, 0, 30, 0, [[0, KF.blue], [1, '#08355f']]); ctx.fill();
  }
}
export function makeKingfisherTextures(scale = artScale) {
  const out = {};
  for (const pose of ['up', 'down', 'dive']) {
    const [c, ctx] = canvas(170, 112, scale);
    sticker(ctx, scale, a => kingfisherBody(a, pose), { w: 170, h: 112, width: 2.2, shadowCol: null });
    out[pose] = texOf(c, scale);
  }
  return out;
}

// ---------------------------------------------------------------- logo and app icon
// The name in gold on a gentle arch: dark extrude, thick outline, gold fill, then a gloss on the top half
function wordmark(ctx, text, cx, cy, size, radius, maxW) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const letters = [...text];
  let ws, total;
  for (;; size -= 2) {   // shrink longer names until they fit
    ctx.font = `900 ${size}px ${FONT}`;
    ws = letters.map(ch => ctx.measureText(ch).width + size * 0.03); total = ws.reduce((a, v) => a + v, 0);
    if (total + size * 0.2 <= maxW || size < 30) break;
  }
  let acc = -total / 2;
  const placed = letters.map((ch, i) => { const mid = acc + ws[i] / 2; acc += ws[i]; const a = mid / radius;
    return { ch, a, x: cx + radius * Math.sin(a), y: cy + radius * (1 - Math.cos(a)) }; });
  const each = fn => placed.forEach(l => { if (l.ch === ' ') return; ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a); fn(l); ctx.restore(); });
  ctx.lineJoin = 'round';
  each(l => { for (let d = size * 0.11; d > 0; d -= 1) { ctx.fillStyle = d > size * 0.09 ? '#120700' : '#4a2408'; ctx.fillText(l.ch, 0, d); } });
  each(l => { ctx.lineWidth = size * 0.17; ctx.strokeStyle = '#1a0b02'; ctx.strokeText(l.ch, 0, 0); });
  each(l => { ctx.fillStyle = lin(ctx, 0, -size * 0.74, 0, 0, [[0, '#fff8d6'], [0.32, '#f8cf5a'], [0.6, '#d48a1c'], [0.82, '#f2b33a'], [1, '#ffe692']]); ctx.fillText(l.ch, 0, 0); });
  each(l => { ctx.lineWidth = size * 0.035; ctx.strokeStyle = 'rgba(255,250,220,0.6)'; ctx.strokeText(l.ch, 0, 0); });
  each(l => { ctx.beginPath(); ctx.rect(-size, -size, size * 2, size * 0.62); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText(l.ch, 0, 0); });
  ctx.restore();
}
function splash(ctx, cx, cy, w) {
  for (const [rx, a] of [[w * 0.5, 0.35], [w * 0.36, 0.55], [w * 0.22, 0.8]]) ellipse(ctx, cx, cy, rx, rx * 0.16, null, `rgba(210,245,255,${a})`, 3);
  const rnd = seeded(21);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (1.08 + rnd() * 0.84), d = w * (0.12 + rnd() * 0.3);
    droplets(ctx, [[cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9 - 8, 2.5 + rnd() * 4]]);
  }
}
// kind 'header': the name only, for the top of the game screen. kind 'title': with a leaping mirror carp.
export function makeLogoTexture(kind = 'header', scale = 2) {
  if (kind === 'header') {
    const [c, ctx] = canvas(900, 170, scale);
    wordmark(ctx, GAME_NAME.toUpperCase(), 450, 116, 92, 4200, 860);
    return texOf(c, scale);
  }
  const w = 900, h = 440, [c, ctx] = canvas(w, h, scale);
  ellipse(ctx, w / 2, 230, 380, 170, rad(ctx, w / 2, 230, 0, 380, [[0, 'rgba(120,210,230,0.28)'], [1, 'rgba(120,210,230,0)']]));
  splash(ctx, w / 2 + 40, 300, 420);
  const [fc, f] = canvas(w, 300, scale);
  arched(f, scale, a => fish(a, 'MIRROR', { cx: w / 2 + 20, cy: 150, len: 380, tilt: 0.28 }), 26, w, 300);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fc, 0, 0); ctx.restore();
  sparkles(ctx, [[w / 2 - 210, 70, 5], [w / 2 + 230, 46, 4], [w / 2 + 170, 120, 3]]);
  wordmark(ctx, GAME_NAME.toUpperCase(), w / 2, 380, 100, 2600, 860);
  return texOf(c, scale);
}
// App icon: a leaping mirror carp over lake water, in a gold-rimmed rounded square
export function drawAppIcon(size) {
  const [c, ctx] = canvas(512, 512, size / 512);
  const r = 112;
  ctx.save(); rrect(ctx, 8, 8, 496, 496, r); ctx.clip();
  ctx.fillStyle = rad(ctx, 256, 190, 20, 420, [[0, '#2c9db3'], [0.55, '#0d4a5e'], [1, '#04161f']]); ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(60 + i * 100, 0); ctx.lineTo(110 + i * 100, 0); ctx.lineTo(10 + i * 100, 512); ctx.lineTo(-40 + i * 100, 512); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, 512, [[0, 'rgba(200,250,255,0.1)'], [1, 'rgba(200,250,255,0)']]); ctx.fill();
  }
  ctx.fillStyle = lin(ctx, 0, 330, 0, 512, [[0, 'rgba(8,60,80,0)'], [1, 'rgba(2,20,28,0.8)']]); ctx.fillRect(0, 330, 512, 182);
  splash(ctx, 256, 392, 360);
  ctx.restore();
  const [fc, f] = canvas(512, 512, size / 512);
  arched(f, size / 512, a => fish(a, 'MIRROR', { cx: 268, cy: 236, len: 400, tilt: 0.42 }), 30, 512, 512);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fc, 0, 0); ctx.restore();
  sparkles(ctx, [[120, 120, 7], [400, 96, 5]]);
  rrect(ctx, 8, 8, 496, 496, r); ctx.strokeStyle = '#2a1604'; ctx.lineWidth = 14; ctx.stroke();
  ctx.strokeStyle = lin(ctx, 0, 0, 0, 512, [[0, '#fff3c0'], [0.3, '#f2c14e'], [0.6, '#a8701a'], [1, '#f7d77a']]); ctx.lineWidth = 8; ctx.stroke();
  return c;
}

// Small round particle (bubbles / sparkles / droplets)
export function makeDotTexture() {
  const [c, ctx] = canvas(32, 32, 1);
  ellipse(ctx, 16, 16, 15, 15, rad(ctx, 12, 12, 1, 16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
  return Texture.from(c);
}
