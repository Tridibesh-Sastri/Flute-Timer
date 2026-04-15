# Phase 4.4 Audio Visualization Tasks

Execute these tasks in order. Do not start the next task until the current one validates cleanly. Keep each task small, isolated, and aligned with spec/11_audio_visualization.md and the matching skills docs.

Preserve the existing FFT Spectrum view and Harmonics visualization. Only extend the live pipeline with spectrogram, waveform, and HPS detection. Do not persist live visualization buffers.

## 1. Shared FFT Buffer Access
Primary files: app/renderer/audio.js, skills/01_audio_system.md
1. Reuse the existing analyser created in setupAudio and keep fftSize fixed at 2048.
2. Keep the current live frame capture path as the only source for spectrum and time-domain data; do not create another analyser or another frame loop.
3. Thread the current float time-domain frame and the current FFT magnitude frame through the same per-tick processing path so spectrogram, waveform, and HPS consumers all read the same analyser tick.
4. Keep the raw frame data ephemeral; use preallocated buffers only and do not add history storage or persistence.
Validation:
1. The analyser frame size stays 2048.
2. No additional analyser instance is introduced.
3. No raw audio or frame history is written to storage.

## 2. HPS Primary Frequency Path
Primary files: app/renderer/audio.js, skills/08_pitch_detection.md, skills/14_hps_detection.md
1. Replace raw FFT peak selection as the authoritative frequency path with HPS computed from the current FFT magnitude frame.
2. Build the HPS curve using factors 2, 3, and 4 and keep the raw FFT peak only as debug comparison data.
3. Emit the live debug fields debugFrequencyRaw, debugFrequencyHPS, and debugConfidence from the same frame analysis pass.
4. Keep the existing pitch-confidence threshold, valid note range, and breath-dominance filtering intact around the HPS result.
Validation:
1. A sustained single note produces a stable HPS frequency.
2. Zero-energy or unreadable frames emit no new pitch result.
3. Breath-dominant frames do not enter note aggregation.

## 3. Spectrogram Rolling Buffer
Primary files: app/components/visualizer.js, app/dashboard/dashboard.css, skills/12_spectrogram_rendering.md
1. Add a bounded rolling spectrogram buffer that stores only live FFT columns for a 5 to 10 second window.
2. Consume the incoming live FFT frame from the existing visualizer IPC payload and write exactly one new spectrogram column per processed frame.
3. Map the visual frequency axis to approximately 0 to 4000 Hz and map amplitude into a stable color scale.
4. Discard the oldest column in FIFO order when the buffer reaches capacity and clear the buffer only on session reset or visualizer reset.
5. Keep the current FFT Spectrum view and Harmonics visualization intact and visually separate from the spectrogram layer.
Validation:
1. The spectrogram never grows beyond the configured rolling window.
2. Oldest columns are discarded in FIFO order.
3. Spectrum and harmonic overlays still render exactly as before.

## 4. Waveform Live Rendering
Primary files: app/components/visualizer.js, app/renderer/audio.js, skills/13_waveform_rendering.md
1. Add the current time-domain analyser frame to the visualizer payload so the dashboard can draw the waveform from live audio data.
2. Render the waveform from the current frame only; do not store a waveform timeline or reuse older samples.
3. Normalize the time-domain samples into canvas coordinates and keep the baseline stable at the center line.
4. Reuse the same canvas and 2D context for waveform drawing and clear the previous frame before drawing the next one.
Validation:
1. Silence renders as a flat center line.
2. No waveform history is retained between frames.
3. The waveform updates smoothly while the session is active.

## 5. Visualizer Surface Integration
Primary files: app/components/visualizer.js, app/dashboard/dashboard.js, app/dashboard/dashboard.css
1. Extend the existing dashboard Visualizer tab with the new spectrogram and waveform sections without removing or rewriting the current spectrum stage.
2. Keep the current frame delivery path from app/renderer/audio.js through the dashboard refresh flow unchanged.
3. Surface the HPS-derived fundamental and its debug values in the visualizer readout while keeping raw FFT peak data available only for comparison.
4. Make sure the new sections reuse the same live session state, session-end clearing behavior, and visual style system as the existing visualizer panel.
Validation:
1. The Visualizer tab still refreshes through the existing IPC flow.
2. The spectrum and harmonic display remain visible and unchanged.
3. The new spectrogram, waveform, and HPS readouts appear together in the dashboard.

## 6. Performance And Memory Guardrails
Primary files: app/renderer/audio.js, app/components/visualizer.js, skills/15_visualizer_optimization.md
1. Reuse typed arrays, scratch buffers, and canvas contexts instead of allocating new ones per frame.
2. Keep render work coalesced to the latest analyser frame and avoid queue growth or background polling.
3. Bound all live visualization state to the active session and clear transient buffers on session stop.
4. Make sure the visualizer does not block the audio loop or create frame lag that affects note capture.
Validation:
1. Long sessions remain stable.
2. Memory usage stays bounded.
3. No extra render queue builds up over time.

## 7. Validation And Smoke Test
Primary files: npm start, app/renderer/audio.js, app/components/visualizer.js, app/dashboard/dashboard.js
1. Test a sustained note and confirm the HPS-derived frequency, note label, spectrum, and harmonics all stay stable.
2. Test silence and breath-only input to confirm the visualizer stays live-only and pitch data is filtered correctly.
3. Test the spectrogram and waveform during a live session and confirm they update from current analyser frames only.
4. Run an app smoke test with npm start and fix any regressions before closing Phase 4.4.
Validation:
1. Existing FFT Spectrum and Harmonics behavior remains intact.
2. The new visualization layers work live without persistent storage.
3. The app starts cleanly and the visualizer tab renders without errors.
