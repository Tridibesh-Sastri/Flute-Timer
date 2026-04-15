# Breath Analysis

## Sub-Skill: Silence Gap Detection

### 1. Purpose
Determines when a note should close after sustained silence.

### 2. APIs / Concepts Used
- RMS threshold comparison
- 300 ms silence delay
- note-active state

### 3. Step-by-Step Implementation
1. When RMS falls below the stop threshold, start the silence gap timer.
2. If the silence gap timer reaches 300 ms, close the active NoteEvent.
3. If RMS rises back above the stop threshold before 300 ms elapses, clear the silence gap timer.
4. Keep the current NoteEvent open while the silence gap timer has not completed.
5. Force-close the note if the Session ends before the silence timer completes.

### 4. Inputs / Outputs
- **Inputs**: current RMS value and active note state.
- **Outputs**: silence timer start, silence timer cancel, or note closure.

### 5. Edge Cases
- Rapid flicker below the stop threshold: must not close the note unless silence lasts the full delay.

### 6. Constraints
- Silence detection must not create extra notes.

---

## Sub-Skill: Continuous Play Detection

### 1. Purpose
Keeps one NoteEvent open across non-silent airflow and breath activity.

### 2. APIs / Concepts Used
- active note state
- RMS gate
- breath classification flag

### 3. Step-by-Step Implementation
1. Treat any frame above the stop threshold as continuous play.
2. Treat a breath-dominant frame inside an active note as continuous play as long as the silence gap timer has not completed.
3. Do not close the note while valid sound or breath continues.
4. Close the note only when the silence gap detection rule completes.
5. Reset the continuity logic on note closure.

### 4. Inputs / Outputs
- **Inputs**: active note state, RMS result, breath classification result.
- **Outputs**: continuous-play or note-close decision.

### 5. Edge Cases
- Breath-only continuation: note stays open, but pitch metadata remains empty unless valid pitch frames appear later.

### 6. Constraints
- Breath activity must not fragment one continuous note into multiple notes.

---

## Sub-Skill: Breath Duration Logic

### 1. Purpose
Tracks how much of a note is breath-dominant while keeping timing deterministic.

### 2. APIs / Concepts Used
- breath-dominant frame classification
- note duration accounting

### 3. Step-by-Step Implementation
1. Mark each breath-dominant frame that occurs inside an active NoteEvent.
2. Accumulate breath duration from those frame spans.
3. Include breath duration inside the note's total duration because the note remains continuous.
4. Exclude breath-dominant frames from pitch aggregates and note label counts.
5. If a note contains only breath-dominant frames, keep the note valid and finalize pitch metadata as empty values.

### 4. Inputs / Outputs
- **Inputs**: breath-dominant frame spans inside one active note.
- **Outputs**: derived breath duration and unchanged note timing.

### 5. Edge Cases
- Interleaved breath and pitch frames: breath duration remains part of the same note window.

### 6. Constraints
- Breath duration must not modify Session duration.
- Breath duration must not mutate dominant note selection.