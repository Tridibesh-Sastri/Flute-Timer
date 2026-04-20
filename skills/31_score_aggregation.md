# Score Aggregation

## 1. Purpose
- Aggregate learning comparisons into a session-level score.
- Produce a single `SessionScore` summary from the component accuracy metrics.

## 2. Input
- `AccuracyModel`
- One or more `ComparisonResult` values
- Optional weighting policy when a caller needs non-default emphasis

## 3. Output
```js
SessionScore = {
  pitchAccuracy: number,
  timingAccuracy: number,
  durationAccuracy: number,
  overallScore: number
}
```

## 4. Step-by-Step Logic
1. Collect the normalized pitch, timing, and duration accuracy values.
2. Preserve the component scores without changing their meaning.
3. Compute the overall score from the component metrics.
4. Keep the aggregation deterministic for the same inputs.
5. Allow the final score to be recomputed from the saved learning outputs.
6. Return the score as derived session summary data.

## 5. Constraints
- Do not read raw audio or pitch-detection frames.
- Do not mutate Session timing or note storage.
- Do not replace `ComparisonResult` or `AccuracyModel` with the score summary.
- Keep the aggregation additive and comparison-only.

## 6. Edge Cases
- Empty comparison sets should return a safe neutral score model.
- Rest-heavy sessions should still produce meaningful timing and duration scores.
- Recomputing the same inputs should yield the same score.
- Partial sequence completion should not fabricate missing results.
