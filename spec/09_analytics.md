# Intelligence Analytics

This file defines the strict mathematical metrics computed by the system.
*Note: This strictly dictates calculations, completely ignoring visual graphing mappings or rendering specifics.*

## Target Measurements
1. **Session duration trend**: Sequence of per-session durations ordered by time.
2. **Note count per session**: Count of `Session.notes.length` for each session.
3. **Practice frequency by day**: Session counts grouped by weekday.
4. **Longest note**: Extract `max(NoteEvent.duration)`.
5. **Shortest note**: Extract `min(NoteEvent.duration)` over valid notes.
6. **Practice streak**: Consecutive days with at least one session.
7. **Active note duration per session**: `sum(NoteEvent.duration)` over valid notes within each session.
8. **Session gap duration**: `Session.duration - active note duration`, clamped to zero for display.
9. **Total active note duration**: Sum of all active note durations across all sessions.
10. **Session efficiency ratio**: `total active note duration / total session duration`.
11. **Pitch stability score**: Mean of per-note stability scores inside the requested scope.
12. **Pitch stability variance**: Variance of per-note stability scores inside the requested scope.
13. **Note distribution**: Count of `dominantNote` values inside the requested scope.
14. **Most played note**: `dominantNote` value with the highest distribution count.
15. **Frequency variance**: Variance of `avgFrequency` values inside the requested scope.

## Calendar Abstract Structure
- Valid `Session` object definitions explicitly map into a valid calendar entity unit.
- Month grid cells provide click interaction for day-level drilldown.
- Day details must include time-aware placement derived from `Session.startTime` and `Session.duration`.
- Day detail views must support zoom-in and zoom-out scaling so users can inspect start and end times with higher precision.
- Day detail views must surface both total session duration and active note duration for each session.
- Visual overlap is allowed only when actual session time intervals overlap.

## Summary Comparison Requirements
- The summary surface must compare total session duration against total active note duration so the user can distinguish real practice time from overhead time.
- The summary surface must expose the absolute gap between those two values, as well as the aggregate totals used to derive them.

## Pitch Analytics Rules
- Scope means the session set being rendered or summarized.
- For each `NoteEvent`, let `F = [f1 ... fn]` be the valid pitch samples captured for the note after excluding breath-dominant frames and out-of-range frequencies.
- If `F` is empty, the note contributes `0` to pitch stability, `''` to `dominantNote`, `[]` to `detectedNotes`, and `0` to `avgFrequency`.
- `avgFrequency = sum(F) / n`.
- `varianceHz = sum((fi - avgFrequency)^2) / n`.
- `stdDevHz = sqrt(varianceHz)`.
- `notePitchStability = max(0, 1 - (stdDevHz / max(avgFrequency, 1)))`.
- Session pitch stability score is the arithmetic mean of `notePitchStability` values across the scope.
- Pitch stability variance is the variance of `notePitchStability` values across the scope.
- Note distribution counts each `NoteEvent` once by its `dominantNote`.
- Notes with empty `dominantNote` are excluded from note distribution and most-played-note counts.
- Most played note ties are broken by higher cumulative note duration, then alphabetically ascending label.
- Frequency variance is computed from `avgFrequency` values only; notes with `avgFrequency = 0` are excluded unless all notes are zero, in which case the result is `0`.
- Breath-dominant notes are included in pitch stability as zero-valued notes if no valid pitch samples exist, but they are excluded from note distribution unless a dominant note is present.
