# UI System

## Sub-Skill: DOM Updates & Rendering

### 1. Purpose
Directly mutates the active Document Object Model using explicitly mapped target IDs bound to logical states.

### 2. APIs / Concepts Used
- `document.getElementById('target-id')`
- `Node.innerText` (for exact duration string injections)
- `Node.innerHTML` (only for structural container clears)

### 3. Step-by-Step Implementation
1. Globally cache static DOM node references exactly once during app initialization: `const timerDisplay = document.getElementById('timer-display');`
2. Define a decoupled target update function: `function updateSessionTimerUI(formattedString)`.
3. Inside the function, directly assign the incoming string parameter: `timerDisplay.innerText = formattedString;`.
4. Fire this specific update function strictly from the matching temporal calculation loops.

### 4. Inputs / Outputs
- **Inputs**: Calculated static mathematical strings matching `HH:MM:SS`.
- **Outputs**: Instantly injected Native graphical text updating visual boundaries directly.

### 5. Edge Cases
- **Missing DOM Nodes**: Initialize `if (!timerDisplay) return;` at the top of the function to block null reference crashes securely.

### 6. Constraints
- Strict performance limits. Never invoke DOM layouts inside tightly bound high-frequency arrays like the raw RMS Web Audio buffers. Always debounce visual state modifications.

---

## Sub-Skill: Rendering Session List 

### 1. Purpose
Iterates historically saved mappings outputting explicitly native child DOM elements visually mapped to the active list UI mode strictly.

### 2. APIs / Concepts Used
- `Array.prototype.forEach()`
- `document.createElement('div')`
- `Node.appendChild()`

### 3. Step-by-Step Implementation
1. Retrieve active parsed session object mapping: `const sessions = JSON.parse(localStorage.getItem('sessions'));`.
2. Clear the target container explicitly: `sessionContainer.innerHTML = '';` to wipe old array data.
3. Iterate over the parsed bounds securely: `sessions.forEach(session => { ... });`.
4. Inside the loop, instantiate standard logic elements securely: `const el = document.createElement('div');`.
5. Populate native limits structurally: `el.innerText = session.id + ' : ' + session.duration;`.
6. Append visually dynamically mapping child targets securely: `sessionContainer.appendChild(el);`.

### 4. Inputs / Outputs
- **Inputs**: Properly formatted valid Session objects extracted directly via system memory.
- **Outputs**: Div representations inserted securely into the visual Document.

### 5. Edge Cases
- **Empty List**: Handle successfully generating blank or implicit "No sessions yet" states securely mapping boundaries directly.

### 6. Constraints
- Render logic must be explicitly called exclusively on Session Load or Session Finalize events strictly.
