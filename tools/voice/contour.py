"""Print the pitch contour summary of two-word takes: median pitch of word 1 vs word 2 and the end."""
import sys
import numpy as np
from scipy.io import wavfile


def f0_track(sig, sr):
    fr, hop, res = int(0.04 * sr), int(0.01 * sr), []
    thr = 0.1 * np.abs(sig).max()
    for i in range(0, len(sig) - fr, hop):
        f = sig[i:i + fr]
        if np.abs(f).max() < thr:
            continue
        f = f - f.mean()
        ac = np.correlate(f, f, 'full')[fr - 1:]
        lo, hi = int(sr / 400), int(sr / 70)
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.3 * ac[0]:
            res.append((i / sr, sr / lag))
    return res


for path in sys.argv[1:]:
    sr, x = wavfile.read(path)
    x = x.astype(float) / 32768
    win = int(0.02 * sr)
    e = np.convolve(x ** 2, np.ones(win) / win, 'same')
    idx = np.where(np.abs(x) > 0.02 * np.abs(x).max())[0]
    a, b = idx[0], idx[-1]
    lo, hi = a + int((b - a) * 0.25), a + int((b - a) * 0.75)
    split = (lo + int(np.argmin(e[lo:hi]))) / sr
    tr = f0_track(x, sr)
    w1 = [f for t, f in tr if t < split]
    w2 = [f for t, f in tr if t >= split]
    med = lambda v: np.median(v) if v else float('nan')
    end = np.mean([f for _, f in tr[-4:]]) if len(tr) >= 4 else float('nan')
    print(f'{path.split("/")[-1]}: fish ~{med(w1):.0f} Hz  on ~{med(w2):.0f} Hz  end ~{end:.0f} Hz  '
          f'(on/fish {med(w2) / med(w1):.2f})  {len(x) / sr:.2f}s')
