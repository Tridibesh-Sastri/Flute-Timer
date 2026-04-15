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
