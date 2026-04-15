# Note Tracking

## Sub-Skill: Sampling During NoteEvent

### 1. Purpose
Collects pitch samples only while a NoteEvent is active.

### 2. APIs / Concepts Used
- active note state
- per-frame frequency results
- rolling sample buffer

### 3. Step-by-Step Implementation
1. Start a fresh note sample set when the NoteEvent begins.
2. Sample only while both the Session and the NoteEvent are active.
3. For each valid pitch frame, store the frequency and its mapped note label.
4. Ignore frames rejected by confidence, noise, or breath rules.
5. Stop collecting immediately when the NoteEvent closes or the Session ends.
6. Keep a cumulative sum and count for frequency samples so avgFrequency can be finalized without reprocessing history.

### 4. Inputs / Outputs
- **Inputs**: valid pitch frames inside the active note window.
- **Outputs**: note frequency samples and mapped note labels.

### 5. Edge Cases
- A note with no valid pitch frames must still close normally.
- Session end during a note must force sampling to stop.

### 6. Constraints
- Sampling must not mutate session duration.

---

## Sub-Skill: detectedNotes[] Population

### 1. Purpose
Builds the ordered unique list of mapped notes observed inside one NoteEvent.

### 2. APIs / Concepts Used
- ordered unique list
- first-seen preservation

### 3. Step-by-Step Implementation
1. Start with an empty detectedNotes array for each note.
2. When a mapped note label appears for the first time, append it.
3. If the label already exists in the array, keep the original order and do not add a duplicate.
4. Preserve the order of first appearance for the full note duration.
5. Leave the array empty when there are no valid pitch frames.

### 4. Inputs / Outputs
- **Inputs**: mapped note labels from valid frames.
- **Outputs**: ordered unique `detectedNotes[]`.

### 5. Edge Cases
- Rapid alternation between two labels: keep only first-seen order, not alternating duplicates.

### 6. Constraints
- No sorting.
- No duplicate labels.

---

## Sub-Skill: dominantNote Calculation

### 1. Purpose
Selects the single most representative note label for one NoteEvent.

### 2. APIs / Concepts Used
- label frequency counting
- cumulative confidence totals
- first occurrence order

### 3. Step-by-Step Implementation
1. Count how many valid frames map to each label.
2. Track cumulative confidence for each label.
3. Choose the label with the highest frame count as the dominantNote.
4. If two labels have the same count, choose the one with the higher cumulative confidence.
5. If a tie remains, choose the label that appeared first in the note.
6. If there are no valid pitch frames, set dominantNote to an empty string.
7. On note close, finalize avgFrequency as sum of valid frequencies divided by valid frequency count.

### 4. Inputs / Outputs
- **Inputs**: labeled pitch frames inside one NoteEvent.
- **Outputs**: one `dominantNote` string.

### 5. Edge Cases
- Breath-only note: dominantNote remains empty.
- Multi-note note with equal counts: apply the tie rules exactly in order.

### 6. Constraints
- Dominant note selection must remain deterministic for the same frame sequence.