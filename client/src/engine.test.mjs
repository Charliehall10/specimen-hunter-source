// Engine tests: run with `npm test`. Uses a seeded RNG so results are repeatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEngine, cryptoRand, PAY, PAYLINES, MAX_WIN } from './engine.js';

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
    const cash = Object.values(r.cash).reduce((a, f) => a + f[1], 0);
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
