# Rapid Note Handling

## 1. Purpose
Handle repeated notes, fast flicker, and short re-articulations without fragmenting the live note stream.

## 2. Input
- Rapidly changing note labels.
- Transition-detection output.
- Smoothing and note-lock state from the current live analysis window.

## 3. Output
- A stable handling decision for repeated or flickering notes.
- Guidance for whether the current candidate should be held, reopened, or promoted immediately.

## 4. Step-by-Step Logic
1. Treat a repeated note as continuity if it reappears within the active stability window.
2. Suppress single-frame flicker when the surrounding frames still support the same note.
3. Allow immediate reopening when a valid repeated attack clearly starts a new note.
4. Prefer the locked note when confidence is high and the pitch center has not meaningfully moved.
5. Promote the new candidate quickly when a real jump or repeated attack survives the fast path.

## 5. Constraints
- Keep the behavior additive and short-window only.
- Do not merge unrelated notes across silence gaps.
- Do not rely on historical phrase analysis.
- Preserve deterministic note segmentation for the same input sequence.

## 6. Edge Cases
- Fast trills should not collapse into one unrelated note.
- Repeated identical notes should not be split by a brief unstable frame.
- A short pause inside the same note should not force fragmentation if the active note remains supported.
- Breath noise should not reopen notes on its own.
