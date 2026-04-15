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

## Calendar Abstract Structure
- Valid `Session` object definitions explicitly map into a valid calendar entity unit.
- Month grid cells provide click interaction for day-level drilldown.
- Day details must include time-aware placement derived from `Session.startTime` and `Session.duration`.
- Visual overlap is allowed only when actual session time intervals overlap.
