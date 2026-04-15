# System Behavior Rules

## Operational Logic
- A Session MUST be manually initiated by the user.
- Each continuous detected sound segment becomes an explicit `NoteEvent`.
- Silence natively and immediately resolves the active `NoteEvent`.

## Session State Control
- **Session Start**: When a Session initiates, the Session Timer immediately begins and the Audio Detection system becomes active.
- **Inactive Session**: If a Session is NOT active, audio detection must be explicitly ignored, and no NoteEvent should be created.
- **Session End**: When a Session ends, any concurrently active NoteEvent must be closed, and the total Session duration is finalized.

## Derived Practice Time
- The effective or active practice time for a Session is the sum of all valid `NoteEvent.duration` values inside that Session.
- Dashboard and calendar views may display the active time as a derived metric, but they must not mutate the stored Session duration to match it.
- When the Session duration exceeds the active note duration, the difference is the non-note gap time and should be surfaced as a comparison metric in summary views.

## Learning Timer Relations
- Operates completely independently of the Session structure. 
- When the Learning Timer concludes, the Alarm is triggered but the Session itself continues unless manually stopped by the user.

## Sound Control System
- The volume threshold logic must be fully exposed as adjustable values.
- Implements user-controlled sensitivity interfaces.

## Pitch Tracking During NoteEvent
- While a NoteEvent is active, each valid pitch frame must be captured into a rolling analysis buffer.
- Only frames that satisfy the pitch confidence and frequency band rules from [spec/10_audio_intelligence.md](spec/10_audio_intelligence.md) may contribute to pitch aggregates.
- Breath-dominant frames must not alter pitch aggregates, detected notes, or dominant note selection.
- On note closure, the system must finalize `avgFrequency`, `detectedNotes`, and `dominantNote` from the captured pitch samples.
- If a note contains no valid pitch frames, the finalized values must be `avgFrequency = 0`, `detectedNotes = []`, and `dominantNote = ''`.

## Note Detection Pipeline
- While the Session is active, audio processing must evaluate frames in this order:
	- RMS gate for note start and note end.
	- Pitch classification for valid note frames.
	- Breath classification for non-pitch frames.
	- Note finalization on silence closure or session end.
- A note starts only when RMS exceeds the start threshold and the current Session is active.
- A note remains active until RMS stays below the stop threshold for the configured silence delay.
- Pitch metadata must be accumulated only during the active note window.
- Session end must force-close any active note and finalize its pitch aggregates using the same rules as a normal silence closure.

## Visualization Update Pipeline
- While the Session is active, each processed analyser frame must also update the live waveform, FFT spectrum, and spectrogram surfaces.
- The spectrogram must append one time slice per frame and discard the oldest slice when the rolling buffer limit is reached.
- Visualization updates may be throttled for rendering, but they must use the most recent analyser frame and must never block audio processing.
- Existing spectrum and harmonic overlays must remain visible and continue to reflect the same live frame.

## Fundamental Tracking Pipeline
- After the FFT spectrum is captured for a frame, the audio loop must compute HPS from the same frame using fixed downsample factors of 2, 3, and 4.
- The fundamental candidate derived from HPS must be tracked separately from the raw FFT peak.
- The visualizer and debug surfaces must surface `debugFrequencyRaw`, `debugFrequencyHPS`, and `debugConfidence` as live-only diagnostic values.
- The final displayed fundamental must prefer HPS output, while raw FFT peak data remains auxiliary debug information.
- HPS computation must not alter Session timing, NoteEvent timing, or note persistence rules.

## Psychoacoustic Processing Layer
- The psychoacoustic layer runs after HPS and uses the same live analyser frame; it must not request a second capture or separate audio pipeline.
- The processing order is:

```text
FFT Frame → HPS frequency → MFCC coefficients → Note mapping → Smoothed output
```

- MFCC values must be derived from the FFT magnitudes already captured for the frame and must remain frame-based.
- The mapping stage must convert the HPS frequency into a continuous MIDI value and then quantize it to the nearest stable note bin.
- A note candidate becomes valid only after it survives the temporal smoothing window and the note-stability window.
- Short spikes and low-confidence MFCC patterns must be discarded before note segmentation.
- The output of this layer is a stable note candidate and note timeline segment that can feed future extraction and comparison systems.
- Psychoacoustic processing must not mutate Session timing, existing NoteEvent timing, or the existing FFT/HPS visualizers.

## Dominant Note Calculation
- Each valid pitch frame must be mapped to a note label using the formula in [spec/10_audio_intelligence.md](spec/10_audio_intelligence.md).
- `dominantNote` is the mapped note label with the highest frame count within the note.
- If two labels have the same frame count, the one with the higher cumulative frame confidence wins.
- If a tie still remains, the label that appeared first in the note wins.
- `detectedNotes` is the ordered unique list of mapped note labels encountered in the note, preserving first-seen order.

## Detail View Interaction
- Session note edits performed in the Dashboard must persist through localStorage updates without changing the computed timing fields.
- Calendar zoom controls must only change the rendered scale of the day timeline and must never change the underlying start or end timestamps of any Session.
