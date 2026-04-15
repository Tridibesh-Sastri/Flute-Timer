# Noise Rejection

## 1. Input
- Raw frame amplitude, spectral energy, HPS confidence, MFCC consistency, and candidate note stability.
- A live note-analysis frame that may or may not be ready for segmentation.

## 2. Output
- An accept or reject decision for the current frame.
- A filtered note candidate that downstream smoothing and segmentation can safely use.

## 3. Step-by-Step Logic
1. Reject frames that fall below the RMS or silence threshold.
2. Reject frames whose spectral energy remains too close to the noise floor.
3. Reject candidates whose HPS and MFCC cues disagree beyond the allowed tolerance.
4. Reject candidates that do not survive the smoothing window.
5. Pass only frames that look like stable musical note content rather than transient air or room noise.

## 4. Constraints
- Keep the rejection rules frame-based and deterministic.
- Prefer false negatives over unstable false positives.
- Do not permanently suppress the next valid note after one rejected frame.
- Keep the rejection layer additive; it must not change the FFT, HPS, or visualizer behavior.

## 5. Edge Cases
- Breath-only frames should fail the note gate unless a stable note is already active.
- Very soft notes should be allowed through once they stabilize, even if the onset is weak.
- Staccato attacks must not be over-rejected if they still meet the stability window.
- Clipped or noisy input should fall back to rejection rather than producing a spurious note.