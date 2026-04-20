# Learning System

## Scope
- Defines the Learning & Comparison Engine as an additive layer on top of the existing Session and NoteEvent system.
- Compares an expected learning sequence against the user's recorded session timeline.
- Produces comparison results, accuracy metrics, feedback state, and session scores without modifying audio detection logic.

## 1. Learning Sequence Model

```js
LearningSequence = [
  {
    note: string | null,
    startTimeMs: number,
    durationMs: number
  }
]
```

### Rules
- Timing must be sequential.
- `note = null` is allowed to represent rest.
- Entries must not overlap.
- Each entry is measured in absolute milliseconds from the session start.

## 2. Timeline Model

### Components
```text
Expected Timeline
User Timeline
Time Cursor
```

### Rules
- Time is absolute from session start.
- The time cursor moves continuously.
- The expected timeline defines the target sequence.
- The user timeline reflects recorded Session output.
- Comparison occurs against aligned timeline positions rather than raw audio frames.

## 3. Comparison Model

### Input
- `expectedNote`
- `actualNote`
- `timestamp`

### Output
```js
ComparisonResult = {
  pitchMatch: boolean,
  timingErrorMs: number,
  durationMatch: boolean,
  confidence: number
}
```

### Rules
- `pitchMatch` indicates whether the actual note matches the expected note or falls within the allowed pitch tolerance.
- `timingErrorMs` measures the absolute delta between expected and actual timing positions.
- `durationMatch` indicates whether the actual duration falls within the accepted duration tolerance.
- `confidence` is a normalized comparison score used by the feedback and score models.

## 4. Accuracy Model

### Accuracy Dimensions
- Pitch Accuracy
- Timing Accuracy
- Duration Accuracy

### Rules
- A direct note match counts as a full pitch match.
- A note within ±1 semitone counts as a partial pitch match.
- Timing tolerance is ±50ms.
- Duration accuracy compares the expected duration against the actual segment duration.
- Accuracy results remain separate from raw detection confidence.

## 5. Feedback Model

### Feedback Types
- Real-time feedback
- Color mapping
- Text feedback

### Rules
- Real-time feedback must reflect the current comparison state while the Session is active.
- Color mapping may indicate match quality, timing drift, or rest handling.
- Text feedback may summarize pitch, timing, and duration status in human-readable form.
- Feedback must not alter the stored Session or NoteEvent data.

## 6. Score Model

### Output
```js
SessionScore = {
  pitchAccuracy: number,
  timingAccuracy: number,
  durationAccuracy: number,
  overallScore: number
}
```

### Rules
- Each score component is normalized.
- `overallScore` is derived from the accuracy dimensions.
- Session scores are comparison outputs, not source-of-truth playback data.
- Score results may be recalculated from the same saved Session and LearningSequence inputs.

## 7. Separation Rule

```text
Audio System → Detection ONLY
Learning System → Comparison ONLY
```

### Rules
- The Audio System must continue to own note detection, frame analysis, and note extraction.
- The Learning System must only consume completed Session data and the expected learning sequence.
- The Learning System must not introduce or modify detection thresholds, pitch extraction, or audio capture behavior.
- Learning outputs must remain additive and must not change stored detection results.
