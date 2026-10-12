// Worker for math/par_sheet.mjs: plays whole features with no 5,000x cap and reports how far they go over it.
import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { makeEngine, MAX_WIN } from '../client/src/engine.js';

const strips = JSON.parse(fs.readFileSync(new URL('../client/strips.json', import.meta.url)));
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const E = makeEngine(strips, mulberry32(workerData.seed));
let over = 0, over2 = 0, overN = 0, max = 0;
for (let i = 0; i < workerData.features; i++) {
  const w = E.featureUncapped(); if (w > max) max = w;
  if (w > MAX_WIN) { const o = w - MAX_WIN; over += o; over2 += o * o; overN++; }
}
parentPort.postMessage({ over, over2, overN, max });
