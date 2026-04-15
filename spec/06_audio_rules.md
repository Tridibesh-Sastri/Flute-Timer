# Audio Handling Rules

## Hardware Interactions
- Access is driven exclusively by the Web Audio API `AnalyserNode`.
- Volume and intensity states are measured exclusively by calculating RMS from time-domain arrays.
- Advanced pitch intelligence uses the same live stream and only derives scalar frequency values; it must never persist raw microphone audio or unbounded frame history.

## Pitch Intelligence Rules
- Pitch detection is enabled only while a Session is active.
- Each pitch analysis frame must be a single 2048-sample analyser window.
- Frequency extraction must read the FFT magnitude spectrum, ignore bins below 80 Hz and above 4000 Hz, and select the highest-magnitude bin within that band.
- When adjacent bins are available, the candidate frequency must be refined by quadratic interpolation around the spectral peak.
- A frame is valid for pitch tracking only when its confidence threshold is satisfied, as defined in [spec/10_audio_intelligence.md](spec/10_audio_intelligence.md).
- Breath-dominant frames are classified separately and must not contribute to note label aggregation.

## Sampling Rate Constraints
- Pitch intelligence is valid only when `AudioContext.sampleRate` is between 44100 Hz and 48000 Hz inclusive.
- If the sample rate falls outside that range, pitch classification must be disabled for the current Session.
- RMS gating, session timing, and note start/stop behavior must continue even when pitch intelligence is disabled.

## Real-Time Processing Limits
- Pitch classification may run at most once per animation frame.
- The system must reuse buffers and derived results for the current note instead of allocating new analysis storage per frame.
- If a frame cannot be classified within the frame budget, the system must retain the last valid pitch result and skip emitting a new note label for that frame.
- The total analysis pipeline must remain lightweight enough to avoid visible lag in the floating widget.

## Output Mechanisms
- Noise flickering is prevented explicitly through standard hysteresis.
- The sole architectural responsibility of this layer is driving the detection layer by emitting raw trigger logic that maps to NoteEvents.
