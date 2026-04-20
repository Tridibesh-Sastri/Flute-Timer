# Note Comparison

## 1. Purpose
- Compare an expected note against an actual note.
- Produce a compact comparison result for scoring and feedback.

## 2. Input
- `expectedNote`
- `actualNote`
- `timestamp`

## 3. Output
```js
ComparisonResult = {
  pitchMatch: boolean,
  timingErrorMs: number,
  durationMatch: boolean,
  confidence: number
}
```

## 4. Step-by-Step Logic
1. Compare the expected and actual notes using the shared learning sequence rules.
2. Treat exact pitch matches as direct alignment.
3. Treat near matches within the allowed pitch tolerance as acceptable comparison matches.
4. Measure the absolute timing error in milliseconds.
5. Evaluate the duration relationship against the expected note duration.
6. Emit a normalized confidence value from the comparison state.

## 5. Constraints
- Do not read or modify audio frames.
- Do not depend on DOM state or visual presentation.
- Do not change the source session data.
- Comparison must operate on completed learning/session data only.

## 6. Edge Cases
- A rest compared with a note should count as a mismatch.
- Missing actual notes should return a low-confidence mismatch result.
- Timing drift should be measured even when pitch matches.
- Duplicate expected notes must be compared in sequence, not merged.
