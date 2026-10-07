// Remote game server (RGS) logic for Specimen Hunter: sessions, stake rules, wallet and round history.
// Outcomes come from the shared engine with a secure RNG; the client only presents them.
// Money is held in integer pence. This is a demo wallet: a real deployment would call the
// operator's wallet API (debit/credit) instead of keeping balances in memory.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { makeEngine, cryptoRand, MAX_WIN } from '../client/src/engine.js';

const strips = JSON.parse(fs.readFileSync(new URL('../client/strips.json', import.meta.url)));

// 10p steps to £3.00, then 50p steps to £5.00 (pence)
export const STAKE_LADDER = [...Array.from({ length: 30 }, (_, i) => (i + 1) * 10), 350, 400, 450, 500];
// GB online slots stake limits per game cycle (Gambling Commission licence condition, 2025):
// £2 for players aged 18 to 24, £5 for 25 and over. The operator tells us the player's band.
export const GB_LIMITS = { '18-24': 200, '25+': 500 };
export const GAME_INFO = { id: 'specimen-hunter', rtp: 96.1, maxWinMultiplier: MAX_WIN, lines: 10, reels: '5x3' };

export class GameError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

export function createRgs({ demo = false, rand = cryptoRand, now = () => new Date() } = {}) {
  const engine = makeEngine(strips, rand);
  const sessions = new Map();

  function createSession({ currency = 'GBP', balance = 10000, maxStake = 500, ageBand = '25+' } = {}) {
    if (currency !== 'GBP') throw new GameError('CURRENCY', 'Only GBP is supported in this demo');
    if (!(ageBand in GB_LIMITS)) throw new GameError('AGE_BAND', 'ageBand must be "18-24" or "25+"');
    if (!Number.isInteger(balance) || balance < 0) throw new GameError('BALANCE', 'balance must be whole pence');
    if (!Number.isInteger(maxStake) || maxStake < STAKE_LADDER[0]) throw new GameError('MAX_STAKE', 'maxStake must be whole pence, at least 10');
    const cap = Math.min(maxStake, GB_LIMITS[ageBand]);   // the stricter of operator setting and legal limit
    const s = {
      id: crypto.randomUUID(), currency, balance, ageBand, maxStake: cap,
      stakes: STAKE_LADDER.filter(v => v <= cap), history: [], requests: new Map(), created: now(),
    };
    sessions.set(s.id, s);
    return publicSession(s);
  }

  const publicSession = s => ({ sessionId: s.id, currency: s.currency, balance: s.balance, maxStake: s.maxStake,
    ageBand: s.ageBand, stakes: s.stakes, demo, game: GAME_INFO });

  function getSession(id) {
    const s = sessions.get(id);
    if (!s) throw new GameError('SESSION', 'Unknown session', 404);
    return s;
  }

  // One complete game round. requestId makes retries safe: the same id returns the same result.
  function spin({ sessionId, stake, requestId, force = false }) {
    const s = getSession(sessionId);
    if (requestId && s.requests.has(requestId)) return s.requests.get(requestId);
    if (force && !demo) throw new GameError('FORBIDDEN', 'Demo bonus is not available', 403);
    if (!s.stakes.includes(stake)) throw new GameError('STAKE', `Stake not allowed (max ${s.maxStake}p)`);
    const cost = force ? 0 : stake;   // demo bonus is free
    if (s.balance < cost) throw new GameError('FUNDS', 'Insufficient balance', 402);

    s.balance -= cost;                                       // debit
    const round = engine.playRoundDetailed(force);
    const win = Math.round(round.total * stake);             // whole pence (all multipliers x stake are whole)
    s.balance += win;                                        // credit
    const result = {
      roundId: crypto.randomUUID(), requestId: requestId ?? null, time: now().toISOString(),
      stake, cost, win, balance: s.balance, demoBonus: !!force, round,
    };
    s.history.unshift({ roundId: result.roundId, time: result.time, stake, cost, win, balance: s.balance,
      feature: round.freeSpins.length > 0, freeSpins: round.freeSpins.length, capped: round.capped });
    if (s.history.length > 500) s.history.pop();
    if (requestId) {
      s.requests.set(requestId, result);
      if (s.requests.size > 200) s.requests.delete(s.requests.keys().next().value);
    }
    return result;
  }

  const history = sessionId => getSession(sessionId).history.slice(0, 100);
  return { createSession, spin, history, sessions, demo };
}
