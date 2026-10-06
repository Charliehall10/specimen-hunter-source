import { Application, Container, Graphics, Text } from 'pixi.js';
import strips from '../strips.json';
import { makeEngine, MAX_WIN } from './engine.js';

const E = makeEngine(strips);
const app = new Application();
await app.init({ width: 960, height: 640, background: 0x0b1d26, antialias: true });
document.body.appendChild(app.canvas);

const CW = 150, CH = 108, GAP = 8, X0 = (960 - (5 * CW + 4 * GAP)) / 2, Y0 = 120;
const T1 = 0x3b6b5a, T2 = 0x4a5f8a, T3 = 0x8a5a2e;
const COL = { FLOAT: T1, BOILIE: T1, CORN: T1, PELLET: T1, FLASK: T2, CATAPULT: T2, NET: T2, BIVVY: T2,
  ROACH: T3, BREAM: T3, TENCH: T3, MIRROR: 0xa8741a, WILD: 0x2f9e44, ALARM: 0xc92a2a, CASH: 0xd9a600 };
const NAME = { WILD: 'LEATHER\nCARP', ALARM: 'BITE\nALARM' };
const POOL = Object.keys(COL).filter(s => s !== 'CASH');
// 10p steps up to £3.00, then 50p steps up to £5.00
const STAKES = [...Array.from({ length: 30 }, (_, i) => Math.round((i + 1) * 10) / 100), 3.5, 4, 4.5, 5];
const START = 100;
const money = v => '£' + v.toFixed(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = (s, size = 20, fill = 0xffffff, x = 480, y = 0) => {
  const t = new Text({ text: s, style: { fontFamily: 'sans-serif', fontSize: size, fill, fontWeight: 'bold', align: 'center' } });
  t.anchor.set(0.5); t.position.set(x, y); app.stage.addChild(t); return t;
};

txt('SPECIMEN HUNTER', 34, 0xf2c14e, 480, 32);
txt('Prototype v0.1 · demo money only', 14, 0x8aa0aa, 480, 62);

// Reel cells
const cells = [];
for (let r = 0; r < 5; r++) {
  cells[r] = [];
  for (let k = 0; k < 3; k++) {
    const c = new Container(); c.position.set(X0 + r * (CW + GAP), Y0 + k * (CH + GAP));
    const bg = new Graphics();
    const label = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 22, fill: 0xffffff, fontWeight: 'bold', align: 'center' } });
    label.anchor.set(0.5); label.position.set(CW / 2, CH / 2);
    c.addChild(bg, label); app.stage.addChild(c); cells[r][k] = { bg, label };
  }
}
function setCell(r, k, sym, label) {
  const c = cells[r][k];
  c.bg.clear().roundRect(0, 0, CW, CH, 12).fill(COL[sym]).stroke({ width: 2, color: 0x000000, alpha: 0.35 });
  c.label.text = label ?? NAME[sym] ?? sym;
}

// Three-rod alarm lights (reels 2-4)
const lights = [1, 2, 3].map(r => {
  const g = new Graphics(); g.position.set(X0 + r * (CW + GAP) + CW / 2, 98); app.stage.addChild(g); return g;
});
const setLights = on => lights.forEach((g, i) =>
  g.clear().circle(0, 0, 10).fill(on[i] ? 0xff3b3b : 0x3a1a1a).stroke({ width: 2, color: 0x777777 }));

// HUD
const msg = txt('', 28, 0xffffff, 480, 492);
const feat = txt('', 18, 0xf2c14e, 480, 524);
const balT = txt('', 20, 0xffffff, 150, 570);
const netT = txt('', 18, 0xaab8c0, 150, 600);
const stakeT = txt('', 20, 0xffffff, 790, 590);
let balance = START, idx = 9, busy = false;   // starts at £1.00
const stake = () => STAKES[idx];
function hud() {
  const net = balance - START;
  balT.text = 'Balance ' + money(balance);
  netT.text = 'Session net ' + (net >= 0 ? '+' : '-') + money(Math.abs(net));
  stakeT.text = 'Stake ' + money(stake());
}
function button(label, x, y, w, h, fn, fill = 0x1f6f5c) {
  const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, 12).fill(fill);
  const t = new Text({ text: label, style: { fontFamily: 'sans-serif', fontSize: 22, fill: 0xffffff, fontWeight: 'bold' } });
  t.anchor.set(0.5); g.addChild(t); g.position.set(x, y);
  g.eventMode = 'static'; g.cursor = 'pointer'; g.on('pointertap', fn); app.stage.addChild(g);
}
const bump = d => { if (!busy) { idx = Math.min(STAKES.length - 1, Math.max(0, idx + d)); hud(); } };
button('SPIN', 480, 590, 180, 60, () => round());
button('DEMO BONUS', 120, 515, 190, 44, () => round(true), 0x9a4a12);
txt('DEMO ONLY · free · not for real-money builds', 11, 0x8aa0aa, 120, 546);
button('−', 690, 590, 50, 50, () => bump(-1));
button('+', 890, 590, 50, 50, () => bump(1));
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); round(); }
  if (e.code === 'ArrowUp' || e.code === 'ArrowRight') { e.preventDefault(); bump(1); }
  if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') { e.preventDefault(); bump(-1); }
});

// One animated spin. Fixed duration: min 2.5s, no slam stop, no turbo, no autoplay.
async function spinOnce(set, force = false) {
  const res = E.spin(set, force), t0 = performance.now(), stopAt = [1300, 1600, 1900, 2200, 2500];
  const flick = setInterval(() => {
    const el = performance.now() - t0;
    for (let r = 0; r < 5; r++) if (el < stopAt[r])
      for (let k = 0; k < 3; k++) setCell(r, k, POOL[Math.floor(Math.random() * POOL.length)]);
  }, 70);
  for (let r = 0; r < 5; r++) {
    await sleep(Math.max(0, t0 + stopAt[r] - performance.now()));
    for (let k = 0; k < 3; k++) {
      const s = res.grid[r][k];
      setCell(r, k, s, s === 'CASH' ? res.cash[r + ',' + k][0] : undefined);
    }
  }
  clearInterval(flick);
  return res;
}

async function round(force = false) {
  if (busy) return;
  if (balance < stake() - 1e-9) { msg.text = 'Not enough balance'; return; }
  busy = true; msg.text = ''; feat.text = ''; setLights([false, false, false]);
  const s = stake(); if (!force) balance -= s; hud();   // demo bonus is free
  const base = await spinOnce('base', force);
  setLights(base.alarmReels);
  let running = base.total;
  if (base.trigger) {
    msg.text = 'THREE RODS! 10 free spins'; msg.style.fill = 0xff6b6b; await sleep(2000);
    let left = 10, played = 0;
    while (left > 0) {
      msg.text = '';
      setLights([false, false, false]);
      const r = await spinOnce('fs');
      setLights(r.alarmReels);
      running += r.total; left--; played++;
      if (r.trigger) { left += 5; msg.text = '+5 free spins'; }
      if (running >= MAX_WIN) { running = MAX_WIN; left = 0; }
      feat.text = `Free spin ${played} of ${played + left} · Feature total ${money(running * s)}`;
      await sleep(600);
    }
  }
  const win = Math.round(running * s * 100) / 100; balance = Math.round((balance + win) * 100) / 100;
  if (win <= 0) { msg.text = 'No win'; msg.style.fill = 0x8aa0aa; }
  else if (win < s - 1e-9) { msg.text = `Returned ${money(win)}`; msg.style.fill = 0x8aa0aa; } // LDW: not celebrated
  else { msg.text = `WIN ${money(win)}`; msg.style.fill = 0xf2c14e; }
  hud(); busy = false;
}

for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) setCell(r, k, POOL[Math.floor(Math.random() * POOL.length)]);
setLights([false, false, false]); hud();
