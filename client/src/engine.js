// Specimen Hunter engine: JS port of math/specimen_hunter_sim.py. The same file runs in the browser (demo mode)
// and on the game server, so outcomes are identical wherever they are generated.
export const MAX_WIN = 5000;

// Cryptographically secure uniform [0, 1) with 53 bits of randomness (Web Crypto: browsers and Node 19+).
// Not a certified RNG: certification is done by an approved test house on the production server.
export function cryptoRand() {
  const u = new Uint32Array(2);
  globalThis.crypto.getRandomValues(u);
  return ((u[0] >>> 5) * 67108864 + (u[1] >>> 6)) / 9007199254740992;
}
export const PAY = {
  FLOAT:[6,15,30], BOILIE:[6,15,30], CORN:[9,24,45], PELLET:[9,24,45],
  FLASK:[12,30,75], CATAPULT:[15,36,90], NET:[18,45,120], BIVVY:[24,60,150],
  ROACH:[30,75,180], BREAM:[36,90,240], TENCH:[45,120,360], MIRROR:[60,225,750],
};
export const PAYLINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,2,1,0,1],
];
export const FISH = [ // [label, multiplier of total bet, weight]
  ["2lb 4oz",0.5,394],["4lb 0oz",1,250],["6lb 8oz",2,170],["9lb 12oz",3,110],
  ["14lb 0oz",5,80],["19lb 8oz",8,38],["26lb 0oz",12,22.5],["32lb 8oz",20,13],
  ["38lb 12oz",50,6.5],["45lb 4oz",100,1.75],["52lb 0oz",250,0.5],["64lb 8oz",1000,0.1],
];
const FISH_TOTAL = FISH.reduce((a, f) => a + f[2], 0);
// Baited swims (free spins): SWIM_COUNT swims are baited on different reels before the first free spin and
// stay put for the whole feature. A fish landing in a swim pays its prize x the swim's multiplier, then the
// multiplier doubles. SWIM_LADDER[c] is the multiplier for a swim's (c+1)th catch; the last value repeats.
export const SWIM_COUNT = 3;
export const SWIM_LADDER = [2, 4, 8, 16, 32];
export const swimMult = catches => SWIM_LADDER[Math.min(catches, SWIM_LADDER.length - 1)];

export function makeEngine(strips, rand = Math.random) {
  const drawFish = () => {
    let x = rand() * FISH_TOTAL;
    for (const f of FISH) { x -= f[2]; if (x < 0) return f; }
    return FISH[FISH.length - 1];
  };
  // SWIM_COUNT different reels (partial shuffle), a random row on each; listed left to right
  function baitSwims() {
    const reels = [0, 1, 2, 3, 4];
    for (let i = 0; i < SWIM_COUNT; i++) { const j = i + Math.floor(rand() * (5 - i)); [reels[i], reels[j]] = [reels[j], reels[i]]; }
    return reels.slice(0, SWIM_COUNT).map(reel => ({ reel, row: Math.floor(rand() * 3), catches: 0 })).sort((a, b) => a.reel - b.reel);
  }
  // swims (free spins only) is updated in place as fish are caught
  function spin(set, force = false, swims = null) {
    const reels = set === 'fs' ? strips.free_spins : strips.base;
    const grid = reels.map(s => {
      const p = Math.floor(rand() * s.length);
      return [s[p], s[(p + 1) % s.length], s[(p + 2) % s.length]];
    });
    // DEMO ONLY: force a Three Rods trigger by dropping an alarm onto reels 2-4
    if (force) [1, 2, 3].forEach(r => { if (!grid[r].includes('ALARM')) grid[r][Math.floor(rand() * 3)] = 'ALARM'; });
    let units = 0; const lines = [];
    PAYLINES.forEach((pl, i) => {
      const syms = pl.map((row, r) => grid[r][row]);
      const target = syms.find(s => s !== 'WILD') ?? 'MIRROR';
      let count = 0;
      for (const s of syms) { if (s === target || s === 'WILD') count++; else break; }
      const pay = PAY[target];
      if (count >= 3 && pay) {
        units += pay[count - 3];
        lines.push({ line: i, sym: target, count, units: pay[count - 3], cells: pl.slice(0, count).map((row, r) => [r, row]) });
      }
    });
    // Specimen Fish: weighed in grid order; a fish in a swim pays x that swim's multiplier, which then doubles
    const cash = {}; let cashTotal = 0;
    if (set === 'fs') grid.forEach((col, r) => col.forEach((s, k) => {
      if (s !== 'CASH') return;
      const [label, value] = drawFish();
      const swim = swims ? swims.findIndex(w => w.reel === r && w.row === k) : -1;
      const mult = swim >= 0 ? swimMult(swims[swim].catches++) : 1;
      cash[r + ',' + k] = { label, value, swim, mult };
      cashTotal += value * mult;
    }));
    const alarmReels = [1, 2, 3].map(r => grid[r].includes('ALARM'));
    const res = { grid, lines, cash, total: units / 10 + cashTotal, alarmReels, trigger: alarmReels.every(Boolean) };
    if (swims) res.swims = swims.map(w => ({ ...w }));   // swim state after this spin
    return res;
  }
  // Free spins from the trigger to the end, or until the round total reaches `cap`. Shared by both round
  // functions below so they use the RNG in exactly the same order.
  function freeSpins(start, cap, detailed) {
    const swims = baitSwims(), baited = swims.map(w => ({ ...w })), spins = [];
    let left = 10, t = start, played = 0, capped = false;
    while (left > 0) {
      const r = spin('fs', false, swims); t += r.total; left--; played++;
      if (r.trigger) left += 5;
      if (detailed) spins.push({ ...r, spinsLeft: left });
      if (t >= cap) { capped = true; break; }
    }
    return { total: t, played, spins, baited, capped };
  }
  function playRound() {
    const b = spin('base'); let t = b.total, fsSpins = 0;
    if (b.trigger) { const f = freeSpins(t, MAX_WIN, false); t = f.total; fsSpins = f.played; }
    return { total: Math.min(t, MAX_WIN), hit: b.lines.length > 0, trig: b.trigger, fsSpins };
  }
  // Whole game round decided up front (server style): base spin plus every free spin, in order.
  // Same rules and RNG order as playRound(), so both give identical results for the same seed.
  function playRoundDetailed(force = false) {
    const base = spin('base', force);
    if (!base.trigger) return { base, swims: null, freeSpins: [], total: Math.min(base.total, MAX_WIN), capped: false };
    const f = freeSpins(base.total, MAX_WIN, true);
    return { base, swims: f.baited, freeSpins: f.spins, total: Math.min(f.total, MAX_WIN), capped: f.capped };
  }
  // A feature's total with no cap: used by the PAR sheet to measure how much RTP the 5,000x cap takes
  const featureUncapped = () => freeSpins(0, Infinity, false).total;
  return { spin, playRound, playRoundDetailed, featureUncapped };
}
