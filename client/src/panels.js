// Info (paytable / feature / paylines / rules), history, reality check and title screens.
import { Container, Graphics, Sprite } from 'pixi.js';
import { W, H, SYMBOLS, LINE_COLOURS, MIN_SPIN_MS, REALITY_CHECK_MIN, DEMO_BONUS, money } from './config.js';
import { PAY, PAYLINES, FISH, MAX_WIN, SWIM_LADDER } from './engine.js';
import { getArtScale } from './art.js';
import { Modal, Button, label } from './ui.js';

const PAYING = ['MIRROR', 'TENCH', 'BREAM', 'ROACH', 'BIVVY', 'NET', 'CATAPULT', 'FLASK', 'CORN', 'PELLET', 'BOILIE', 'FLOAT'];
const body = (text, size = 17, wrap = 960, x = 0, y = 0, fill = 0xdbe7ec, ax = 0.5) =>
  label(text, size, fill, { wrap, x, y, ax, ay: 0, stroke: { width: 0 }, lineHeight: size * 1.45, style: { fontWeight: 'normal', align: ax === 0 ? 'left' : 'center' } });

function icon(textures, sym, x, y, s = 0.52) {
  const sp = new Sprite(textures[sym]); sp.anchor.set(0.5); sp.scale.set(s / getArtScale()); sp.position.set(x, y); return sp;
}

function paytablePage(textures, stake) {
  const p = new Container();
  p.addChild(body(`Values shown for your current stake of ${money(stake)}. Line wins pay left to right on 10 fixed lines.`, 16, 1000, 0, -228));
  PAYING.forEach((sym, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = -390 + col * 260, y = -150 + row * 112;
    p.addChild(icon(textures, sym, x - 50, y));
    const v = PAY[sym].map(u => money(u / 10 * stake));
    p.addChild(body(`${SYMBOLS[sym].name}\n5× ${v[2]}\n4× ${v[1]}\n3× ${v[0]}`, 15, 140, x + 8, y - 44, 0xffffff, 0));
  });
  p.addChild(icon(textures, 'WILD', -400, 220, 0.5), icon(textures, 'ALARM', 110, 220, 0.5));
  p.addChild(body('LEATHER CARP is WILD. It substitutes for all line symbols except the Bite Alarm and Specimen Fish.', 15, 330, -345, 188, 0xffffff, 0));
  p.addChild(body('BITE ALARM appears on reels 2, 3 and 4 only. One on each of those reels starts the Three Rods feature.', 15, 330, 165, 188, 0xffffff, 0));
  return p;
}

function featurePage(textures, stake) {
  const p = new Container();
  p.addChild(label('THREE RODS FREE SPINS', 24, 0xf2c14e, { x: 0, y: -230 }));
  p.addChild(body('Land a Bite Alarm on reels 2, 3 and 4 in the same spin to win 10 free spins. Before the first free spin, three swims are ' +
    'baited on three different reels; they stay put for the whole feature.\n' +
    'Specimen Fish can land anywhere. Every fish is weighed and paid straight away. A fish caught in a swim is paid at that ' +
    'swim\'s multiplier, and the multiplier then doubles. Three Bite Alarms add 5 more spins. Line wins pay as normal.', 16, 1000, 0, -206));
  p.addChild(label('SWIM MULTIPLIER', 16, 0xffd36a, { x: 0, y: -84 }));
  SWIM_LADDER.forEach((m, i) => {
    const x = -300 + i * 150, last = i === SWIM_LADDER.length - 1;
    p.addChild(new Graphics().roundRect(x - 62, -66, 124, 44, 10).fill({ color: 0x3a2a08, alpha: 0.95 }).stroke({ width: 2, color: 0xf2c14e }));
    p.addChild(label(`×${m}`, 22, 0xffe066, { x, y: -52 }));
    p.addChild(label(last ? `catch ${i + 1} and on` : `catch ${i + 1}`, 12, 0xdbe7ec, { x, y: -32, stroke: { width: 0 } }));
    if (!last) p.addChild(label('›', 22, 0xf2c14e, { x: x + 75, y: -46 }));
  });
  p.addChild(icon(textures, 'CASH', -445, 110, 0.6));
  p.addChild(label('FISH WEIGHT → PRIZE', 16, 0xffe066, { x: 30, y: 4 }));
  FISH.forEach(([w, mult], i) => {
    const col = i % 3, row = Math.floor(i / 3), x = -220 + col * 260, y = 36 + row * 42;
    const special = mult >= 250;
    p.addChild(new Graphics().roundRect(x - 115, y - 16, 230, 32, 8).fill({ color: special ? 0x5a4210 : 0x10303f, alpha: 0.9 })
      .stroke({ width: 1, color: special ? 0xffd84d : 0x2f5d70 }));
    p.addChild(label(`${w}  =  ${money(mult * stake)}`, 16, special ? 0xffe066 : 0xffffff, { x, y, stroke: { width: 0 } }));
  });
  p.addChild(body('Record fish: 52lb 0oz pays 250× stake and 64lb 8oz pays 1,000× stake, before any swim multiplier.', 15, 900, 30, 206, 0xffe066));
  return p;
}

function paylinesPage() {
  const p = new Container();
  p.addChild(body('10 fixed paylines. Wins pay left to right from reel 1. Only the highest win on each line is paid.', 16, 1000, 0, -228));
  PAYLINES.forEach((pl, i) => {
    const col = i % 5, row = Math.floor(i / 5), x = -420 + col * 210, y = -110 + row * 190, s = 26, g = 4;
    const ox = x - (5 * s + 4 * g) / 2, oy = y - (3 * s + 2 * g) / 2;
    const gr = new Graphics();
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++)
      gr.roundRect(ox + r * (s + g), oy + k * (s + g), s, s, 4).fill(pl[r] === k ? LINE_COLOURS[i] : 0x1b3a48);
    p.addChild(gr, label(`Line ${i + 1}`, 15, 0xffffff, { x, y: y + 64, stroke: { width: 0 } }));
  });
  return p;
}

function rulesPage() {
  const p = new Container();
  p.addChild(body([
    '• Return to player (design figure): 96.1%. This is a demo prototype; the figure has not been independently certified.',
    `• Total win per game round, including free spins, is capped at ${MAX_WIN.toLocaleString('en-GB')}× stake.`,
    '• Stakes from £0.10 up to £5.00 per spin, or £2.00 for players aged 18 to 24 (GB limits); your casino may set a lower maximum. Use − / + or the arrow keys.',
    `• Every spin lasts at least ${MIN_SPIN_MS / 1000} seconds. There is no autoplay, turbo or quick stop.`,
    '• Returns smaller than your stake are shown as returns, not as wins.',
    `• Your session time and net position are always on screen. A reality check appears every ${REALITY_CHECK_MIN} minutes.`,
    '• Free spins are played at the stake that triggered them. Swim positions are chosen at random when the feature starts.',
    '• Malfunction voids all pays and plays.',
    '• Demo money only. This build uses a non-certified random number generator and is not for real-money play.',
    DEMO_BONUS ? '• DEMO BONUS starts the free spins at no cost. It exists only for demonstrations and is removed in release builds.' : '',
  ].filter(Boolean).join('\n'), 17, 960, -480, -230, 0xdbe7ec, 0));
  return p;
}

export function openInfo(stage, textures, stake, onClose) {
  const m = new Modal(1120, 640, null, { onClose });
  const pages = [['PAYTABLE', () => paytablePage(textures, stake)], ['FREE SPINS', () => featurePage(textures, stake)],
    ['PAYLINES', paylinesPage], ['RULES', rulesPage]];
  const holder = new Container(); holder.y = 20; m.body.addChild(holder);
  const tabs = [];
  const show = i => {
    holder.removeChildren().forEach(c => c.destroy({ children: true }));
    holder.addChild(pages[i][1]());
    tabs.forEach((t, j) => { t.fillColour = i === j ? 0x9a6a12 : 0x1d4152; t.draw(); });
  };
  pages.forEach(([name], i) => {
    const b = new Button(name, 170, 44, () => show(i), { size: 17 }); b.position.set(-345 + i * 185, -280);
    tabs.push(b); m.panel.addChild(b);
  });
  show(0); stage.addChild(m); return m;
}

export function openHistory(stage, history, onClose) {
  const m = new Modal(760, 600, 'GAME HISTORY', { onClose });
  if (!history.length) m.body.addChild(label('No rounds played yet this session.', 18, 0x9fb7c2, { x: 0, y: 0, stroke: { width: 0 } }));
  [['TIME', -250], ['STAKE', -110], ['RETURN', 40], ['RESULT', 210]].forEach(([h, x]) =>
    m.body.addChild(label(h, 15, 0x9fb7c2, { x, y: -226, stroke: { width: 0 } })));
  history.slice(0, 18).forEach((h, i) => {
    const y = -196 + i * 26;
    const t = h.time.toLocaleTimeString('en-GB');
    const result = h.feature ? `Free spins (${h.fsSpins})` : h.win >= h.stake ? 'Win' : h.win > 0 ? 'Return' : '—';
    [[t, -250], [money(h.stake), -110], [money(h.win), 40], [result, 210]].forEach(([s, x]) =>
      m.body.addChild(label(s, 15, h.win >= h.stake ? 0xffe066 : 0xffffff, { x, y, stroke: { width: 0 } })));
  });
  stage.addChild(m); return m;
}

export function realityCheck(stage, minutes, net) {
  return new Promise(res => {
    const m = new Modal(640, 340, 'REALITY CHECK', { closable: false });
    m.body.addChild(body(`You have been playing for ${minutes} minutes.\nSession net: ${net >= 0 ? '+' : '−'}${money(Math.abs(net))}\n\nWould you like to keep playing or take a break?`, 19, 560, 0, -100, 0xffffff));
    const go = new Button('KEEP PLAYING', 220, 54, () => { m.close(); res('continue'); });
    const stop = new Button('TAKE A BREAK', 220, 54, () => { m.close(); res('stop'); }, { fill: 0x7a2e12 });
    go.position.set(-125, 110); stop.position.set(125, 110); m.panel.addChild(go, stop);
    stage.addChild(m);
  });
}

export function sessionEnded(stage, minutes, net, onNew) {
  const m = new Modal(640, 320, 'SESSION ENDED', { closable: false });
  m.body.addChild(body(`Time played: ${minutes} minutes\nSession net: ${net >= 0 ? '+' : '−'}${money(Math.abs(net))}\n\nTake care. Come back later if you want another session.`, 19, 560, 0, -90, 0xffffff));
  const b = new Button('START NEW SESSION', 260, 54, () => { m.close(); onNew(); }); b.position.set(0, 105); m.panel.addChild(b);
  stage.addChild(m);
}

export function titleScreen(stage, logo, textures) {
  return new Promise(res => {
    const c = new Container();
    const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x02080c, alpha: 0.86 }); dim.eventMode = 'static'; dim.cursor = 'pointer';
    const lg = new Sprite(logo); lg.anchor.set(0.5); lg.scale.set(0.62); lg.position.set(W / 2, 170);
    c.addChild(dim, lg, label('A UK carp-fishing slot · 5 reels · 10 lines', 22, 0xdbe7ec, { x: W / 2, y: 240 }));
    ['ALARM', 'CASH', 'MIRROR'].forEach((s, i) => c.addChild(icon(textures, s, W / 2 - 280 + i * 280, 380, 0.9)));
    [['Three Rods', 'alarms on reels 2, 3 & 4'], ['Baited swims', 'fish in a swim pay ×2, ×4, ×8 …'], ['Record fish', 'up to 1,000× stake']]
      .forEach(([a, b], i) => {
        c.addChild(label(a, 22, 0xf2c14e, { x: W / 2 - 280 + i * 280, y: 466 }), label(b, 15, 0xdbe7ec, { x: W / 2 - 280 + i * 280, y: 492 }));
      });
    const tap = label('TAP OR PRESS SPACE TO START', 26, 0xffffff, { x: W / 2, y: 580 });
    c.addChild(tap, label('Demo money only · 18+ · Play responsibly', 14, 0x9fb7c2, { x: W / 2, y: 625 }));
    stage.addChild(c);
    let t = 0; const blink = setInterval(() => { t++; tap.alpha = 0.55 + 0.45 * Math.abs(Math.sin(t / 6)); }, 50);
    const go = () => { clearInterval(blink); window.removeEventListener('keydown', key); c.destroy({ children: true }); res(); };
    const key = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); go(); } };
    dim.on('pointertap', go); window.addEventListener('keydown', key);
  });
}
