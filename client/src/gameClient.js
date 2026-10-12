// Where game outcomes come from:
//  - 'server': the Specimen Hunter game server decides every round (as a real remote game server would).
//    Used automatically when the client is opened from the server, or with ?server=http://host:port
//  - 'local':  the same engine runs in the browser with a secure RNG. Used for the static web demo
//    and the desktop app, which have no server.
// Both expose the same interface, in pence:  start(profile) -> session,  play(stake, force) -> result
import strips from '../strips.json';
import { makeEngine, cryptoRand } from './engine.js';
import { STAKES, START_BALANCE, DEMO_BONUS } from './config.js';

const LADDER = STAKES.map(s => Math.round(s * 100));
// GB online slots stake limits per game cycle: £2 under 25, £5 for 25 and over
const GB_LIMITS = { '18-24': 200, '25+': 500 };

// Operator launch settings, e.g. ?age=18-24&maxStake=2  (a real operator passes these when it opens the game)
export function launchProfile() {
  const q = new URLSearchParams(location.search);
  const age = q.get('age') === '18-24' ? '18-24' : '25+';
  const max = Number(q.get('maxStake'));
  return { ageBand: age, maxStake: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : 500 };
}

function localClient() {
  const engine = makeEngine(strips, cryptoRand);
  let s = null;
  return {
    mode: 'local',
    async start({ ageBand = '25+', maxStake = 500, balance = START_BALANCE * 100 } = {}) {
      const cap = Math.min(maxStake, GB_LIMITS[ageBand] ?? 500);
      s = { balance, ageBand, maxStake: cap, stakes: LADDER.filter(v => v <= cap), demo: DEMO_BONUS };
      return { ...s };
    },
    async play(stake, force = false) {
      if (![false, true, 'feature', 'kingfisher'].includes(force)) throw Object.assign(new Error('Unknown demo option'), { code: 'FORCE' });
      if (force && !s.demo) throw Object.assign(new Error('Demo bonus is not available'), { code: 'FORBIDDEN' });
      if (!s.stakes.includes(stake)) throw Object.assign(new Error('Stake not allowed'), { code: 'STAKE' });
      const cost = force ? 0 : stake;
      if (s.balance < cost) throw Object.assign(new Error('Insufficient balance'), { code: 'FUNDS' });
      s.balance -= cost;
      const round = engine.playRoundDetailed(force);
      const win = Math.round(round.total * stake);
      s.balance += win;
      return { stake, cost, win, balance: s.balance, round };
    },
  };
}

function serverClient(base) {
  let sessionId = null;
  async function call(path, body) {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.message || `Server error ${r.status}`), { code: data.error || 'SERVER' });
    return data;
  }
  return {
    mode: 'server',
    async start(profile = {}) {
      const s = await call('/api/session', { currency: 'GBP', balance: START_BALANCE * 100, ...profile });
      sessionId = s.sessionId;
      return s;
    },
    async play(stake, force = false) {
      const requestId = crypto.randomUUID();
      try { return await call('/api/spin', { sessionId, stake, force, requestId }); }
      catch (e) {
        const transient = e instanceof TypeError || e.code === 'INTERNAL' || e.code === 'SERVER';   // network drop / server hiccup
        if (!transient) throw e;
        return call('/api/spin', { sessionId, stake, force, requestId });   // one safe retry: same requestId, never charged twice
      }
    },
  };
}

export async function connect() {
  const q = new URLSearchParams(location.search);
  const base = q.get('server') ?? '';
  try {
    const r = await fetch(base + '/api/health', { cache: 'no-store' });
    if (r.ok && (await r.json()).ok) return serverClient(base);
  } catch { /* no server: static demo or desktop app */ }
  return localClient();
}
