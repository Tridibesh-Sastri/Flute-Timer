# Temporal Smoothing

## 1. Input
- Recent stable MIDI values, mapped note labels, timestamps, and frame confidence scores.
- A short sliding window of consecutive live frames.

## 2. Output
- One smoothed pitch candidate for the current live note stream.
- A smoothed note label and confidence value for segmentation.

## 3. Step-by-Step Logic
1. Keep only the last 3 to 5 frames in the active smoothing window.
2. Remove frames that are clear outliers or that fall below the note-confidence threshold.
3. Compute a median or confidence-weighted average over the remaining values.
4. Prefer the most stable note bin over a single-frame spike.
5. Emit the smoothed value only when it remains stable across the window.
6. Reset the smoothing state when silence or a hard note boundary occurs.

## 4. Constraints
- Keep the smoothing window short enough to preserve playable latency.
- Do not smooth across a silence gap that should close the current note.
- Do not use long-term history or session-level statistics here.
- Smoothing must remain additive and must not alter the underlying FFT or HPS values.

## 5. Edge Cases
- Too few frames: return the current candidate with reduced confidence instead of inventing stability.
- Rapid note changes: allow the new note through once it dominates the window.
- Glissando or vibrato: allow motion, but do not oscillate between bins on every frame.
- Missing or dropped frames: keep the last stable value until the window can reform.