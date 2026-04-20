# Session-First Data Model

**SINGLE SOURCE OF TRUTH**  
This specification represents the universally exact boundaries of data schemas across the intelligence system.

## Cardinal Rules
- **No NoteEvent can exist outside a Session.**
- **Continuous sound segment = NoteEvent.**
- There is NO separate "task" entity. The data hierarchy is strictly Session -> NoteEvent[].

## Data Schema Models

### `Session` Type Structure
- `id`: Globally unique identifier string.
- `name`: Editable session name string. Defaults to `Session #N` when not explicitly set.
- `startTime`: Valid initial timestamp format.
- `endTime`: Valid concluding timestamp format.
- `duration`: Calculated absolute elapsed ms.
- `notes`: Collection `[]` of strictly bounded `NoteEvent` structures.
- `activeDuration` (derived): Sum of all valid note durations within the session.
- `gapDuration` (derived): Remaining time after subtracting `activeDuration` from `duration`.

### Backward Compatibility Rule
- Existing persisted sessions that do not contain `name` must remain valid.
- UI layers should derive fallback labels as `Session #<index>` without mutating historical records unless user edits the name.
- Existing notes that do not contain `tags` must remain valid and should render as having no tags until the user edits them.
- Existing notes that do not contain `endTime` must remain valid and should derive their closing timestamp from `startTime + duration` when needed.
- Existing notes that do not contain pitch-intelligence fields must remain valid and should derive empty or zero-valued pitch metadata until pitch data is available.

### `NoteEvent` Type Structure
- `startTime`: Valid initial timestamp format mapped within the parent session time range.
- `endTime`: Valid concluding timestamp format mapped within the parent session time range.
- `duration`: Calculated elapsed ms tracking the unbroken trigger duration.
- `avgFrequency`: Derived mean frequency in Hz computed from valid pitch frames captured inside the note. Defaults to `0` when no valid pitch frames exist.
- `detectedNotes`: Ordered array of unique mapped note labels observed inside the note. Defaults to `[]` when no valid pitch frames exist.
- `dominantNote`: Dominant mapped note label string for the note. Defaults to `''` when no valid pitch frames exist.
- `label`: Standard editable system string mapping context definitions.
- `description`: Standard editable system string mapping expanded user inputs.
- `tags`: Editable array of short label strings, typically normalized from a comma-separated user input.
- `debugFrequencyRaw`: Transient live-only raw FFT frequency candidate in Hz used for debug visualization. Must not be persisted.
- `debugFrequencyHPS`: Transient live-only HPS-derived fundamental frequency in Hz used for debug visualization. Must not be persisted.
- `debugConfidence`: Transient live-only confidence score for the current fundamental estimate. Must not be persisted.

### Transient Psychoacoustic Frame Fields
- `mfcc`: Frame-based array of MFCC coefficients used for psychoacoustic note validation. Must not be persisted.
- `mappedNote`: Frame-based psychoacoustic note candidate string. Must not be persisted.
- `midiValue`: Frame-based continuous MIDI value used before note quantization. Must not be persisted.
- `noteConfidence`: Frame-based confidence score for the current psychoacoustic note candidate. Must not be persisted.
- These fields may appear in live analysis snapshots, but serialization layers must omit them when writing Session or NoteEvent records to storage.
- If historical records do not contain these fields, renderers should treat them as absent without mutating the stored data.

### Transient Debug Field Rule
- The debug frequency fields exist only for live visualization and debug surfaces.
- Serialization layers must omit them when writing Session or NoteEvent records to storage.
- If historical records do not contain these fields, renderers should treat them as absent without mutating the stored data.

## Learning System Models

### `LearningSequence` Type Structure
- Ordered array of learning timeline entries.
- Each entry contains `note`, `startTimeMs`, and `durationMs`.
- `note` may be `null` to represent a rest.
- Entries must remain sequential and non-overlapping.

### `ComparisonResult` Type Structure
- `pitchMatch`: Boolean flag indicating pitch alignment quality.
- `timingErrorMs`: Absolute timing delta in milliseconds.
- `durationMatch`: Boolean flag indicating duration alignment quality.
- `confidence`: Normalized comparison confidence.

### `SessionScore` Type Structure
- `pitchAccuracy`: Normalized pitch accuracy score.
- `timingAccuracy`: Normalized timing accuracy score.
- `durationAccuracy`: Normalized duration accuracy score.
- `overallScore`: Combined session score derived from the three accuracy dimensions.

### Data Model Rules
- LearningSequence is comparison input and must not be stored as detection output.
- ComparisonResult is derived data and must not replace Session or NoteEvent records.
- SessionScore is a derived summary and may be recomputed from the same saved inputs.
- These learning-system models are additive and must remain compatible with existing Session and NoteEvent persistence.
