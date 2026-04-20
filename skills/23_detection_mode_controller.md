# Detection Mode Controller

## 1. Input
- Recent frequency delta values.
- Short stability history from the active live note stream.
- Current confidence or note-lock context when available.

## 2. Output
```js
detectionMode
```

## 3. Modes
- Stable Mode
- Fast Mode

## 4. Step-by-Step Logic
1. Read the current frequency delta and recent stability trend.
2. Use Stable Mode when the note is holding steady with only small motion.
3. Switch to Fast Mode when a large jump or clear transition appears.
4. Allow the controller to shrink smoothing latency in Fast Mode.
5. Allow the controller to expand smoothing confidence in Stable Mode.
6. Return to Stable Mode once the new note has enough support.

## 5. Constraints
- Keep the controller short-window and frame-based.
- Do not introduce long-term pitch memory.
- Do not alter FFT, HPS, or note mapping behavior.
- Mode selection should stay deterministic for the same frame sequence.

## 6. Edge Cases
- Small drift inside one note should remain in Stable Mode.
- A real note jump should move to Fast Mode quickly.
- Repeated frames with no change should not oscillate modes.
- Noisy input should fall back to Stable Mode only after the pitch settles.
