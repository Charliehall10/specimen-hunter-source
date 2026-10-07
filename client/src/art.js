// Procedural artwork: every symbol, the lakeside scenes, reel frame and logo are drawn
// with Canvas2D at start-up and turned into Pixi textures. No external image assets.
import { Texture, CanvasSource } from 'pixi.js';
import { W, H, CW, CH, REEL_W, REEL_H, FONT } from './config.js';

export const ART_SCALE = 2;  // symbols are drawn at 2x and shown at 0.5 scale for crisp edges

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

// ---------------------------------------------------------------- symbol plates
const PLATES = {
  low: ['#21495a', '#122c38', '#3f7487'],
  mid: ['#2c4f6e', '#16283c', '#5d86b0'],
  high: ['#5a3c1c', '#2e1d0c', '#c8964a'],
  wild: ['#3f6b1f', '#1c330c', '#f2c14e'],
  alarm: ['#6b1414', '#2a0606', '#ff6b6b'],
  cash: ['#6b5210', '#2e2306', '#ffd84d'],
};
function plate(ctx, tier) {
  const [a, b, edge] = PLATES[tier];
  rrect(ctx, 4, 4, CW - 8, CH - 8, 16);
  ctx.fillStyle = lin(ctx, 0, 0, 0, CH, [[0, a], [1, b]]); ctx.fill();
  ctx.lineWidth = tier === 'low' || tier === 'mid' ? 2 : 3; ctx.strokeStyle = edge; ctx.globalAlpha = 0.85; ctx.stroke();
  ctx.globalAlpha = 1;
  // soft top sheen
  rrect(ctx, 8, 8, CW - 16, CH * 0.38, 12);
  ctx.fillStyle = lin(ctx, 0, 8, 0, CH * 0.45, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]); ctx.fill();
}

// ---------------------------------------------------------------- fish
function fish(ctx, o) {
  const { cx = CW / 2, cy = CH / 2 + 4, len = 128, h = 50, tilt = -0.06, body, fin, finEdge = 'rgba(0,0,0,0.35)',
    scales = 'full', eyeIris = '#d9b23a', barbels = false, deep = 1 } = o;
  const L = len / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  shadow(ctx, 10, 5);
  // tail
  ctx.beginPath(); ctx.moveTo(L * 0.55, 0);
  ctx.quadraticCurveTo(L * 0.8, -h * 0.2, L * 1.02, -h * 0.62);
  ctx.quadraticCurveTo(L * 0.88, 0, L * 1.02, h * 0.62);
  ctx.quadraticCurveTo(L * 0.8, h * 0.2, L * 0.55, 0);
  ctx.fillStyle = fin; ctx.fill(); noShadow(ctx); ctx.strokeStyle = finEdge; ctx.lineWidth = 1.5; ctx.stroke();
  // dorsal
  ctx.beginPath(); ctx.moveTo(-L * 0.2, -h * 0.42 * deep);
  ctx.quadraticCurveTo(-L * 0.05, -h * 0.98 * deep, L * 0.18, -h * 0.82 * deep);
  ctx.lineTo(L * 0.42, -h * 0.3); ctx.closePath(); ctx.fillStyle = fin; ctx.fill(); ctx.stroke();
  // pelvic + anal fins
  ctx.beginPath(); ctx.moveTo(-L * 0.12, h * 0.4 * deep); ctx.quadraticCurveTo(-L * 0.02, h * 0.82 * deep, L * 0.08, h * 0.42 * deep);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.3, h * 0.3); ctx.quadraticCurveTo(L * 0.38, h * 0.68, L * 0.5, h * 0.22);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  const bodyPath = () => {
    ctx.beginPath(); ctx.moveTo(-L, h * 0.04);
    ctx.bezierCurveTo(-L * 0.82, -h * 0.72 * deep, L * 0.28, -h * 0.62 * deep, L * 0.62, -h * 0.1);
    ctx.lineTo(L * 0.62, h * 0.1);
    ctx.bezierCurveTo(L * 0.28, h * 0.6 * deep, -L * 0.82, h * 0.66 * deep, -L, h * 0.04); ctx.closePath();
  };
  bodyPath(); shadow(ctx, 6, 3, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = lin(ctx, 0, -h * 0.6 * deep, 0, h * 0.6 * deep, [[0, body[0]], [0.5, body[1]], [1, body[2]]]); ctx.fill();
  noShadow(ctx);
  ctx.save(); bodyPath(); ctx.clip();
  if (scales === 'full') {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    for (let y = -h * 0.6; y < h * 0.65; y += 7) for (let x = -L * 0.55 + ((y / 7) % 2 ? 4 : 0); x < L * 0.62; x += 8) {
      ctx.beginPath(); ctx.arc(x, y, 5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  } else if (scales === 'mirror') {
    const plates = [[-L * 0.35, -h * 0.28, 7], [-L * 0.12, -h * 0.34, 9], [L * 0.12, -h * 0.3, 8], [L * 0.32, -h * 0.2, 6],
      [-L * 0.25, 0, 6], [L * 0.02, -h * 0.02, 8], [L * 0.24, h * 0.04, 6], [L * 0.45, 0, 5]];
    for (const [x, y, r] of plates) {
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = rad(ctx, x - r * 0.3, y - r * 0.3, 1, r * 1.3, [[0, 'rgba(255,240,190,0.95)'], [1, 'rgba(176,118,34,0.9)']]);
      ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.6)'; ctx.stroke();
    }
  }
  // lateral line and sheen
  ctx.beginPath(); ctx.moveTo(-L * 0.6, -h * 0.05); ctx.quadraticCurveTo(0, -h * 0.1, L * 0.6, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-L * 0.1, -h * 0.28 * deep, L * 0.5, h * 0.1, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  ctx.restore();
  bodyPath(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  // pectoral fin
  ctx.beginPath(); ctx.moveTo(-L * 0.55, h * 0.2); ctx.quadraticCurveTo(-L * 0.4, h * 0.55, -L * 0.28, h * 0.3);
  ctx.closePath(); ctx.fillStyle = fin; ctx.fill(); ctx.strokeStyle = finEdge; ctx.lineWidth = 1.2; ctx.stroke();
  // gill
  ctx.beginPath(); ctx.arc(-L * 0.78, h * 0.02, h * 0.42, -0.9, 0.9);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  // eye
  ellipse(ctx, -L * 0.84, -h * 0.12, 5.2, 5.2, eyeIris, 'rgba(0,0,0,0.6)', 1);
  ellipse(ctx, -L * 0.85, -h * 0.12, 2.6, 2.6, '#0a0a0a');
  ellipse(ctx, -L * 0.86, -h * 0.15, 1, 1, '#fff');
  // mouth + barbels
  ctx.beginPath(); ctx.moveTo(-L * 1.0, h * 0.06); ctx.quadraticCurveTo(-L * 0.95, h * 0.16, -L * 0.88, h * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (barbels) {
    ctx.beginPath(); ctx.moveTo(-L * 0.97, h * 0.12); ctx.quadraticCurveTo(-L * 1.0, h * 0.3, -L * 1.06, h * 0.32);
    ctx.strokeStyle = body[1]; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- tackle symbols
function drawFloat(ctx) {
  const cx = CW / 2;
  ellipse(ctx, cx, 102, 44, 9, null, 'rgba(180,220,235,0.5)', 2);
  ellipse(ctx, cx, 102, 28, 5.5, null, 'rgba(180,220,235,0.7)', 2);
  shadow(ctx, 8, 3);
  ctx.beginPath(); ctx.moveTo(cx, 22); ctx.quadraticCurveTo(cx + 13, 60, cx + 4, 100); ctx.lineTo(cx - 4, 100);
  ctx.quadraticCurveTo(cx - 13, 60, cx, 22); ctx.closePath();
  ctx.fillStyle = lin(ctx, cx - 12, 0, cx + 12, 0, [[0, '#f4ead2'], [0.5, '#fffaf0'], [1, '#c9b991']]); ctx.fill();
  noShadow(ctx);
  ctx.save(); ctx.clip();
  ctx.fillStyle = lin(ctx, cx - 12, 0, cx + 12, 0, [[0, '#c92a2a'], [0.5, '#ff5a3d'], [1, '#8f1d1d']]); ctx.fillRect(cx - 14, 18, 28, 26);
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(cx - 14, 44, 28, 4); ctx.fillRect(cx - 14, 74, 28, 3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 100); ctx.lineTo(cx, 120); ctx.strokeStyle = 'rgba(220,220,220,0.6)'; ctx.lineWidth = 1; ctx.stroke();
}
function drawBoilies(ctx) {
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.bezierCurveTo(70, 20, 100, 40, 136, 34);
  ctx.strokeStyle = 'rgba(220,230,220,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  const balls = [[58, 76, 25, ['#ffd3a6', '#e8915a', '#9a4a1e']], [102, 80, 25, ['#ffe9a8', '#e0b13c', '#8a6510']], [82, 50, 20, ['#ffc2d4', '#e76f98', '#8c2d50']]];
  for (const [x, y, r, [a, b, c]] of balls) {
    shadow(ctx, 8, 4);
    ellipse(ctx, x, y, r, r, rad(ctx, x - r * 0.4, y - r * 0.45, 2, r * 1.15, [[0, a], [0.55, b], [1, c]]));
    noShadow(ctx);
    for (let i = 0; i < 14; i++) {
      const ang = i * 2.4, d = r * (0.25 + ((i * 37) % 10) / 14);
      ellipse(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1.6, 1.6, 'rgba(60,25,10,0.55)');
    }
    ellipse(ctx, x - r * 0.38, y - r * 0.4, r * 0.25, r * 0.15, 'rgba(255,255,255,0.45)');
  }
}
function drawCorn(ctx) {
  const rows = [[42, 44], [66, 36], [90, 40], [114, 46], [36, 70], [60, 64], [84, 66], [108, 70], [132, 74], [52, 94], [78, 92], [102, 96], [126, 100]];
  for (const [x, y] of rows) {
    shadow(ctx, 5, 3);
    ctx.save(); ctx.translate(x, y); ctx.rotate(((x * 13 + y) % 7 - 3) * 0.12);
    rrect(ctx, -11, -12, 22, 24, 9);
    ctx.fillStyle = rad(ctx, -4, -5, 1, 18, [[0, '#fff6b0'], [0.5, '#ffd43b'], [1, '#d9900b']]); ctx.fill();
    noShadow(ctx); ctx.strokeStyle = 'rgba(120,70,0,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    ellipse(ctx, 0, 8, 6, 2.5, 'rgba(255,255,230,0.75)');
    ellipse(ctx, -4, -5, 3.5, 2, 'rgba(255,255,255,0.7)');
    ctx.restore();
  }
}
function drawPellets(ctx) {
  const ps = [[44, 92, 18], [80, 96, 20], [118, 92, 18], [62, 64, 18], [100, 66, 19], [82, 38, 16], [130, 62, 12], [36, 62, 12]];
  for (const [x, y, r] of ps) {
    shadow(ctx, 6, 3);
    ellipse(ctx, x, y + r * 0.25, r, r * 0.55, '#3d2210');
    ctx.fillStyle = '#5a3418'; ctx.fillRect(x - r, y - r * 0.15, r * 2, r * 0.4);
    noShadow(ctx);
    ellipse(ctx, x, y - r * 0.15, r, r * 0.55, rad(ctx, x - r * 0.3, y - r * 0.4, 1, r * 1.2, [[0, '#c78a52'], [0.6, '#8a5428'], [1, '#5a3418']]), 'rgba(0,0,0,0.4)', 1);
    ellipse(ctx, x, y - r * 0.15, r * 0.25, r * 0.12, '#2a160a');
    ellipse(ctx, x - r * 0.45, y - r * 0.35, r * 0.25, r * 0.1, 'rgba(255,230,180,0.55)');
  }
}
function drawFlask(ctx) {
  const cx = CW / 2;
  shadow(ctx, 10, 5);
  rrect(ctx, cx - 26, 30, 52, 88, 10);
  ctx.fillStyle = lin(ctx, cx - 26, 0, cx + 26, 0, [[0, '#1f4d2b'], [0.35, '#3f8f52'], [0.6, '#2f6e3e'], [1, '#143820']]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const steel = lin(ctx, cx - 28, 0, cx + 28, 0, [[0, '#7d868c'], [0.4, '#eef2f4'], [0.7, '#a9b2b8'], [1, '#596066']]);
  rrect(ctx, cx - 28, 100, 56, 20, 6); ctx.fillStyle = steel; ctx.fill(); ctx.stroke();
  rrect(ctx, cx - 22, 14, 44, 22, 6); ctx.fillStyle = steel; ctx.fill(); ctx.stroke();
  rrect(ctx, cx - 16, 8, 32, 10, 4); ctx.fillStyle = '#2b2f33'; ctx.fill();
  rrect(ctx, cx - 18, 56, 36, 26, 4); ctx.fillStyle = 'rgba(240,230,200,0.85)'; ctx.fill();
  ctx.fillStyle = '#3a2a10'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('TEA', cx, 73);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx - 18, 36, 6, 62);
  // steam
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  for (const dx of [-8, 6]) { ctx.beginPath(); ctx.moveTo(cx + dx, 6); ctx.bezierCurveTo(cx + dx - 8, -2, cx + dx + 8, -6, cx + dx, -14); ctx.stroke(); }
}
function drawCatapult(ctx) {
  const cx = CW / 2;
  shadow(ctx, 8, 4);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const wood = lin(ctx, cx - 40, 0, cx + 40, 0, [[0, '#6b3d18'], [0.5, '#b8783a'], [1, '#6b3d18']]);
  ctx.strokeStyle = wood; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(cx, 122); ctx.lineTo(cx, 76); ctx.quadraticCurveTo(cx - 6, 60, cx - 34, 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 76); ctx.quadraticCurveTo(cx + 6, 60, cx + 34, 26); ctx.stroke();
  noShadow(ctx);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx, 104); ctx.lineTo(cx, 120); ctx.stroke();
  ctx.strokeStyle = '#e2b13a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx - 34, 28); ctx.lineTo(cx - 10, 64); ctx.moveTo(cx + 34, 28); ctx.lineTo(cx + 10, 64); ctx.stroke();
  rrect(ctx, cx - 14, 58, 28, 14, 6); ctx.fillStyle = '#3b2a1a'; ctx.fill();
  ellipse(ctx, cx - 4, 60, 4, 4, '#ffe9a8'); ellipse(ctx, cx + 5, 61, 4, 4, '#ffd3a6');
  ctx.lineCap = 'butt';
}
function drawNet(ctx) {
  ctx.save();
  shadow(ctx, 8, 4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = lin(ctx, 0, 0, CW, 0, [[0, '#4a4f55'], [1, '#9aa3ab']]); ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(98, 70); ctx.lineTo(150, 128); ctx.stroke();
  noShadow(ctx);
  // net bag
  ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(108, 18); ctx.lineTo(98, 70); ctx.quadraticCurveTo(64, 132, 40, 86); ctx.closePath();
  ctx.fillStyle = 'rgba(30,60,40,0.55)'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(160,200,160,0.65)'; ctx.lineWidth = 1.2;
  for (let i = -120; i < 160; i += 11) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 120, 140); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + 120, 0); ctx.lineTo(i, 140); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#d9dee2'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(108, 18); ctx.lineTo(98, 70); ctx.moveTo(18, 18); ctx.lineTo(40, 86); ctx.stroke();
  ctx.restore();
}
function drawBivvy(ctx) {
  ellipse(ctx, CW / 2, 112, 70, 10, 'rgba(0,0,0,0.35)');
  shadow(ctx, 10, 5);
  ctx.beginPath(); ctx.moveTo(16, 112); ctx.quadraticCurveTo(30, 22, CW / 2, 22); ctx.quadraticCurveTo(CW - 30, 22, CW - 16, 112); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 22, 0, 112, [[0, '#5d7a3a'], [1, '#2f4320']]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(20,30,10,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CW / 2, 22); ctx.quadraticCurveTo(48, 60, 34, 112); ctx.moveTo(CW / 2, 22); ctx.quadraticCurveTo(CW - 48, 60, CW - 34, 112); ctx.stroke();
  // door
  ctx.beginPath(); ctx.moveTo(60, 112); ctx.quadraticCurveTo(64, 52, CW / 2, 50); ctx.quadraticCurveTo(CW - 64, 52, CW - 60, 112); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 50, 0, 112, [[0, '#1d2a14'], [1, '#0e140a']]); ctx.fill();
  ellipse(ctx, CW / 2, 98, 12, 4, 'rgba(255,190,90,0.6)');
  // guy ropes
  ctx.strokeStyle = 'rgba(230,220,190,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 60); ctx.lineTo(6, 116); ctx.moveTo(CW - 30, 60); ctx.lineTo(CW - 6, 116); ctx.stroke();
}
function drawAlarm(ctx) {
  const cx = CW / 2;
  // rod blank across the top
  ctx.strokeStyle = lin(ctx, 0, 0, CW, 0, [[0, '#222'], [0.5, '#555'], [1, '#222']]); ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, 30); ctx.lineTo(CW - 10, 22); ctx.stroke(); ctx.lineCap = 'butt';
  // bank stick
  ctx.fillStyle = lin(ctx, cx - 5, 0, cx + 5, 0, [[0, '#555'], [0.5, '#bbb'], [1, '#555']]); ctx.fillRect(cx - 5, 92, 10, 34);
  shadow(ctx, 12, 4);
  rrect(ctx, cx - 44, 34, 88, 62, 12);
  ctx.fillStyle = lin(ctx, 0, 34, 0, 96, [[0, '#3a3d42'], [1, '#111316']]); ctx.fill();
  noShadow(ctx); ctx.strokeStyle = '#6c7178'; ctx.lineWidth = 2; ctx.stroke();
  // V-cradle
  ctx.fillStyle = '#2a2c30'; ctx.beginPath(); ctx.moveTo(cx - 30, 34); ctx.lineTo(cx - 10, 24); ctx.lineTo(cx + 10, 24); ctx.lineTo(cx + 30, 34); ctx.closePath(); ctx.fill();
  // LED glow
  ellipse(ctx, cx - 18, 64, 26, 26, rad(ctx, cx - 18, 64, 2, 28, [[0, 'rgba(255,90,90,0.95)'], [0.4, 'rgba(255,40,40,0.5)'], [1, 'rgba(255,0,0,0)']]));
  ellipse(ctx, cx - 18, 64, 9, 9, rad(ctx, cx - 21, 61, 1, 10, [[0, '#fff'], [0.4, '#ff6b6b'], [1, '#c01010']]), '#400', 1.5);
  // speaker grille
  for (let i = 0; i < 4; i++) { rrect(ctx, cx + 4, 48 + i * 9, 30, 4, 2); ctx.fillStyle = '#0a0b0c'; ctx.fill(); }
  ctx.fillStyle = '#ffdede'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('BITE ALARM', cx, 118);
}

function badge(ctx, text, y, fill, fg = '#1a1200') {
  ctx.font = `bold 18px ${FONT}`; const w = ctx.measureText(text).width + 22;
  shadow(ctx, 6, 2);
  rrect(ctx, CW / 2 - w / 2, y - 13, w, 26, 13); ctx.fillStyle = fill; ctx.fill();
  noShadow(ctx); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, CW / 2, y + 1); ctx.textBaseline = 'alphabetic';
}

const DRAW = {
  FLOAT: drawFloat, BOILIE: drawBoilies, CORN: drawCorn, PELLET: drawPellets,
  FLASK: drawFlask, CATAPULT: drawCatapult, NET: drawNet, BIVVY: drawBivvy,
  ROACH: c => fish(c, { len: 120, h: 42, body: ['#5b6f7d', '#cfd8de', '#f4f6f7'], fin: '#d6452f', eyeIris: '#d6452f' }),
  BREAM: c => fish(c, { len: 120, h: 56, deep: 1.15, body: ['#4b3a1c', '#b08a43', '#e2cf9a'], fin: '#3a2c18' }),
  TENCH: c => fish(c, { len: 132, h: 48, scales: 'none', body: ['#2b3b12', '#5f7a25', '#b8a64a'], fin: '#33421a', eyeIris: '#e03131' }),
  MIRROR: c => fish(c, { len: 140, h: 58, scales: 'mirror', barbels: true, body: ['#5a3c14', '#b07a2a', '#f0d68a'], fin: '#7a4a1c' }),
  WILD: c => { fish(c, { len: 140, h: 56, cy: CH / 2 - 6, scales: 'none', barbels: true, body: ['#3d3416', '#8a7a3a', '#e8d79a'], fin: '#4a3d18' }); badge(c, 'WILD', CH - 22, lin(c, 0, CH - 34, 0, CH - 10, [[0, '#fff1a8'], [1, '#e0a412']])); },
  ALARM: drawAlarm,
  CASH: c => fish(c, { len: 132, h: 52, cy: CH / 2 - 14, scales: 'full', barbels: true, body: ['#6b4a12', '#d29a32', '#ffe7a0'], fin: '#8a5a1a' }),
};

export function makeSymbolTextures() {
  const out = {};
  for (const [sym, draw] of Object.entries(DRAW)) {
    const tier = { FLOAT: 'low', BOILIE: 'low', CORN: 'low', PELLET: 'low', FLASK: 'mid', CATAPULT: 'mid', NET: 'mid', BIVVY: 'mid',
      ROACH: 'high', BREAM: 'high', TENCH: 'high', MIRROR: 'high', WILD: 'wild', ALARM: 'alarm', CASH: 'cash' }[sym];
    const [c, ctx] = canvas(CW, CH, ART_SCALE);
    plate(ctx, tier);
    ctx.save(); draw(ctx); ctx.restore();
    out[sym] = new Texture({ source: new CanvasSource({ resource: c, autoGenerateMipmaps: true }) });
  }
  return out;
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

export function makeFrameTexture() {
  const pad = 18, w = REEL_W + pad * 2, h = REEL_H + pad * 2;
  const [c, ctx] = canvas(w, h, 1);
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
  rrect(ctx, pad, pad, REEL_W, REEL_H, 12);
  ctx.fillStyle = lin(ctx, 0, pad, 0, pad + REEL_H, [[0, '#0e2a3a'], [1, '#071722']]); ctx.fill();
  return { texture: Texture.from(c), pad };
}

export function makeLogoTexture() {
  const w = 760, h = 110, [c, ctx] = canvas(w, h, 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 64px ${FONT}`;
  shadow(ctx, 12, 5, 'rgba(0,0,0,0.7)');
  ctx.lineWidth = 10; ctx.strokeStyle = '#2a1606'; ctx.lineJoin = 'round'; ctx.strokeText('SPECIMEN HUNTER', w / 2, 52);
  noShadow(ctx);
  ctx.fillStyle = lin(ctx, 0, 22, 0, 82, [[0, '#fff6c8'], [0.45, '#f2c14e'], [0.55, '#d08a1a'], [1, '#ffdf7a']]);
  ctx.fillText('SPECIMEN HUNTER', w / 2, 52);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeText('SPECIMEN HUNTER', w / 2, 51);
  return Texture.from(c);
}

// Small round particle (bubbles / sparkles / droplets)
export function makeDotTexture() {
  const [c, ctx] = canvas(32, 32, 1);
  ellipse(ctx, 16, 16, 15, 15, rad(ctx, 12, 12, 1, 16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
  return Texture.from(c);
}
