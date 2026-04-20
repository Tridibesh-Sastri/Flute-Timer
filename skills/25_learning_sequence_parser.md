# Learning Sequence Parser

## 1. Purpose
- Parse user-authored text into a structured `LearningSequence`.
- Normalize note and rest descriptions into sequential timeline entries.

## 2. Input
- Plain text entered by the user.
- Optional separators, labels, or timing markers.
- Existing learning-session context when needed to anchor absolute timing.

## 3. Output
```js
LearningSequence = [
  {
    note: string | null,
    startTimeMs: number,
    durationMs: number
  }
]
```

## 4. Step-by-Step Logic
1. Normalize whitespace, separators, and line breaks.
2. Read the user text in order and extract note or rest tokens.
3. Convert each valid token into a sequential sequence entry.
4. Resolve timing into absolute milliseconds from session start.
5. Preserve the original order of the learning passage.
6. Reject malformed fragments without inventing new timing relationships.

## 5. Constraints
- Do not parse live audio or frame data.
- Do not introduce UI-specific behavior.
- Keep the result additive, deterministic, and non-overlapping.
- `note = null` must represent an explicit rest.

## 6. Edge Cases
- Blank lines should be ignored.
- Consecutive rests are allowed.
- Invalid tokens must not shift later entries unless the input format explicitly defines that behavior.
- Duplicate notes remain separate when their timing differs.
