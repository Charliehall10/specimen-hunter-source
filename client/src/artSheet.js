// Dev tool: every symbol on the reel background at 2x, plus the logos, kingfisher, catapult and app icon,
// for reviewing art without playing. Open http://localhost:5173/art-sheet.html while `npm run dev` is running.
// Not part of the game build. ?icon=512 shows only the app icon at that size (used to export icon PNGs).
import { drawSymbolCanvas, drawReelBackground, drawSwimPatch, SYMBOL_ORDER, makeLogoTexture, makeKingfisherTextures,
  makeCatapultTextures, makeBaitTexture, drawAppIcon } from './art.js';
import { CW, CH, GAP } from './config.js';

const S = 2, q = new URLSearchParams(location.search);
const add = (w, h) => {
  const c = document.createElement('canvas'); c.width = w * S; c.height = h * S; c.style.width = `${w}px`; c.style.display = 'block';
  document.body.appendChild(c); const ctx = c.getContext('2d'); ctx.scale(S, S); return ctx;
};
const img = tex => tex.source.resource;

if (q.get('icon')) {
  const c = drawAppIcon(Number(q.get('icon'))); c.id = 'icon'; document.body.appendChild(c);
} else {
  const cols = 5, rows = Math.ceil(SYMBOL_ORDER.length / cols) + 1;
  const w = cols * CW + (cols - 1) * GAP, h = rows * CH + (rows - 1) * GAP;
  const ctx = add(w + 40, h + 40); ctx.translate(20, 20);
  drawReelBackground(ctx, w, h);
  SYMBOL_ORDER.forEach((sym, i) => ctx.drawImage(drawSymbolCanvas(sym, S), (i % cols) * (CW + GAP), Math.floor(i / cols) * (CH + GAP), CW, CH));
  const y = (rows - 1) * (CH + GAP);
  for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(i * (CW + GAP), y); drawSwimPatch(ctx, CW, CH); ctx.restore(); }
  ctx.drawImage(drawSymbolCanvas('CASH', S), 0, y, CW, CH);
  ctx.drawImage(drawSymbolCanvas('MEAT', S), CW + GAP, y, CW, CH);
  // logos, kingfisher, catapult, bait, icon
  const x2 = add(w + 40, 820); x2.fillStyle = '#0b2a36'; x2.fillRect(0, 0, w + 40, 820);
  x2.drawImage(img(makeLogoTexture('header')), 20, 10, 900, 160);
  x2.drawImage(img(makeLogoTexture('title')), 20, 170, 600, 293);
  const kf = makeKingfisherTextures(S);
  ['up', 'down', 'dive'].forEach((p, i) => x2.drawImage(img(kf[p]), 640, 170 + i * 115, 170, 112));
  const cat = makeCatapultTextures(S);
  x2.drawImage(img(cat.loaded), 20, 480, CW, CH); x2.drawImage(img(cat.empty), 200, 480, CW, CH);
  x2.drawImage(img(makeBaitTexture(S)), 380, 520, 44, 34);
  x2.drawImage(drawAppIcon(512), 460, 480, 256, 256);
  x2.drawImage(drawAppIcon(64), 740, 480, 64, 64);
}
document.body.dataset.ready = '1';
