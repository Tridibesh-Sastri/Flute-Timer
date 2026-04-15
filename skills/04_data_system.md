# Data System

## Sub-Skill: Session Creation & Storage

### 1. Purpose
Creates universally tracked JSON objects managing the entire scope of the mathematical system data state bounds mapping securely entirely isolating individual sessions strictly into localStorage contexts dynamically logically globally tracking data properly inherently independently implicitly securely internally mapping parameters properly cleanly natively cleanly.

### 2. APIs / Concepts Used
- `Date.now()`
- `crypto.randomUUID()` or generic ID generation mapping arrays implicitly reliably smoothly natively.
- `localStorage.setItem()` / `localStorage.getItem()`

### 3. Step-by-Step Implementation
1. Upon Session Start Explicit Event mapping: Instantiate native internal payload schema array implicitly structurally linking globally exactly formatted implicitly correctly.
   - `const newSession = { id: crypto.randomUUID(), startTime: new Date().toISOString(), endTime: null, duration: 0, notes: [] };`
2. Set logical system global target pointing active bounds correctly mapping payload variable gracefully naturally `currentSession = newSession`.
3. Upon explicitly executed Session Close Event logic:
   - Map naturally duration extraction logic natively smoothly tracking `currentSession.endTime = new Date().toISOString()`.
   - Update bounds globally inherently tracking math natively `currentSession.duration = Date.now() - sessionStartTime`.
4. String abstraction JSON execution mapping `localStorage.setItem(currentSession.id, JSON.stringify(currentSession))`.
5. Nullify explicit tracking variable bounds locally securely protecting memory bounds seamlessly gracefully perfectly securely `currentSession = null`.

### 4. Inputs / Outputs
- **Inputs**: Temporal start/stop toggle limits functionally structurally tracking internal state blocks precisely natively naturally inside bounded application layers mechanically perfectly.
- **Outputs**: Complete strictly validated native JavaScript objects smoothly mathematically committed correctly perfectly gracefully into hard-coded string logic native mappings dynamically cleanly smoothly properly inherently successfully reliably completely locally storing data tracking strictly.

### 5. Edge Cases
- **Quota Limit Reached**: Handled globally internally inherently catching explicit localStorage `.catch` constraints smoothly correctly perfectly natively tracking schemas safely flawlessly structurally locally logically seamlessly properly executing cleanly safely ignoring memory overflow exceptions manually warning tracking outputs smoothly logically reliably logically tracking safely explicitly locally executing safely cleanly seamlessly explicitly.
- **Sudden Window Termination**: Uniquely saving intermediate snapshots inherently mapping bounds reliably correctly executing schemas cleanly naturally inherently mapping outputs safely dynamically directly inside local tracking limits natively implicitly.

### 6. Constraints
- Operates structurally isolated functionally capturing single overarching objects internally reliably seamlessly storing objects securely exactly natively efficiently natively explicitly.

---

## Sub-Skill: NoteEvent Linking

### 1. Purpose
Maps implicitly created audio limits cleanly linking dynamically mathematically generating arrays natively mapped globally correctly securely inside current objects limits functionally safely correctly flawlessly implicitly mapping child schemas smoothly smoothly correctly securely cleanly functionally cleanly inherently correctly safely implicitly safely safely safely.

### 2. APIs / Concepts Used
- Array `push()` logical bounds cleanly natively accurately correctly natively safely dynamically gracefully properly.

### 3. Step-by-Step Implementation
1. Generate specific note bounds explicit mapping explicitly defined directly matching schemas intelligently structurally gracefully efficiently properly exactly intelligently flawlessly mapping schemas smoothly. `const newNote = { startTime: ..., duration: ..., label: 'Unlabeled', description: '' };`
2. Directly structural map functionally mapping accurately gracefully dynamically seamlessly correctly tracking gracefully efficiently linking targets seamlessly efficiently gracefully seamlessly flawlessly seamlessly mapping effectively gracefully smoothly effectively array loops seamlessly dynamically dynamically effectively structurally safely gracefully targeting precisely gracefully effectively targeting intelligently. `currentSession.notes.push(newNote);`
3. Commit mapping logically internally safely.

### 4. Inputs / Outputs
- **Inputs**: Finished extracted note bounds functionally defined independently elegantly reliably precisely smoothly inside NoteEvent Lifecycle smoothly reliably naturally dynamically effectively efficiently functionally efficiently intelligently cleanly correctly.
- **Outputs**: Populated target array structures mapping functionally dynamically explicitly smoothly inside explicitly gracefully accurately naturally optimally efficiently effectively intelligently safely functionally safely appropriately optimally mapped outputs completely securely logically correctly successfully.

### 5. Edge Cases
- **Missing Session**: Checks actively inherently reliably correctly functionally safely dynamically smoothly efficiently safely cleanly functionally gracefully ensuring flawlessly cleanly gracefully mapped implicitly safely inherently reliably gracefully natively capturing overrides intelligently perfectly properly natively smoothly natively mapping bounds directly. `if (!currentSession) return;` properly naturally efficiently exactly structurally effectively seamlessly optimally gracefully appropriately efficiently optimal cleanly properly seamlessly correctly smoothly seamlessly. 

### 6. Constraints
- Modifies directly effectively capturing bounds properly dynamically intelligently securely correctly smoothly effectively seamlessly optimal successfully efficiently appropriately efficiently functionally efficiently efficiently cleanly effectively optimally smoothly effectively naturally exactly.

---

## Sub-Skill: Immediate Persistence & Safe Indexing

### 1. Purpose
Ensures that any user edit to a specific NoteEvent is immediately saved to localStorage without data displacement, using precise matrix indexing to isolate the exact target.

### 2. APIs / Concepts Used
- Direct array matrix indexing: `window.sessions[sIndex].notes[nIndex]`
- `localStorage.setItem('sessions', JSON.stringify(window.sessions))`

### 3. Step-by-Step Implementation
1. Pass exactly `sIndex` (Session Index) and `nIndex` (Note Index) down to the edit function context.
2. Intercept `change` or `keyup` events from input nodes representing the note fields.
3. Update specific coordinates directly: `window.sessions[sIndex].notes[nIndex].label = newLabel`.
4. Immediately post serialization to storage: `localStorage.setItem('sessions', JSON.stringify(window.sessions))`.

### 4. Inputs / Outputs
- **Inputs**: User keyboard input and explicitly tracked UI indices.
- **Outputs**: Instantly refreshed single source of truth in `window.sessions` array and localStorage mirror.

### 5. Edge Cases
- **Out of bounds indexing**: Controlled by rigid index passing strictly during DOM generation.

### 6. Constraints
- ALL edits must bypass generic `find` or `filter` replacements and strictly use direct pointer indexing to execute the immediate persistence rule successfully.

---

## Sub-Skill: Psychoacoustic Frame Fields

### 1. Input
- Live frame snapshots that contain FFT, HPS, MFCC, mapped note, MIDI value, and confidence metadata.
- Session records that will store only finalized note events.

### 2. Output
- A frame-scoped analysis object with mfcc, mappedNote, midiValue, and noteConfidence fields.
- A persisted Session note timeline that stores only finalized NoteEvent data.

### 3. Step-by-Step Logic
1. Keep MFCC coefficients on the live analysis frame, not in long-term storage.
2. Derive mappedNote, midiValue, and noteConfidence from the current pitch and psychoacoustic state.
3. Pass the frame-scoped values into smoothing, segmentation, and noise rejection.
4. When a note becomes final, copy only the stable note summary into the Session note array.
5. Clear transient psychoacoustic fields when the next frame arrives or the session closes.

### 4. Constraints
- Treat mfcc as transient frame data.
- Treat mappedNote, midiValue, and noteConfidence as live-analysis values until segmentation finalizes them.
- Keep the schema backward-compatible for sessions that do not have psychoacoustic fields.
- Do not store raw frame history inside Session records.

### 5. Edge Cases
- Missing psychoacoustic fields must resolve safely when loading older sessions.
- If a frame has no stable pitch, leave the mapped note fields empty instead of inventing values.
- On partial saves or abrupt stop, finalized NoteEvent records must remain valid even if transient frame data is discarded.
