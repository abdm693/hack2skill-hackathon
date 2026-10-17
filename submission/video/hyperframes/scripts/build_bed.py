"""Assemble the music bed from Lyria 2 clips (Vertex, lyria-002): bar-aligned loops + equal-power crossfades."""
import numpy as np, soundfile as sf, json, sys
from pathlib import Path
SRC = Path(__file__).resolve().parent.parent / "assets/music/src"
OUT = Path(__file__).resolve().parent.parent / "assets/music/bed.wav"
SR = 48000
BPM = 110.3; BEAT = 60 / BPM; BAR = 4 * BEAT
def load(n):
    y, sr = sf.read(SRC / f"{n}_0.wav"); assert sr == SR; return y
def downbeat_offset(y):
    m = y.mean(axis=1); hop = 480; n = 2048
    fr = np.lib.stride_tricks.sliding_window_view(m, n)[::hop] * np.hanning(n)
    S = np.log1p(np.abs(np.fft.rfft(fr, axis=1))[:, :200])
    flux = np.maximum(0, np.diff(S, axis=0)).sum(axis=1)
    fps = SR / hop; best = (0, 0)
    for o in np.arange(0, BAR, 0.01):
        idx = ((o + np.arange(0, 12) * BAR) * fps).astype(int); idx = idx[idx < len(flux)]
        sc = flux[idx].sum()
        if sc > best[0]: best = (sc, o)
    return best[1]
def loop(y, o, length, bars=13, xf=0.1):
    """Repeat the bar-aligned span y[o : o+bars*BAR] to `length` s; each seam crossfades the clip's own continuation
    (tail) into the restart (head), equal power, so the loop point keeps the groove."""
    L = int(bars * BAR * SR); X = int(xf * SR); a = int(o * SR)
    seg = y[a:a + L]; tail = y[a + L:a + L + X]
    X = min(X, len(tail))
    fi = np.sqrt(np.linspace(0, 1, X))[:, None]; fo = np.sqrt(np.linspace(1, 0, X))[:, None]
    out = np.zeros((int(length * SR) + L, 2)); pos = 0; k = 0
    while pos < int(length * SR):
        piece = seg.copy()
        if k > 0 and X > 0:
            piece[:X] = seg[:X] * fi + tail[:X] * fo
        out[pos:pos + L] = piece; pos += L; k += 1
    return out[: int(length * SR)]

def place(bed, clip, start, fin=0.8, fout=0.8):
    a = int(start * SR); n = min(len(clip), len(bed) - a)
    c = clip[:n].copy(); t = np.arange(n) / SR
    if fin > 0: c *= np.sqrt(np.clip(t / fin, 0, 1))[:, None]
    if fout > 0: c *= np.sqrt(np.clip((n / SR - t) / fout, 0, 1))[:, None]
    bed[a:a + n] += c
plan = json.loads(sys.argv[1]) if len(sys.argv) > 1 else None
TOTAL = plan["total"]
bed = np.zeros((int(TOTAL * SR), 2))
for sec in plan["sections"]:
    y = load(sec["clip"]); o = downbeat_offset(y)
    length = sec["end"] - sec["start"] + sec.get("fout", 0.8)
    clip = loop(y, o, length) if sec.get("loop", True) else y[int(o * SR):]
    place(bed, clip, sec["start"], sec.get("fin", 0.8), sec.get("fout", 0.8))
    print(sec["clip"], "downbeat offset", round(o, 3))
peak = np.abs(bed).max(); bed *= 0.89 / peak
sf.write(OUT, bed, SR, subtype="PCM_16"); print(OUT, round(len(bed) / SR, 2), "s")
