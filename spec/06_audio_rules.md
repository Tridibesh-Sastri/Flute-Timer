# Audio Handling Rules

## Hardware Interactions
- Access is driven exclusively by the Web Audio API `AnalyserNode`.
- Volume and intensity states are measured exclusively by calculating RMS from time-domain arrays.
- Advanced pitch intelligence uses the same live stream and only derives scalar frequency values; it must never persist raw microphone audio or unbounded frame history.
- A single analyser frame must be captured once per animation frame and reused by RMS, FFT, waveform, spectrogram, and HPS consumers.

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

## Visualization and Fundamental Detection Limits
- Spectrogram history buffers must be bounded to a rolling 5 to 10 second window and must overwrite the oldest columns when capacity is reached.
- The spectrogram frame resolution must match the analyser frame cadence as closely as practical.
- HPS computation must use only the current FFT frame, fixed downsample factors of 2, 3, and 4, and preallocated working storage.
- HPS output may inform visualizer and debug fields, but it must not mutate Session duration, note timing, or persistence rules.

## Output Mechanisms
- Noise flickering is prevented explicitly through standard hysteresis.
- The sole architectural responsibility of this layer is driving the detection layer by emitting raw trigger logic that maps to NoteEvents.

## Psychoacoustic Feature Extraction Limits
- MFCC must reuse the same FFT magnitude frame as HPS and the existing live visualizer surfaces.
- MFCC must not introduce a separate audio capture path, a second analyser instance, or duplicate spectrum computation.
- Psychoacoustic note extraction must stay within the same per-frame budget as the live audio loop.
- MFCC coefficients are frame-based and temporary; they must not be buffered as long-term audio history.
- Note mapping and temporal smoothing derived from MFCC must remain deterministic for the same input frame sequence.
- The psychoacoustic layer is defined in [spec/12_psychoacoustic_intelligence.md](spec/12_psychoacoustic_intelligence.md) and must remain additive to the existing FFT, spectrogram, waveform, and HPS rules.
