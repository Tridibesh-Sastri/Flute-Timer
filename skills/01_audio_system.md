# Audio System

## Sub-Skill: Microphone Permission Handling

### 1. Purpose
Requests and maps local microphone hardware access to valid audio stream context within the Web Audio API.

### 2. APIs / Concepts Used
- `navigator.mediaDevices.getUserMedia`
- `Promise` chaining/async-await

### 3. Step-by-Step Implementation
1. Call `navigator.mediaDevices.getUserMedia({ audio: true, video: false })`.
2. Await hardware prompt resolution securely.
3. Define the output variable matching the resulting `MediaStream` object.
4. Pass the validated stream downward to the Audio API instantiation loop.

### 4. Inputs / Outputs
- **Inputs**: Hardware API mapping string `{ audio: true }`.
- **Outputs**: Active `MediaStream` containing raw channel block data.

### 5. Edge Cases
- **Permission Denied**: Catch `.catch(error)` and update DOM status to "Missing Access". Do not execute downstream variables.
- **No hardware available**: Throw specific logical checks wrapping null outputs.
- **Session Rule**: Ensure it strictly checks if the overarching manual `Session` is currently active. If inactive, silently abort stream request loop entirely.

### 6. Constraints
- Executed exclusively from the isolated Renderer layer.
- Must not install generic external recording components natively.

---

## Sub-Skill: Web Audio API Setup

### 1. Purpose
Parses the active MediaStream object into mathematical arrays mapping to the detection logic context natively.

### 2. APIs / Concepts Used
- `window.AudioContext` or `window.webkitAudioContext`
- `context.createMediaStreamSource()`
- `context.createAnalyser()`

### 3. Step-by-Step Implementation
1. Instantiate `new AudioContext()`.
2. Call `createMediaStreamSource(stream)` passing the mic stream securely.
3. Call `createAnalyser()` on the context.
4. Set `.fftSize` to exactly `2048`.
5. Call `source.connect(analyser)`.
6. Instantiate global buffer: `new Float32Array(analyser.frequencyBinCount)`.

### 4. Inputs / Outputs
- **Inputs**: Verified raw `MediaStream`.
- **Outputs**: Active `AnalyserNode` connected mathematically mapping time domains, and predefined float buffer.

### 5. Edge Cases
- **Suspended Context**: Chrome strictly blocks auto-play. Check `if (context.state === 'suspended')` and call `context.resume()` strictly bound locally to the user's explicit manual "Session Start" UI toggle click.

### 6. Constraints
- Strict vanilla JS audio standards required only.
- Audio context loop bounds firmly defined mathematically ignoring abstract generic classes.

---

## Sub-Skill: RMS Calculation

### 1. Purpose
Derives the exact real-time mathematical volume tracking from the continuous frequency chunk buffers mapping audio intensities.

### 2. APIs / Concepts Used
- `AnalyserNode.getFloatTimeDomainData()`
- Core `Math.sqrt()` and array accumulations

### 3. Step-by-Step Implementation
1. Enqueue looping window natively wrapping `requestAnimationFrame()`.
2. Inside loop: Validate `Session Active` boolean. If inactive, immediately `return;`.
3. Read raw chunks mapping: `analyser.getFloatTimeDomainData(buffer)`.
4. Initialize `sum = 0`.
5. Loop exactly over buffer's length: add sequentially `Math.pow(buffer[i], 2)` into `sum`.
6. Calculate RMS mapping natively explicitly as: `Math.sqrt(sum / buffer.length)`.
7. Pass generic mathematical output to threshold triggers securely.

### 4. Inputs / Outputs
- **Inputs**: Sourced float buffer chunk tied to Web API native states.
- **Outputs**: Mathematical float digit tracking raw volume.

### 5. Edge Cases
- **Out of bounds index loops**: Handled implicitly mathematically traversing `buffer.length`.
- **Inactive session bypass**: Must forcibly `return` to entirely halt calculation block saving CPU if session falls logically inactive.

### 6. Constraints
- Processing inside animation frame must stay lightweight.
- Math operations isolated avoiding any DOM overhead bindings securely.

---

## Sub-Skill: Silence Hysteresis Detection

### 1. Purpose
Determines the strict boundaries mapping unbroken audio strings into NoteEvents filtering brief flickering anomalies cleanly.

### 2. APIs / Concepts Used
- Conditional boolean tracking (`isListening`, `isRecording`) 
- `setTimeout` / `clearTimeout`

### 3. Step-by-Step Implementation
1. Read live RMS value from output block.
2. If RMS > explicit defined START threshold AND `isRecording === false`:
   - Set `isRecording = true`.
   - Call NoteEvent explicit creation.
   - Clear any active timeout limits securely.
3. If RMS < explicit defined STOP threshold AND `isRecording === true`:
   - Initialize fixed delay tracking: `setTimeout()` logic wrapping 300ms mathematically.
   - Explicitly inside timeout conclusion: Call NoteEvent termination loop, set `isRecording = false`. 
4. If RMS > explicit START threshold while the stop timeline timeout lives:
   - Call `clearTimeout(timeoutId)` instantly killing the delay loop, effectively protecting the note event visually and data-wise natively extending tracking.

### 4. Inputs / Outputs
- **Inputs**: Calculated mathematical RMS integer boundaries.
- **Outputs**: Logical explicitly executed DOM-agnostic triggers via generic callbacks like `window.onNoteComplete()`.

### 4b. No DOM Interaction Rule
Audio module logic MUST NOT select, inject, or mutate DOM components (e.g., bypassing `document.getElementById`). Instead, update global state flags natively and invoke explicitly defined `window.*` boundary hooks managed strictly by the generic app layer.

### 5. Edge Cases
- **Rapid flickering spikes**: Mitigated naturally since hysteresis timers are securely restarted by spikes triggering `clearTimeout()`.
- **Systematic window suspension**: If application suspends mathematically breaking setTimeout mapping.

### 6. Constraints
- Execution completely locked natively verifying internal bounds.
- Tied specifically only into the internal system detection limits avoiding DOM manipulations entirely. Audio states update via defined system callbacks strictly separated from structural layers.

---

## Sub-Skill: Pitch Detection Pipeline

### 1. Purpose
Transforms each active audio frame into a deterministic pitch candidate for note intelligence.

### 2. APIs / Concepts Used
- `AnalyserNode`
- `requestAnimationFrame`
- time-domain and frequency-domain buffer reads

### 3. Step-by-Step Implementation
1. Execute only while the Session is active.
2. Verify `AudioContext.sampleRate` is within 44100 Hz to 48000 Hz inclusive; if not, skip pitch classification for the frame.
3. Capture one 2048-sample analyser frame using preallocated buffers only.
4. Apply the RMS gate before any pitch classification.
5. Analyze only the 80 Hz to 4000 Hz band.
6. Emit one scalar frequency candidate and one confidence value per frame.
7. Forward valid pitch results to note mapping and note tracking.

### 4. Inputs / Outputs
- **Inputs**: live analyser frame and session-active state.
- **Outputs**: `frequencyHz`, `pitchConfidence`, and a validity decision for downstream note logic.

### 5. Edge Cases
- Sample rate out of range: keep session timing active, disable pitch intelligence for the frame.
- Zero-energy frame: emit no pitch result.
- Frame with no clear peak: preserve the last valid pitch result and do not emit a new note label.

### 6. Constraints
- One pitch analysis pass per animation frame.
- No raw audio persistence.
- No buffer allocation per frame.

---

## Sub-Skill: Frequency Extraction Method

### 1. Purpose
Converts the strongest valid spectral peak into a deterministic scalar frequency.

### 2. APIs / Concepts Used
- spectral magnitude bins from the current analyser frame
- logarithmic frequency-to-bin mapping

### 3. Step-by-Step Implementation
1. Determine the lowest and highest usable bins from 80 Hz and 4000 Hz.
2. Select the bin with the largest magnitude inside that band.
3. If both neighboring bins exist, refine the peak using quadratic interpolation around the center bin.
4. Convert the refined bin to Hertz using the analyser sample rate and FFT size.
5. Clamp non-finite or unstable interpolation results back to the center bin frequency.
6. Reject any candidate outside the valid pitch range.

### 4. Inputs / Outputs
- **Inputs**: spectral magnitudes, analyser sample rate, FFT size.
- **Outputs**: one refined `frequencyHz` value or an empty classification.

### 5. Edge Cases
- Adjacent bins missing at band edges: use the center bin without interpolation.
- Multiple bins with equal magnitude: choose the lowest-frequency bin first for determinism.
- Non-finite arithmetic: discard the frame classification.

### 6. Constraints
- Frequency extraction must remain deterministic for the same frame sequence.

---

## Sub-Skill: Real-Time Sampling Loop

### 1. Purpose
Keeps the audio analysis loop aligned with session state and frame budget limits.

### 2. APIs / Concepts Used
- `requestAnimationFrame`
- Session active boolean
- reusable analyser buffers

### 3. Step-by-Step Implementation
1. Start the sampling loop only after a Session becomes active.
2. On each frame, read audio once and perform the minimum required analysis.
3. If the Session is inactive, exit immediately and do not schedule a new analysis pass.
4. Process RMS gating before pitch work.
5. Process pitch work before note finalization.
6. Re-arm the loop only after the current frame finishes.

### 4. Inputs / Outputs
- **Inputs**: active session state and current analyser frame.
- **Outputs**: per-frame RMS, pitch candidate, and note-state updates.

### 5. Edge Cases
- Session stops mid-frame: the current frame must not enqueue another frame after completion.
- Audio context not ready: skip pitch work and preserve the last valid state.

### 6. Constraints
- The loop must remain lightweight enough for the floating widget to stay responsive.

---

## Sub-Skill: Frame Throttling Logic

### 1. Purpose
Prevents redundant pitch work and guarantees one classification pass per animation frame.

### 2. APIs / Concepts Used
- pending frame handle
- last valid pitch result cache

### 3. Step-by-Step Implementation
1. Maintain exactly one pending frame request at a time.
2. If a request is already pending, do not enqueue another one.
3. If a frame cannot be classified within budget, skip label emission for that frame.
4. Retain the last valid pitch classification until a new valid frame replaces it.
5. Clear the pending request when the Session ends.

### 4. Inputs / Outputs
- **Inputs**: current frame budget and session state.
- **Outputs**: throttled pitch analysis with stable downstream values.

### 5. Edge Cases
- Rapid start-stop: the pending frame handle must be cleared before a new Session begins.
- Repeated invalid frames: the loop must keep running without growing the queue.

### 6. Constraints
- No background polling.
- No multiple queued classification frames.

---

## Sub-Skill: Shared Frame Reuse Rules

### 1. Purpose
Ensures the live analyser frame is captured once and reused by pitch, waveform, spectrogram, and HPS consumers without extra allocations.

### 2. APIs / Concepts Used
- `AnalyserNode`
- reusable time-domain and frequency-domain buffers
- session-active state

### 3. Step-by-Step Implementation
1. Allocate the analyser buffers when the Session becomes active.
2. Reuse the same time-domain frame buffer for every live sample.
3. Reuse the same FFT magnitude buffer for every live spectral consumer.
4. Capture the analyser frame once per animation frame and share the snapshot with downstream processing.
5. Clear the shared frame state only when the Session ends.

### 4. Inputs / Outputs
- **Inputs**: active session state and current analyser instance.
- **Outputs**: shared frame snapshot for pitch, waveform, spectrogram, and HPS processing.

### 5. Edge Cases
- Session stops mid-frame: keep the current shared buffers alive until the frame completes, then stop reusing them.
- Missing analyser: skip all consumers for that frame.

### 6. Constraints
- No per-frame buffer allocation.
- No separate frame copies for each consumer unless a renderer explicitly needs a transient draw snapshot.

---

## Sub-Skill: Shared FFT Buffer Usage

### 1. Purpose
Provides a single FFT magnitude source for spectrum display, HPS detection, and spectrogram extraction.

### 2. APIs / Concepts Used
- `AnalyserNode.getFloatFrequencyData()`
- preallocated floating-point spectrum buffer
- shared live-frame state

### 3. Step-by-Step Implementation
1. Allocate one FFT buffer sized to `analyser.frequencyBinCount`.
2. Fill the buffer once from the current analyser frame.
3. Read the same buffer from the spectrum display, HPS detector, and spectrogram extractor.
4. Keep auxiliary scratch arrays separate from the live FFT buffer.
5. Never mutate the live FFT buffer inside downstream consumers.

### 4. Inputs / Outputs
- **Inputs**: one live analyser spectral frame.
- **Outputs**: shared magnitude data for all spectral consumers.

### 5. Edge Cases
- Sample rate changes: reinitialize the shared FFT buffer only when the analyser is rebuilt.
- Low-energy frame: keep the buffer valid even when the magnitude values are near the noise floor.

### 6. Constraints
- No duplicated FFT storage per consumer.
- No unbounded spectral history in memory.

---

## Sub-Skill: Spectrogram Frame Extraction

### 1. Purpose
Transforms each shared FFT frame into a single spectrogram column for the live visualizer.

### 2. APIs / Concepts Used
- FFT magnitude buffer
- rolling spectrogram column buffer
- frequency-bin to frequency-axis mapping

### 3. Step-by-Step Implementation
1. Read the current shared FFT magnitude buffer.
2. Clamp the usable bins to the 0 Hz to approximately 4000 Hz visual range.
3. Normalize each bin into a display intensity value.
4. Store the normalized values as one spectrogram column.
5. Append the new column to the rolling spectrogram buffer and overwrite the oldest column when full.
6. Forward the column to the renderer without persisting it.

### 4. Inputs / Outputs
- **Inputs**: one live FFT magnitude frame.
- **Outputs**: one time-stamped spectrogram column for live rendering.

### 5. Edge Cases
- Empty or low-energy frames: still advance the timeline with a low-intensity column.
- Buffer full: discard the oldest column in FIFO order.

### 6. Constraints
- Spectrogram extraction must remain live-only.
- The spectrogram buffer must stay bounded to the approved rolling window.

---

## Sub-Skill: Psychoacoustic Frame Chain

### 1. Input
- One live analyser snapshot, the shared FFT magnitude frame, the HPS result, and the current session timestamp.
- Downstream consumers that need a stable psychoacoustic note candidate.

### 2. Output
- One shared psychoacoustic frame object containing MFCC coefficients, mapped note data, MIDI pitch data, and confidence metadata.
- The same frame must feed note mapping, pitch binning, temporal smoothing, segmentation, and noise rejection.

### 3. Step-by-Step Logic
1. Capture the live analyser frame once for the current animation tick.
2. Reuse the same FFT magnitude buffer that already feeds HPS and visualization.
3. Run HPS first so the fundamental estimate remains available to the psychoacoustic layer.
4. Feed the same FFT frame into MFCC extraction without allocating a second spectral pass.
5. Attach the derived MFCC vector, mapped note candidate, MIDI value, and note confidence to the shared frame object.
6. Publish the shared frame to the note pipeline, then clear it only when the session closes.

### 4. Constraints
- Do not allocate a second FFT buffer.
- Do not create a separate audio pipeline for MFCC.
- Keep MFCC additive to the existing FFT, HPS, spectrogram, waveform, and visualizer flow.
- Keep all frame data live-only unless a later Session event finalizes it.

### 5. Edge Cases
- Low-energy frames still advance the pipeline, but they should carry low confidence.
- If HPS fails on a frame, MFCC may still be computed, but downstream note output must not become unstable.
- If the session stops mid-frame, finish the current frame and then clear the shared state.
