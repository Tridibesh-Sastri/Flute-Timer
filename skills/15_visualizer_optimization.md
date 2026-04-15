# Visualizer Optimization

## Scope
- Applies to the existing spectrum and harmonic renderer plus the new spectrogram, waveform, and HPS debug surfaces.
- Must keep rendering live-only and prevent memory growth.
- Must not alter pitch detection logic.

## Sub-Skill: Frame Throttling

### 1. Purpose
Limits visual rendering to a stable 30 to 60 FPS range while always keeping the latest analyser frame.

### 2. APIs / Concepts Used
- `requestAnimationFrame`
- pending frame state
- latest-frame coalescing

### 3. Step-by-Step Implementation
1. Keep exactly one pending render request at a time.
2. Coalesce multiple analyser updates into the most recent frame snapshot.
3. Drop intermediate visual frames when the renderer falls behind.
4. Target a 30 to 60 FPS draw cadence depending on device capacity.
5. Never let rendering block the audio loop.

### 4. Inputs / Outputs
- **Inputs**: latest live analyser frame and render budget.
- **Outputs**: one throttled visual update.

### 5. Edge Cases
- Bursty audio updates: render only the newest frame snapshot.
- Window hidden or inactive: skip unnecessary redraws when the host renderer supports it.

### 6. Constraints
- No frame queue growth.
- No background polling.

---

## Sub-Skill: Canvas Reuse

### 1. Purpose
Keeps the visualizer fast by reusing canvas elements, contexts, and derived draw state.

### 2. APIs / Concepts Used
- `CanvasRenderingContext2D`
- cached canvas dimensions
- reusable draw state

### 3. Step-by-Step Implementation
1. Create each canvas once and reuse it for the lifetime of the panel.
2. Cache the 2D context and avoid reacquiring it every frame.
3. Reuse gradients, line styles, and path helpers when possible.
4. Avoid repeated DOM queries during the draw loop.
5. Resize only when the host panel changes size.

### 4. Inputs / Outputs
- **Inputs**: current canvas dimensions and latest frame snapshot.
- **Outputs**: updated live drawing on the same canvas instance.

### 5. Edge Cases
- Canvas resize: recompute the drawing area but keep the live visual state intact.
- Multiple layers: keep separate draw paths for spectrum, spectrogram, waveform, and debug overlays.

### 6. Constraints
- No canvas recreation per frame.
- No context lookup inside tight loops when it can be cached.

---

## Sub-Skill: Memory Limits

### 1. Purpose
Prevents visual memory growth by bounding all live buffers and histories.

### 2. APIs / Concepts Used
- fixed-size typed arrays
- rolling buffers
- bounded live history

### 3. Step-by-Step Implementation
1. Bound the spectrogram to the approved 5 to 10 second rolling window.
2. Keep the waveform limited to the current frame only.
3. Reuse FFT scratch buffers and HPS working arrays.
4. Drop any transient frame copies after rendering completes.
5. Keep debug-only values live-only and short-lived.

### 4. Inputs / Outputs
- **Inputs**: live analyser data and current visual state.
- **Outputs**: bounded memory usage for visualization.

### 5. Edge Cases
- Long-running sessions: the buffer size must remain constant.
- Frequent redraws: memory usage must not climb as frame count increases.

### 6. Constraints
- No unbounded arrays or history stores.
- No raw audio persistence.

---

## Sub-Skill: Avoid Reallocation

### 1. Purpose
Ensures the visualizer reuses data structures instead of creating new ones every frame.

### 2. APIs / Concepts Used
- shared typed arrays
- reusable draw snapshots
- object reuse

### 3. Step-by-Step Implementation
1. Reuse per-frame scratch buffers for spectrogram, waveform, and HPS processing.
2. Avoid allocating new arrays inside the main draw loop.
3. Avoid creating new objects for repeated sample, bin, or column processing.
4. Copy data only when a renderer needs a transient snapshot for the current draw.
5. Keep the existing spectrum and harmonic rendering logic intact while layering the new visuals.

### 4. Inputs / Outputs
- **Inputs**: current frame and reusable draw state.
- **Outputs**: live visual rendering with minimal allocation.

### 5. Edge Cases
- New session start: reset reusable state without recreating the entire visualizer stack.
- Buffer expansion request: prefer pre-sizing to the approved rolling limits instead of growing dynamically.

### 6. Constraints
- No per-frame reallocation when a reusable buffer can be used.
- No external rendering libraries.