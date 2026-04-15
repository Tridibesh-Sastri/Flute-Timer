# Note Segmentation

## 1. Input
- Smoothed note candidates, stable MIDI bins, timestamps, and confidence scores.
- The live session state and the currently active note segment, if one exists.

## 2. Output
- Final NoteEvent objects with note, startTime, endTime, and confidence.
- A stable note timeline that can be stored in the Session record.

## 3. Step-by-Step Logic
1. Start a candidate segment when a note survives the smoothing and noise gates.
2. Keep the segment open while the same stable note continues to dominate the live frames.
3. Require the note to remain stable for at least 3 frames and typically 80 ms to 150 ms before finalizing it.
4. Close the segment when a different note survives smoothing, the confidence collapses, or the session ends.
5. Reject micro-spikes that do not survive the stability window.
6. Emit the final NoteEvent only after the segment is long enough to count as a real note.

## 4. Constraints
- Align segment boundaries to frame timestamps.
- Track only one active segment per live note stream.
- Do not persist raw frame history inside the note event.
- Keep the output compatible with future reference-comparison and learning systems.

## 5. Edge Cases
- A note that restarts after a short gap should open a new segment unless the gap is clearly just noise.
- If the session stops mid-note, close the note at the last valid frame timestamp.
- If a segment is shorter than the minimum stability window, discard it unless it merges cleanly into the same note.
- Breath-dominant or otherwise noisy frames should not force a segment open on their own.