# Phase 5 Audio Intelligence Tasks

Execute these tasks in order. Do not start the next task until the current one validates cleanly. Keep each task small, isolated, and aligned with the spec and skills docs.

## 1. Audio Frame Extraction
Primary files: app/renderer/audio.js
1. Connect the pitch pipeline to the existing live audio stream used by the session loop.
2. Reuse one fixed 2048-sample analyser frame buffer for pitch analysis during the active session.
3. Read only the current analyser frame and keep raw audio ephemeral.
Validation:
1. The analyser frame size remains 2048 samples.
2. RMS start/stop behavior still works exactly as before.
3. No raw audio or frame history is persisted.

## 2. Pitch Detection Engine
Primary files: app/renderer/audio.js
1. Add the pitch detection pass that reads the FFT magnitude spectrum from the current analyser frame.
2. Produce one `frequencyHz` value and one `pitchConfidence` value for each valid frame.
3. Keep the detection deterministic for the same frame sequence.
Validation:
1. A sustained single note produces a stable frequency.
2. Zero-energy or unreadable frames emit no pitch result.
3. Sample-rate limits from the spec are enforced.

## 3. Frequency Filtering
Primary files: app/renderer/audio.js
1. Reject frames with `pitchConfidence < 0.35`.
2. Reject out-of-range frequencies and breath-dominant frames.
3. Preserve the last valid pitch result when the current frame is filtered out.
Validation:
1. Silence and noise do not create pitch output.
2. Breath-dominant frames do not enter the note pipeline.
3. The session timing loop continues unaffected.

## 4. Note Mapping
Primary files: app/renderer/audio.js, skills/09_note_mapping.md
1. Convert each valid `frequencyHz` value into a note name and octave with the equal temperament formula.
2. Use sharps-only canonical note names and reject frequencies outside 27.5 Hz to 4186.01 Hz.
3. Keep the mapping stable at semitone boundaries.
Validation:
1. Known reference frequencies map to the expected note labels.
2. Invalid frequencies return no note label.
3. Repeated frames map to the same label.

## 5. Real-Time Pitch Loop
Primary files: app/renderer/audio.js, app/renderer/app.js
1. Integrate the pitch pipeline into the existing requestAnimationFrame audio loop.
2. Run pitch classification only while `window.isSessionActive` is true.
3. Keep classification to one pass per animation frame, and throttle any visible readout updates to the latest valid result on a 50 to 100 ms cadence.
Validation:
1. The loop stops cleanly when the session stops.
2. The floating widget stays responsive while pitch analysis runs.
3. No extra classification queue builds up over time.

## 6. NoteEvent Integration
Primary files: app/renderer/audio.js, app/components/sessionTimer.js
1. During an active note, collect valid pitch samples and mapped note labels.
2. On note close, finalize `detectedNotes`, `avgFrequency`, and `dominantNote` from the collected samples.
3. Persist the completed note into the current session without changing note timing or session duration.
Validation:
1. Notes with valid pitch frames store pitch metadata correctly.
2. Notes with no valid pitch frames close normally with empty pitch metadata.
3. Session start and stop behavior is unchanged.

## 7. Breath Analysis
Primary files: app/renderer/audio.js, app/components/sessionTimer.js
1. Keep the 300 ms silence gap timer as the only note-closing trigger.
2. Treat breath-dominant frames as continuous play inside the same note window.
3. Compute session gap duration and continuous play duration from the same bounded note lifecycle rules.
Validation:
1. A full silence gap closes the note after 300 ms.
2. Breath-only continuation does not split one note into multiple notes.
3. Breath frames stay out of pitch aggregates.

## 8. Analytics Extension
Primary files: app/components/analytics.js, app/dashboard/dashboard.js
1. Extend the read-only analytics calculations to include pitch stability, note distribution, most played note, and frequency variance.
2. Derive all metrics from persisted `sessions` data only.
3. Apply the spec rules for empty dominant notes, zero-frequency cases, and tie breaking.
Validation:
1. Analytics renders without mutating session data.
2. Empty datasets return zero-state values instead of NaN.
3. The new pitch metrics match the spec formulas.

## 9. Dashboard Integration
Primary files: app/renderer/app.js, app/dashboard/dashboard.js, app/dashboard/dashboard.html, app/dashboard/dashboard.css
1. Surface the current live note and frequency in the UI using the existing renderer state path.
2. Show the session-level pitch insights in the dashboard summary alongside the existing analytics surface.
3. Keep both surfaces read-only and update them only through the existing refresh flow.
Validation:
1. The live readout changes during recording.
2. The dashboard shows finalized pitch insights after refresh.
3. No dashboard control mutates session data.

## 10. Performance Optimization
Primary files: app/renderer/audio.js, app/renderer/app.js, app/components/sessionTimer.js, app/components/analytics.js
1. Reuse buffers and cached results instead of allocating new analysis data per frame.
2. Keep pitch classification bounded to one pass per animation frame and stop all loops cleanly when the session ends.
3. Avoid extra DOM work in the audio path and update UI only when the displayed value changes.
Validation:
1. Long sessions stay responsive.
2. No timer, audio, or render loop leaks appear.
3. The pitch loop does not grow over time.

## 11. Validation & Testing
Primary files: npm start, app/renderer/audio.js, app/components/analytics.js, app/dashboard/dashboard.js
1. Test a single sustained note and confirm frequency detection, note mapping, and note finalization.
2. Test multiple note transitions and confirm pitch changes, dominantNote selection, and detectedNotes ordering.
3. Test a long session for stability and memory behavior.
4. Test silence and breath-only input to confirm no false note creation.
5. Run an app smoke test after the full task set and fix any regressions before considering Phase 5 ready.
Validation:
1. All four required scenarios pass.
2. The app starts cleanly with `npm start`.
3. No regressions appear in audio detection, session tracking, or dashboard rendering.
