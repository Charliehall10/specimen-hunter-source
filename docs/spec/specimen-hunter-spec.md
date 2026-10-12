# Specimen Hunter: game spec and symbol sheet (v1.2 demo)

UK carp-fishing video slot. 5 reels × 3 rows, 10 fixed paylines, "Three Rods" free spins with weighed cash fish and three baited swims that multiply every fish caught in them (×2, doubling with each catch, up to ×32).
Name "Specimen Hunter" (briefly renamed "Fish On!", reverted because "FISH ON!" is a registered US slot trademark of King Show Games; see docs/legal). UK/EU trade mark check still to do. All figures are design figures from the in-house simulator, **not certified**.

## At a glance

| Item | Value |
|---|---|
| Grid / lines | 5×3, 10 fixed lines, left to right |
| Stakes | £0.10 to £5.00 (10p steps to £3.00, then 50p steps; 34 levels) |
| RTP (design) | 96.16% with the 5,000× cap: exact 96.24% uncapped (base game incl. kingfisher 54.37%, free spins 41.87%) less 0.085% ± 0.010 lost to the cap |
| Hit frequency | 25.5% |
| Feature frequency | 1 in 152 spins |
| Kingfisher | 1 in 300 base spins, average line win 8.9× stake |
| Average feature win | 63.5× stake (10.3 spins on average), of which 26.1× from fish caught in swims |
| Volatility (SD) | 9.0 (50M rounds, JS engine) to 9.15 (500M rounds, Python); was 7.2 before the swims |
| Max win | 5,000× per round (cap). Reached about 1 in 6 million rounds (1 in 40,000 features); uncapped, a feature reached 32,515× in 20M simulated features |
| Spin time | Minimum 2.5 s, fixed reel stops; no autoplay, turbo or quick stop |

## Symbols and paytable (multiples of total stake)

| Symbol | Tier | 3 | 4 | 5 |
|---|---|---|---|---|
| Mirror Carp | High | 6 | 22.5 | 75 |
| Tench | High | 4.5 | 12 | 36 |
| Bream | High | 3.6 | 9 | 24 |
| Roach | High | 3 | 7.5 | 18 |
| Bivvy | Mid | 2.4 | 6 | 15 |
| Landing Net | Mid | 1.8 | 4.5 | 12 |
| Catapult | Mid | 1.5 | 3.6 | 9 |
| Flask | Mid | 1.2 | 3 | 7.5 |
| Sweetcorn | Low | 0.9 | 2.4 | 4.5 |
| Luncheon Meat | Low | 0.9 | 2.4 | 4.5 |
| Boilies | Low | 0.6 | 1.5 | 3 |
| Float | Low | 0.6 | 1.5 | 3 |

- **Leather Carp (Wild)**: reels 2 to 5. Substitutes for all line symbols except Bite Alarm and Specimen Fish. No pay of its own.
- **Bite Alarm (Scatter)**: reels 2, 3 and 4 only.
- **Specimen Fish (Cash)**: free spins only. Carries a weight that maps to a fixed prize, multiplied if it lands in a baited swim.
- Luncheon Meat replaced Pellets in v1.2 (same pays and positions; only the name and art changed).

## Kingfisher (base game random event)

- On any base-game spin there is a **1 in 300** chance the kingfisher visits. It flies in while the reels spin, then dives into 3, 4 or 5 spots (chance 60%, 30%, 10%) and turns them into **Leather Carp wilds**.
- It always takes **reels 2, 3 and 4 on one random row**, so the paylines along that row get at least four of a kind (a guaranteed win unless a Bite Alarm sits in one of those spots). Extra spots are random elsewhere on reels 2 to 5.
- A spot holding a Bite Alarm keeps the alarm, so the free-spins trigger rate is unchanged.
- Average line win on a kingfisher spin: about 8.9× stake. Not available in free spins.

## Three Rods free spins

- One Bite Alarm on each of reels 2, 3 and 4 in the same spin awards **10 free spins** at the triggering stake.
- During free spins the reels use the free-spins strips. Every Specimen Fish that lands is weighed and its prize is paid at once (all fish on screen, every spin).
- **Baited swims.** Before the first free spin a catapult fires a pouch of boilies into each of three swims: 3 swims on 3 different reels, a random row on each (all placements equally likely). The swims stay in place for the whole feature, including retriggered spins.
- A fish that lands in a swim pays its prize × the swim's multiplier, then the multiplier doubles. Every swim starts at ×2: 1st catch ×2, 2nd ×4, 3rd ×8, 4th ×16, 5th and later ×32. Fish outside the swims pay ×1.
- Each swim shows a marker float and its next multiplier on the reels; the side panel lists every swim's multiplier and what it has paid.
- Three Bite Alarms during free spins add **5 spins** (no limit other than the win cap).
- Line wins pay as normal during free spins.

### Fish weights and prizes

| Weight | Prize (× stake) | Weight share |
|---|---|---|
| 2lb 4oz | 0.5 | 396 |
| 4lb 0oz | 1 | 250 |
| 6lb 8oz | 2 | 170 |
| 9lb 12oz | 3 | 110 |
| 14lb 0oz | 5 | 80 |
| 19lb 8oz | 8 | 38 |
| 26lb 0oz | 12 | 22.5 |
| 32lb 8oz | 20 | 13 |
| 38lb 12oz | 50 | 6.5 |
| 45lb 4oz | 100 | 1.75 |
| **52lb 0oz (record)** | **250** | 0.5 |
| **64lb 8oz (record)** | **1,000** | 0.1 |

Mean fish value: 2.827× stake (before swim multipliers). The 2lb 4oz share was raised from 300 to 396 as the swims and the kingfisher were added, to keep the RTP at 96.1%.

## Reel strips (symbol counts per 32-stop reel)

| Symbol | Base R1 | R2 | R3 | R4 | R5 | Free spins R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|---|---|---|
| Float | 6 | 3 | 3 | 3 | 4 | 4 | 2 | 2 | 2 | 3 |
| Boilies | 6 | 3 | 3 | 3 | 4 | 5 | 3 | 3 | 3 | 3 |
| Sweetcorn | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 3 |
| Luncheon Meat | 3 | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 4 |
| Flask | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Catapult | 3 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 3 |
| Landing Net | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Bivvy | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 |
| Roach | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Bream | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Tench | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Mirror Carp | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Leather Carp (Wild) | 0 | 3 | 3 | 3 | 2 | 0 | 3 | 3 | 3 | 2 |
| Bite Alarm | 0 | 2 | 2 | 2 | 0 | 0 | 2 | 2 | 2 | 0 |
| Specimen Fish | – | – | – | – | – | 3 | 3 | 3 | 3 | 3 |

Reel 1 lost one Luncheon Meat and one Bivvy (now a Float and Boilies) in v1.2 to pay for the kingfisher.

Full strips: `client/strips.json` (exported by `math/specimen_hunter_sim.py --export-strips`).

## Paylines (row per reel, 0 = top)

| Line | Rows | Line | Rows |
|---|---|---|---|
| 1 | 1-1-1-1-1 | 6 | 0-0-1-2-2 |
| 2 | 0-0-0-0-0 | 7 | 2-2-1-0-0 |
| 3 | 2-2-2-2-2 | 8 | 1-0-0-0-1 |
| 4 | 0-1-2-1-0 | 9 | 1-2-2-2-1 |
| 5 | 2-1-0-1-2 | 10 | 1-2-1-0-1 |

## Player protection built into the client

- Minimum 2.5 s per spin with fixed reel-stop times. No slam stop, turbo or autoplay. Free spins play automatically at the same pace.
- Returns below stake are labelled "Returned £x" in grey, with faded lines and no sound or animation. Only wins at or above stake are celebrated.
- Session timer, clock and session net position always on screen. Reality check every 30 minutes (keep playing / take a break).
- Game history of the session's rounds. Paytable values always shown in £ at the current stake.
- The demo-only "Demo Bonus" trigger is compiled out of release builds (`npm run build:release`).

## Not yet done (needed before any real-money use)

- Certified RNG and server-side outcome generation (the demo uses `Math.random` in the browser).
- Independent test-house certification of the maths and game.
- Check current UKGC Remote Gambling and Software Technical Standards, stake limits and feature-buy rules. Do not rely on this document for them.
- Trademark check on the name; patent check on the cash-fish and swim-multiplier mechanics (see docs/legal); decide the advertised max win.
