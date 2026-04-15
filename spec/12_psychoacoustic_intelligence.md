# Psychoacoustic Audio Intelligence

## Scope
- Adds a psychoacoustic note-extraction layer on top of the existing FFT, HPS, spectrogram, waveform, and visualizer systems.
- Applies only to live Session processing.
- Reuses the same analyser frame and derived FFT data; it must not create a separate audio pipeline or persist raw history.
- Produces stable note timeline output suitable for future reference comparison and learning feedback.

## Final Pipeline
```text
Audio Input
→ FFT Spectrum
→ HPS (Fundamental Frequency)
→ MFCC (Perceptual Features)
→ Frequency → Note Mapping (Log Scale)
→ Temporal Smoothing
→ Note Segmentation
→ Note Timeline Output
```

## MFCC Pipeline
1. Read the current FFT magnitude frame.
2. Apply a Mel filter bank to the same frame.
3. Log-compress the Mel-band energies.
4. Apply a DCT to produce cepstral coefficients.

### MFCC Output
- `mfccCoefficients = [c1, c2, ..., c13]`
- The coefficient count must remain between 10 and 13 inclusive.
- MFCC values are frame-based and must not be stored as long-term history.
- MFCC must reuse the same FFT frame already used by HPS and visualization.

### Mel Scale Reference
- `mel(f) = 2595 * log10(1 + f / 700)`
- The Mel filter bank should emphasize perceptually spaced bands rather than linear bins.

## Psychoacoustic Frequency Mapping
- `midi = 12 * log2(f / 440) + 69`
- `stableMidi = round(midi)`.
- `octave = floor(stableMidi / 12) - 1`.
- `note = NOTE_NAMES[((stableMidi % 12) + 12) % 12] + octave`.
- Nearby frequencies must be grouped into the same note bin to suppress micro-fluctuation noise.
- Frequencies should be treated as the nearest psychoacoustic note center unless the frame is below the confidence threshold.

### Note Binning Rule
- One semitone bin represents a stable note bucket.
- Small pitch jitter inside a bin must not force a note change.
- A candidate note changes only when the smoothed MIDI value crosses into a new bin with sufficient confidence.

## Temporal Smoothing
- Use a sliding window of 3 to 5 frames.
- Use a median or confidence-weighted average over the window.
- Prefer the most stable note bin over single-frame outliers.
- Fast jumps must be stabilized before they become output notes.

## Note Segmentation
- A note is valid only after remaining stable for X ms.
- X must cover at least 3 frames and should typically fall in the 80 ms to 150 ms range.
- Short spikes shorter than the stability window must be ignored.
- The stability window must preserve musical transitions while rejecting random frame noise.
- Segment boundaries are formed only when the stable note changes or the session ends.

## Noise Rejection
- Ignore low amplitude frames.
- Ignore low confidence MFCC patterns.
- Reject unstable frequency shifts that do not survive the smoothing window.
- Breath-dominant or otherwise noisy frames may contribute to timing only if they do not satisfy note confidence rules.

## Final Output Format
```js
NoteEvent = {
  note: "A4",
  startTime: number,
  endTime: number,
  confidence: number
}
```

### Output Rules
- `note` is the stable psychoacoustic note label.
- `confidence` is a normalized score derived from HPS agreement, MFCC consistency, and temporal stability.
- `noteConfidence = (hpsAgreement + mfccConsistency + temporalStability) / 3`, where each component is normalized to the range 0 to 1.
- The timeline output must remain compatible with future reference-comparison and learning-feedback systems.

## Compatibility Rules
- This layer is additive and must not modify FFT, spectrogram, waveform, HPS, or visualizer behavior.
- The layer must remain frame-based and deterministic for the same input sequence.
- MFCC, note mapping, and segmentation results must be consumable by downstream comparison systems without requiring additional audio capture.