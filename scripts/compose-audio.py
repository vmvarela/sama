#!/usr/bin/env python3
"""Render SAMA's original handpan loop and short cues from CC0 source samples."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "handpan"
OUT = ROOT / "web" / "audio"
BEAT = 0.8
DURATION = 27.5

# Eight relaxed bars in D minor; all pitches exist in the FreePats Hang bank.
EVENTS = [
    (0, "D4"), (1, "A4"), (2, "D5"), (3, "A4"),
    (4, "F4"), (5, "A4"), (6, "C5"), (7, "A4"),
    (8, "G4"), (9, "D4"), (10, "A3"), (11, "D4"),
    (12, "D4"), (13, "F4"), (14, "A4"), (15, "D5"),
    (16, "A3"), (17, "D4"), (18, "F4"), (19, "A4"),
    (20, "G4"), (21, "A4"), (22, "C5"), (23, "A4"),
    (24, "F4"), (25, "A4"), (26, "D5"), (27, "C5"),
    (28, "D4"), (29.5, "A3"), (31, "D4"),
]


def render_track():
    notes = sorted({note for _, note in EVENTS})
    inputs = [SRC / f"{note}_01.flac" for note in notes]
    filters = []
    labels = []
    for i, (beat, note) in enumerate(EVENTS):
        delay = round(beat * BEAT * 1000)
        filters.append(
            f"[{notes.index(note)}:a]atrim=duration=2.7,"
            f"afade=t=out:st=2.35:d=0.35,volume=0.32,"
            f"adelay={delay}|{delay}[n{i}]"
        )
        labels.append(f"[n{i}]")
    filters.append(
        f"{''.join(labels)}amix=inputs={len(labels)}:duration=longest:normalize=0,"
        f"alimiter=limit=0.9,atrim=duration={DURATION},"
        f"afade=t=in:d=0.8,afade=t=out:st=25.5:d=2[out]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        *[arg for sample in inputs for arg in ("-i", str(sample))],
        "-filter_complex", ";".join(filters), "-map", "[out]",
        "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
        str(OUT / "handpan.mp3"),
    ], check=True)


def render_cue(source, target, end, fade_start, gain):
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(SRC / source),
        "-af", f"atrim=duration={end},afade=t=out:st={fade_start}:d={end-fade_start},volume={gain}",
        "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "44100",
        str(OUT / target),
    ], check=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    render_track()
    render_cue("tibetan-bowl-struck-2.ogg", "transition.mp3", 2.8, 1.8, 0.55)
    render_cue("gong-sweet.ogg", "gong.mp3", 6, 4, 0.6)
