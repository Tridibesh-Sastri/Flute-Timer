# Psychoacoustic Note Mapping

## 1. Input
- One candidate frequency from HPS or a smoothed pitch bin.
- The current frame confidence and the live psychoacoustic frame metadata.

## 2. Output
- A stable note label such as A4.
- A rounded MIDI value and octave for downstream binning.
- A mapped-note confidence value that can be forwarded to segmentation.

## 3. Step-by-Step Logic
1. Reject non-positive frequencies immediately.
2. Reject frequencies outside the musical range used by the live note pipeline.
3. Compute midiValue = round(69 + 12 * log2(f / 440)).
4. Derive the note index from the rounded MIDI value.
5. Derive the octave from the rounded MIDI value.
6. Build the note label with sharps only.
7. Attach the mapped note and MIDI value to the current live frame for downstream consumers.

## 4. Constraints
- Use 12-TET only.
- Do not emit enharmonic spellings.
- Keep note mapping deterministic for the same input frequency.
- Do not remap the note after segmentation has started unless the input frequency itself changes.

## 5. Edge Cases
- Frequencies that land exactly on a semitone boundary must resolve consistently.
- Frequencies outside the accepted range must return no label instead of a guessed note.
- Vibrato inside one sustained note should not create label churn if smoothing keeps the same bin.
- If the frame confidence is too low, the note label should remain empty even if the formula can be computed.