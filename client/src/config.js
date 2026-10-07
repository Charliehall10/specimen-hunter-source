// Shared layout, stake and presentation settings for the Specimen Hunter client.
// Game maths lives in engine.js and strips.json; nothing here changes RTP.

export const W = 1280, H = 720;                    // design resolution (scaled to fit)
export const CW = 168, CH = 136, GAP = 6;          // reel cell size
export const REEL_W = 5 * CW + 4 * GAP;
export const X0 = (W - REEL_W) / 2, Y0 = 132;     // top-left of the reel window
export const REEL_H = 3 * CH + 2 * GAP;

// UK design rules: fixed reel timings, minimum 2.5s spin, no slam stop / turbo / autoplay.
export const STOP_AT = [1300, 1600, 1900, 2200, 2500];
export const ANTICIPATION_MS = 1200;              // extra time on reels 4-5 when two alarms are showing
export const MIN_SPIN_MS = 2500;

// 10p steps up to £3.00, then 50p steps up to £5.00 (34 levels)
export const STAKES = [...Array.from({ length: 30 }, (_, i) => Math.round((i + 1) * 10) / 100), 3.5, 4, 4.5, 5];
export const START_BALANCE = 100;
export const START_STAKE_INDEX = 9;               // £1.00
export const REALITY_CHECK_MIN = 30;

// Demo-only free bonus trigger. Release builds: VITE_DEMO_BONUS=false (npm run build:release)
export const DEMO_BONUS = (import.meta.env?.VITE_DEMO_BONUS ?? 'true') !== 'false';

export const SYMBOLS = {
  FLOAT: { name: 'Float', tier: 'low' }, BOILIE: { name: 'Boilies', tier: 'low' },
  CORN: { name: 'Sweetcorn', tier: 'low' }, PELLET: { name: 'Pellets', tier: 'low' },
  FLASK: { name: 'Flask', tier: 'mid' }, CATAPULT: { name: 'Catapult', tier: 'mid' },
  NET: { name: 'Landing Net', tier: 'mid' }, BIVVY: { name: 'Bivvy', tier: 'mid' },
  ROACH: { name: 'Roach', tier: 'high' }, BREAM: { name: 'Bream', tier: 'high' },
  TENCH: { name: 'Tench', tier: 'high' }, MIRROR: { name: 'Mirror Carp', tier: 'high' },
  WILD: { name: 'Leather Carp (Wild)', tier: 'wild' }, ALARM: { name: 'Bite Alarm', tier: 'alarm' },
  CASH: { name: 'Specimen Fish', tier: 'cash' },
};

export const LINE_COLOURS = [0xf2c14e, 0x4dabf7, 0xff6b6b, 0x69db7c, 0xda77f2,
  0xffa94d, 0x3bc9db, 0xf783ac, 0xa9e34b, 0x9775fa];

// Big-win tiers by total win as a multiple of stake (only wins at or above stake are celebrated)
export const BIG_WINS = [
  { min: 200, title: 'MONSTER CATCH', ms: 6000 },
  { min: 50, title: 'HUGE CATCH', ms: 4500 },
  { min: 15, title: 'BIG CATCH', ms: 3000 },
];

export const FONT = "'Trebuchet MS', 'Cantarell', 'DejaVu Sans', sans-serif";
export const money = v => '£' + (Math.round(v * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sleep = ms => new Promise(r => setTimeout(r, ms));
