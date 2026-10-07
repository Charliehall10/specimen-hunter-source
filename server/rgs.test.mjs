// Server tests: stake rules, wallet arithmetic, demo bonus, retries, HTTP API. Run: npm test (in server/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRgs, STAKE_LADDER } from './rgs.mjs';
import { createHttpServer } from './index.mjs';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const code = fn => { try { fn(); return 'none'; } catch (e) { return e.code; } };

test('GB stake caps: 18-24 limited to £2, 25+ to £5, operator can go lower', () => {
  const rgs = createRgs();
  const young = rgs.createSession({ ageBand: '18-24' });
  assert.equal(young.maxStake, 200); assert.equal(Math.max(...young.stakes), 200);
  const adult = rgs.createSession({ ageBand: '25+' });
  assert.equal(adult.maxStake, 500); assert.deepEqual(adult.stakes, STAKE_LADDER);
  const op = rgs.createSession({ ageBand: '25+', maxStake: 100 });
  assert.equal(Math.max(...op.stakes), 100);
  const tooHigh = rgs.createSession({ ageBand: '25+', maxStake: 10000 });
  assert.equal(tooHigh.maxStake, 500);   // legal limit always wins
});

test('rejects disallowed stakes, unknown sessions and bad settings', () => {
  const rgs = createRgs();
  const s = rgs.createSession({ ageBand: '18-24', balance: 1000 });
  assert.equal(code(() => rgs.spin({ sessionId: s.sessionId, stake: 250 })), 'STAKE');   // above £2 cap
  assert.equal(code(() => rgs.spin({ sessionId: s.sessionId, stake: 15 })), 'STAKE');    // not on the ladder
  assert.equal(code(() => rgs.spin({ sessionId: 'nope', stake: 100 })), 'SESSION');
  assert.equal(code(() => rgs.createSession({ ageBand: '16-17' })), 'AGE_BAND');
  assert.equal(code(() => rgs.createSession({ currency: 'EUR' })), 'CURRENCY');
  assert.equal(code(() => rgs.createSession({ balance: 10.5 })), 'BALANCE');
});

test('wallet: balance always equals previous - stake + win, in whole pence', () => {
  const rgs = createRgs({ rand: mulberry32(5) });
  const s = rgs.createSession({ balance: 10_000_000 });
  let bal = s.balance;
  for (let i = 0; i < 20000; i++) {
    const stake = STAKE_LADDER[i % STAKE_LADDER.length];
    const r = rgs.spin({ sessionId: s.sessionId, stake });
    assert.ok(Number.isInteger(r.win) && r.win >= 0);
    assert.equal(r.win, Math.round(r.round.total * stake));
    assert.equal(r.balance, bal - stake + r.win);
    bal = r.balance;
  }
});

test('insufficient funds is refused and nothing is charged', () => {
  const rgs = createRgs();
  const s = rgs.createSession({ balance: 50 });
  assert.equal(code(() => rgs.spin({ sessionId: s.sessionId, stake: 100 })), 'FUNDS');
  assert.equal(rgs.history(s.sessionId).length, 0);
});

test('demo bonus only when the server runs in demo mode, and it is free', () => {
  assert.equal(code(() => { const r = createRgs(); const s = r.createSession(); r.spin({ sessionId: s.sessionId, stake: 100, force: true }); }), 'FORBIDDEN');
  const rgs = createRgs({ demo: true });
  const s = rgs.createSession({ balance: 1000 });
  const r = rgs.spin({ sessionId: s.sessionId, stake: 100, force: true });
  assert.equal(r.cost, 0); assert.ok(r.round.freeSpins.length >= 10); assert.equal(r.balance, 1000 + r.win);
});

test('a retried request (same requestId) is not charged twice', () => {
  const rgs = createRgs();
  const s = rgs.createSession({ balance: 1000 });
  const a = rgs.spin({ sessionId: s.sessionId, stake: 100, requestId: 'req-1' });
  const b = rgs.spin({ sessionId: s.sessionId, stake: 100, requestId: 'req-1' });
  assert.deepEqual(a, b);
  assert.equal(rgs.history(s.sessionId).length, 1);
});

test('server-side return over 300k rounds is in line with the design RTP', () => {
  const rgs = createRgs({ rand: mulberry32(11) });
  const s = rgs.createSession({ balance: 1e12 });
  let staked = 0, won = 0;
  for (let i = 0; i < 300000; i++) { const r = rgs.spin({ sessionId: s.sessionId, stake: 100 }); staked += 100; won += r.win; }
  const rtp = won / staked * 100;
  assert.ok(rtp > 92 && rtp < 100.5, `RTP ${rtp.toFixed(2)}%`);
});

test('HTTP API end to end', async () => {
  const rgs = createRgs({ demo: false });
  const srv = createHttpServer({ rgs });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.ok, true); assert.equal(health.demo, false);
    const sres = await post('/api/session', { balance: 500, ageBand: '18-24' });
    assert.equal(sres.status, 201);
    const s = await sres.json();
    const spin = await (await post('/api/spin', { sessionId: s.sessionId, stake: 200, requestId: 'x' })).json();
    assert.equal(spin.balance, 500 - 200 + spin.win);
    const capped = await post('/api/spin', { sessionId: s.sessionId, stake: 300 });
    assert.equal(capped.status, 400); assert.equal((await capped.json()).error, 'STAKE');
    const hist = await (await fetch(`${base}/api/history?sessionId=${s.sessionId}`)).json();
    assert.equal(hist.length, 1);
    assert.equal((await fetch(base + '/api/nope')).status, 404);
    const bad = await fetch(base + '/api/spin', { method: 'POST', body: '{oops' });
    assert.equal(bad.status, 400);
  } finally { srv.close(); }
});
