// Engine tests: run with `npm test`. Uses a seeded RNG so results are repeatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEngine, cryptoRand, PAY, PAYLINES, MAX_WIN, FISH, SWIM_COUNT, swimMult, KINGFISHER_CHANCE } from './engine.js';

const strips = JSON.parse(fs.readFileSync(new URL('../strips.json', import.meta.url)));
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

test('same seed gives the same results', () => {
  const a = makeEngine(strips, mulberry32(42)), b = makeEngine(strips, mulberry32(42));
  for (let i = 0; i < 1000; i++) assert.deepEqual(a.spin('base'), b.spin('base'));
});

test('every reported line matches the grid and pays the table value', () => {
  const E = makeEngine(strips, mulberry32(7));
  for (let i = 0; i < 50000; i++) {
    const r = E.spin(i % 2 ? 'fs' : 'base');
    let units = 0;
    for (const l of r.lines) {
      assert.equal(l.cells.length, l.count);
      l.cells.forEach(([reel, row], j) => {
        assert.equal(reel, j); assert.equal(row, PAYLINES[l.line][reel]);
        assert.ok([l.sym, 'WILD'].includes(r.grid[reel][row]));
      });
      assert.equal(l.units, PAY[l.sym][l.count - 3]);
      units += l.units;
    }
    const cash = Object.values(r.cash).reduce((a, f) => a + f.value * f.mult, 0);
    assert.ok(Math.abs(r.total - (units / 10 + cash)) < 1e-9);
  }
});

test('alarms only on reels 2-4, cash fish only in free spins', () => {
  const E = makeEngine(strips, mulberry32(3));
  for (let i = 0; i < 20000; i++) {
    const b = E.spin('base');
    assert.ok(!b.grid.flat().includes('CASH'));
    [0, 4].forEach(r => assert.ok(!b.grid[r].includes('ALARM')));
    assert.equal(b.trigger, b.alarmReels.every(Boolean));
  }
});

test('demo force always triggers the feature', () => {
  const E = makeEngine(strips, mulberry32(9));
  for (let i = 0; i < 500; i++) assert.ok(E.spin('base', true).trigger);
});

test('playRoundDetailed matches playRound exactly for the same random sequence', () => {
  const a = makeEngine(strips, mulberry32(77)), b = makeEngine(strips, mulberry32(77));
  let features = 0;
  for (let i = 0; i < 300000; i++) {
    const s = a.playRound(), d = b.playRoundDetailed();
    assert.ok(Math.abs(s.total - d.total) < 1e-9);
    assert.equal(s.fsSpins, d.freeSpins.length);
    if (d.freeSpins.length) {
      features++;
      const sum = d.base.total + d.freeSpins.reduce((x, r) => x + r.total, 0);
      assert.ok(Math.abs(Math.min(sum, MAX_WIN) - d.total) < 1e-9);
      assert.equal(d.freeSpins[d.freeSpins.length - 1].spinsLeft === 0 || d.capped, true);
    }
  }
  assert.ok(features > 1000);
});

test('swims: on different reels, fixed for the feature, multipliers double with each catch', () => {
  const E = makeEngine(strips, mulberry32(21));
  const prizes = new Map(FISH.map(f => [f[0], f[1]]));
  let features = 0, caught = 0, deep = 0;
  for (let i = 0; i < 4000; i++) {
    const d = E.playRoundDetailed(true);
    features++;
    assert.equal(d.swims.length, SWIM_COUNT);
    assert.equal(new Set(d.swims.map(w => w.reel)).size, SWIM_COUNT);
    d.swims.forEach(w => { assert.ok(w.row >= 0 && w.row <= 2); assert.equal(w.catches, 0); });
    const catches = d.swims.map(() => 0);
    let sum = d.base.total;
    for (const fsr of d.freeSpins) {
      let units = 0;
      for (const l of fsr.lines) units += l.units;
      let cash = 0;
      for (const [key, f] of Object.entries(fsr.cash)) {
        const [r, k] = key.split(',').map(Number);
        assert.equal(f.value, prizes.get(f.label));
        const swim = d.swims.findIndex(w => w.reel === r && w.row === k);
        assert.equal(f.swim, swim);
        if (swim >= 0) { assert.equal(f.mult, swimMult(catches[swim])); catches[swim]++; caught++; }
        else assert.equal(f.mult, 1);
        cash += f.value * f.mult;
      }
      assert.ok(Math.abs(fsr.total - (units / 10 + cash)) < 1e-9);
      assert.deepEqual(fsr.swims.map(w => [w.reel, w.row]), d.swims.map(w => [w.reel, w.row]));
      assert.deepEqual(fsr.swims.map(w => w.catches), catches);
      sum += fsr.total;
    }
    if (Math.max(...catches) >= 3) deep++;
    assert.ok(Math.abs(Math.min(sum, MAX_WIN) - d.total) < 1e-9);
  }
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(swimMult), [2, 4, 8, 16, 32, 32, 32]);
  assert.ok(caught > features * 2 && deep > 50, `caught ${caught}, deep ${deep}`);
});

test('a round that reaches the 5,000x cap stops there and pays exactly the cap', () => {
  const E = makeEngine(strips, mulberry32(21));   // this seed reaches the cap within a few thousand features
  let d = null;
  for (let i = 0; i < 5000 && !d; i++) { const r = E.playRoundDetailed(true); if (r.capped) d = r; }
  assert.ok(d, 'no capped round found');
  assert.equal(d.total, MAX_WIN);
  const totals = d.freeSpins.reduce((acc, r) => [...acc, acc[acc.length - 1] + r.total], [d.base.total]);
  assert.ok(totals[totals.length - 1] >= MAX_WIN && totals[totals.length - 2] < MAX_WIN, 'the feature ends on the spin that reaches the cap');
});

test('kingfisher: base game only, reels 2-4 on one row plus up to 2 more spots, spots turn wild unless they held an alarm', () => {
  const E = makeEngine(strips, mulberry32(12));
  let visits = 0; const N = 300000;
  for (let i = 0; i < N; i++) {
    const r = E.spin('base');
    if (!r.kingfisher) continue;
    visits++;
    const spots = r.kingfisher.spots;
    assert.ok(spots.length >= 3 && spots.length <= 5);
    assert.equal(new Set(spots.map(w => w.reel + ',' + w.row)).size, spots.length);
    assert.ok([0, 1, 2].some(row => [1, 2, 3].every(reel => spots.some(w => w.reel === reel && w.row === row))), 'reels 2-4 on one row');
    for (const w of spots) {
      assert.ok(w.reel >= 1 && w.reel <= 4 && w.row >= 0 && w.row <= 2);
      assert.equal(r.grid[w.reel][w.row], w.was === 'ALARM' ? 'ALARM' : 'WILD');
    }
  }
  const expected = N * KINGFISHER_CHANCE;
  assert.ok(Math.abs(visits - expected) < 5 * Math.sqrt(expected), `kingfisher visited ${visits} times, expected about ${expected}`);
  for (let i = 0; i < 20000; i++) assert.equal(E.spin('fs').kingfisher, null);
  const forced = E.spin('base', 'kingfisher');
  assert.ok(forced.kingfisher);
});

test('base game rounds carry no swims', () => {
  const E = makeEngine(strips, mulberry32(4));
  for (let i = 0; i < 20000; i++) { const d = E.playRoundDetailed(); if (!d.freeSpins.length) assert.equal(d.swims, null); }
});

test('cryptoRand is uniform-looking in [0, 1)', () => {
  let sum = 0, min = 1, max = 0; const N = 200000;
  for (let i = 0; i < N; i++) { const v = cryptoRand(); sum += v; min = Math.min(min, v); max = Math.max(max, v); }
  assert.ok(min >= 0 && max < 1);
  assert.ok(Math.abs(sum / N - 0.5) < 0.005);
});

test('RTP over 2M rounds is in line with the 96.1% design figure', () => {
  const E = makeEngine(strips, mulberry32(2026));
  let sum = 0, max = 0; const N = 2_000_000;
  for (let i = 0; i < N; i++) { const t = E.playRound().total; sum += t; if (t > max) max = t; }
  const rtp = sum / N * 100;
  assert.ok(rtp > 94 && rtp < 98.2, `RTP ${rtp.toFixed(2)}% out of range`);
  assert.ok(max <= MAX_WIN);
});
