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

## Sub-Skill: HPS Fundamental Selection

### 1. Purpose
Derives the primary frequency candidate from the current FFT frame using Harmonic Product Spectrum, not the raw FFT peak.

### 2. APIs / Concepts Used
- spectral magnitude bins
- Harmonic Product Spectrum (HPS)
- reusable FFT and scratch buffers

### 3. Step-by-Step Implementation
1. Read the current reusable FFT magnitude buffer from the live analyser frame.
2. Preserve the raw FFT peak only as `debugFrequencyRaw` for visual comparison.
3. Pass the same spectrum into the HPS detector and treat the HPS result as the primary `frequencyHz` candidate.
4. Emit `debugFrequencyHPS` and `debugConfidence` alongside the primary frequency.
5. Forward the HPS-derived frequency to note mapping and note tracking.
6. If HPS is unavailable for the frame, keep the last valid primary frequency for the current session state and do not manufacture a new note label.

### 4. Inputs / Outputs
- **Inputs**: magnitude spectrum, sample rate, FFT size, and HPS output.
- **Outputs**: one primary `frequencyHz` candidate plus live-only debug values.

### 5. Edge Cases
- Equal raw FFT peak magnitudes: choose the lower-frequency bin first for `debugFrequencyRaw` only.
- Missing HPS result: do not promote raw FFT peak to the primary frequency.

### 6. Constraints
- The same frame sequence must produce the same primary HPS frequency output.
- Raw FFT peak remains auxiliary debug data only.

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
2. Reject any frame with no HPS-derived fundamental candidate.
3. Reject any HPS frequency outside the valid pitch range.
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
1. Measure the highest HPS magnitude inside the valid pitch band as `peakMagnitude`.
2. Measure the sum of all HPS magnitudes inside the valid pitch band as `totalMagnitude`.
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