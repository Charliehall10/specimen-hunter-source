// Checks the JS engine against the Python simulator. Usage: node src/verify.mjs 20000000
import fs from 'node:fs';
import { makeEngine } from './engine.js';
const strips = JSON.parse(fs.readFileSync(new URL('../strips.json', import.meta.url)));
const N = Number(process.argv[2] ?? 20_000_000);
const E = makeEngine(strips);
let sum = 0, sumsq = 0, hits = 0, trig = 0, max = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = E.playRound();
  sum += r.total; sumsq += r.total * r.total;
  if (r.hit) hits++; if (r.trig) trig++; if (r.total > max) max = r.total;
}
const mean = sum / N, sd = Math.sqrt(sumsq / N - mean * mean);
console.log(`Spins ${N.toLocaleString()}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`RTP ${(mean * 100).toFixed(2)}%  (95% CI +/- ${(1.96 * sd / Math.sqrt(N) * 100).toFixed(2)}%)`);
console.log(`Hit freq ${(hits / N * 100).toFixed(2)}%  | Feature 1 in ${(N / trig).toFixed(0)}  | Max ${max.toFixed(0)}x`);
console.log('Python reference: RTP 96.1%, hit 25.5%, feature 1 in 152');
