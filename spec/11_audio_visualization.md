# Audio Visualization & Fundamental Detection

## Scope
- Extends the existing FFT spectrum and harmonic visualization; it does not replace them.
- Applies only while a Session is active.
- All visualization outputs are live-only and must not be persisted to localStorage, Session notes, or analytics history.
- The visualizer may display raw FFT peaks, HPS fundamentals, and debug values, but only the HPS-derived fundamental is authoritative for the final fundamental display.

## Existing Visual Layers
- Spectrum (existing): FFT magnitude graph with frequency on the X-axis and amplitude on the Y-axis. This layer must remain intact.
- Harmonics (existing): Harmonic markers and guides for multiples of the detected frequency. This layer must remain intact.

## Spectrogram System
- X-axis -> Time
- Y-axis -> Frequency
- Color -> Amplitude
- Rolling buffer duration must remain between 5 and 10 seconds inclusive.
- Each processed analyser frame contributes one new time slice to the spectrogram.
- The frequency range should cover 0 to approximately 4000 Hz.
- Oldest slices must be discarded in FIFO order when the buffer capacity is reached.
- Spectrogram output is live-only and must not be written to persistent storage.

## Waveform System
- X-axis -> Time
- Y-axis -> Amplitude
- The waveform must use the current time-domain analyser frame only.
- Waveform rendering is real-time only and must not keep long-term history.
- Rendering must remain smooth and lightweight, using the same live audio stream as the FFT spectrum.

## Fundamental Detection (HPS)
1. Read the current FFT magnitude spectrum.
2. Build downsampled spectra at factors 2, 3, and 4.
3. Multiply the aligned spectra to produce the HPS curve.
4. Identify the strongest peak in the HPS curve as the fundamental candidate.
5. Use the HPS result for the fundamental display and debug values.
6. Preserve the raw FFT peak as a comparison value only.

### HPS Constraints
- HPS must run on the current frame only.
- HPS must reuse preallocated buffers when possible.
- HPS must not allocate unbounded history or raw frame storage.
- HPS must execute within the same frame budget as the live audio loop.
- HPS output must remain deterministic for the same input frame sequence.

## Frequency Selection Logic
- Final detected frequency for the visualizer must be based on HPS output, not the raw FFT peak.
- Raw FFT peak may still be shown as `debugFrequencyRaw`.
- HPS fundamental may be shown as `debugFrequencyHPS`.
- Confidence may be shown as `debugConfidence`.
- If HPS is unavailable for a frame, the visualizer should leave the current fundamental display unchanged or show a neutral empty state, depending on the host renderer.
- Existing spectrum and harmonic overlays must remain visible at all times.