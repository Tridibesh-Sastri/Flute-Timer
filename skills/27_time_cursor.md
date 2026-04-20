# Time Cursor

## 1. Purpose
- Manage the moving comparison cursor for the learning timeline.
- Track absolute session progress against the expected sequence.

## 2. Input
- Session start time.
- Elapsed session time or comparison clock time.
- Optional playback, pause, or completion state.

## 3. Output
```js
TimeCursor = {
  currentTimeMs: number,
  sessionElapsedMs: number,
  normalizedPosition: number,
  activeIndex: number | null
}
```

## 4. Step-by-Step Logic
1. Measure elapsed time from the shared session start reference.
2. Clamp the cursor to valid session bounds.
3. Advance the cursor continuously while the session is active.
4. Locate the current expected timeline segment.
5. Preserve a stable cursor state when the session is paused or finished.
6. Keep the cursor deterministic for the same time input sequence.

## 5. Constraints
- Do not animate the cursor through UI code.
- Do not depend on audio capture or analyzer frames.
- Do not introduce long-term history beyond the current session context.
- The cursor must remain a comparison aid only.

## 6. Edge Cases
- Rests should not stop the cursor.
- Paused sessions should preserve the last valid cursor position.
- End-of-session state should clamp to the final timeline boundary.
- Zero-length sequences should return a safe neutral cursor state.
