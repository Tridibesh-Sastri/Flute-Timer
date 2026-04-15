# Phase 5 Psychoacoustic Audio Intelligence Tasks

Execute these tasks in order. Do not start the next task until the current one validates cleanly. Keep each task small, isolated, and aligned with spec/12_psychoacoustic_intelligence.md and the matching skills docs.

Preserve the existing FFT, HPS detection, spectrogram, waveform, and visualizer behavior. This phase adds a psychoacoustic layer on top of the existing live audio loop and must not create a second analyser or a separate audio pipeline.

## 1. MFCC Extraction
Primary files: app/renderer/audio.js, skills/16_mfcc_extraction.md
1. Reuse the current FFT magnitude frame from the live audio loop and feed it directly into the MFCC path.
2. Apply the Mel filter bank, log compression, and DCT using preallocated working buffers only.
3. Extract a fixed coefficient vector in the 10 to 13 coefficient range and expose it as `mfccCoefficients` on the live frame snapshot.
4. Keep MFCC frame-based and additive; do not persist raw Mel-band history or allocate a second spectral pass.
Validation:
1. MFCC values remain stable across repeated frames for the same input.
2. No new per-frame arrays or long-lived history buffers are introduced.
3. FFT, HPS, and visualizer behavior remain unchanged.

## 2. Frequency to MIDI Mapping
Primary files: app/renderer/audio.js, skills/17_note_mapping.md
1. Take the HPS-derived frequency from the current frame as the note mapping input.
2. Convert frequency to MIDI with `midi = 12 * log2(f / 440) + 69` and round to the nearest semitone.
3. Map the rounded MIDI value to the canonical sharp-only note label and octave.
4. Emit the mapped note as `{ midiValue, noteLabel }` on the live analysis frame.
Validation:
1. Known reference notes map to the expected note labels.
2. Out-of-range or invalid frequencies do not produce a note label.
3. Repeated frames map to the same MIDI and label output.

## 3. Pitch Binning
Primary files: app/renderer/audio.js, skills/18_pitch_binning.md
1. Collect a short run of recent MIDI values from the live frame stream.
2. Group nearby values into a single semitone bucket and snap to the dominant bucket.
3. Keep the current bin stable unless a competing bin clearly dominates the short window.
4. Expose the binned result as the current note candidate used by smoothing.
Validation:
1. Small pitch jitter stays inside one bin.
2. The stable bin changes only when the input truly moves to a new semitone.
3. No long-range history is used for binning.

## 4. Temporal Smoothing
Primary files: app/renderer/audio.js, skills/19_temporal_smoothing.md
1. Maintain a sliding window of 3 to 5 live frames for the current note candidate.
2. Apply a median filter or confidence-weighted median over the active window.
3. Emit `stableMidi` only when the window is sufficiently consistent.
4. Reset the smoothing state when silence, invalid pitch, or a hard note boundary occurs.
Validation:
1. Rapid transitions are less jittery than the raw frame stream.
2. Vibrato or small drift does not cause note flapping.
3. The smoothing window remains bounded and frame-based.

## 5. Noise Rejection
Primary files: app/renderer/audio.js, skills/21_noise_rejection.md
1. Reject frames with low amplitude or low pitch confidence before they reach segmentation.
2. Reject unstable frequency shifts that do not survive the smoothing window.
3. Reject frames with low MFCC confidence or strong disagreement between HPS and MFCC cues.
4. Allow valid soft notes through once they stabilize instead of filtering them permanently.
Validation:
1. Silence and noise do not create false note candidates.
2. Breath-dominant or unstable frames are filtered out consistently.
3. Valid low-volume notes can still pass after stabilization.

## 6. Note Segmentation
Primary files: app/renderer/audio.js, app/components/sessionTimer.js, skills/20_note_segmentation.md
1. Track one active stable note segment at a time inside the live session loop.
2. Finalize a note only after it remains stable for at least 3 frames and typically 80 ms to 150 ms.
3. Close the current segment when the stable note changes or the session ends.
4. Emit a `NoteEvent` with `note`, `startTime`, `endTime`, and `confidence` once the segment is valid.
Validation:
1. Single sustained notes become one stable NoteEvent.
2. Short spikes below the stability window do not become notes.
3. Session stop closes any active note cleanly.

## 7. Note Timeline Buffer
Primary files: app/components/sessionTimer.js, app/renderer/audio.js
1. Maintain a bounded list of finalized NoteEvents for the current session.
2. Append a note only when segmentation closes a valid segment.
3. Keep the note timeline consistent with existing session persistence rules and do not store transient frame data.
4. Clear the active timeline state when the session resets or ends.
Validation:
1. Finalized notes append in chronological order.
2. No transient psychoacoustic frame data is persisted in the timeline.
3. Existing session timing and duration behavior remain unchanged.

## 8. Integration With Existing System
Primary files: app/renderer/audio.js, app/components/sessionTimer.js, skills/01_audio_system.md, skills/04_data_system.md
1. Hook the psychoacoustic layer into the existing audio.js frame loop only.
2. Preserve the ordering `HPS → MFCC → Mapping → Smoothing → Segmentation` on the same live frame snapshot.
3. Reuse the already captured FFT and HPS outputs rather than recomputing them.
4. Keep all new logic additive so FFT, HPS detection, spectrogram, waveform, and visualizer behavior remain intact.
Validation:
1. The audio loop still uses one analyser and one frame capture path.
2. The psychoacoustic layer runs without changing the existing visualizer pipeline.
3. No extra heavy loops or duplicate analysis passes are introduced.

## 9. Debug Output
Primary files: app/renderer/audio.js, app/components/sessionTimer.js
1. Expose live debug fields for `rawFrequency`, `hpsFrequency`, `mfccCoefficients`, `mappedNote`, and `stableNote`.
2. Keep debug values live-only and tied to the current frame snapshot.
3. Make sure debug output remains a readout only and does not change note timing or persistence rules.
Validation:
1. Debug values update from the live frame stream.
2. Debug fields do not persist into session storage.
3. The displayed note state matches the final psychoacoustic output.

## 10. Performance Guard
Primary files: app/renderer/audio.js, app/components/sessionTimer.js
1. Reuse typed arrays, scratch buffers, and existing frame data instead of allocating new objects per frame.
2. Keep the psychoacoustic work bounded to the current animation frame budget and avoid blocking the UI.
3. Clear transient state on session stop so the buffers do not grow over long runs.
4. Keep all note extraction deterministic for the same frame sequence.
Validation:
1. Long sessions do not accumulate extra analysis memory.
2. The floating widget and session UI remain responsive.
3. No frame queue or note queue grows without bound.

## 11. Validation And Smoke Test
Primary files: npm start, app/renderer/audio.js, app/components/sessionTimer.js
1. Test a single sustained flute note and confirm stable MFCC output, note mapping, smoothing, and final note extraction.
2. Test rapid note transitions and confirm the pitch binning and smoothing reduce jitter without dropping valid notes.
3. Test noise, breath, and unstable harmonic input to confirm rejection behavior works as expected.
4. Test a long session and confirm there is no lag, no memory growth, and no regression in the existing FFT/HPS/visualizer systems.
5. Run the app smoke test with `npm start` and fix any regressions before closing Phase 5.
Validation:
1. The app starts cleanly with `npm start`.
2. Stable notes are extracted correctly from live audio.
3. Existing FFT, HPS, spectrogram, and visualizer behavior remain intact.