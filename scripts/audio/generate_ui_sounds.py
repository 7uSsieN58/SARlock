#!/usr/bin/env python3
"""Generate SARlock's UI sound effects as original synthesized clips.

Every clip is built from sine/triangle tones, short noise bursts and filters
in this script, so no third-party recordings are used and no attribution is
required. Output: web/assets/audio/<group>/<name>.mp3 (mono, 44.1 kHz, 96 kbps).

Run from the repository root:
    python3 scripts/audio/generate_ui_sounds.py

Requires numpy, scipy and an ffmpeg build with libmp3lame.
"""

import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT_DIR = os.path.join(ROOT, "web", "assets", "audio")


# ---------- building blocks ----------

def t_axis(duration):
    return np.arange(int(SR * duration)) / SR


def env(n, attack_s=0.004, tau_s=0.08):
    """Short linear fade-in (avoids clicks), then exponential decay."""
    t = np.arange(n) / SR
    a = np.clip(t / attack_s, 0, 1) if attack_s > 0 else np.ones(n)
    return a * np.exp(-t / tau_s)


def sweep(f0, f1, duration, wave="sine"):
    t = t_axis(duration)
    freq = np.linspace(f0, f1, len(t))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    if wave == "tri":
        return (2 / np.pi) * np.arcsin(np.sin(phase))
    return np.sin(phase)


def tone(freq, duration, wave="sine"):
    t = t_axis(duration)
    phase = 2 * np.pi * freq * t
    if wave == "tri":
        return (2 / np.pi) * np.arcsin(np.sin(phase))
    return np.sin(phase)


def bell(freq, duration, tau_s, attack_s=0.003, partial=0.25):
    """A sine with a soft second partial, shaped like a glass tone."""
    base = tone(freq, duration) + partial * tone(freq * 2.0, duration)
    base = base / (1 + partial)
    return base * env(len(base), attack_s, tau_s)


def noise(duration, seed):
    rng = np.random.default_rng(seed)
    return rng.standard_normal(int(SR * duration))


def bandpass(x, lo, hi):
    sos = butter(2, [lo, hi], btype="bandpass", fs=SR, output="sos")
    return sosfilt(sos, x)


def lowpass(x, cutoff):
    sos = butter(2, cutoff, btype="lowpass", fs=SR, output="sos")
    return sosfilt(sos, x)


def highpass(x, cutoff):
    sos = butter(2, cutoff, btype="highpass", fs=SR, output="sos")
    return sosfilt(sos, x)


def place(buf, clip, at_s):
    """Add clip into buf starting at time at_s (seconds)."""
    start = int(SR * at_s)
    end = min(len(buf), start + len(clip))
    buf[start:end] += clip[: end - start]
    return buf


def total(duration):
    return np.zeros(int(SR * duration))


def normalize(x, peak):
    m = np.max(np.abs(x))
    return x if m == 0 else x * (peak / m)


# ---------- the sounds ----------
# Each returns (samples, peak). Peaks set relative loudness between sounds.

def click():
    body = sweep(1700, 1300, 0.05) * env(int(SR * 0.05), 0.001, 0.012)
    snap = highpass(noise(0.01, 1), 3000) * env(int(SR * 0.01), 0.0005, 0.003) * 0.25
    x = total(0.06)
    place(x, body, 0)
    place(x, snap, 0)
    return x, 0.45


def hover():
    x = bell(2600, 0.09, tau_s=0.025, attack_s=0.004, partial=0.15)
    return x, 0.10


def enter():
    body = sweep(500, 1500, 0.26, wave="tri") * env(int(SR * 0.26), 0.01, 0.12)
    shimmer = tone(3000, 0.26) * env(int(SR * 0.26), 0.03, 0.09) * 0.18
    x = total(0.28)
    place(x, body + shimmer, 0)
    return x, 0.40


def leave():
    body = sweep(1400, 600, 0.22, wave="tri") * env(int(SR * 0.22), 0.008, 0.08)
    return body, 0.34


def toggle():
    x = total(0.10)
    place(x, tone(1500, 0.035) * env(int(SR * 0.035), 0.001, 0.010), 0.0)
    place(x, tone(2100, 0.045) * env(int(SR * 0.045), 0.001, 0.012), 0.04)
    return x, 0.38


def slider():
    tick = tone(1100, 0.03) * env(int(SR * 0.03), 0.001, 0.008)
    grain = bandpass(noise(0.012, 7), 2000, 6000) * env(int(SR * 0.012), 0.0005, 0.004) * 0.6
    x = total(0.04)
    place(x, tick, 0)
    place(x, grain, 0)
    return x, 0.18


def success():
    # C6, E6, G6: a bright major arpeggio that stays soft.
    x = total(0.42)
    for i, f in enumerate([1046.5, 1318.5, 1568.0]):
        place(x, bell(f, 0.20, tau_s=0.06, attack_s=0.003, partial=0.2), i * 0.06)
    return x, 0.42


def error():
    # Two soft, low notes falling a fourth. Neutral, not harsh.
    x = total(0.34)
    for i, f in enumerate([392.0, 329.6]):
        note = lowpass(tone(f, 0.16, wave="tri"), 1200) * env(int(SR * 0.16), 0.005, 0.07)
        place(x, note, i * 0.11)
    return x, 0.34


def achievement():
    # C5, E5, G5, C6 with a slow bloom: more meaningful than a success tone.
    x = total(1.05)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        note = bell(f, 0.55, tau_s=0.16, attack_s=0.01, partial=0.2)
        shimmer = tone(f * 1.003, 0.55) * env(int(SR * 0.55), 0.01, 0.16) * 0.12
        place(x, note + shimmer, i * 0.09)
    x = lowpass(x, 6000)
    return x, 0.46


def transition():
    # A band-passed noise sweep with a soft pitch glide underneath.
    dur = 0.42
    n = int(SR * dur)
    t = np.arange(n) / SR
    env_shape = np.sin(np.pi * t / dur) ** 2
    centers = np.geomspace(400, 3000, n)
    rng = np.random.default_rng(3)
    raw = rng.standard_normal(n)
    # Shift the band in short blocks to approximate a moving filter cheaply.
    block = 512
    out = np.zeros(n)
    for start in range(0, n, block):
        end = min(n, start + block)
        mid = centers[(start + end) // 2]
        lo = max(80.0, mid * 0.6)
        hi = min(SR / 2 - 200, mid * 1.4)
        out[start:end] = bandpass(raw, lo, hi)[start:end]
    glide = sweep(300, 900, dur) * 0.12
    x = (out * 0.5 + glide) * env_shape
    return x, 0.28


def case_select():
    # A radar-like ping with a short, quieter echo.
    x = total(0.46)
    ping = tone(980, 0.18) * env(int(SR * 0.18), 0.002, 0.05)
    echo = sweep(980, 990, 0.18) * env(int(SR * 0.18), 0.002, 0.06) * 0.38
    place(x, ping, 0)
    place(x, echo, 0.19)
    return x, 0.40


def sar_appear():
    # A soft chime with a rising band-passed swell.
    x = total(0.56)
    for i, f in enumerate([880.0, 1174.7, 1396.9]):
        place(x, bell(f, 0.30, tau_s=0.10, attack_s=0.01, partial=0.2), i * 0.07)
    dur = 0.45
    n = int(SR * dur)
    swell = bandpass(noise(dur, 11), 1000, 4000)[:n] * np.sin(np.pi * np.arange(n) / n) * 0.2
    place(x, swell, 0.02)
    return x, 0.36


SOUNDS = {
    "ui/click": click,
    "ui/hover": hover,
    "ui/enter": enter,
    "ui/leave": leave,
    "ui/toggle": toggle,
    "ui/slider": slider,
    "feedback/success": success,
    "feedback/error": error,
    "feedback/achievement": achievement,
    "navigation/transition": transition,
    "navigation/case-select": case_select,
    "character/sar-appear": sar_appear,
}


def write_mp3(samples, peak, out_path, tmp_dir):
    samples = normalize(samples, peak)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    wav_path = os.path.join(tmp_dir, os.path.basename(out_path) + ".wav")
    wavfile.write(wav_path, SR, pcm)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav_path,
         "-ac", "1", "-ar", str(SR), "-codec:a", "libmp3lame", "-b:a", "96k", out_path],
        check=True,
    )


def main():
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SOUNDS.items():
            samples, peak = fn()
            out = os.path.join(OUT_DIR, name + ".mp3")
            write_mp3(samples, peak, out, tmp)
            print(f"wrote {os.path.relpath(out, ROOT)}  ({len(samples) / SR * 1000:.0f} ms)")


if __name__ == "__main__":
    main()
