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
- `startTime`: Valid initial timestamp format.
- `endTime`: Valid concluding timestamp format.
- `duration`: Calculated absolute elapsed ms.
- `notes`: Collection `[]` of strictly bounded `NoteEvent` structures.

### `NoteEvent` Type Structure
- `startTime`: Valid initial timestamp format mapped within the parent session time range.
- `duration`: Calculated elapsed ms tracking the unbroken trigger duration.
- `label`: Standard editable system string mapping context definitions.
- `description`: Standard editable system string mapping expanded user inputs.
