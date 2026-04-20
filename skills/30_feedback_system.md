# Feedback System

## 1. Purpose
- Generate real-time learning feedback from comparison and accuracy data.
- Expose semantic feedback values for downstream presentation layers.

## 2. Input
- `ComparisonResult`
- `AccuracyModel`
- Cursor or alignment state when available

## 3. Output
```js
FeedbackState = {
  pitchState: string,
  timingState: string,
  durationState: string,
  colorKey: string,
  text: string,
  confidence: number
}
```

## 4. Step-by-Step Logic
1. Read the current comparison state for the active timeline position.
2. Map pitch, timing, and duration outcomes to semantic feedback states.
3. Convert the current feedback state into a stable color key.
4. Produce text feedback that summarizes the current match quality.
5. Keep the feedback aligned to the current learning cursor.
6. Preserve deterministic output for the same comparison input.

## 5. Constraints
- Do not render UI or manipulate DOM nodes.
- Do not read audio frames or detection thresholds.
- Do not change source session data or comparison results.
- Feedback should be descriptive output only.

## 6. Edge Cases
- Rest segments should produce neutral or context-aware feedback.
- Low-confidence comparisons should avoid overconfident feedback states.
- Rapid updates should not oscillate color or text unnecessarily.
- Missing comparison data should fall back to a neutral state.
