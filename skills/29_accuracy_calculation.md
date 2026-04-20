# Accuracy Calculation

## 1. Purpose
- Compute pitch, timing, and duration accuracy from comparison data.
- Convert per-note comparison outcomes into normalized accuracy scores.

## 2. Input
- One or more `ComparisonResult` values.
- Optional expected and actual duration totals when available.

## 3. Output
```js
AccuracyModel = {
  pitchAccuracy: number,
  timingAccuracy: number,
  durationAccuracy: number
}
```

## 4. Step-by-Step Logic
1. Aggregate comparison outcomes across the relevant learning sequence.
2. Assign full pitch credit to exact matches.
3. Assign partial pitch credit to matches within ±1 semitone.
4. Score timing using the ±50ms tolerance rule.
5. Score duration using the expected-versus-actual segment length relationship.
6. Clamp every score to the normalized range from 0 to 1.

## 5. Constraints
- Do not calculate from raw audio.
- Do not rely on UI timing or screen refresh rate.
- Do not mutate the stored Session or NoteEvent records.
- Keep the calculation deterministic for the same comparison inputs.

## 6. Edge Cases
- Rests should contribute to timing and duration evaluation when part of the expected sequence.
- Zero-duration comparisons should not divide by zero.
- Missing actual data should lower the score rather than inventing a match.
- Scores should remain stable across repeated evaluations of the same input.
