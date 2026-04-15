# Waveform Rendering

## Scope
- Additive to the existing spectrum and harmonic visual layers.
- Uses the current time-domain analyser frame only.
- Must not persist waveform history.

## Sub-Skill: Time-Domain Buffer Usage

### 1. Purpose
Provides the live waveform renderer with the same current analyser frame used for RMS and pitch gating.

### 2. APIs / Concepts Used
- `AnalyserNode.getFloatTimeDomainData()`
- reusable float buffer
- session-active state

### 3. Step-by-Step Implementation
1. Allocate one fixed time-domain buffer when the Session becomes active.
2. Reuse that same buffer for every frame until the Session ends.
3. Read only the current analyser frame.
4. Do not retain earlier waveform samples after rendering.
5. Keep the waveform buffer separate from any FFT or spectrogram scratch data.

### 4. Inputs / Outputs
- **Inputs**: current analyser time-domain frame.
- **Outputs**: one live waveform frame ready for rendering.

### 5. Edge Cases
- Zero-energy frame: render a flat line at the center baseline.
- Missing analyser: skip waveform drawing for that frame.

### 6. Constraints
- No per-frame buffer allocation.
- No waveform history beyond the current frame.

---

## Sub-Skill: Amplitude Normalization

### 1. Purpose
Converts raw time-domain samples into stable canvas coordinates.

### 2. APIs / Concepts Used
- normalized sample values in the range `-1` to `1`
- canvas height mapping
- center baseline math

### 3. Step-by-Step Implementation
1. Read each sample from the live time-domain buffer.
2. Normalize the sample to a 0 to 1 display range.
3. Map the display range into canvas Y coordinates.
4. Keep the center amplitude at the vertical midpoint of the canvas.
5. Clamp out-of-range samples so clipping does not break the line.

### 4. Inputs / Outputs
- **Inputs**: raw waveform samples.
- **Outputs**: normalized Y coordinates for the waveform path.

### 5. Edge Cases
- Clipped samples: clamp them to the top or bottom of the canvas.
- Low-amplitude noise: keep the line stable rather than jittery.

### 6. Constraints
- The normalization must remain deterministic for identical input samples.

---

## Sub-Skill: Continuous Waveform Drawing

### 1. Purpose
Draws a smooth live waveform that updates with the current analyser frame only.

### 2. APIs / Concepts Used
- canvas path drawing
- polyline or stroke rendering
- requestAnimationFrame-based redraws

### 3. Step-by-Step Implementation
1. Reuse the same canvas and 2D context for every waveform redraw.
2. Clear the previous frame before drawing the current waveform.
3. Plot samples from left to right across the available canvas width.
4. Join the points with a smooth line or polyline stroke.
5. Redraw only the latest frame; do not accumulate previous waveforms.

### 4. Inputs / Outputs
- **Inputs**: normalized waveform coordinates.
- **Outputs**: one live waveform stroke.

### 5. Edge Cases
- Flat waveform: draw a straight baseline instead of a broken path.
- Very small buffers: preserve spacing so the waveform does not collapse visually.

### 6. Constraints
- No stored waveform timeline.
- No replacement of the existing spectrum or harmonic layers.