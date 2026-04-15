# Pitch Detection

## Sub-Skill: Input Buffer Handling

### 1. Purpose
Maintains the live analyser frame as a single reusable input source for pitch classification.

### 2. APIs / Concepts Used
- `AnalyserNode`
- reusable frame buffers
- session-active state

### 3. Step-by-Step Implementation
1. Allocate one fixed-size analyser buffer when the Session becomes active.
2. Reuse the same 2048-sample frame buffer for every frame until the Session ends.
3. Read only the current frame; do not retain historical raw audio frames.
4. If the analyser or buffer is unavailable, skip pitch classification for the frame.
5. If `AudioContext.sampleRate` is outside the allowed range, keep the session active but disable pitch classification for that frame.

### 4. Inputs / Outputs
- **Inputs**: analyser frame, sample rate, session-active state.
- **Outputs**: normalized frame data ready for frequency classification.

### 5. Edge Cases
- Zero-energy frame: return no pitch classification.
- Clipped or noisy frame: keep the raw frame ephemeral and continue to the next frame.

### 6. Constraints
- No per-frame buffer allocation.
- No persistence of raw audio data.

---

## Sub-Skill: Frequency Calculation Method

### 1. Purpose
Derives one deterministic frequency candidate from the strongest valid spectral peak.

### 2. APIs / Concepts Used
- spectral magnitude bins
- 80 Hz to 4000 Hz search band
- quadratic interpolation around a local peak

### 3. Step-by-Step Implementation
1. Convert the valid frequency band into low and high analyser bins.
2. Find the bin with the highest magnitude inside that band.
3. If both neighboring bins exist, refine the peak using quadratic interpolation around the local maximum.
4. Convert the refined bin to Hertz using the analyser sample rate and FFT size.
5. Reject any non-finite or unstable interpolation result.
6. Reject any frequency outside the valid pitch range.

### 4. Inputs / Outputs
- **Inputs**: magnitude spectrum, sample rate, FFT size.
- **Outputs**: one `frequencyHz` candidate or no result.

### 5. Edge Cases
- Equal peak magnitudes: choose the lower-frequency bin first.
- Band edge peak: skip interpolation and use the center bin frequency.

### 6. Constraints
- The same frame sequence must produce the same frequency output.

---

## Sub-Skill: Noise Filtering Rules

### 1. Purpose
Removes frames that should not contribute to pitch intelligence.

### 2. APIs / Concepts Used
- pitch confidence threshold
- valid pitch band
- breath-dominant classification

### 3. Step-by-Step Implementation
1. Reject any frame with `pitchConfidence < 0.35`.
2. Reject any frame with no dominant spectral peak.
3. Reject any frame outside the 80 Hz to 4000 Hz pitch band.
4. Reject any frame classified as breath-dominant.
5. Preserve the last valid pitch result when the current frame is rejected.

### 4. Inputs / Outputs
- **Inputs**: spectral peak, confidence value, breath classification.
- **Outputs**: valid pitch frame or filtered frame.

### 5. Edge Cases
- All frames in a note are filtered: the note remains valid but pitch metadata stays empty.

### 6. Constraints
- Filtering must not change Session timing.

---

## Sub-Skill: Confidence Estimation

### 1. Purpose
Produces a deterministic numeric confidence for each pitch frame.

### 2. APIs / Concepts Used
- peakMagnitude
- totalMagnitude
- ratio calculation

### 3. Step-by-Step Implementation
1. Measure the highest magnitude inside the valid pitch band as `peakMagnitude`.
2. Measure the sum of all magnitudes inside the valid pitch band as `totalMagnitude`.
3. Calculate `pitchConfidence = peakMagnitude / max(totalMagnitude, 1)`.
4. Treat the frame as valid only when `pitchConfidence >= 0.35`.
5. Clamp any non-finite result to 0.

### 4. Inputs / Outputs
- **Inputs**: valid-band magnitudes from the current frame.
- **Outputs**: one confidence value in the range 0 to 1.

### 5. Edge Cases
- Zero total magnitude: confidence is 0.
- Flat spectrum: confidence is 0.

### 6. Constraints
- Confidence must be reproducible from the same frame data.