# Analytics Prep

## Sub-Skill: Pure CSS Bar Chart Rendering

### 1. Purpose
Render meaningful analytics charts without external chart libraries.

### 2. APIs / Concepts Used
- DOM templating
- CSS width percentages (`style="width: X%"`)
- Flex and Grid layouts

### 3. Step-by-Step Implementation
1. Compute normalized values from session aggregates.
2. Build rows containing label, track, fill, and numeric value.
3. Set fill width by percentage (`width: ${pct}%`).
4. Keep chart read-only and fully derived from persisted sessions.

### 4. Inputs / Outputs
- **Inputs**: Aggregated numeric metrics.
- **Outputs**: Lightweight CSS bars with no canvas dependency.

### 5. Edge Cases
- Empty datasets should render zero-state values, not NaN widths.

### 6. Constraints
- No Chart.js, D3, or any external chart package.

---

## Sub-Skill: Calendar Grid + Day Timeline

### 1. Purpose
Provide month navigation and day-level session inspection with time-aware visual placement.

### 2. APIs / Concepts Used
- CSS Grid for month cells
- Click handlers for day selection
- Absolute positioning for day timeline blocks

### 3. Step-by-Step Implementation
1. Render month grid with day headers and date cells.
2. Highlight cells that contain sessions.
3. On day click, render side detail including session list and day timeline.
4. Convert each session to minute-of-day start/end.
5. Place blocks vertically by start time and height by duration.
6. Compute overlap groups so only truly overlapping sessions share horizontal space.

### 4. Inputs / Outputs
- **Inputs**: Session timestamps and durations.
- **Outputs**: Interactive day inspection view with overlap-correct placement.

### 5. Edge Cases
- Sessions that cross midnight should clamp to visible day range.
- Missing end time should fallback to `start + duration` when possible.

### 6. Constraints
- Keep interaction lightweight and local to dashboard rendering only.

---

## Sub-Skill: Pitch Stability Calculation

### 1. Purpose
Converts note-level pitch samples into a deterministic stability score.

### 2. APIs / Concepts Used
- arithmetic mean
- population variance
- square root

### 3. Step-by-Step Implementation
1. Collect the valid pitch frequencies for one note only.
2. If the note has no valid pitch samples, assign stability score 0.
3. Calculate `avgFrequency = sum(frequencies) / count`.
4. Calculate `varianceHz = sum((frequency - avgFrequency)^2) / count`.
5. Calculate `stdDevHz = sqrt(varianceHz)`.
6. Calculate `notePitchStability = max(0, 1 - (stdDevHz / max(avgFrequency, 1)))`.
7. For a session or summary scope, average all notePitchStability values.

### 4. Inputs / Outputs
- **Inputs**: valid pitch samples per note.
- **Outputs**: notePitchStability and aggregate pitch stability score.

### 5. Edge Cases
- Single-sample note: stability score is 1 when the sample is valid.
- All samples zero or missing: stability score is 0.

### 6. Constraints
- Use population variance only.
- Do not include breath-dominant frames in pitch samples.

---

## Sub-Skill: Note Distribution Aggregation

### 1. Purpose
Counts the dominant note labels across a scope.

### 2. APIs / Concepts Used
- frequency map
- ordered note labels

### 3. Step-by-Step Implementation
1. Read `dominantNote` from each note in scope.
2. Ignore notes whose dominantNote is empty.
3. Increment the count for each dominantNote.
4. Keep total note duration per label for tie breaking.
5. Select the label with the highest count as most played note.
6. If counts tie, choose the label with the higher cumulative duration.
7. If duration also ties, choose the alphabetically earliest label.

### 4. Inputs / Outputs
- **Inputs**: note list with dominantNote and duration values.
- **Outputs**: note distribution map and most played note label.

### 5. Edge Cases
- Empty scope: return an empty map and blank most played note.
- Notes with empty dominantNote: exclude from counts.

### 6. Constraints
- Read-only aggregation only.

---

## Sub-Skill: Variance Calculation

### 1. Purpose
Computes deterministic spread metrics for pitch stability and average frequency.

### 2. APIs / Concepts Used
- population variance formula
- arithmetic mean

### 3. Step-by-Step Implementation
1. Build the numeric input set for the requested metric.
2. If the set is empty, return 0.
3. If the set contains only zeros, return 0.
4. Calculate the arithmetic mean.
5. Calculate the sum of squared deviations from the mean.
6. Divide by the number of values to get population variance.
7. Use the same rule set for both stability variance and frequency variance.

### 4. Inputs / Outputs
- **Inputs**: notePitchStability values or avgFrequency values.
- **Outputs**: variance value.

### 5. Edge Cases
- Single value: variance is 0.
- Mixed zero and non-zero values: zeros participate unless the rule for the requested metric excludes them.

### 6. Constraints
- No sample weighting.
- No rounding until presentation time.
