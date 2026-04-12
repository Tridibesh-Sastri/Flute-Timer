# Intelligence Analytics

This file defines the strict mathematical metrics computed by the system.
*Note: This strictly dictates calculations, completely ignoring visual graphing mappings or rendering specifics.*

## Target Measurements
1. **Total session duration**: Calculates sum duration values tracked inside individual sessions over targeted timestamps.
2. **Average note duration**: Computes `avg(NoteEvent.duration)` globally filtering by selected session bounds.
3. **Longest note**: Extracts `max(NoteEvent.duration)` mapping individual peak outputs.
4. **Notes per session**: Sum aggregates counting total elements nested within a Session's `.notes[]` array.
5. **Practice frequency**: Distils raw days mathematically where session counts exist at `> 0` value.

## Calendar Abstract Structure
- Valid `Session` object definitions explicitly map into a valid calendar entity unit.
- The unit length/dimension abstracts mathematically matching precisely to the parent `Session.duration`.
- An abstracted action interaction fetches child specifics based fundamentally on the clicked entity context.
