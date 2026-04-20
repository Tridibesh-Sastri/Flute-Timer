# Timeline Builder

## 1. Purpose
- Convert a structured learning sequence into timeline positions.
- Define expected and user-aligned timeline entries for comparison.

## 2. Input
- `LearningSequence` entries.
- Recorded session note data when building the user timeline.
- Absolute session start timing as the shared reference.

## 3. Output
```js
TimelineModel = {
  expectedTimeline: Array<{
    note: string | null,
    startTimeMs: number,
    endTimeMs: number
  }>,
  userTimeline: Array<{
    note: string | null,
    startTimeMs: number,
    endTimeMs: number
  }>,
  timeCursorMs: number
}
```

## 4. Step-by-Step Logic
1. Treat all timing as absolute milliseconds from session start.
2. Convert each learning entry into a timeline segment with start and end times.
3. Mirror the recorded Session note data into a comparable user timeline.
4. Keep rests as valid timeline segments with `note = null`.
5. Preserve chronological order and reject overlaps.
6. Keep the cursor aligned to the same session time reference.

## 5. Constraints
- Do not render the timeline.
- Do not alter note detection or audio timing.
- Do not infer timing from UI layout or screen position.
- Keep timeline output compatible with later comparison and feedback steps.

## 6. Edge Cases
- Zero-duration entries should remain bounded and non-overlapping.
- Missing user notes should produce gaps rather than invented data.
- Repeated notes must stay as distinct sequential segments when their times differ.
- Rests should advance the timeline like any other segment.
