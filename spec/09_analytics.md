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
