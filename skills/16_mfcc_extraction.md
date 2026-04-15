# MFCC Extraction

## 1. Input
- One shared FFT magnitude frame from the live analyser.
- The current sample rate and the fixed frequency-bin layout for that analyser.
- A live frame timestamp for associating the coefficients with the current note-analysis cycle.

## 2. Output
- A fixed-length MFCC coefficient array between 10 and 13 values inclusive.
- A frame-level psychoacoustic feature snapshot that can be reused by note mapping and noise rejection.

## 3. Step-by-Step Logic
1. Read the current FFT magnitude frame that is already being reused by HPS and the visualizer.
2. Map the linear FFT bins into perceptually spaced Mel bands.
3. Sum the energy inside each Mel band.
4. Apply log compression to the Mel-band energies.
5. Run a DCT over the log Mel energies to produce cepstral coefficients.
6. Keep the low-order coefficients and discard the rest.
7. Attach the coefficient vector to the current live frame without storing a raw history buffer.

## 4. Constraints
- Reuse the same FFT frame that powered HPS; do not trigger a second spectral capture.
- Keep the coefficient count fixed for the whole session.
- Keep MFCC generation additive; it must not alter pitch detection or visualizer output.
- Do not persist raw FFT or raw Mel-band history as part of the MFCC layer.

## 5. Edge Cases
- Silence or near-silence should still produce a finite coefficient vector, not NaN values.
- Clipped or saturated frames should clamp cleanly before log compression.
- If the Mel filter edges fall outside the analyser range, clamp them to the valid bins.
- If the sample rate changes and the analyser is rebuilt, rebuild the Mel bank with it.