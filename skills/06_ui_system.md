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
- Strict Hybrid Rendering Model limits. The generic lightweight loop (`requestAnimationFrame` or `setInterval`) is exclusively allowed for Live text layer updates (e.g., `timerDisplay.innerText`). Never invoke structural DOM layouts (lists, sessions) inside this loop.


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
- Render logic (`renderSessionList`) must be strictly Event-Driven. It must only trigger on explicitly approved events: Session Start, Session End, Note End, and App Load.

---

## Sub-Skill: Dual-Window Electron Architecture

### 1. Purpose
Splits runtime responsibilities into a minimal floating widget and an intelligence-focused dashboard window.

### 2. APIs / Concepts Used
- `BrowserWindow`
- `ipcMain` / `ipcRenderer`
- `contextBridge`

### 3. Step-by-Step Implementation
1. Keep floating widget small, always-on-top, and focused on timer/session controls.
2. Create dashboard window lazily (on user action), with standard resizable behavior.
3. Route `open-dashboard` from widget to main process.
4. If dashboard exists, focus it; otherwise create it.
5. Keep data exchange simple: both windows read `localStorage` and refresh via explicit signal.

### 4. Inputs / Outputs
- **Inputs**: User interaction from floating widget.
- **Outputs**: Dashboard open/focus behavior without impacting widget loop timing.

### 5. Edge Cases
- Dashboard closed while widget is active: widget continues unaffected.
- Repeated open requests: focus existing dashboard, do not duplicate windows.

### 6. Constraints
- Do not move analytics/calendar rendering into floating widget.
- Keep IPC minimal and purpose-specific.

---

## Sub-Skill: Dashboard Lifecycle via IPC

### 1. Purpose
Refreshes dashboard views only when meaningful events happen (for example session end), without polling.

### 2. APIs / Concepts Used
- `ipcRenderer.send('dashboard-refresh')`
- `ipcMain.on('dashboard-refresh', ...)`
- Dashboard preload callback registration

### 3. Step-by-Step Implementation
1. Expose `notifyDashboard()` in widget preload.
2. On session end, widget sends `dashboard-refresh`.
3. Main process forwards refresh event to dashboard webContents if open.
4. Dashboard preload exposes `onRefresh(cb)`.
5. Dashboard renderer re-runs its render pipeline in callback.

### 4. Inputs / Outputs
- **Inputs**: Session lifecycle completion events.
- **Outputs**: Fresh dashboard cards/calendar/session list.

### 5. Edge Cases
- Dashboard not open: refresh signal should no-op safely.

### 6. Constraints
- Keep channel surface narrow (`open-dashboard`, `dashboard-refresh`) for feature communication.
