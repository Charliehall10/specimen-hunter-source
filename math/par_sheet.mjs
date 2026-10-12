// PAR sheet data for Specimen Hunter: exact strip maths + simulation of the production engine.
// Usage (from the repo root):  node math/par_sheet.mjs [rounds=50000000] [seed=2026] [capFeatures=20000000]
// Writes docs/par/specimen-hunter-par.json (read by math/par_xlsx.py to build the spreadsheet).
// rounds = 0 prints the exact figures only (quick check while tuning).
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { makeEngine, PAY, PAYLINES, FISH, MAX_WIN, SWIM_COUNT, SWIM_LADDER, swimMult, KINGFISHER_CHANCE, KINGFISHER_WILDS } from '../client/src/engine.js';

const ROOT = new URL('..', import.meta.url);
const strips = JSON.parse(fs.readFileSync(new URL('client/strips.json', ROOT)));
const N = Number(process.argv[2] ?? 50_000_000), SEED = Number(process.argv[3] ?? 2026);
const PAYING = Object.keys(PAY);
const SYMS = ['FLOAT', 'BOILIE', 'CORN', 'MEAT', 'FLASK', 'CATAPULT', 'NET', 'BIVVY', 'ROACH', 'BREAM', 'TENCH', 'MIRROR', 'WILD', 'ALARM', 'CASH'];

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
const pCash = strips.free_spins.map(reel => reel.filter(x => x === 'CASH').length / reel.length);   // per cell, by reel
const cashPerSpin = 3 * pCash.reduce((a, v) => a + v, 0);
// Each swim is on a different reel; any one swim is equally likely to be on any of the 15 cells.
const swimCashPerSpin = SWIM_COUNT * pCash.reduce((a, v) => a + v, 0) / 5;
const expFsSpins = 10 / (1 - 5 * pTrigFs);

// Catches in one swim over a whole feature. The swim's reel also decides whether its alarm shows, so the
// retrigger and the catch are not independent: work out their joint chance per spin, then step through
// the feature exactly (state = spins left x catches so far) until the remaining chance is negligible.
const MAX_CATCH = 24;
function swimCatchDistribution(reel, row) {
  const strip = strips.free_spins[reel], L = strip.length;
  const joint = [[0, 0], [0, 0]];   // [alarm visible on this reel][fish in the swim]
  for (let p = 0; p < L; p++) {
    const win = [0, 1, 2].map(k => strip[(p + k) % L]);
    joint[+win.includes('ALARM')][+(win[row] === 'CASH')] += 1 / L;
  }
  const vis = visible('free_spins', 'ALARM');
  const other = [1, 2, 3].filter(r => r !== reel).reduce((a, r) => a * vis[r], 1);   // other alarm reels
  const pr = [[0, 0], [0, 0]];      // [retrigger][catch]
  for (const hit of [0, 1]) {
    const pHit = joint[0][hit] + joint[1][hit];
    pr[1][hit] = [1, 2, 3].includes(reel) ? joint[1][hit] * other : pHit * pTrigFs;
    pr[0][hit] = pHit - pr[1][hit];
  }
  const out = new Array(MAX_CATCH + 1).fill(0);
  let cur = new Map([[`10,0`, 1]]), live = 1;
  while (live > 1e-15) {
    const next = new Map();
    for (const [key, mass] of cur) {
      const [left, c] = key.split(',').map(Number);
      for (const rt of [0, 1]) for (const hit of [0, 1]) {
        const m = mass * pr[rt][hit]; if (!m) continue;
        const l2 = left - 1 + 5 * rt, c2 = Math.min(MAX_CATCH, c + hit);
        if (l2 === 0) out[c2] += m;
        else { const k2 = `${l2},${c2}`; next.set(k2, (next.get(k2) ?? 0) + m); }
      }
    }
    cur = next; live = [...cur.values()].reduce((a, v) => a + v, 0);
  }
  return out;
}
const cells = [0, 1, 2, 3, 4].flatMap(r => [0, 1, 2].map(k => [r, k]));
const swimCatches = cells.map(([r, k]) => swimCatchDistribution(r, k))
  .reduce((acc, d) => acc.map((v, i) => v + d[i] / cells.length), new Array(MAX_CATCH + 1).fill(0));
const cumMult = n => { let m = 0; for (let c = 0; c < n; c++) m += swimMult(c); return m; };
const swimMultPerSwim = swimCatches.reduce((a, pn, n) => a + pn * cumMult(n), 0);   // E[sum of multipliers paid]
const fsSpinWin = lineRtp(fsLine) + (cashPerSpin - swimCashPerSpin) * meanFish;      // everything except swim catches
// Kingfisher: on a base spin it turns N spots wild: reels 2-4 on one row, plus N-3 more at random on reels 2-5
// (an alarm in a spot stays an alarm). Every payline crosses one cell per reel, so for each possible set of spots
// the line wins follow from each reel's own distribution: a chosen cell is wild (or the reel's alarm), the rest
// are as on the strip. Average over every row and every set of extra spots.
const lineValue = d => { const lp = lineProbs(d); return PAYING.reduce((a, S) => a + lp[S].reduce((b, pk, i) => b + pk * PAY[S][i] / 10, 0), 0); };
const KF_CELLS = [1, 2, 3, 4].flatMap(r => [0, 1, 2].map(k => [r, k]));
const wildCell = r => Object.fromEntries(SYMS.map(s => [s, s === 'WILD' ? 1 - baseP[r].ALARM : s === 'ALARM' ? baseP[r].ALARM : 0]));
const kingfisherSets = n => [0, 1, 2].flatMap(row => {
  const forced = [[1, row], [2, row], [3, row]];
  const pool = KF_CELLS.filter(([r, k]) => !forced.some(([fr, fk]) => fr === r && fk === k));
  const extra = (m, from = 0, acc = []) => acc.length === m ? [acc] : pool.slice(from).flatMap((c, i) => extra(m, from + i + 1, [...acc, c]));
  return extra(n - 3).map(e => [...forced, ...e]);
});
const kingfisherEvByN = Object.fromEntries(KINGFISHER_WILDS.map(([n]) => {
  const sets = kingfisherSets(n);
  const total = sets.reduce((a, set) => a + PAYLINES.reduce((b, pl) =>
    b + lineValue(pl.map((row, r) => set.some(([cr, ck]) => cr === r && ck === row) ? wildCell(r) : baseP[r])), 0), 0);
  return [n, total / sets.length];
}));
const kingfisherEv = KINGFISHER_WILDS.reduce((a, [n, w]) => a + w * kingfisherEvByN[n], 0);

const exact = {
  baseLineRtpNoKingfisher: lineRtp(baseLine), kingfisherChance: KINGFISHER_CHANCE, kingfisherWilds: KINGFISHER_WILDS,
  kingfisherEvByN, kingfisherEv,
  baseLineRtp: (1 - KINGFISHER_CHANCE) * lineRtp(baseLine) + KINGFISHER_CHANCE * kingfisherEv, fsLineRtpPerSpin: lineRtp(fsLine), pTriggerBase: pTrigBase, pRetriggerFs: pTrigFs,
  expectedFreeSpins: expFsSpins, expectedCashFishPerSpin: cashPerSpin, expectedSwimFishPerSpin: swimCashPerSpin, meanFishValue: meanFish,
  swimCount: SWIM_COUNT, swimLadder: SWIM_LADDER, swimCatchDistribution: swimCatches,
  expectedCatchesPerSwim: swimCatches.reduce((a, pn, n) => a + pn * n, 0), expectedSwimMultiplierPerSwim: swimMultPerSwim,
  expectedFsSpinWinOutsideSwims: fsSpinWin, expectedSwimWin: SWIM_COUNT * swimMultPerSwim * meanFish,
};
exact.expectedFeatureWinUncapped = expFsSpins * fsSpinWin + exact.expectedSwimWin;
exact.featureRtpUncapped = pTrigBase * exact.expectedFeatureWinUncapped;
exact.totalRtpUncapped = exact.baseLineRtp + exact.featureRtpUncapped;
const exactReport = () => {
  console.log(`Kingfisher: 1 in ${(1 / KINGFISHER_CHANCE).toFixed(0)}, line win on those spins ${kingfisherEv.toFixed(3)}x ` +
    `(by spots ${Object.entries(kingfisherEvByN).map(([n, v]) => n + ': ' + v.toFixed(2) + 'x').join(', ')}); base lines without it ${(exact.baseLineRtpNoKingfisher * 100).toFixed(3)}%`);
  console.log(`Exact (uncapped): base lines ${(exact.baseLineRtp * 100).toFixed(3)}%  feature ${(exact.featureRtpUncapped * 100).toFixed(3)}%  total ${(exact.totalRtpUncapped * 100).toFixed(3)}%`);
  console.log(`Exact: trigger 1 in ${(1 / pTrigBase).toFixed(1)}, E[free spins] ${expFsSpins.toFixed(3)}, E[feature win] ${exact.expectedFeatureWinUncapped.toFixed(2)}x ` +
    `(swims ${exact.expectedSwimWin.toFixed(2)}x), mean fish ${meanFish.toFixed(4)}x, catches per swim ${exact.expectedCatchesPerSwim.toFixed(4)} ` +
    `(check ${(expFsSpins * swimCashPerSpin / SWIM_COUNT).toFixed(4)})`);
};
if (N === 0) { exactReport(); process.exit(0); }

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
let features2 = 0, swimWin = 0, swimCatchesSim = new Array(8).fill(0), topMult = new Array(SWIM_LADDER.length + 1).fill(0);
for (let i = 0; i < N2; i++) {
  const d = E2.playRoundDetailed(); baseSum += d.base.total;
  if (!d.freeSpins.length) continue;
  featSum += d.total - d.base.total; features2++;
  for (const r of d.freeSpins) for (const f of Object.values(r.cash)) if (f.swim >= 0) swimWin += f.value * f.mult;
  const last = d.freeSpins[d.freeSpins.length - 1].swims;
  last.forEach(w => swimCatchesSim[Math.min(7, w.catches)]++);
  topMult[Math.min(SWIM_LADDER.length, Math.max(...last.map(w => w.catches)))]++;   // most catches in any one swim
}
// What the 5,000x cap costs. The exact maths above ignores the cap, and a record fish in a deep swim can go well
// past it, so simulate whole features with no cap and average how far they go over. (The triggering spin's own
// line win is left out: it is small, so this slightly understates the cost.)
const W = Math.max(1, os.availableParallelism() - 1), NF = Math.round(Number(process.argv[4] ?? 20_000_000) / W) * W;
const parts = await Promise.all(Array.from({ length: W }, (_, i) => new Promise((resolve, reject) => {
  const w = new Worker(new URL('./cap_worker.mjs', import.meta.url), { workerData: { seed: SEED * 1000 + i, features: Math.round(NF / W) } });
  w.on('message', resolve); w.on('error', reject);
})));
const over = parts.reduce((a, p) => a + p.over, 0), over2 = parts.reduce((a, p) => a + p.over2, 0);
const overN = parts.reduce((a, p) => a + p.overN, 0), featMax = Math.max(...parts.map(p => p.max));
const overMean = over / NF, overSd = Math.sqrt(over2 / NF - overMean * overMean);
exact.capCost = pTrigBase * overMean;
exact.capCostCi95 = pTrigBase * 1.96 * overSd / Math.sqrt(NF);
exact.totalRtpWithCap = exact.totalRtpUncapped - exact.capCost;
const capSim = { features: NF, overCap: overN, featuresPerCapHit: NF / Math.max(1, overN), maxUncappedFeatureWin: featMax };
const mean = sum / N, sd = Math.sqrt(sumsq / N - mean * mean);
const sim = {
  rounds: N, seed: SEED, seconds: Math.round((Date.now() - t0) / 1000), rtp: mean, ci95: 1.96 * sd / Math.sqrt(N), sd,
  hitFrequency: hits / N, featureFrequency: trig / N, avgFreeSpins: fsSpins / Math.max(1, trig), maxWin: max, cappedRounds: capped,
  belowStakeReturns: ldw / N, splitRounds: N2, baseRtpSplit: baseSum / N2, featureRtpSplit: featSum / N2,
  splitFeatures: features2, swimShareOfFeatureWin: swimWin / Math.max(1e-9, featSum),
  swimCatchDistribution: swimCatchesSim.map(c => c / Math.max(1, features2 * SWIM_COUNT)),
  bestSwimDistribution: topMult.map(c => c / Math.max(1, features2)), capSimulation: capSim,
  distribution: BUCKETS.map(([lo, hi, label], j) => ({ label, rounds: dist[j].n, probability: dist[j].n / N, rtpContribution: dist[j].sum / N })),
};

const out = {
  game: 'Specimen Hunter', version: 'v1.1 demo (baited swims)', generated: new Date().toISOString(), maxWin: MAX_WIN, lines: PAYLINES, reels: '5x3',
  paytable: PAY, fish: FISH, strips: { base: strips.base, free_spins: strips.free_spins },
  stripCounts: { base: counts('base'), free_spins: counts('free_spins') },
  lineProbabilities: { base: baseLine, free_spins: fsLine },
  alarmVisible: { base: visible('base', 'ALARM'), free_spins: visible('free_spins', 'ALARM') },
  exact, simulation: sim,
};
fs.mkdirSync(new URL('docs/par/', ROOT), { recursive: true });
fs.writeFileSync(new URL('docs/par/specimen-hunter-par.json', ROOT), JSON.stringify(out, null, 1));
exactReport();
console.log(`Cap: ${NF.toLocaleString()} uncapped features, 1 in ${capSim.featuresPerCapHit.toFixed(0)} go over ${MAX_WIN}x (max ${featMax.toFixed(0)}x); ` +
  `cap costs ${(exact.capCost * 100).toFixed(3)}% +/- ${(exact.capCostCi95 * 100).toFixed(3)} RTP -> RTP with cap ${(exact.totalRtpWithCap * 100).toFixed(3)}%`);
console.log(`Sim ${N.toLocaleString()} rounds (${sim.seconds}s): RTP ${(mean * 100).toFixed(3)}% +/- ${(sim.ci95 * 100).toFixed(3)}  hit ${(sim.hitFrequency * 100).toFixed(2)}%  ` +
  `feature 1 in ${(1 / sim.featureFrequency).toFixed(1)}  SD ${sd.toFixed(2)}  max ${max.toFixed(1)}x  capped ${capped}`);
