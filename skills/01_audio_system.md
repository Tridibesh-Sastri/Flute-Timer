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
- **Outputs**: Logical explicitly executed trigger pathways mapping to `createNoteEvent()` and `finalizeNoteEvent()`.

### 5. Edge Cases
- **Rapid flickering spikes**: Mitigated naturally since hysteresis timers are securely restarted by spikes triggering `clearTimeout()`.
- **Systematic window suspension**: If application suspends mathematically breaking setTimeout mapping.

### 6. Constraints
- Execution completely locked natively verifying internal bounds.
- Tied specifically only into the internal system detection limits avoiding DOM manipulations entirely.
