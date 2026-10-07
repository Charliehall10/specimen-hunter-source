// Fish On! engine: JS port of math/fish_on_sim.py (prototype RNG = Math.random)
export const MAX_WIN = 5000;
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
  ["2lb 4oz",0.5,300],["4lb 0oz",1,250],["6lb 8oz",2,170],["9lb 12oz",3,110],
  ["14lb 0oz",5,80],["19lb 8oz",8,38],["26lb 0oz",12,22.5],["32lb 8oz",20,13],
  ["38lb 12oz",50,6.5],["45lb 4oz",100,1.75],["52lb 0oz",250,0.5],["64lb 8oz",1000,0.1],
];
const FISH_TOTAL = FISH.reduce((a, f) => a + f[2], 0);

export function makeEngine(strips, rand = Math.random) {
  const drawFish = () => {
    let x = rand() * FISH_TOTAL;
    for (const f of FISH) { x -= f[2]; if (x < 0) return f; }
    return FISH[FISH.length - 1];
  };
  function spin(set, force = false) {
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
    const cash = {}; let cashTotal = 0;
    if (set === 'fs') grid.forEach((col, r) => col.forEach((s, k) => {
      if (s === 'CASH') { const f = drawFish(); cash[r + ',' + k] = f; cashTotal += f[1]; }
    }));
    const alarmReels = [1, 2, 3].map(r => grid[r].includes('ALARM'));
    return { grid, lines, cash, total: units / 10 + cashTotal, alarmReels, trigger: alarmReels.every(Boolean) };
  }
  function playRound() {
    const b = spin('base'); let t = b.total, fsSpins = 0;
    if (b.trigger) {
      let left = 10;
      while (left > 0) {
        const r = spin('fs'); t += r.total; left--; fsSpins++;
        if (r.trigger) left += 5;
        if (t >= MAX_WIN) break;
      }
    }
    return { total: Math.min(t, MAX_WIN), hit: b.lines.length > 0, trig: b.trigger, fsSpins };
  }
  return { spin, playRound };
}
