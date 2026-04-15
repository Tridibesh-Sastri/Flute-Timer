# Spectrogram Rendering

## Scope
- Additive to the existing spectrum and harmonic visual layers.
- Uses live FFT columns only and must not persist raw audio history.
- The spectrogram must remain bounded to a rolling time window of 5 to 10 seconds.

## Sub-Skill: Rolling Time Buffer

### 1. Purpose
Maintains the spectrogram as a bounded 2D time-frequency buffer where each column represents one live analyser frame.

### 2. APIs / Concepts Used
- `Float32Array` or equivalent column storage
- circular buffer indexing
- live FFT frame snapshot

### 3. Step-by-Step Implementation
1. Allocate a fixed number of spectrogram columns for the approved rolling window.
2. Set each column width to match the usable FFT bin count for the visual frequency band.
3. Write one new normalized column for every processed analyser frame.
4. Advance the write index on each frame.
5. Overwrite the oldest column in FIFO order when the buffer is full.
6. Clear the rolling buffer only when the Session ends.

### 4. Inputs / Outputs
- **Inputs**: current FFT magnitude frame and live session state.
- **Outputs**: one spectrogram column stored in the rolling time buffer.

### 5. Edge Cases
- Buffer not yet full: keep filling columns until capacity is reached.
- Buffer full: discard the oldest column and continue writing at the next index.

### 6. Constraints
- No unbounded history.
- No raw audio persistence.

---

## Sub-Skill: Frequency Axis Mapping

### 1. Purpose
Maps FFT bins onto the vertical frequency axis used by the spectrogram display.

### 2. APIs / Concepts Used
- analyser sample rate
- FFT size
- bin-to-frequency conversion

### 3. Step-by-Step Implementation
1. Convert each bin index into Hertz using `frequency = binIndex * sampleRate / fftSize`.
2. Clamp the drawable frequency range to approximately 0 Hz through 4000 Hz.
3. Discard or clip bins outside the visual band.
4. Preserve a stable axis scale for the full buffer lifetime.
5. Use the same mapping for every frame so identical frequencies stay aligned vertically.

### 4. Inputs / Outputs
- **Inputs**: FFT bin index, sample rate, FFT size.
- **Outputs**: vertical frequency position for each visible bin.

### 5. Edge Cases
- Sample rate change: rebuild the mapping using the new analyser values.
- Noisy low bins: keep them in the same axis scale even if they are visually dim.

### 6. Constraints
- The frequency axis must remain deterministic for the same analyser configuration.

---

## Sub-Skill: Canvas Column Drawing

### 1. Purpose
Draws the spectrogram as a scrolling or column-shift canvas layer using the rolling time buffer.

### 2. APIs / Concepts Used
- `CanvasRenderingContext2D`
- column shift or scrolling draw logic
- cached canvas dimensions

### 3. Step-by-Step Implementation
1. Reuse the same canvas and 2D context for every redraw.
2. Choose either a left-shift pixel strategy or a circular-buffer column strategy.
3. Draw the newest spectrogram column at the trailing edge of the buffer.
4. Move older columns leftward or remap them by circular index.
5. Keep the existing spectrum and harmonic overlays intact and visually separate.

### 4. Inputs / Outputs
- **Inputs**: one spectrogram column and the current canvas size.
- **Outputs**: a live scrolling spectrogram layer.

### 5. Edge Cases
- Canvas resize: recompute the drawable area but keep the live buffer state intact.
- Partially filled buffer: draw only the available columns.

### 6. Constraints
- Do not replace the spectrum or harmonic layer logic.
- Do not allocate a new canvas per frame.

---

## Sub-Skill: Amplitude Color Mapping

### 1. Purpose
Converts normalized FFT intensity into a stable heat-map color for the spectrogram.

### 2. APIs / Concepts Used
- normalized amplitude values
- color interpolation
- canvas fill styles

### 3. Step-by-Step Implementation
1. Normalize the FFT magnitude into a bounded display range.
2. Map low intensity to dark or transparent colors.
3. Map high intensity to brighter, warmer colors.
4. Apply the same color curve to every frame so equal values look identical.
5. Use the color mapping only for live rendering and not for storage.

### 4. Inputs / Outputs
- **Inputs**: normalized column intensity values.
- **Outputs**: color values for spectrogram drawing.

### 5. Edge Cases
- Zero-energy frame: render a dark column rather than skipping the time slice.
- Saturated bins: clamp color intensity so it remains visually stable.

### 6. Constraints
- No external color libraries.
- No per-bin object allocation during draw.