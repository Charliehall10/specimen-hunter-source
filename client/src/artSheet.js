// Dev tool: every symbol drawn on the reel background at 2x, for reviewing art without playing.
// Open http://localhost:5173/art-sheet.html while `npm run dev` is running. Not part of the game build.
import { drawSymbolCanvas, drawReelBackground, drawSwimPatch, SYMBOL_ORDER } from './art.js';
import { CW, CH, GAP } from './config.js';

const S = 2, cols = 5, rows = Math.ceil(SYMBOL_ORDER.length / cols) + 1;
const c = document.createElement('canvas');
const w = cols * CW + (cols - 1) * GAP, h = rows * CH + (rows - 1) * GAP;
c.width = (w + 40) * S; c.height = (h + 40) * S; c.style.width = `${w + 40}px`;
document.body.appendChild(c);
const ctx = c.getContext('2d');
ctx.scale(S, S); ctx.translate(20, 20);
drawReelBackground(ctx, w, h);
SYMBOL_ORDER.forEach((sym, i) => {
  const x = (i % cols) * (CW + GAP), y = Math.floor(i / cols) * (CH + GAP);
  ctx.drawImage(drawSymbolCanvas(sym, S), x, y, CW, CH);
});
// last row: swim patches with a fish over one of them
const y = (rows - 1) * (CH + GAP);
for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(i * (CW + GAP), y); drawSwimPatch(ctx, CW, CH); ctx.restore(); }
ctx.drawImage(drawSymbolCanvas('CASH', S), 0, y, CW, CH);
ctx.drawImage(drawSymbolCanvas('CORN', S), CW + GAP, y, CW, CH);
document.body.dataset.ready = '1';
