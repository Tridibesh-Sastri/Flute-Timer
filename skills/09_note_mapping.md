# Note Mapping

## Sub-Skill: Frequency to Note Formula

### 1. Purpose
Converts a valid pitch frequency into a deterministic note label.

### 2. APIs / Concepts Used
- `Math.log2`
- MIDI semitone numbering
- fixed note-name array with sharps only

### 3. Step-by-Step Implementation
1. Accept only frequencies from 27.5 Hz through 4186.01 Hz inclusive.
2. Calculate `midiNumber = round(69 + 12 * log2(f / 440))`.
3. Calculate `noteIndex = ((midiNumber % 12) + 12) % 12`.
4. Calculate `octave = floor(midiNumber / 12) - 1`.
5. Build `noteLabel` as `NOTE_NAMES[noteIndex] + octave`.
6. If the frequency is outside the valid range, return an empty label.

### 4. Inputs / Outputs
- **Inputs**: one valid pitch frequency.
- **Outputs**: one deterministic note label or empty result.

### 5. Edge Cases
- Exact boundary frequency: include it.
- Frequency outside the valid range: reject it.

### 6. Constraints
- No enharmonic spelling variants.
- Sharps only.

---

## Sub-Skill: Octave Calculation

### 1. Purpose
Places the mapped note label into the correct octave.

### 2. APIs / Concepts Used
- integer division
- floor calculation

### 3. Step-by-Step Implementation
1. Use the rounded MIDI number from the frequency-to-note formula.
2. Calculate the octave as `floor(midiNumber / 12) - 1`.
3. Append the octave number directly to the note name.
4. Keep the octave value unchanged for the same MIDI number.

### 4. Inputs / Outputs
- **Inputs**: rounded MIDI number.
- **Outputs**: octave number embedded in the note label.

### 5. Edge Cases
- Negative or invalid MIDI numbers are not expected inside the valid pitch range.

### 6. Constraints
- Octave derivation must stay aligned with the canonical MIDI formula.

---

## Sub-Skill: Note Rounding Logic

### 1. Purpose
Ensures the pitch-to-note conversion is deterministic at semitone boundaries.

### 2. APIs / Concepts Used
- nearest integer rounding
- tie-to-upper-semitone rule

### 3. Step-by-Step Implementation
1. Round the MIDI value to the nearest integer semitone.
2. If the value lies exactly halfway between two semitones, choose the higher semitone.
3. Use the rounded MIDI number for both note name and octave.
4. Keep the note label stable for equal input frequencies.

### 4. Inputs / Outputs
- **Inputs**: valid pitch frequency.
- **Outputs**: one rounded note label.

### 5. Edge Cases
- Near-boundary values must not oscillate between adjacent notes within the same frame.

### 6. Constraints
- No alternate spellings or user-facing heuristics.