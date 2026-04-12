# Timer System

## Sub-Skill: Session Timer Logic

### 1. Purpose
Manually calculates and renders the absolute running timeline metric of an overall master block user practice period.

### 2. APIs / Concepts Used
- `Date.now()`
- `setInterval`
- Native JavaScript string concatenations

### 3. Step-by-Step Implementation
1. Execute exclusively on manual "Start Session" mapping explicit click event.
2. Initialize global tracking limit variables `sessionStartTime = Date.now()` and `sessionElapsed = 0`.
3. Implement `setInterval` block explicitly repeating geometrically every `1000ms`.
4. Inside interval:
   - Calculate native duration precisely: `Date.now() - sessionStartTime`.
   - Math conversion loops mapping ms strictly into `HH:MM:SS` mathematically bounded formatting strings.
   - Feed resulting structural strings natively mapping DOM targeting outputs explicitly.
5. On Session closure trigger natively call `clearInterval` stopping mathematical mapping.

### 4. Inputs / Outputs
- **Inputs**: Manual boolean DOM trigger bounding Session start/stop operations.
- **Outputs**: Exact tracked `durationMs` logic and cleanly formatted output timeline string formats.

### 5. Edge Cases
- **UI Drag Lag**: `Date.now()` completely mitigates potential delay shifts because limits extract universally based on static origin bounds securely rather than cumulative timer errors natively.
- **Session Closed**: Verify clearing active timer mapping mathematically preventing ghost intervals tracking into memory.

### 6. Constraints
- Runs fully decoupled visually mapping bounds excluding dependent NoteEvent data entirely.

---

## Sub-Skill: Note Timer Logic

### 1. Purpose
Automatically manages the visual math and duration tracking bounding individual auditory trigger elements exclusively dynamically mapped within the session.

### 2. APIs / Concepts Used
- `Date.now()`
- `requestAnimationFrame`

### 3. Step-by-Step Implementation
1. Execute specifically exclusively when NoteEvent creation binds true (Trigger volume limit achieved).
2. Instantiate native mathematical reference: `noteStartTime = Date.now()`.
3. Generate loop mapping `requestAnimationFrame`.
4. Calculate natively exact active bounding limit explicitly: `duration = Date.now() - noteStartTime`.
5. Format duration mathematically converting `ms` structurally to strict `MM:SS:ms` string output parameters.
6. Target independent Note Timer UI limits structurally passing formatting DOM element updates directly.
7. Break mathematically the `requestAnimationFrame` loop explicitly upon receiving NoteEvent termination triggers from the silence mapping delay limits.

### 4. Inputs / Outputs
- **Inputs**: Boolean volume tracking limits passed entirely by hysteresis systems physically.
- **Outputs**: Explicitly structured real-time temporal readouts mapped natively to specific current NoteEvents natively.

### 5. Edge Cases
- **Unbounded Loops**: Frame recursion strictly checked wrapping explicitly matching active NoteEvent lifecycle boolean limits safely.
- **Session closed unexpectedly**: If overarching Session strictly ends, manually break the Note Timer rendering logic abruptly overriding the standard Audio volume checks logically.

### 6. Constraints
- Operates absolutely natively only IF overarching manual Session loop dictates state === structurally active.

---

## Sub-Skill: Learning Timer Logic

### 1. Purpose
Creates isolated customizable manual countdown boundaries managing independent mathematical timing goals tracking logic excluding audio integrations natively.

### 2. APIs / Concepts Used
- `Date.now()`
- `setInterval`
- Math calculating structures (`Math.max()`)

### 3. Step-by-Step Implementation
1. Parse natively target configuration limits derived strictly from user settings (e.g., target tracking ms count limit).
2. On click explicit trigger bounding Start logic: set `learningEndTime = Date.now() + targetMsCount`.
3. Construct recursive timeline mapping bounds securely tracking mapping wrapped identically repeating `1000ms` globally via `setInterval`.
4. Calculate: `remainingMs = Math.max(0, learningEndTime - Date.now())`.
5. Format visually remaining output structurally converting math output into standard `MM:SS` timeline definitions natively hitting Dashboard DOM mappings logically.
6. Target conditional triggers logically checking strictly: `if (remainingMs === 0)`.
   - Inside check trigger Alarm notification mappings natively.
   - Clears mathematical looping mappings (`clearInterval`).

### 4. Inputs / Outputs
- **Inputs**: External integer configurations explicitly defining bounded timeline lengths mathematically natively.
- **Outputs**: Formatted countdown tracker structurally binding outputs natively onto Mode 2 UIs explicitly. Executes Alarm mapping bounds.

### 5. Edge Cases
- **Session Interference**: Function logic explicitly isolated ignoring entirely all overarching or underlying Note / Session dependencies natively protecting independence securely.
- **Tab Sleeping**: By structuring calculation natively bounding explicit mathematical diff extraction (`endTime - Date.now()`), suspended frames mathematically natively fix timeline positioning structurally exactly resuming mathematically correct states globally natively. 

### 6. Constraints
- Only mathematically exposed onto Dashboard contexts natively explicitly avoiding rendering collisions mapping onto smaller Mode 1 states logically.
