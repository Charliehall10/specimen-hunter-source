// Engine tests: run with `npm test`. Uses a seeded RNG so results are repeatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEngine, PAY, PAYLINES, MAX_WIN } from './engine.js';

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

test('RTP over 2M rounds is in line with the 96.1% design figure', () => {
  const E = makeEngine(strips, mulberry32(2026));
  let sum = 0, max = 0; const N = 2_000_000;
  for (let i = 0; i < N; i++) { const t = E.playRound().total; sum += t; if (t > max) max = t; }
  const rtp = sum / N * 100;
  assert.ok(rtp > 94 && rtp < 98.2, `RTP ${rtp.toFixed(2)}% out of range`);
  assert.ok(max <= MAX_WIN);
});
