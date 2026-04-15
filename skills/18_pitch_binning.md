# Pitch Binning

## 1. Input
- A stream of rounded MIDI values and mapped note candidates from recent frames.
- Per-frame confidence values and timestamps.

## 2. Output
- One stable MIDI bin value for the current note candidate.
- A stable note bucket that downstream smoothing can treat as the current pitch center.

## 3. Step-by-Step Logic
1. Collect the most recent short run of mapped MIDI values.
2. Snap each value to the nearest semitone bin.
3. Group nearby values that fall into the same semitone bucket.
4. Select the bin with the strongest cumulative support from the recent frames.
5. Keep the current bin unless a competing bin exceeds it by the configured confidence margin.
6. Emit the stable MIDI value and its matching note label.

## 4. Constraints
- Do not build long-range key or scale history here.
- Keep the binning window short and bounded.
- Do not split one musical note into multiple bins just because of small pitch jitter.
- Binning must remain frame-based and deterministic.

## 5. Edge Cases
- Boundary flutter between two semitones should stay in the dominant bin.
- Small octave jumps caused by noise should be rejected instead of being treated as a valid rebin.
- If a frame is missing, retain the current bin until a valid replacement appears.
- A deliberate glide between notes should be allowed to move bins once the new bin clearly dominates.