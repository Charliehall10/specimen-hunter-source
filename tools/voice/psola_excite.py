"""Excited 'Fish! On!': reshape the pitch with TD-PSOLA, then add punch.

Usage: psola_excite.py in.wav out.wav LIFT ON_START ON_END
  LIFT      pitch multiplier for the whole line (e.g. 1.2 = +3 semitones)
  ON_START  extra multiplier at the start of "on"
  ON_END    extra multiplier at the end of "on" (bigger = stronger upward glide)
Duration and voice character (formants) are kept; only the pitch line changes.
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, medfilt

src, dst = sys.argv[1], sys.argv[2]
LIFT, ON_START, ON_END = (float(v) for v in sys.argv[3:6])
sr, x = wavfile.read(src)
x = x.astype(np.float64) / 32768.0

# trim
idx = np.where(np.abs(x) > 0.02 * np.abs(x).max())[0]
x = x[max(0, idx[0] - int(0.01 * sr)): idx[-1] + int(0.04 * sr)]
n = len(x)

# --- pitch track every 5 ms (autocorrelation), voiced/unvoiced
hop, fr = int(0.005 * sr), int(0.04 * sr)
times, f0s = [], []
thr = 0.06 * np.abs(x).max()
for i in range(0, n - fr, hop):
    f = x[i:i + fr]
    f0 = 0.0
    if np.abs(f).max() > thr:
        g = f - f.mean()
        ac = np.correlate(g, g, 'full')[fr - 1:]
        lo, hi = int(sr / 300), int(sr / 70)
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[0] > 0 and ac[lag] > 0.4 * ac[0]:
            f0 = sr / lag
    times.append(i + fr // 2); f0s.append(f0)
times, f0s = np.array(times), np.array(f0s)
f0s = medfilt(f0s, 5)
f0_at = lambda s: f0s[min(len(f0s) - 1, max(0, int((s - fr // 2) / hop)))]

# split between the words = quietest point in the middle half
win = int(0.02 * sr)
energy = np.convolve(x ** 2, np.ones(win) / win, 'same')
lo, hi = int(n * 0.25), int(n * 0.75)
split = lo + int(np.argmin(energy[lo:hi]))
on_end = n


def shift_at(s):
    if s < split:
        return LIFT
    u = min(1.0, (s - split) / max(1, on_end - split))
    return LIFT * (ON_START + (ON_END - ON_START) * u ** 0.9)


# --- analysis marks: pitch-synchronous in voiced parts (snapped to waveform peaks), 10 ms elsewhere
lp = sosfilt(butter(4, 900, 'lowpass', fs=sr, output='sos'), x)
marks, periods = [], []
s = 0
while s < n:
    f0 = f0_at(s)
    if f0 > 0:
        P = int(sr / f0)
        a, b = max(0, s - P // 3), min(n, s + P // 3)
        if b > a:
            s = a + int(np.argmax(lp[a:b]))
    else:
        P = int(0.01 * sr)
    marks.append(s); periods.append(P)
    s += max(P, 1)
marks, periods = np.array(marks), np.array(periods)

# --- synthesis: place grains at the new spacing (period / shift) in voiced parts
out = np.zeros(n + sr // 10)
norm = np.zeros_like(out)
t = float(marks[0])
while t < n:
    k = int(np.argmin(np.abs(marks - t)))
    a, P = marks[k], periods[k]
    voiced = f0_at(a) > 0
    lo_, hi_ = a - P, a + P
    if lo_ < 0 or hi_ > n:
        t += P
        continue
    w = np.hanning(2 * P)
    ti = int(round(t))
    if ti - P >= 0 and ti + P <= len(out):
        out[ti - P: ti + P] += x[lo_:hi_] * w
        norm[ti - P: ti + P] += w
    t += P / (shift_at(a) if voiced else 1.0)
norm[norm < 1e-3] = 1.0
y = (out / norm)[:n]

if len(sys.argv) > 6 and sys.argv[6] == 'dry':   # pitch-reshaped only, for measuring
    wavfile.write(dst, sr, (y / np.abs(y).max() * 0.89 * 32767).astype(np.int16)); sys.exit()

# --- punch: emphasis on "on", presence, double-track, drive
gain = np.ones(n)
ramp = int(0.03 * sr)
gain[split:] = 10 ** (3 / 20)
gain[max(0, split - ramp):split] = np.linspace(1, 10 ** (3 / 20), min(ramp, split))
y = y * gain
y = sosfilt(butter(2, 90, 'highpass', fs=sr, output='sos'), y)
y = y + 0.5 * sosfilt(butter(2, 1800, 'highpass', fs=sr, output='sos'), y)
d = int(0.014 * sr)
layer = np.zeros(n); layer[d:] = y[:-d]
y = y + 0.25 * layer
y = y / np.abs(y).max()
y = np.tanh(1.6 * y) / np.tanh(1.6)

# --- light slap echo + tail, fades, normalise to -1 dBFS
outp = np.zeros(n + int(0.4 * sr))
outp[:n] += y
d = int(0.11 * sr)
outp[d:d + n] += 0.1 * y
rng = np.random.default_rng(1)
ir = rng.standard_normal(int(0.3 * sr)) * np.exp(-np.linspace(0, 9, int(0.3 * sr)))
tail = np.convolve(y, ir)[:len(outp)] * 0.02
outp[:len(tail)] += tail
fi, fo = int(0.004 * sr), int(0.08 * sr)
outp[:fi] *= np.linspace(0, 1, fi)
outp = outp[:np.where(np.abs(outp) > 0.003)[0][-1] + 1]
outp[-fo:] *= np.linspace(1, 0, fo)
outp = outp / np.abs(outp).max() * 10 ** (-1 / 20)
wavfile.write(dst, sr, (outp * 32767).astype(np.int16))
