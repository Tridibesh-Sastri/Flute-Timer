# Advanced Audio Intelligence

## Scope
- Applies only while a Session is active.
- Raw microphone audio and FFT buffers are ephemeral and must never be persisted.
- All outputs are deterministic derived values stored only on sessions and notes.

## Pitch Detection Architecture
1. Capture one analyser frame from the live `AudioContext`.
2. Use a 2048-sample window for pitch analysis.
3. Compute RMS from time-domain samples for note gating.
4. Compute a spectrum from the same frame for pitch classification.
5. Identify a dominant spectral peak inside the 80 Hz to 4000 Hz pitch band.
6. Convert the peak frequency into a note label.
7. Aggregate valid pitch samples until the note closes.

### Pitch Confidence
- `peakMagnitude` is the highest magnitude observed inside the pitch band.
- `totalMagnitude` is the sum of magnitudes observed inside the pitch band.
- `pitchConfidence = peakMagnitude / max(totalMagnitude, 1)`.
- A frame is a valid pitch frame only when `pitchConfidence >= 0.35`.

## Note Mapping Formula
- `NOTE_NAMES = [C, C#, D, D#, E, F, F#, G, G#, A, A#, B]`.
- `midiNumber = round(69 + 12 * log2(f / 440))`.
- `noteIndex = ((midiNumber % 12) + 12) % 12`.
- `octave = floor(midiNumber / 12) - 1`.
- `noteLabel = NOTE_NAMES[noteIndex] + octave`.
- The valid mapping range is 27.5 Hz to 4186.01 Hz.
- Frequencies outside the valid range are ignored.
- `dominantNote` is the most frequent mapped note label among valid frames; ties break by higher cumulative confidence, then first occurrence.

## Breath Detection Logic
- `breathScore = highBandEnergy / max(totalEnergy, 1)` where `highBandEnergy` is the sum of spectral magnitudes from 1000 Hz to 8000 Hz.
- A frame is breath-dominant when RMS is above the note floor, `pitchConfidence < 0.35`, and `breathScore >= 0.45`.
- Breath-dominant frames remain part of the note timing but do not contribute to `avgFrequency`, `detectedNotes`, or `dominantNote`.
- If a note contains only breath-dominant frames, its pitch summary must finalize as empty pitch data.

## System Constraints
- Pitch intelligence must only run when `AudioContext.sampleRate` is between 44100 Hz and 48000 Hz inclusive.
- Processing must be limited to one analysis pass per animation frame.
- The system must not allocate or persist raw audio buffers.
- Pitch intelligence must never mutate session duration, note duration, or session timing rules.
- If a frame exceeds the processing budget, the system must retain the last valid classification and skip emitting a new label for that frame.
- All derived values must be reproducible from the same frame sequence.