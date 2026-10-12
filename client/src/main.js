// Specimen Hunter: game client. Outcomes are decided by the game server (or the same engine locally, see
// gameClient.js) before the reels move; this file only presents them.
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import strips from '../strips.json';
import { MAX_WIN, FISH, PAYLINES as PAYLINE_ROWS, swimMult } from './engine.js';
import { connect, launchProfile } from './gameClient.js';
import { W, H, CW, CH, GAP, X0, Y0, REEL_W, REEL_H, STOP_AT, ANTICIPATION_MS, START_BALANCE,
  REALITY_CHECK_MIN, DEMO_BONUS, LINE_COLOURS, BIG_WINS, SYMBOLS, GAME_NAME, money, sleep } from './config.js';
import { makeSymbolTextures, makeSceneTexture, makeFrameTexture, makeLogoTexture, makeDotTexture, makeSwimPatchTexture, makeMarkerTexture,
  makeCatapultTextures, makeBaitTexture, makeKingfisherTextures, getArtScale } from './art.js';
import { Reel, tween, tickTweens } from './reels.js';
import { initAudio, sfx, isMuted, setMuted, isMusicOn, setMusic, setMood, duckMusic } from './audio.js';
import { label, Button, SpinButton, valueBox, Modal } from './ui.js';
import { openInfo, openHistory, realityCheck, sessionEnded, titleScreen } from './panels.js';

document.title = GAME_NAME;
const game = await connect();
const profile = launchProfile();
let session = await game.start(profile);
let STAKES = session.stakes.map(p => p / 100);   // allowed stakes in pounds (operator / age-band cap applied)
const app = new Application();
await app.init({ resizeTo: window, background: 0x06121a, antialias: true, resolution: Math.min(3, window.devicePixelRatio || 1), autoDensity: true });
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

const logoSp = new Sprite(makeLogoTexture('header')); logoSp.anchor.set(0.5); logoSp.scale.set(0.68); logoSp.position.set(W / 2, 50); root.addChild(logoSp);

const { texture: frameTex, pad } = makeFrameTexture();
const frame = new Sprite(frameTex); frame.position.set(X0 - pad, Y0 - pad); root.addChild(frame);
const swimUnder = new Container(); root.addChild(swimUnder);   // baited swim patches, under the symbols

let stakeIdx = Math.max(0, STAKES.indexOf(1) >= 0 ? STAKES.indexOf(1) : STAKES.length - 1);   // start at £1.00 if allowed
const stake = () => STAKES[stakeIdx];
// A fish shows its weight and prize; once a swim has multiplied it, the multiplied prize
const fishLabel = f => [f.label, money(f.value * (f.shown ?? 1) * stake())];
const reels = Array.from({ length: 5 }, (_, r) => new Reel(r, tex, fishLabel));
reels.forEach(r => root.addChild(r.view));
const swimOver = new Container(); root.addChild(swimOver);     // swim rings, marker floats and multipliers

// Redraw the symbols at exactly their on-screen pixel size whenever the game's size changes
// (rotation, resizing), so the GPU never has to shrink or stretch them.
let oldTex = null, sharpenTimer = 0;
function sharpenSymbols() {
  const target = Math.min(4, Math.max(0.75, Math.ceil(root.scale.x * app.renderer.resolution * 4) / 4));
  if (Math.abs(target - getArtScale()) < 0.01) return;
  const fresh = makeSymbolTextures(target);
  if (oldTex) Object.values(oldTex).forEach(t => t.destroy(true));   // keep one previous set for open panels
  oldTex = { ...tex };
  Object.assign(tex, fresh);
  reels.forEach(r => r.refreshLabels());
}
sharpenSymbols();
window.addEventListener('resize', () => { clearTimeout(sharpenTimer); sharpenTimer = setTimeout(sharpenSymbols, 200); });

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
const leftInfo = new Container(); leftInfo.position.set(95, 262); side.addChild(leftInfo);
leftInfo.addChild(new Graphics().roundRect(-80, -98, 160, 196, 14).fill({ color: 0x04121a, alpha: 0.7 }).stroke({ width: 2, color: 0xff6b6b, alpha: 0.6 }));
leftInfo.addChild(label('THREE RODS', 17, 0xff8080, { x: 0, y: -76 }));
leftInfo.addChild(label('A bite alarm on\nreels 2, 3 & 4 wins\n10 FREE SPINS', 14, 0xffffff, { x: 0, y: -30, style: { fontWeight: 'normal' }, stroke: { width: 0 }, lineHeight: 19 }));
leftInfo.addChild(label('3 BAITED SWIMS', 14, 0xffd36a, { x: 0, y: 18 }));
leftInfo.addChild(label('Fish caught in a swim\npay ×2, then ×4, ×8,\n×16 and up to ×32', 13, 0xdbe7ec, { x: 0, y: 58, style: { fontWeight: 'normal' }, stroke: { width: 0 }, lineHeight: 18 }));

const featPanel = new Container(); featPanel.position.set(1185, 300); featPanel.visible = false; side.addChild(featPanel);
featPanel.addChild(new Graphics().roundRect(-82, -172, 164, 344, 16).fill({ color: 0x04121a, alpha: 0.84 }).stroke({ width: 3, color: 0xf2c14e }));
featPanel.addChild(label('FREE SPINS', 16, 0xf2c14e, { x: 0, y: -150 }));
const fsCount = label('', 32, 0xffffff, { x: 0, y: -114 }); featPanel.addChild(fsCount);
featPanel.addChild(label('SWIMS', 13, 0xffd36a, { x: 0, y: -78 }));
const markerTex = makeMarkerTexture();
// one row per swim, left to right as on the reels: next multiplier and what the swim has paid so far
const swimRows = [0, 1, 2].map(i => {
  const row = new Container(); row.position.set(0, -46 + i * 40); featPanel.addChild(row);
  row.addChild(new Graphics().roundRect(-72, -17, 144, 34, 9).fill({ color: 0x0b2a38, alpha: 0.95 }).stroke({ width: 1, color: 0x2f5d70 }));
  const m = new Sprite(markerTex); m.anchor.set(0.5, 0.5); m.scale.set(0.42); m.position.set(-60, -2);
  const mult = label('×2', 19, 0xffe066, { x: -26, y: 0 });
  const won = label('£0.00', 15, 0xffffff, { x: 34, y: 0 });
  row.addChild(m, mult, won); return { row, mult, won };
});
featPanel.addChild(label('TOTAL WIN', 13, 0x9fb7c2, { x: 0, y: 84 }));
const meter = label('£0.00', 26, 0xffe066, { x: 0, y: 114 }); featPanel.addChild(meter);
const fishCount = label('', 12, 0x9fb7c2, { x: 0, y: 150, stroke: { width: 0 } }); featPanel.addChild(fishCount);
const meterPos = { x: 1185, y: 414 };

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
const prefs = (() => { try { return JSON.parse(localStorage.getItem('specimen-hunter-audio') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('specimen-hunter-audio', JSON.stringify({ music: isMusicOn() })); } catch {} };
const sndBtn = new Button('♪', 50, 50, () => {
  setMuted(!isMuted()); sndBtn.text.text = isMuted() ? '✕' : '♪';
  sndBtn.fillColour = isMuted() ? 0x8a2a1a : 0x1d4152; sndBtn.draw();   // red while muted so it's obvious
}, { fill: 0x1d4152, size: 22 });
const musicBtn = new Button('♫', 50, 50, () => { setMusic(!isMusicOn()); showMusic(); savePrefs(); }, { fill: 0x1d4152, size: 22 });
const showMusic = () => { musicBtn.text.style.fill = isMusicOn() ? 0xffffff : 0x6d7f88; };
[infoBtn, histBtn, musicBtn, sndBtn].forEach((b, i) => { b.position.set(1068 + i * 56, 678); root.addChild(b); });
let demoBtn = null;
let ageBtn = null;
let kfBtn = null;
if (DEMO_BONUS && session.demo) {
  demoBtn = new Button('DEMO BONUS', 160, 40, () => round(true), { fill: 0x9a4a12, size: 16 });
  demoBtn.position.set(95, 414); root.addChild(demoBtn);
  kfBtn = new Button('DEMO KINGFISHER', 160, 40, () => round('kingfisher'), { fill: 0x12607a, size: 14 });
  kfBtn.position.set(95, 460); root.addChild(kfBtn);
  root.addChild(label('demo only · free\nremoved in release builds', 11, 0x9fb7c2, { x: 95, y: 496, stroke: { width: 2, color: 0x000000 } }));
  // Demo of operator-set stake caps: GB limit is £2 per spin for 18-24s, £5 for 25+
  ageBtn = new Button('', 160, 40, () => switchAgeBand(), { fill: 0x1d4152, size: 13 });
  ageBtn.position.set(95, 544); root.addChild(ageBtn);
  root.addChild(label('demo: operator stake cap', 11, 0x9fb7c2, { x: 95, y: 574, stroke: { width: 2, color: 0x000000 } }));
}
const modeT = label(game.mode === 'server' ? 'Outcomes: game server' : 'Outcomes: in-browser engine (demo)', 11, 0x9fb7c2, { x: 18, y: 40, ax: 0, ay: 0, stroke: { width: 2, color: 0x000000 } });
root.addChild(modeT);
const resetBtn = new Button('RESET DEMO BALANCE', 250, 44, async () => {
  session = await game.start({ ...profile, balance: START_BALANCE * 100 });
  balance = session.balance / 100; netBase = balance; resetBtn.visible = false; msg.text = ''; hud();
}, { fill: 0x7a2e12, size: 16 });
resetBtn.position.set(W / 2, 622); resetBtn.visible = false; root.addChild(resetBtn);

// ------------------------------------------------------------------ state
let balance = session.balance / 100, netBase = balance, lastWin = 0, busy = false, modals = 0;
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
  if (kfBtn) kfBtn.enabled = ready;
  if (ageBtn) { ageBtn.text.text = `PLAYER ${profile.ageBand} · MAX ${money(session.maxStake / 100)}`; ageBtn.enabled = ready; }
}
// Demo only: switch the player's age band to show the operator stake cap working
async function switchAgeBand() {
  if (busy || modals || ended) return;
  profile.ageBand = profile.ageBand === '25+' ? '18-24' : '25+';
  const keep = stake();
  session = await game.start({ ...profile, balance: Math.round(balance * 100) });
  STAKES = session.stakes.map(p => p / 100);
  stakeIdx = Math.max(0, STAKES.filter(v => v <= keep + 1e-9).length - 1);   // clamp the stake to the new cap
  reels.forEach(r => r.refreshLabels()); hud();
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
const showInfo = () => { if (!busy && !modals) modal(openInfo(root, tex, stake(), modalClosed, kfTex.up)); };
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
const backOut = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;   // overshoots a little, then settles
async function banner(text, colour = 0xf2c14e, ms = 1600, size = 64) {
  const t = label(text, size, colour, { x: W / 2, y: Y0 + REEL_H / 2, stroke: { color: 0x1a0d00, width: 10 } });
  t.scale.set(0.3); root.addChild(t);
  await tween(350, k => { t.scale.set(0.3 + 0.7 * k); }, backOut);
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
const cheapFish = () => { const [label, value] = FISH[Math.floor(Math.random() * 6)]; return { label, value, swim: -1, mult: 1 }; };
const filler = (set, r) => () => {
  const s = (set === 'fs' ? strips.free_spins : strips.base)[r];
  const sym = s[Math.floor(Math.random() * s.length)];
  return { sym, fish: sym === 'CASH' ? cheapFish() : null };
};

// ------------------------------------------------------------------ kingfisher
// Rarely, a kingfisher flies in while the reels spin, then dives into a few spots and turns them into wilds.
// The reels first land on what was there (spot.was) so the player sees each spot change.
const kfTex = makeKingfisherTextures(2);
const bird = new Sprite(kfTex.up); bird.anchor.set(0.6, 0.5); bird.visible = false; bird.flap = false; root.addChild(bird);
const face = (dx, s = 0.9) => { bird.scale.set(dx < 0 ? -s : s, s); };
async function kingfisherArrives() {
  bird.texture = kfTex.up; bird.visible = true; bird.flap = true; bird.rotation = 0; bird.alpha = 1; face(1);
  sfx.kingfisher();
  msg.text = 'A kingfisher has spotted some big fish!'; msg.style.fill = 0x7fe0ff;
  await tween(1200, t => bird.position.set(-120 + (W / 2 + 120) * t, 70 + 26 * t - Math.sin(t * Math.PI * 2) * 14), t => 1 - (1 - t) ** 2);
}
async function kingfisherDives(spots) {
  for (const w of spots) {
    const c = reels[w.reel].cellCentre(w.row), x0 = bird.x, y0 = bird.y, dx = c.x - x0, dy = c.y - y0;
    bird.flap = false; bird.texture = kfTex.dive; face(dx);
    bird.rotation = dx < 0 ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
    sfx.dive();
    await tween(360, t => bird.position.set(x0 + dx * t, y0 + dy * t * t), t => t);
    sfx.splash(); burst(c.x, c.y, 26, 0xcfefff, { speed: 6, up: 5, life: 800 });
    if (w.was !== 'ALARM') {
      reels[w.reel].replace(w.row, { sym: 'WILD', fish: null });
      sfx.wildLand(); burst(c.x, c.y, 18, 0xffe066, { speed: 5, up: 3, life: 900 });
      const slot = reels[w.reel].slotAt(w.row);
      tween(420, t => slot.view.scale.set(1 + 0.22 * Math.sin(t * Math.PI)), t => t);
    }
    bird.texture = kfTex.up; bird.flap = true; bird.rotation = 0; face(1);
    await tween(340, t => bird.position.set(c.x + 30 * t, c.y + (96 - c.y) * (1 - (1 - t) ** 2)));
  }
  const x0 = bird.x, y0 = bird.y;
  await tween(900, t => { bird.position.set(x0 + (W + 160 - x0) * t * t, y0 - 70 * t); });
  bird.visible = false; bird.flap = false;
  msg.text = '';
}

async function spinReels(set, res) {
  const kf = res.kingfisher;
  const arrival = kf ? kingfisherArrives() : null;
  const stops = [...STOP_AT];
  const tease = res.alarmReels[0] && res.alarmReels[1];
  if (tease) { stops[3] += ANTICIPATION_MS; stops[4] += ANTICIPATION_MS; }
  const t0 = performance.now();
  sfx.spinStart();
  let alarms = 0;
  const done = reels.map((reel, r) => {
    const col = res.grid[r].map((sym, k) => ({ sym: kf?.spots.find(w => w.reel === r && w.row === k)?.was ?? sym, fish: res.cash[r + ',' + k] ?? null }));
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
  if (kf) { await arrival; await kingfisherDives(kf.spots); }
}
let glowOn = 0;
function tickGlow(now) {
  glow.clear();
  if (!glowOn) return;
  const a = 0.5 + 0.5 * Math.sin((now - glowOn) / 90), x = X0 + 3 * (CW + GAP);
  glow.roundRect(x - 6, Y0 - 6, CW + 12, REEL_H + 12, 14).stroke({ width: 6, color: 0xff4d4d, alpha: 0.4 + 0.5 * a });
}

// ------------------------------------------------------------------ feature
// Baited swims: a lit patch under the symbols, a glowing ring, a marker float and a multiplier badge on top
let swims = [], featStake = 0, patchTex = null, patchScale = 0;
function makeSwim(w, patchTex) {
  const c = reels[w.reel].cellCentre(w.row);
  const patch = new Sprite(patchTex); patch.anchor.set(0.5); patch.scale.set(1 / getArtScale()); patch.position.set(c.x, c.y); patch.alpha = 0;
  swimUnder.addChild(patch);
  const ring = new Graphics(); ring.position.set(c.x, c.y); ring.alpha = 0;
  const marker = new Sprite(markerTex); marker.anchor.set(0.5, 0.85); marker.scale.set(0); marker.position.set(c.x - CW / 2 + 18, c.y - CH / 2 + 26);
  const badge = new Container(); badge.position.set(c.x + CW / 2 - 24, c.y - CH / 2 + 22); badge.scale.set(0);
  badge.addChild(new Graphics().circle(0, 2, 23).fill({ color: 0x000000, alpha: 0.5 }).circle(0, 0, 23).fill(0xf2c14e).stroke({ width: 3, color: 0x3a1a00 })
    .circle(0, -3, 17).fill({ color: 0xfff3c0, alpha: 0.45 }));
  const badgeText = label(`×${swimMult(w.catches)}`, 18, 0x3a1a00, { x: 0, y: 1, stroke: { width: 0 } });
  badge.addChild(badgeText);
  swimOver.addChild(ring, marker, badge);
  return { ...w, won: 0, best: 0, patch, ring, marker, badge, badgeText, flash: 0 };
}
function tickSwims(now) {
  swims.forEach((s, i) => {
    const glowA = 0.5 + 0.25 * Math.sin(now / 320 + i * 2);
    s.ring.clear()
      .roundRect(-CW / 2 - 1, -CH / 2 - 1, CW + 2, CH + 2, 18).stroke({ width: 12, color: 0xff9a1a, alpha: 0.22 + 0.1 * glowA + s.flash * 0.5 })
      .roundRect(-CW / 2 + 2, -CH / 2 + 2, CW - 4, CH - 4, 16).stroke({ width: 4, color: s.flash > 0.05 ? 0xffffff : 0xffc04d, alpha: 0.45 + glowA * 0.6 + s.flash * 0.5 });
    s.flash = Math.max(0, s.flash - 0.03);
  });
}
function updateSwimRows() {
  swimRows.forEach((r, i) => {
    const s = swims[i];
    r.row.visible = !!s;
    if (s) { r.mult.text = `×${swimMult(s.catches)}`; r.won.text = money(s.won * featStake); }
  });
}
function clearSwims() {
  const old = [...swimUnder.children, ...swimOver.children];
  tween(400, k => old.forEach(o => { o.alpha = Math.min(o.alpha, 1 - k); })).then(() => old.forEach(o => o.destroy({ children: true })));
  swims = [];
}

// Before the first free spin a catapult fires a pouch of boilies into each swim
const catTex = makeCatapultTextures(2), baitTex = makeBaitTexture(2);
async function baitSwims(list) {
  if (patchScale !== getArtScale()) { patchTex?.destroy(true); patchTex = makeSwimPatchTexture(); patchScale = getArtScale(); }
  swims = list.map(w => makeSwim(w, patchTex));
  updateSwimRows();
  const rest = H - 100, cat = new Sprite(catTex.loaded); cat.anchor.set(0.5, 0.75); cat.scale.set(1.45); cat.position.set(W / 2, H + 140);
  fxLayer.addChild(cat);
  await tween(420, t => { cat.y = H + 120 + (rest - H - 120) * t; }, backOut);
  for (const s of swims) {
    const to = reels[s.reel].cellCentre(s.row);
    const aim = Math.max(-0.7, Math.min(0.7, Math.atan2(to.x - cat.x, cat.y - 60 - to.y))), r0 = cat.rotation;
    await tween(220, t => { cat.rotation = r0 + (aim - r0) * t; });
    await tween(240, t => { cat.scale.set(1.45, 1.45 * (1 - 0.14 * t)); });     // draw back
    cat.texture = catTex.empty; cat.scale.set(1.45); sfx.twang(); sfx.cast();
    const from = { x: cat.x + Math.sin(aim) * 72, y: cat.y - Math.cos(aim) * 72 };
    const bait = new Sprite(baitTex); bait.anchor.set(0.5); bait.scale.set(1.3); fxLayer.addChild(bait);
    await tween(560, t => {
      bait.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 170);
      bait.rotation = t * 7; bait.scale.set(1.3 - 0.45 * t);
    }, t => t);
    bait.destroy();
    sfx.splash();
    burst(to.x, to.y, 28, 0xcfefff, { speed: 6, up: 5, life: 800 }); burst(to.x, to.y, 12, 0xffc04d, { speed: 3, up: 2, life: 900 });
    s.flash = 1;
    tween(450, t => { s.patch.alpha = t; s.ring.alpha = t; });
    tween(380, t => s.marker.scale.set(t * 0.82), backOut);
    tween(380, t => s.badge.scale.set(t), backOut);
    cat.texture = catTex.loaded;
    await sleep(140);
  }
  await tween(380, t => { cat.rotation *= 1 - t; cat.y = rest + (H + 140 - rest) * t; });
  cat.destroy();
  await sleep(250);
}

async function collectFish(res, st, state) {
  const keys = Object.keys(res.cash).sort((a, b) => a.split(',')[0] - b.split(',')[0] || a.split(',')[1] - b.split(',')[1]);
  let i = 0;
  for (const key of keys) {
    const [r, k] = key.split(',').map(Number), f = res.cash[key];
    const slot = reels[r].slotAt(k), c = reels[r].cellCentre(k), sw = f.swim >= 0 ? swims[f.swim] : null;
    const record = f.value >= 250;
    await tween(260, t => slot.view.scale.set(1 + 0.18 * Math.sin(t * Math.PI)), t => t);
    burst(c.x, c.y, record ? 40 : 12, 0xbfe8ff, { speed: 5, up: 3 });
    sfx.collect(i++);
    if (record) { sfx.record(); await banner(`RECORD FISH!\n${f.label}`, 0xffe066, 1400, 56); }
    const pay = f.value * f.mult;
    if (sw) {
      // caught in a swim: the multiplier lands on the fish and its prize counts up
      sw.flash = 1; sfx.swimCatch(sw.catches);
      const pop = label(`×${f.mult}`, 58, 0xffe066, { x: c.x, y: c.y - 8, stroke: { color: 0x3a1a00, width: 9 } });
      pop.scale.set(0.2); fxLayer.addChild(pop);
      burst(c.x, c.y, 24, 0xffd36a, { speed: 6, up: 4, life: 900 });
      await tween(320, t => pop.scale.set(0.2 + 0.85 * t), backOut);
      await tween(560, t => { slot.value.text = money(f.value * st * (1 + (f.mult - 1) * t)); slot.value.scale.set(1 + 0.25 * Math.sin(t * Math.PI)); });
      f.shown = f.mult;
      await tween(220, t => { pop.alpha = 1 - t; pop.scale.set(1.05 + 0.4 * t); });
      pop.destroy();
      sw.catches++; sw.won += pay; sw.best = Math.max(sw.best, f.mult); state.swimFish++;
      // the swim's multiplier doubles for the next fish
      sw.badgeText.text = `×${swimMult(sw.catches)}`; sfx.multUp(sw.catches);
      burst(sw.badge.x, sw.badge.y, 14, 0xffe066, { speed: 4, up: 3, life: 700 });
      tween(450, t => sw.badge.scale.set(1 + 0.6 * Math.sin(t * Math.PI)), t => t);
      updateSwimRows();
    }
    const fly = label(money(pay * st), 26, 0xffe066, { x: c.x, y: c.y + 40, stroke: { color: 0x2a1a00, width: 5 } });
    fxLayer.addChild(fly);
    await tween(420, t => { fly.position.set(c.x + (meterPos.x - c.x) * t, c.y + 40 + (meterPos.y - c.y - 40) * t - Math.sin(t * Math.PI) * 60); fly.scale.set(1 - 0.3 * t); },
      t => t * t * (3 - 2 * t));
    fly.destroy();
    state.running += pay; state.fish++;
    meter.text = money(Math.min(state.running, MAX_WIN) * st); fishCount.text = fishText(state);
    burst(meterPos.x, meterPos.y, 8, 0xffe066, { speed: 3, up: 2, life: 600 });
  }
  // the round result is the authority on swim state
  res.swims?.forEach((w, j) => { if (swims[j] && swims[j].catches !== w.catches) { swims[j].catches = w.catches; swims[j].badgeText.text = `×${swimMult(w.catches)}`; } });
}
const fishText = s => `${s.fish} fish landed · ${s.swimFish} in swims`;

async function freeSpins(st, running, spins, cappedRound, baited) {
  sfx.feature(); setMood('feature'); duckMusic(2200);
  lightsOff(); clearLines();
  await banner('THREE RODS!', 0xff6b6b, 900, 76);
  await banner('10 FREE SPINS', 0xf2c14e, 900, 70);
  tween(1200, k => { dusk.alpha = k; });
  const state = { running, fish: 0, swimFish: 0 };
  featStake = st;
  featPanel.visible = true; leftInfo.visible = false; meter.text = money(running * st); fishCount.text = fishText(state);
  fsCount.text = `0 / ${spins.length ? 10 : 0}`;
  await baitSwims(baited);
  let played = 0, capped = false;
  for (const r of spins) {            // spins were decided before the round started; just play them back
    clearLines(); lightsOff();
    played++;
    fsCount.text = `${played} / ${played + r.spinsLeft - (r.trigger ? 5 : 0)}`;
    await spinReels('fs', r);
    await collectFish(r, st, state);
    if (r.lines.length) {
      drawLines(r.lines); sfx.lineWin(); await pulseCells(r.lines.flatMap(l => l.cells));
      state.running += r.lines.reduce((a, l) => a + l.units, 0) / 10;
      meter.text = money(Math.min(state.running, MAX_WIN) * st);
    }
    if (r.trigger) { fsCount.text = `${played} / ${played + r.spinsLeft}`; sfx.retrigger(); await banner('+5 FREE SPINS', 0xff8080, 900); }
    if (cappedRound && played === spins.length) { state.running = MAX_WIN; capped = true; await banner('MAXIMUM WIN REACHED', 0xffe066, 1500, 54); }
    await sleep(r.lines.length || Object.keys(r.cash).length ? 500 : 250);
  }
  clearLines(); lightsOff();
  const best = Math.max(0, ...swims.map(s => s.best));
  return { total: state.running, played, fish: state.fish, swimFish: state.swimFish, best, capped };
}

// Runs after any big-win count-up: feature summary, then back to the dawn scene
async function endFeature(f, win, st) {
  setMood('base');
  await summary(f, win, win >= st);
  tween(1200, k => { dusk.alpha = 1 - k; });
  clearSwims();
  featPanel.visible = false; leftInfo.visible = true;
}

function summary(f, win, celebrate) {
  return new Promise(res => {
    const m = modal(new Modal(600, 320, 'FEATURE COMPLETE', { closable: false }));
    const swimLine = f.swimFish ? `${f.swimFish} caught in swims · best multiplier ×${f.best}` : 'No fish caught in the swims this time';
    m.body.addChild(label(`${f.played} free spins · ${f.fish} fish landed\n${swimLine}${f.capped ? '\nMaximum win reached' : ''}`, 19, 0xdbe7ec,
      { x: 0, y: -48, stroke: { width: 0 }, lineHeight: 28 }));
    m.body.addChild(label(celebrate ? `TOTAL WIN ${money(win)}` : `Total returned ${money(win)}`, celebrate ? 40 : 28, celebrate ? 0xffe066 : 0xdbe7ec, { x: 0, y: 28 }));
    const b = new Button('CONTINUE', 200, 52, () => { clearTimeout(timer); m.close(); modalClosed(); res(); });
    b.position.set(0, 110); m.panel.addChild(b); root.addChild(m);
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
  const before = balance;
  if (!force) balance = Math.round((balance - st) * 100) / 100;   // show the stake taken straight away (demo bonus is free)
  hud();
  let res;
  try { res = await game.play(Math.round(st * 100), force); }   // the whole round is decided here, before the reels move
  catch (e) {
    balance = before; busy = false; msg.text = e.code === 'FUNDS' ? 'Not enough balance' : `Could not play: ${e.message}`; msg.style.fill = 0xff8080; hud();
    return;
  }
  const base = res.round.base;
  await spinReels('base', base);
  let total = base.total, fsSpins = 0;
  if (base.lines.length) {
    if (base.total >= 1) { drawLines(base.lines); sfx.lineWin(); await pulseCells(base.lines.flatMap(l => l.cells)); }
    else drawLines(base.lines, 0.45);   // return below stake: shown plainly, no sound or animation
  }
  let feature = null;
  if (base.trigger) {
    await sleep(500);
    feature = await freeSpins(st, total, res.round.freeSpins, res.round.capped, res.round.swims);
    fsSpins = feature.played;
  }
  const win = res.win / 100;          // the amount actually paid by the game server / wallet
  if (base.trigger || base.lines.length) await bigWin(win, st);   // big-win count-up comes before the feature summary
  if (feature) await endFeature(feature, win, st);
  balance = res.balance / 100; lastWin = win;
  if (win <= 0) { msg.text = 'No win'; msg.style.fill = 0x9fb7c2; }
  else if (win < st - 1e-9) { msg.text = `Returned ${money(win)}`; msg.style.fill = 0x9fb7c2; }
  else { msg.text = `WIN ${money(win)}`; msg.style.fill = 0xffe066; burst(W / 2, 591, 16, 0xffe066, { speed: 4, up: 3 }); }
  if (base.lines.length && !base.trigger) { drawLines(base.lines, win >= st ? 1 : 0.45); startIdle(base.lines, st, win >= st ? 1 : 0.45); }
  history.unshift({ time: new Date(), stake: st, win, feature: base.trigger, kingfisher: !!base.kingfisher, fsSpins, demo: !!force });
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
  tickTweens(now); tickParticles(now, dt); tickGlow(now); tickIdle(now); tickSwims(now);
  if (bird.flap) bird.texture = Math.floor(now / 90) % 2 ? kfTex.up : kfTex.down;
  spinBtn.update(now);
  mist.x = Math.sin(now / 9000) * 60; mist.alpha = 0.7 + 0.3 * Math.sin(now / 4000);
});
setInterval(clock, 1000); clock();
// Dev builds only: lets automated runs (screenshots, the gameplay video) wait until a round has finished
if (import.meta.env.DEV) window.__specimenHunter = {
  idle: () => !busy && modals === 0,
  render: on => on ? app.ticker.add(app.render, app, -25) : app.ticker.remove(app.render, app),   // skip drawing while fast-forwarding
};

// Opening grid
reels.forEach((r, i) => r.show([0, 1, 2].map(filler('base', i))));
hud();
modals++; hud();
await titleScreen(root, makeLogoTexture('title'), tex, kfTex.up);
initAudio();
setMusic(prefs.music !== false); showMusic();
modals--; hud();
