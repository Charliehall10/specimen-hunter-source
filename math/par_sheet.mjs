// PAR sheet data for Specimen Hunter: exact strip maths + simulation of the production engine.
// Usage (from the repo root):  node math/par_sheet.mjs [rounds=50000000] [seed=2026]
// Writes docs/par/specimen-hunter-par.json (read by math/par_xlsx.py to build the spreadsheet).
import fs from 'node:fs';
import { makeEngine, PAY, PAYLINES, FISH, MAX_WIN } from '../client/src/engine.js';

const ROOT = new URL('..', import.meta.url);
const strips = JSON.parse(fs.readFileSync(new URL('client/strips.json', ROOT)));
const N = Number(process.argv[2] ?? 50_000_000), SEED = Number(process.argv[3] ?? 2026);
const PAYING = Object.keys(PAY);
const SYMS = ['FLOAT', 'BOILIE', 'CORN', 'PELLET', 'FLASK', 'CATAPULT', 'NET', 'BIVVY', 'ROACH', 'BREAM', 'TENCH', 'MIRROR', 'WILD', 'ALARM', 'CASH'];

// ---------------------------------------------------------------- exact strip maths
const counts = set => strips[set].map(reel => Object.fromEntries(SYMS.map(s => [s, reel.filter(x => x === s).length])));
const prob = set => strips[set].map(reel => Object.fromEntries(SYMS.map(s => [s, reel.filter(x => x === s).length / reel.length])));

// Probability that a single payline pays symbol S x k (matches the engine: the first non-wild symbol is the
// target, wilds substitute, 5 wilds pay as Mirror Carp x5; lines led by Alarm/Cash after wilds pay nothing).
function lineProbs(p) {
  const out = {};
  for (const S of PAYING) {
    out[S] = [3, 4, 5].map(k => {
      let total = 0;
      for (let j = 0; j < k; j++) {           // j = position of the first non-wild symbol (which is S)
        let pr = 1;
        for (let i = 0; i < j; i++) pr *= p[i].WILD;
        pr *= p[j][S];
        for (let i = j + 1; i < k; i++) pr *= p[i][S] + p[i].WILD;
        if (k < 5) pr *= 1 - p[k][S] - p[k].WILD;
        total += pr;
      }
      if (S === 'MIRROR' && k === 5) total += p.reduce((a, r) => a * r.WILD, 1);   // all five wild
      return total;
    });
  }
  return out;
}
// Probability a symbol is visible anywhere in the 3-row window of each reel
const visible = (set, sym) => strips[set].map(reel => {
  const L = reel.length; let hits = 0;
  for (let p = 0; p < L; p++) if ([0, 1, 2].some(k => reel[(p + k) % L] === sym)) hits++;
  return hits / L;
});

const baseP = prob('base'), fsP = prob('free_spins');
const baseLine = lineProbs(baseP), fsLine = lineProbs(fsP);
const lineRtp = lp => PAYING.reduce((a, S) => a + lp[S].reduce((b, pk, i) => b + pk * PAY[S][i] / 10, 0), 0) * PAYLINES.length;
const pTrigBase = visible('base', 'ALARM').slice(1, 4).reduce((a, v) => a * v, 1);
const pTrigFs = visible('free_spins', 'ALARM').slice(1, 4).reduce((a, v) => a * v, 1);
const fishTotalW = FISH.reduce((a, f) => a + f[2], 0);
const meanFish = FISH.reduce((a, f) => a + f[1] * f[2], 0) / fishTotalW;
const cashPerSpin = strips.free_spins.reduce((a, reel) => a + 3 * reel.filter(x => x === 'CASH').length / reel.length, 0);
const expFsSpins = 10 / (1 - 5 * pTrigFs);
const fsSpinWin = lineRtp(fsLine) + cashPerSpin * meanFish;
const exact = {
  baseLineRtp: lineRtp(baseLine), fsLineRtpPerSpin: lineRtp(fsLine), pTriggerBase: pTrigBase, pRetriggerFs: pTrigFs,
  expectedFreeSpins: expFsSpins, expectedCashFishPerSpin: cashPerSpin, meanFishValue: meanFish,
  expectedFsSpinWin: fsSpinWin, expectedFeatureWinUncapped: expFsSpins * fsSpinWin,
};
exact.featureRtpUncapped = pTrigBase * exact.expectedFeatureWinUncapped;
exact.totalRtpUncapped = exact.baseLineRtp + exact.featureRtpUncapped;

// ---------------------------------------------------------------- simulation (production engine)
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const E = makeEngine(strips, mulberry32(SEED));
const BUCKETS = [[0, 0, 'No win'], [1e-9, 1, 'Below stake (0 < x < 1)'], [1, 2, '1x to <2x'], [2, 5, '2x to <5x'], [5, 10, '5x to <10x'],
  [10, 20, '10x to <20x'], [20, 50, '20x to <50x'], [50, 100, '50x to <100x'], [100, 250, '100x to <250x'], [250, 500, '250x to <500x'],
  [500, 1000, '500x to <1,000x'], [1000, MAX_WIN, '1,000x to <5,000x'], [MAX_WIN, Infinity, '5,000x (cap)']];
const dist = BUCKETS.map(() => ({ n: 0, sum: 0 }));
let sum = 0, sumsq = 0, hits = 0, trig = 0, featSum = 0, fsSpins = 0, max = 0, capped = 0, ldw = 0, baseSum = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = E.playRound();
  const t = r.total;
  sum += t; sumsq += t * t; if (t > max) max = t;
  if (r.hit) hits++;
  if (r.trig) { trig++; fsSpins += r.fsSpins; }
  if (t >= MAX_WIN) capped++;
  if (t > 0 && t < 1) ldw++;
  const b = t === 0 ? 0 : t >= MAX_WIN ? BUCKETS.length - 1 : BUCKETS.findIndex(([lo, hi], j) => j > 0 && t >= lo && t < hi);
  dist[b].n++; dist[b].sum += t;
}
// Separate run for base vs feature split (needs the detailed round)
const E2 = makeEngine(strips, mulberry32(SEED + 1)); const N2 = Math.min(N, 10_000_000);
for (let i = 0; i < N2; i++) { const d = E2.playRoundDetailed(); baseSum += d.base.total; if (d.freeSpins.length) featSum += d.total - d.base.total; }
const mean = sum / N, sd = Math.sqrt(sumsq / N - mean * mean);
const sim = {
  rounds: N, seed: SEED, seconds: Math.round((Date.now() - t0) / 1000), rtp: mean, ci95: 1.96 * sd / Math.sqrt(N), sd,
  hitFrequency: hits / N, featureFrequency: trig / N, avgFreeSpins: fsSpins / Math.max(1, trig), maxWin: max, cappedRounds: capped,
  belowStakeReturns: ldw / N, splitRounds: N2, baseRtpSplit: baseSum / N2, featureRtpSplit: featSum / N2,
  distribution: BUCKETS.map(([lo, hi, label], j) => ({ label, rounds: dist[j].n, probability: dist[j].n / N, rtpContribution: dist[j].sum / N })),
};

const out = {
  game: 'Specimen Hunter', version: 'v1.0 demo', generated: new Date().toISOString(), maxWin: MAX_WIN, lines: PAYLINES, reels: '5x3',
  paytable: PAY, fish: FISH, strips: { base: strips.base, free_spins: strips.free_spins },
  stripCounts: { base: counts('base'), free_spins: counts('free_spins') },
  lineProbabilities: { base: baseLine, free_spins: fsLine },
  alarmVisible: { base: visible('base', 'ALARM'), free_spins: visible('free_spins', 'ALARM') },
  exact, simulation: sim,
};
fs.mkdirSync(new URL('docs/par/', ROOT), { recursive: true });
fs.writeFileSync(new URL('docs/par/specimen-hunter-par.json', ROOT), JSON.stringify(out, null, 1));
console.log(`Exact (uncapped): base lines ${(exact.baseLineRtp * 100).toFixed(3)}%  feature ${(exact.featureRtpUncapped * 100).toFixed(3)}%  total ${(exact.totalRtpUncapped * 100).toFixed(3)}%`);
console.log(`Exact: trigger 1 in ${(1 / pTrigBase).toFixed(1)}, E[free spins] ${expFsSpins.toFixed(3)}, E[feature win] ${exact.expectedFeatureWinUncapped.toFixed(2)}x`);
console.log(`Sim ${N.toLocaleString()} rounds (${sim.seconds}s): RTP ${(mean * 100).toFixed(3)}% +/- ${(sim.ci95 * 100).toFixed(3)}  hit ${(sim.hitFrequency * 100).toFixed(2)}%  ` +
  `feature 1 in ${(1 / sim.featureFrequency).toFixed(1)}  SD ${sd.toFixed(2)}  max ${max.toFixed(1)}x  capped ${capped}`);
