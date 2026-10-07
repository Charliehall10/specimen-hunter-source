// Fish On!: game client. Outcomes come from engine.js; this file only presents them.
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import strips from '../strips.json';
import { makeEngine, MAX_WIN, FISH, PAYLINES as PAYLINE_ROWS } from './engine.js';
import { W, H, CW, CH, GAP, X0, Y0, REEL_W, REEL_H, STOP_AT, ANTICIPATION_MS, STAKES, START_BALANCE, START_STAKE_INDEX,
  REALITY_CHECK_MIN, DEMO_BONUS, LINE_COLOURS, BIG_WINS, SYMBOLS, money, sleep } from './config.js';
import { makeSymbolTextures, makeSceneTexture, makeFrameTexture, makeLogoTexture, makeDotTexture } from './art.js';
import { Reel, tween, tickTweens } from './reels.js';
import { initAudio, sfx, isMuted, setMuted, isMusicOn, setMusic, setMood, duckMusic } from './audio.js';
import { label, Button, SpinButton, valueBox, Modal } from './ui.js';
import { openInfo, openHistory, realityCheck, sessionEnded, titleScreen } from './panels.js';

const E = makeEngine(strips);
const app = new Application();
await app.init({ resizeTo: window, background: 0x06121a, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
document.body.appendChild(app.canvas);

// ------------------------------------------------------------------ scene
const tex = makeSymbolTextures();
const bgLayer = new Container(), root = new Container();
app.stage.addChild(bgLayer, root);
const dawn = new Sprite(makeSceneTexture('dawn')), dusk = new Sprite(makeSceneTexture('dusk'));
dusk.alpha = 0; bgLayer.addChild(dawn, dusk);
const dotTex = makeDotTexture();
const mist = new Graphics().rect(0, 0, W, 60).fill({ color: 0xffffff, alpha: 0.05 }); mist.y = 300; bgLayer.addChild(mist);

function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = Math.min(w / W, h / H), c = Math.max(w / W, h / H);
  root.scale.set(s); root.position.set((w - W * s) / 2, (h - H * s) / 2);
  bgLayer.scale.set(c); bgLayer.position.set((w - W * c) / 2, (h - H * c) / 2);
}
window.addEventListener('resize', fit); fit();

const logo = makeLogoTexture();
const logoSp = new Sprite(logo); logoSp.anchor.set(0.5); logoSp.scale.set(0.42); logoSp.position.set(W / 2, 46); root.addChild(logoSp);

const { texture: frameTex, pad } = makeFrameTexture();
const frame = new Sprite(frameTex); frame.position.set(X0 - pad, Y0 - pad); root.addChild(frame);

let stakeIdx = START_STAKE_INDEX;
const stake = () => STAKES[stakeIdx];
const fishLabel = f => [f[0], money(f[1] * stake())];
const reels = Array.from({ length: 5 }, (_, r) => new Reel(r, tex, fishLabel));
reels.forEach(r => root.addChild(r.view));

const glow = new Graphics(); root.addChild(glow);            // anticipation glow
const linesLayer = new Graphics(); root.addChild(linesLayer);
const fxLayer = new Container(); root.addChild(fxLayer);

// Three Rods: one bite-alarm light above each of reels 2, 3 and 4
const lights = [1, 2, 3].map((r, i) => {
  const c = new Container(); c.position.set(X0 + r * (CW + GAP) + CW / 2, 100);
  const g = new Graphics(); c.addChild(g, label(`ROD ${i + 1}`, 11, 0xdbe7ec, { x: 26, y: 0, ax: 0, stroke: { width: 3, color: 0x000000 } }));
  c.g = g; c.on = false; root.addChild(c); return c;
});
function setLight(i, on) {
  const l = lights[i]; l.on = on;
  l.g.clear();
  if (on) l.g.circle(0, 0, 18).fill({ color: 0xff2a2a, alpha: 0.25 });
  l.g.circle(0, 0, 9).fill(on ? 0xff4d4d : 0x3a1a1a).stroke({ width: 2, color: on ? 0xffd0d0 : 0x6d6d6d });
}
const lightsOff = () => lights.forEach((_, i) => setLight(i, false));
lightsOff();

// Side panels
const side = new Container(); root.addChild(side);
const leftInfo = new Container(); leftInfo.position.set(95, 250); side.addChild(leftInfo);
leftInfo.addChild(new Graphics().roundRect(-80, -70, 160, 150, 14).fill({ color: 0x04121a, alpha: 0.7 }).stroke({ width: 2, color: 0xff6b6b, alpha: 0.6 }));
leftInfo.addChild(label('THREE RODS', 17, 0xff8080, { x: 0, y: -48 }));
leftInfo.addChild(label('A bite alarm on\nreels 2, 3 & 4\nwins\n10 FREE SPINS', 14, 0xffffff, { x: 0, y: 14, style: { fontWeight: 'normal' }, stroke: { width: 0 }, lineHeight: 20 }));

const featPanel = new Container(); featPanel.position.set(1185, 300); featPanel.visible = false; side.addChild(featPanel);
featPanel.addChild(new Graphics().roundRect(-82, -150, 164, 300, 16).fill({ color: 0x04121a, alpha: 0.82 }).stroke({ width: 3, color: 0xf2c14e }));
featPanel.addChild(label('FREE SPINS', 16, 0xf2c14e, { x: 0, y: -126 }));
const fsCount = label('', 34, 0xffffff, { x: 0, y: -86 }); featPanel.addChild(fsCount);
featPanel.addChild(label('FISH LANDED', 13, 0x9fb7c2, { x: 0, y: -36 }));
const fishCount = label('0', 26, 0xffffff, { x: 0, y: -8 }); featPanel.addChild(fishCount);
featPanel.addChild(label('TOTAL WIN', 13, 0x9fb7c2, { x: 0, y: 46 }));
const meter = label('£0.00', 26, 0xffe066, { x: 0, y: 78 }); featPanel.addChild(meter);
const meterPos = { x: 1185, y: 378 };

// Messages + HUD
const msg = label('', 28, 0xffffff, { x: W / 2, y: 591 }); root.addChild(msg);
const lineInfo = label('', 15, 0xdbe7ec, { x: 58, y: 616, ax: 0, stroke: { width: 3, color: 0x000000 } }); root.addChild(lineInfo);
const clockT = label('', 15, 0xdbe7ec, { x: 18, y: 18, ax: 0, ay: 0 }); root.addChild(clockT);
const netT = label('', 15, 0xdbe7ec, { x: W - 18, y: 18, ax: 1, ay: 0 }); root.addChild(netT);
const balBox = valueBox('BALANCE', 210, 160, 678), winBox = valueBox('WIN', 190, 380, 678), stakeBox = valueBox('STAKE', 160, 890, 678);
root.addChild(balBox, winBox, stakeBox);
const spinBtn = new SpinButton(() => round()); spinBtn.position.set(640, 670); root.addChild(spinBtn);
const minus = new Button('−', 52, 52, () => bump(-1), { size: 28 }), plus = new Button('+', 52, 52, () => bump(1), { size: 28 });
minus.position.set(778, 678); plus.position.set(1002, 678); root.addChild(minus, plus);
const infoBtn = new Button('i', 50, 50, () => showInfo(), { fill: 0x1d4152, size: 24 });
const histBtn = new Button('☰', 50, 50, () => showHistory(), { fill: 0x1d4152, size: 22 });
// The music on/off choice is remembered between sessions (per device). Full mute is not:
// the game always starts with sound on, so a forgotten mute can't leave it silent.
const prefs = (() => { try { return JSON.parse(localStorage.getItem('fishon-audio') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('fishon-audio', JSON.stringify({ music: isMusicOn() })); } catch {} };
const sndBtn = new Button('♪', 50, 50, () => {
  setMuted(!isMuted()); sndBtn.text.text = isMuted() ? '✕' : '♪';
  sndBtn.fillColour = isMuted() ? 0x8a2a1a : 0x1d4152; sndBtn.draw();   // red while muted so it's obvious
}, { fill: 0x1d4152, size: 22 });
const musicBtn = new Button('♫', 50, 50, () => { setMusic(!isMusicOn()); showMusic(); savePrefs(); }, { fill: 0x1d4152, size: 22 });
const showMusic = () => { musicBtn.text.style.fill = isMusicOn() ? 0xffffff : 0x6d7f88; };
[infoBtn, histBtn, musicBtn, sndBtn].forEach((b, i) => { b.position.set(1068 + i * 56, 678); root.addChild(b); });
let demoBtn = null;
if (DEMO_BONUS) {
  demoBtn = new Button('DEMO BONUS', 160, 44, () => round(true), { fill: 0x9a4a12, size: 17 });
  demoBtn.position.set(95, 430); root.addChild(demoBtn);
  root.addChild(label('demo only · free\nremoved in release builds', 11, 0x9fb7c2, { x: 95, y: 470, stroke: { width: 2, color: 0x000000 } }));
}
const resetBtn = new Button('RESET DEMO BALANCE', 250, 44, () => { balance = START_BALANCE; netBase = START_BALANCE; resetBtn.visible = false; msg.text = ''; hud(); }, { fill: 0x7a2e12, size: 16 });
resetBtn.position.set(W / 2, 622); resetBtn.visible = false; root.addChild(resetBtn);

// ------------------------------------------------------------------ state
let balance = START_BALANCE, netBase = START_BALANCE, lastWin = 0, busy = false, modals = 0;
let sessionStart = Date.now(), lastCheck = Date.now(), ended = false;
const history = [];
let idle = null;     // cycling line-win display while waiting for the next spin

function hud() {
  balBox.value.text = money(balance);
  winBox.value.text = money(lastWin);
  stakeBox.value.text = money(stake());
  const net = balance - netBase;
  netT.text = `Session net ${net >= 0 ? '+' : '−'}${money(Math.abs(net))}`;
  const ready = !busy && modals === 0 && !ended;
  spinBtn.enabled = ready; minus.enabled = ready && stakeIdx > 0; plus.enabled = ready && stakeIdx < STAKES.length - 1;
  infoBtn.enabled = !busy && modals === 0; histBtn.enabled = !busy && modals === 0;
  if (demoBtn) demoBtn.enabled = ready;
}
const mins = () => Math.floor((Date.now() - sessionStart) / 60000);
function clock() {
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  clockT.text = `Session ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}  ·  ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
function bump(d) {
  if (busy || modals || ended) return;
  const n = Math.min(STAKES.length - 1, Math.max(0, stakeIdx + d));
  if (n !== stakeIdx) { stakeIdx = n; sfx.click(); reels.forEach(r => r.refreshLabels()); hud(); }
}
function modal(m) { modals++; hud(); return m; }
const modalClosed = () => { modals = Math.max(0, modals - 1); hud(); };
const showInfo = () => { if (!busy && !modals) modal(openInfo(root, tex, stake(), modalClosed)); };
const showHistory = () => { if (!busy && !modals) modal(openHistory(root, history, modalClosed)); };

// ------------------------------------------------------------------ effects
const particles = [];
function burst(x, y, n, colour, { speed = 6, up = 4, life = 900, size = 0.5 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = new Sprite(dotTex); p.anchor.set(0.5); p.tint = colour; p.position.set(x, y); p.scale.set(size * (0.4 + Math.random() * 0.8));
    const a = Math.random() * Math.PI * 2;
    p.vx = Math.cos(a) * speed * Math.random(); p.vy = Math.sin(a) * speed * Math.random() - up; p.life = life; p.t0 = performance.now();
    fxLayer.addChild(p); particles.push(p);
  }
}
function tickParticles(now, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i], age = now - p.t0;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.25 * dt; p.alpha = Math.max(0, 1 - age / p.life);
    if (age > p.life) { p.destroy(); particles.splice(i, 1); }
  }
}
async function banner(text, colour = 0xf2c14e, ms = 1600, size = 64) {
  const t = label(text, size, colour, { x: W / 2, y: Y0 + REEL_H / 2, stroke: { color: 0x1a0d00, width: 10 } });
  t.scale.set(0.3); root.addChild(t);
  await tween(350, k => { t.scale.set(0.3 + 0.7 * k); }, k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2);
  await sleep(ms);
  await tween(250, k => { t.alpha = 1 - k; });
  t.destroy();
}
function clearLines() { linesLayer.clear(); idle = null; lineInfo.text = ''; reels.forEach(r => r.slots.forEach(s => { s.view.scale.set(1); s.view.alpha = 1; })); }
function drawLines(lines, alpha = 1) {
  linesLayer.clear();
  for (const l of lines) {
    const pts = [0, 1, 2, 3, 4].map(r => reels[r].cellCentre(PAYLINE_ROWS[l.line][r]));
    const col = LINE_COLOURS[l.line];
    linesLayer.moveTo(pts[0].x - CW / 2 + 4, pts[0].y);
    pts.forEach(p => linesLayer.lineTo(p.x, p.y));
    linesLayer.lineTo(pts[4].x + CW / 2 - 4, pts[4].y);
    linesLayer.stroke({ width: 5, color: col, alpha: 0.85 * alpha, cap: 'round', join: 'round' });
    for (const [r, row] of l.cells) {
      const c = reels[r].cellCentre(row);
      linesLayer.roundRect(c.x - CW / 2 + 2, c.y - CH / 2 + 2, CW - 4, CH - 4, 14).stroke({ width: 4, color: col, alpha });
    }
  }
}
async function pulseCells(cells) {
  const slots = cells.map(([r, row]) => reels[r].slotAt(row));
  await tween(520, k => slots.forEach(s => s.view.scale.set(1 + 0.12 * Math.sin(k * Math.PI))), k => k);
}
function startIdle(lines, st, alpha = 1) {
  if (!lines.length) return;
  idle = { lines, st, alpha, i: 0, next: 0 };
}
function tickIdle(now) {
  if (!idle || now < idle.next) return;
  const l = idle.lines[idle.i % idle.lines.length];
  if (idle.lines.length > 1) drawLines([l], idle.alpha);
  lineInfo.text = `Line ${l.line + 1}: ${l.count}× ${NAMES[l.sym]} pays ${money(l.units / 10 * idle.st)}`;
  idle.i++; idle.next = now + 1500;
}

// ------------------------------------------------------------------ spinning
const NAMES = Object.fromEntries(Object.entries(SYMBOLS).map(([k, v]) => [k, v.name]));
const cheapFish = () => FISH[Math.floor(Math.random() * 6)];
const filler = (set, r) => () => {
  const s = (set === 'fs' ? strips.free_spins : strips.base)[r];
  const sym = s[Math.floor(Math.random() * s.length)];
  return { sym, fish: sym === 'CASH' ? cheapFish() : null };
};

async function spinReels(set, res) {
  const stops = [...STOP_AT];
  const tease = res.alarmReels[0] && res.alarmReels[1];
  if (tease) { stops[3] += ANTICIPATION_MS; stops[4] += ANTICIPATION_MS; }
  const t0 = performance.now();
  sfx.spinStart();
  let alarms = 0;
  const done = reels.map((reel, r) => {
    const col = res.grid[r].map((sym, k) => ({ sym, fish: res.cash[r + ',' + k] ?? null }));
    return reel.spinTo(col, stops[r], t0, filler(set, r)).then(() => {
      sfx.reelStop(r);
      if (r >= 1 && r <= 3 && res.alarmReels[r - 1]) {
        setLight(r - 1, true); sfx.alarm(alarms++);
      }
      if (r === 2 && tease) { sfx.anticipation(); glowOn = performance.now(); }
      if (r === 3) glowOn = 0;
    });
  });
  await Promise.all(done);
  await sleep(220);   // let the landing bounce settle
}
let glowOn = 0;
function tickGlow(now) {
  glow.clear();
  if (!glowOn) return;
  const a = 0.5 + 0.5 * Math.sin((now - glowOn) / 90), x = X0 + 3 * (CW + GAP);
  glow.roundRect(x - 6, Y0 - 6, CW + 12, REEL_H + 12, 14).stroke({ width: 6, color: 0xff4d4d, alpha: 0.4 + 0.5 * a });
}

// ------------------------------------------------------------------ feature
async function collectFish(res, st, state) {
  const keys = Object.keys(res.cash).sort((a, b) => a.split(',')[0] - b.split(',')[0] || a.split(',')[1] - b.split(',')[1]);
  let i = 0;
  for (const key of keys) {
    const [r, k] = key.split(',').map(Number), f = res.cash[key];
    const slot = reels[r].slotAt(k), c = reels[r].cellCentre(k);
    const record = f[1] >= 250;
    await tween(260, t => slot.view.scale.set(1 + 0.18 * Math.sin(t * Math.PI)), t => t);
    burst(c.x, c.y, record ? 40 : 12, 0xbfe8ff, { speed: 5, up: 3 });
    sfx.collect(i++);
    if (record) { sfx.record(); await banner(`RECORD FISH!\n${f[0]}`, 0xffe066, 1400, 56); }
    const fly = label(money(f[1] * st), 26, 0xffe066, { x: c.x, y: c.y + 40, stroke: { color: 0x2a1a00, width: 5 } });
    root.addChild(fly);
    await tween(420, t => { fly.position.set(c.x + (meterPos.x - c.x) * t, c.y + 40 + (meterPos.y - c.y - 40) * t - Math.sin(t * Math.PI) * 60); fly.scale.set(1 - 0.3 * t); },
      t => t * t * (3 - 2 * t));
    fly.destroy();
    state.running += f[1]; state.fish++;
    meter.text = money(Math.min(state.running, MAX_WIN) * st); fishCount.text = String(state.fish);
    burst(meterPos.x, meterPos.y, 8, 0xffe066, { speed: 3, up: 2, life: 600 });
  }
}

async function freeSpins(st, running) {
  sfx.feature(); setMood('feature'); duckMusic(2200);
  lightsOff(); clearLines();
  await banner('THREE RODS!', 0xff6b6b, 900, 76);
  await banner('10 FREE SPINS', 0xf2c14e, 900, 70);
  tween(1200, k => { dusk.alpha = k; });
  const state = { running, fish: 0 };
  featPanel.visible = true; leftInfo.visible = false; meter.text = money(running * st); fishCount.text = '0';
  let left = 10, played = 0, capped = false;
  while (left > 0) {
    clearLines(); lightsOff();
    const r = E.spin('fs'); left--; played++;
    fsCount.text = `${played} / ${played + left}`;
    await spinReels('fs', r);
    await collectFish(r, st, state);
    if (r.lines.length) {
      drawLines(r.lines); sfx.lineWin(); await pulseCells(r.lines.flatMap(l => l.cells));
      state.running += r.lines.reduce((a, l) => a + l.units, 0) / 10;
      meter.text = money(Math.min(state.running, MAX_WIN) * st);
    }
    if (r.trigger) { left += 5; fsCount.text = `${played} / ${played + left}`; sfx.retrigger(); await banner('+5 FREE SPINS', 0xff8080, 900); }
    if (state.running >= MAX_WIN) { state.running = MAX_WIN; left = 0; capped = true; await banner('MAXIMUM WIN REACHED', 0xffe066, 1500, 54); }
    await sleep(r.lines.length || Object.keys(r.cash).length ? 500 : 250);
  }
  clearLines(); lightsOff();
  return { total: state.running, played, fish: state.fish, capped };
}

// Runs after any big-win count-up: feature summary, then back to the dawn scene
async function endFeature(f, win, st) {
  setMood('base');
  await summary(f.played, f.fish, win, win >= st, f.capped);
  tween(1200, k => { dusk.alpha = 1 - k; });
  featPanel.visible = false; leftInfo.visible = true;
}

function summary(spins, fish, win, celebrate, capped) {
  return new Promise(res => {
    const m = modal(new Modal(560, 300, 'FEATURE COMPLETE', { closable: false }));
    m.body.addChild(label(`${spins} free spins · ${fish} fish landed${capped ? '\nMaximum win reached' : ''}`, 20, 0xdbe7ec, { x: 0, y: -40, stroke: { width: 0 } }));
    m.body.addChild(label(celebrate ? `TOTAL WIN ${money(win)}` : `Total returned ${money(win)}`, celebrate ? 40 : 28, celebrate ? 0xffe066 : 0xdbe7ec, { x: 0, y: 20 }));
    const b = new Button('CONTINUE', 200, 52, () => { clearTimeout(timer); m.close(); modalClosed(); res(); });
    b.position.set(0, 100); m.panel.addChild(b); root.addChild(m);
    const timer = setTimeout(() => { if (!m.destroyed) { m.close(); modalClosed(); res(); } }, 6000);
  });
}

// Big win celebration with a count-up; tap to finish the count early
function bigWin(win, st) {
  const tier = BIG_WINS.find(t => win / st >= t.min);
  if (!tier) return Promise.resolve();
  return new Promise(async res => {
    const c = new Container();
    const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x000000, alpha: 0.55 }); dim.eventMode = 'static'; dim.cursor = 'pointer';
    const title = label(tier.title, 84, 0xffe066, { x: W / 2, y: 280, stroke: { color: 0x3a1a00, width: 12 } });
    const amt = label(money(0), 64, 0xffffff, { x: W / 2, y: 390, stroke: { color: 0x000000, width: 9 } });
    c.addChild(dim, title, amt); root.addChild(c);
    sfx.bigWin(); duckMusic(tier.ms + 1400);
    let skip = false; dim.on('pointertap', () => { skip = true; });
    const t0 = performance.now();
    let lastTick = 0;
    await new Promise(done => {
      const step = () => {
        const k = skip ? 1 : Math.min(1, (performance.now() - t0) / tier.ms);
        amt.text = money(win * (1 - (1 - k) ** 2)); title.scale.set(1 + 0.04 * Math.sin(performance.now() / 120));
        if (performance.now() - lastTick > 90) { sfx.tally(); lastTick = performance.now(); burst(W / 2 + (Math.random() - 0.5) * 600, 520, 3, 0xffd84d, { speed: 7, up: 9, life: 1400, size: 0.7 }); }
        if (k < 1) requestAnimationFrame(step); else done();
      };
      step();
    });
    await sleep(1400);
    await tween(300, k => { c.alpha = 1 - k; });
    c.destroy({ children: true }); res();
  });
}

// ------------------------------------------------------------------ game round
async function round(force = false) {
  if (busy || modals || ended) return;
  const st = stake();
  if (!force && balance < st - 1e-9) {
    msg.text = 'Not enough balance'; msg.style.fill = 0xff8080;
    if (balance < STAKES[0]) resetBtn.visible = true;
    return;
  }
  busy = true; resetBtn.visible = false; clearLines(); lightsOff();
  msg.text = ''; lastWin = 0;
  if (!force) balance = Math.round((balance - st) * 100) / 100;   // demo bonus is free
  hud();
  const base = E.spin('base', force);
  await spinReels('base', base);
  let total = base.total, fsSpins = 0;
  if (base.lines.length) {
    if (base.total >= 1) { drawLines(base.lines); sfx.lineWin(); await pulseCells(base.lines.flatMap(l => l.cells)); }
    else drawLines(base.lines, 0.45);   // return below stake: shown plainly, no sound or animation
  }
  let feature = null;
  if (base.trigger) {
    await sleep(500);
    feature = await freeSpins(st, total);
    total = feature.total; fsSpins = feature.played;
  }
  total = Math.min(total, MAX_WIN);
  const win = Math.round(total * st * 100) / 100;
  if (base.trigger || base.lines.length) await bigWin(win, st);   // big-win count-up comes before the feature summary
  if (feature) await endFeature(feature, win, st);
  balance = Math.round((balance + win) * 100) / 100; lastWin = win;
  if (win <= 0) { msg.text = 'No win'; msg.style.fill = 0x9fb7c2; }
  else if (win < st - 1e-9) { msg.text = `Returned ${money(win)}`; msg.style.fill = 0x9fb7c2; }
  else { msg.text = `WIN ${money(win)}`; msg.style.fill = 0xffe066; burst(W / 2, 591, 16, 0xffe066, { speed: 4, up: 3 }); }
  if (base.lines.length && !base.trigger) { drawLines(base.lines, win >= st ? 1 : 0.45); startIdle(base.lines, st, win >= st ? 1 : 0.45); }
  history.unshift({ time: new Date(), stake: st, win, feature: base.trigger, fsSpins, demo: force });
  if (history.length > 100) history.pop();
  busy = false; hud();
  if (balance < STAKES[0]) resetBtn.visible = true;
  await maybeRealityCheck();
}

async function maybeRealityCheck() {
  if (Date.now() - lastCheck < REALITY_CHECK_MIN * 60000) return;
  lastCheck = Date.now();
  modals++; hud();
  const choice = await realityCheck(root, mins(), balance - netBase);
  modals--;
  if (choice === 'stop') {
    ended = true; modals++;
    sessionEnded(root, mins(), balance - netBase, () => {
      modals--; ended = false; sessionStart = Date.now(); lastCheck = Date.now(); netBase = balance; history.length = 0; hud();
    });
  }
  hud();
}

// ------------------------------------------------------------------ input + loop
window.addEventListener('keydown', e => {
  if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); round(); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') { e.preventDefault(); bump(1); }
  else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') { e.preventDefault(); bump(-1); }
  else if (e.code === 'KeyI') showInfo();
  else if (e.code === 'KeyH') showHistory();
  else if (e.code === 'KeyM') sndBtn.emit('pointertap');
  else if (e.code === 'KeyN') musicBtn.emit('pointertap');
});

let last = performance.now();
app.ticker.add(() => {
  const now = performance.now(), dt = Math.min(3, (now - last) / 16.67); last = now;
  reels.forEach(r => r.update(now));
  tickTweens(now); tickParticles(now, dt); tickGlow(now); tickIdle(now);
  spinBtn.update(now);
  mist.x = Math.sin(now / 9000) * 60; mist.alpha = 0.7 + 0.3 * Math.sin(now / 4000);
});
setInterval(clock, 1000); clock();

// Opening grid
reels.forEach((r, i) => r.show([0, 1, 2].map(filler('base', i))));
hud();
modals++; hud();
await titleScreen(root, logo, tex);
initAudio();
setMusic(prefs.music !== false); showMusic();
modals--; hud();
