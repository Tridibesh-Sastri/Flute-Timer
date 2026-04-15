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

### `NoteEvent` Type Structure
- `startTime`: Valid initial timestamp format mapped within the parent session time range.
- `endTime`: Valid concluding timestamp format mapped within the parent session time range.
- `duration`: Calculated elapsed ms tracking the unbroken trigger duration.
- `label`: Standard editable system string mapping context definitions.
- `description`: Standard editable system string mapping expanded user inputs.
- `tags`: Editable array of short label strings, typically normalized from a comma-separated user input.
