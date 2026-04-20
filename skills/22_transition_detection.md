# Transition Detection

## 1. Input
- Current frequency from the live note-analysis frame.
- Previous frequency from the immediately preceding valid frame.
- Optional frame confidence or stability context when available.

## 2. Output
```js
{
  isTransition: boolean,
  deltaFrequency: number
}
```

## 3. Step-by-Step Logic
1. Compute the absolute frequency delta between the current and previous frames.
2. Compare the delta against a short transition threshold.
3. Mark the frame as a transition only when the delta is large enough to indicate a real note jump.
4. Treat small fluctuations as continuity so the note does not flap.
5. Keep the decision frame-based and deterministic.

## 4. Constraints
- Ignore micro fluctuations inside a sustained note.
- Do not use long-range history or scale awareness.
- Keep the detection additive so it can gate smoothing and segmentation without replacing them.
- Prefer stable continuity unless the pitch jump is clearly musical.

## 5. Edge Cases
- Vibrato should stay below the transition threshold.
- A deliberate leap between notes should trigger immediately.
- Missing frames should not invent a transition by themselves.
- Noise spikes should be rejected by the surrounding confidence gates before they become transitions.
