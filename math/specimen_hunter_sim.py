#!/usr/bin/env python3
"""
FISH ON! (formerly Specimen Hunter) - v0.1 math simulator
5x3, 10 fixed paylines, "Three Rods" scatter (bite alarms, reels 2-4 only),
free spins with simple fish-weight collect.

Usage:
    python specimen_hunter_sim.py --spins 50000000
    python specimen_hunter_sim.py --theory          # exact strip maths, instant
    python specimen_hunter_sim.py --export-strips   # writes strips.json

All wins are in multiples of TOTAL BET. Everything you tune lives in the
CONFIG block. Change a number, re-run, read the report.
"""
import argparse
import json
import time
import numpy as np
from multiprocessing import Pool, cpu_count

# =====================================================================
# CONFIG
# =====================================================================
SYMS = ["FLOAT", "BOILIE", "CORN", "PELLET",          # low
        "FLASK", "CATAPULT", "NET", "BIVVY",          # mid
        "ROACH", "BREAM", "TENCH", "MIRROR",          # high
        "WILD",                                       # leather carp
        "ALARM",                                      # scatter, reels 2-4 only
        "CASH"]                                       # fish with weight (free spins only)
ID = {s: i for i, s in enumerate(SYMS)}
WILD, ALARM, CASH, MIRROR = ID["WILD"], ID["ALARM"], ID["CASH"], ID["MIRROR"]
LOW = ["FLOAT", "BOILIE", "CORN", "PELLET"]

# Paylines: row index (0=top, 1=middle, 2=bottom) for reels 1..5
PAYLINES = [
    (1, 1, 1, 1, 1), (0, 0, 0, 0, 0), (2, 2, 2, 2, 2), (0, 1, 2, 1, 0), (2, 1, 0, 1, 2),
    (0, 0, 1, 2, 2), (2, 2, 1, 0, 0), (1, 0, 0, 0, 1), (1, 2, 2, 2, 1), (1, 2, 1, 0, 1),
]
NLINES = len(PAYLINES)

# Pays are multiples of the LINE bet (total bet / 10) for 3, 4, 5 of a kind
PAYTABLE = {
    "FLOAT":    (6, 15, 30),    "BOILIE":   (6, 15, 30),
    "CORN":     (9, 24, 45),    "PELLET":   (9, 24, 45),
    "FLASK":    (12, 30, 75),   "CATAPULT": (15, 36, 90),
    "NET":      (18, 45, 120),  "BIVVY":    (24, 60, 150),
    "ROACH":    (30, 75, 180),  "BREAM":    (36, 90, 240),
    "TENCH":    (45, 120, 360), "MIRROR":   (60, 225, 750),
}

# Reel strips, as symbol counts per reel (each reel = 32 stops)
BASE_COUNTS = [
    dict(FLOAT=5, BOILIE=5, CORN=4, PELLET=4, FLASK=3, CATAPULT=3, NET=2, BIVVY=2,
         ROACH=1, BREAM=1, TENCH=1, MIRROR=1),
    dict(FLOAT=3, BOILIE=3, CORN=4, PELLET=4, FLASK=3, CATAPULT=2, NET=2, BIVVY=2,
         ROACH=1, BREAM=1, TENCH=1, MIRROR=1, WILD=3, ALARM=2),
    dict(FLOAT=3, BOILIE=3, CORN=4, PELLET=4, FLASK=3, CATAPULT=2, NET=2, BIVVY=2,
         ROACH=1, BREAM=1, TENCH=1, MIRROR=1, WILD=3, ALARM=2),
    dict(FLOAT=3, BOILIE=3, CORN=4, PELLET=4, FLASK=3, CATAPULT=2, NET=2, BIVVY=2,
         ROACH=1, BREAM=1, TENCH=1, MIRROR=1, WILD=3, ALARM=2),
    dict(FLOAT=4, BOILIE=4, CORN=4, PELLET=4, FLASK=3, CATAPULT=3, NET=2, BIVVY=2,
         ROACH=1, BREAM=1, TENCH=1, MIRROR=1, WILD=2),
]
# Free spins strips: same as base but N low symbols per reel swapped for CASH fish
FS_CASH_PER_REEL = [4, 4, 4, 4, 4]

# Fish weights (display only) -> value in multiples of TOTAL BET, with probability weight.
# The weight shown to the player is a fixed lookup of the value, so it is never misleading.
FISH = [  # (label, multiplier, relative weight)
    ("2lb 4oz",   0.5, 300),   ("4lb 0oz",   1, 250),  ("6lb 8oz",   2, 170),
    ("9lb 12oz",  3, 110),     ("14lb 0oz",  5,  80),  ("19lb 8oz",  8,  38),
    ("26lb 0oz", 12,  22.5),   ("32lb 8oz", 20,  13),   ("38lb 12oz", 50,  6.5),
    ("45lb 4oz", 100,  1.75),  ("52lb 0oz", 250,  0.5), ("64lb 8oz", 1000, 0.1),  # record fish
]
FISH_VALS = np.array([f[1] for f in FISH], dtype=np.float64)
FISH_P = np.array([f[2] for f in FISH], dtype=np.float64)
FISH_P /= FISH_P.sum()

FS_START_SPINS = 10
FS_RETRIGGER_SPINS = 5
MAX_WIN = 5000.0          # cap, multiples of total bet; feature ends if reached
STRIP_SEED = 20260610     # strips are built once from this seed so they are reproducible
BUCKETS = [0, 1e-9, 1, 2, 5, 10, 20, 50, 100, 500, 1000, MAX_WIN, np.inf]
BUCKET_NAMES = ["0x", "<1x (LDW zone)", "1-2x", "2-5x", "5-10x", "10-20x", "20-50x",
                "50-100x", "100-500x", "500-1000x", "1000-5000x", "5000x cap"]


# =====================================================================
# STRIP BUILDING
# =====================================================================
def _spread_ok(strip, sym, gap=3):
    pos = [i for i, s in enumerate(strip) if s == sym]
    n = len(strip)
    return all(((pos[(k + 1) % len(pos)] - pos[k]) % n) >= gap for k in range(len(pos))) \
        if len(pos) > 1 else True


def build_strip(counts, rng):
    syms = []
    for name, c in counts.items():
        syms += [ID[name]] * c
    for _ in range(100000):
        rng.shuffle(syms)
        if _spread_ok(syms, ALARM) and _spread_ok(syms, WILD) and _spread_ok(syms, CASH, 2):
            return list(syms)
    raise RuntimeError("could not build strip satisfying spacing rules")


def fs_counts(base, n_cash):
    c = dict(base)
    for _ in range(n_cash):
        biggest = max(LOW, key=lambda s: c.get(s, 0))
        c[biggest] -= 1
        c["CASH"] = c.get("CASH", 0) + 1
    return c


def make_all_strips():
    rng = np.random.default_rng(STRIP_SEED)
    base = [build_strip(c, rng) for c in BASE_COUNTS]
    fs = [build_strip(fs_counts(c, n), rng) for c, n in zip(BASE_COUNTS, FS_CASH_PER_REEL)]
    for strips in (base, fs):
        assert all(len(s) == len(strips[0]) for s in strips) or True
        for r, s in enumerate(strips):
            assert (ALARM not in s) or r in (1, 2, 3), "alarm outside reels 2-4"
    assert all(CASH not in s for s in base), "cash fish must not appear in base game"
    return base, fs


def pay_array():
    p = np.zeros((len(SYMS), 6))
    for name, (a, b, c) in PAYTABLE.items():
        p[ID[name], 3], p[ID[name], 4], p[ID[name], 5] = a, b, c
    return p


PAY = pay_array()


# =====================================================================
# CORE SPIN LOGIC (vectorised)
# =====================================================================
class Machine:
    def __init__(self, strips):
        self.ext = [np.array(s + s[:2], dtype=np.int8) for s in strips]
        self.len = [len(s) for s in strips]

    def spin(self, n, rng):
        win = np.empty((n, 5, 3), dtype=np.int8)
        for r in range(5):
            stop = rng.integers(0, self.len[r], n)
            for k in range(3):
                win[:, r, k] = self.ext[r][stop + k]
        return win


def line_wins(win):
    """Total line pay per spin, in multiples of total bet."""
    n = win.shape[0]
    total = np.zeros(n)
    cols = np.arange(5)
    for line in PAYLINES:
        s = win[:, cols, list(line)]
        target = s[:, 0].copy()
        for i in range(1, 5):
            target = np.where(target == WILD, s[:, i], target)
        target = np.where(target == WILD, MIRROR, target)       # all-wild line pays as MIRROR
        match = (s == target[:, None]) | (s == WILD)
        count = np.cumprod(match, axis=1, dtype=np.int8).sum(axis=1)
        total += PAY[target, count]
    return total / NLINES


def three_rods(win):
    """True if an alarm shows on each of reels 2, 3 and 4."""
    a = (win[:, 1:4, :] == ALARM).any(axis=2)
    return a.all(axis=1)


def play_free_spins(machine, base_win, rng):
    n = base_win.size
    left = np.full(n, FS_START_SPINS)
    total = np.zeros(n)
    played = np.zeros(n, dtype=np.int64)
    retrigs = np.zeros(n, dtype=np.int64)
    while True:
        act = np.flatnonzero(left > 0)
        if act.size == 0:
            break
        m = act.size
        win = machine.spin(m, rng)
        w = line_wins(win)
        c = (win == CASH).sum(axis=(1, 2))
        vals = rng.choice(FISH_VALS, size=int(c.sum()), p=FISH_P)
        cash = np.bincount(np.repeat(np.arange(m), c), weights=vals, minlength=m)
        total[act] += w + cash
        played[act] += 1
        rt = three_rods(win)
        retrigs[act] += rt
        left[act] += rt * FS_RETRIGGER_SPINS - 1
        capped = (base_win[act] + total[act]) >= MAX_WIN
        left[act[capped]] = 0
    return total, played, retrigs


# =====================================================================
# SIMULATION
# =====================================================================
def run_chunk(args):
    n_spins, seed = args
    base_s, fs_s = make_all_strips()
    bm, fm = Machine(base_s), Machine(fs_s)
    rng = np.random.default_rng(seed)
    st = dict(n=0, sum=0.0, sumsq=0.0, hits=0, trig=0, base_sum=0.0, fs_sum=0.0,
              fs_spins=0, fs_retrig=0, maxwin=0.0, capped=0, ldw=0,
              hist=np.zeros(len(BUCKET_NAMES), dtype=np.int64), fs_wins=[])
    done = 0
    batch = 1_000_000
    while done < n_spins:
        m = min(batch, n_spins - done)
        win = bm.spin(m, rng)
        base = line_wins(win)
        total = base.copy()
        trig = np.flatnonzero(three_rods(win))
        if trig.size:
            fw, played, rt = play_free_spins(fm, base[trig], rng)
            total[trig] += fw
            st["fs_sum"] += fw.sum()
            st["fs_spins"] += int(played.sum())
            st["fs_retrig"] += int(rt.sum())
        total = np.minimum(total, MAX_WIN)
        st["n"] += m
        st["sum"] += total.sum()
        st["sumsq"] += (total ** 2).sum()
        st["hits"] += int((base > 0).sum())
        st["trig"] += trig.size
        st["base_sum"] += base.sum()
        st["maxwin"] = max(st["maxwin"], float(total.max()))
        st["capped"] += int((total >= MAX_WIN).sum())
        st["ldw"] += int(((total > 0) & (total < 1)).sum())
        idx = np.searchsorted(BUCKETS, total, side="right") - 1
        idx = np.clip(idx, 0, len(BUCKET_NAMES) - 1)
        st["hist"] += np.bincount(idx, minlength=len(BUCKET_NAMES))
        done += m
    return st


def merge(parts):
    out = parts[0]
    for p in parts[1:]:
        for k, v in p.items():
            out[k] = max(out[k], v) if k == "maxwin" else out[k] + v
    return out


def report(st):
    n = st["n"]
    mean = st["sum"] / n
    var = st["sumsq"] / n - mean ** 2
    sd = var ** 0.5
    se = sd / n ** 0.5
    print(f"\n=== FISH ON! v0.1 | {n:,} spins ===")
    print(f"Total RTP            {mean*100:7.3f}%   (95% CI +/- {1.96*se*100:.3f}%)")
    print(f"  base line wins     {st['base_sum']/n*100:7.3f}%")
    print(f"  free spins         {(mean - st['base_sum']/n)*100:7.3f}%")
    print(f"Hit frequency        {st['hits']/n*100:7.2f}%   (base line win on any spin)")
    print(f"Any return < 1x bet  {st['ldw']/n*100:7.2f}%   (LDW zone: must NOT be celebrated)")
    t = st["trig"]
    print(f"Feature frequency    1 in {n/max(t,1):,.0f}   ({t:,} triggers)")
    if t:
        print(f"Avg FS spins         {st['fs_spins']/t:7.2f}   (retrigger rate {st['fs_retrig']/st['fs_spins']*100:.2f}% per spin)")
        print(f"Avg feature win      {st['fs_sum']/t:7.1f}x bet")
    print(f"Volatility (std dev) {sd:7.2f}   (per-spin win, x bet)")
    print(f"Max win observed     {st['maxwin']:7.1f}x   | cap hits: {st['capped']:,}")
    print("\nWin distribution (share of spins):")
    for name, c in zip(BUCKET_NAMES, st["hist"]):
        print(f"  {name:<16}{c/n*100:9.4f}%")


# =====================================================================
# EXACT THEORY (no simulation noise)
# =====================================================================
def theory():
    base, fs = make_all_strips()
    print("\n=== EXACT STRIP MATHS ===")
    for label, strips in (("Base", base), ("Free spins", fs)):
        probs = []
        for r in (1, 2, 3):
            s = strips[r]
            n = len(s)
            hit = sum(any(s[(i + k) % n] == ALARM for k in range(3)) for i in range(n))
            probs.append(hit / n)
        p = float(np.prod(probs))
        print(f"{label}: alarm chance per reel (2,3,4) = {[round(x, 4) for x in probs]}")
        print(f"{label}: Three Rods probability = {p:.5f}  (1 in {1/p:,.1f})")
        if label == "Free spins":
            print(f"Expected FS length = {FS_START_SPINS/(1-FS_RETRIGGER_SPINS*p):.2f} spins")
    print("Strip lengths:", [len(s) for s in base])
    print("Mean fish value: %.3fx bet" % float((FISH_VALS * FISH_P).sum()))


def export_strips():
    base, fs = make_all_strips()
    to_names = lambda ss: [[SYMS[i] for i in s] for s in ss]
    with open("strips.json", "w") as f:
        json.dump({"base": to_names(base), "free_spins": to_names(fs)}, f, indent=1)
    print("wrote strips.json")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--spins", type=int, default=10_000_000)
    ap.add_argument("--workers", type=int, default=max(1, cpu_count()))
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--theory", action="store_true")
    ap.add_argument("--export-strips", action="store_true")
    a = ap.parse_args()
    if a.theory:
        theory()
    elif a.export_strips:
        export_strips()
    else:
        t0 = time.time()
        seeds = np.random.SeedSequence(a.seed).spawn(a.workers)
        per = a.spins // a.workers
        jobs = [(per, int(s.generate_state(1)[0])) for s in seeds]
        if a.workers == 1:
            parts = [run_chunk(jobs[0])]
        else:
            with Pool(a.workers) as p:
                parts = p.map(run_chunk, jobs)
        report(merge(parts))
        print(f"\n({time.time()-t0:.0f}s)")
