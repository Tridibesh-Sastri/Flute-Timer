# HPS Fundamental Detection

## Scope
- Uses the current FFT magnitude frame as input.
- Produces the primary fundamental frequency for the live visualizer and debug surface.
- The raw FFT peak remains auxiliary debug data only.

## Sub-Skill: HPS Fundamental Selection

### 1. Purpose
Derives the primary pitch candidate from the Harmonic Product Spectrum of the current FFT frame.

### 2. APIs / Concepts Used
- FFT magnitude array
- harmonic product spectrum math
- reusable downsample working buffers

### 3. Step-by-Step Implementation
1. Input the current FFT magnitude array.
2. Build downsampled spectra at factors 2, 3, and 4.
3. Multiply the aligned spectra together to produce the HPS curve.
4. Find the peak index in the HPS curve.
5. Convert the peak index to a frequency using the analyser sample rate and FFT size.
6. Return the HPS-derived frequency as the primary fundamental candidate.

### 4. Inputs / Outputs
- **Inputs**: one live FFT magnitude array.
- **Outputs**: one primary `frequencyHz` candidate from HPS.

### 5. Edge Cases
- Noisy or flat spectrum: return no new HPS fundamental.
- Very narrow peak: keep the exact peak bin unless a later refinement step is explicitly added by the host pipeline.

### 6. Constraints
- The HPS result must be deterministic for the same input frame sequence.
- HPS must use only the current frame.

---

## Sub-Skill: HPS Confidence and Debug Output

### 1. Purpose
Produces the confidence and debug values that accompany the HPS fundamental.

### 2. APIs / Concepts Used
- peak-to-total ratio
- raw FFT comparison values
- live-only debug fields

### 3. Step-by-Step Implementation
1. Measure the HPS peak magnitude.
2. Measure the total HPS energy within the valid pitch band.
3. Calculate confidence as `peakMagnitude / max(totalMagnitude, 1)`.
4. Emit the confidence as a live debug value.
5. Preserve the raw FFT peak as `debugFrequencyRaw` for comparison only.
6. Emit the HPS fundamental as `debugFrequencyHPS`.

### 4. Inputs / Outputs
- **Inputs**: HPS curve and current FFT comparison data.
- **Outputs**: `debugConfidence`, `debugFrequencyRaw`, and `debugFrequencyHPS`.

### 5. Edge Cases
- Zero-energy frame: confidence is `0`.
- Missing HPS peak: do not synthesize a frequency from the raw FFT peak.

### 6. Constraints
- Debug output must remain live-only.
- Debug fields must not be persisted.