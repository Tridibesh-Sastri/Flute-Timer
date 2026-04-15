window.isSessionActive = false;
window.currentSession = null;
window.sessions = JSON.parse(localStorage.getItem('sessions')) || [];
window.expandedSessionIds = new Set();
window.currentSessionIndex = -1;

let sessionStartTime = 0;
let sessionDuration = 0;
let sessionAnimationFrame = null;

function updateSessionDisplay() {
  const elapsed = Date.now() - sessionStartTime;
  document.getElementById('session-timer-display').textContent = formatElapsed(elapsed);
  sessionAnimationFrame = requestAnimationFrame(updateSessionDisplay);
}

function toggleSession() {
  const btn = document.getElementById('session-toggle-btn');
  if (!window.isSessionActive) {
    // Start
    window.isSessionActive = true;
    sessionStartTime = Date.now();
    const sessionNumber = window.sessions.length + 1;
    window.currentSession = {
        id: crypto.randomUUID(),
        name: `Session #${sessionNumber}`,
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: null,
        duration: 0,
        notes: []
    };
    window.sessions.push(window.currentSession);
    window.currentSessionIndex = window.sessions.length - 1;
    localStorage.setItem('sessions', JSON.stringify(window.sessions));
    
    btn.textContent = 'Stop Session (S)';
    updateSessionDisplay();
    window.renderSessionList(); // Structural render on start
  } else {
    // Stop
    if (window.isRecording && typeof window.onStopRecording === 'function') {
        window.onStopRecording();
    }
    
    window.isSessionActive = false;
    cancelAnimationFrame(sessionAnimationFrame);
    const elapsed = Date.now() - sessionStartTime;
    
    if (window.currentSessionIndex >= 0) {
        window.sessions[window.currentSessionIndex].endTime = new Date().toISOString();
        window.sessions[window.currentSessionIndex].duration = elapsed;
        localStorage.setItem('sessions', JSON.stringify(window.sessions));
    }
    
    window.currentSession = null;
    window.currentSessionIndex = -1;
    
    sessionDuration += elapsed;
    
    document.getElementById('session-timer-display').textContent = '00:00:00';
    btn.textContent = 'Start Session (S)';
    window.renderSessionList();

        if (window.electronAPI && window.electronAPI.notifyDashboard) {
                window.electronAPI.notifyDashboard();
        }
  }
}

function createNoteDOM(note, isLive, sIndex, nIndex) {
    const nEl = document.createElement('div');
    nEl.className = 'note-entry-box';
    
    const info = document.createElement('div');
    info.className = 'note-info';
    info.innerText = `└─ Note | Dur: ${note.duration}ms`;
    
    const inputs = document.createElement('div');
    inputs.className = 'note-inputs';
    
    const lbl = document.createElement('input');
    lbl.type = 'text';
    lbl.placeholder = 'Label (e.g. Sa)';
    lbl.value = note.label || '';
    lbl.dataset.sessionIndex = sIndex;
    lbl.dataset.noteIndex = nIndex;
    lbl.dataset.inputType = 'label';
    
    const desc = document.createElement('textarea');
    desc.placeholder = 'Description...';
    desc.value = note.description || '';
    desc.dataset.sessionIndex = sIndex;
    desc.dataset.noteIndex = nIndex;
    desc.dataset.inputType = 'desc';
    
    const saveChanges = () => {
        window.sessions[sIndex].notes[nIndex].label = lbl.value;
        window.sessions[sIndex].notes[nIndex].description = desc.value;
        localStorage.setItem('sessions', JSON.stringify(window.sessions));
    };
    
    lbl.addEventListener('change', saveChanges);
    desc.addEventListener('change', saveChanges);
    lbl.addEventListener('keyup', () => { note.label = lbl.value; });
    desc.addEventListener('keyup', () => { note.description = desc.value; });
    
    inputs.appendChild(lbl);
    inputs.appendChild(desc);
    
    nEl.appendChild(info);
    nEl.appendChild(inputs);
    return nEl;
}

function createSessionDOM(session, sIndex, isLive) {
    const el = document.createElement('div');
    el.className = 'session-entry' + (isLive ? ' current-session' : '');
    if (isLive) el.id = 'live-session-container';
    
    const header = document.createElement('div');
    header.className = 'session-header';
    const idStr = isLive ? 'Live Session' : (session.name || (`Session #${sIndex + 1}`));
    const durStr = session.endTime ? session.duration + 'ms' : 'Tracking...';
    header.innerText = `${idStr} | Notes: ${session.notes.length} | Dur: ${durStr}`;
    if (isLive) header.id = 'live-session-header';
    
    const notesContainer = document.createElement('div');
    notesContainer.className = 'session-notes';
    
    const isExpanded = isLive || window.expandedSessionIds.has(session.id);
    if (isExpanded) {
        notesContainer.classList.add('expanded');
    }
    if (isLive) {
        notesContainer.id = 'live-notes-container';
    }
    
    header.addEventListener('click', () => {
        const currentlyExpanded = notesContainer.classList.toggle('expanded');
        if (currentlyExpanded) {
            window.expandedSessionIds.add(session.id);
        } else {
            window.expandedSessionIds.delete(session.id);
        }
    });
    
    session.notes.forEach((note, nIndex) => {
        notesContainer.appendChild(createNoteDOM(note, isLive, sIndex, nIndex));
    });
    
    el.appendChild(header);
    el.appendChild(notesContainer);
    return el;
}

window.renderSessionList = function() {
    const container = document.getElementById('entry-logs');
    if (!container) return;
    
    const activeEl = document.activeElement;
    let activeData = null;
    if (activeEl && activeEl.dataset && activeEl.dataset.sessionIndex !== undefined) {
        activeData = {
           sIndex: activeEl.dataset.sessionIndex,
           nIndex: activeEl.dataset.noteIndex,
           type: activeEl.dataset.inputType,
           selectionStart: activeEl.selectionStart,
           selectionEnd: activeEl.selectionEnd
        };
    }
    
    container.innerHTML = '';
    window.sessions.forEach((session, i) => {
        const isLive = window.isSessionActive && i === window.currentSessionIndex;
        container.appendChild(createSessionDOM(session, i, isLive));
    });
    
    if (activeData) {
        const selector = `[data-session-index="${activeData.sIndex}"][data-note-index="${activeData.nIndex}"][data-input-type="${activeData.type}"]`;
        const restEl = container.querySelector(selector);
        if (restEl) {
            restEl.focus();
            restEl.setSelectionRange(activeData.selectionStart, activeData.selectionEnd);
        }
    } else {
        container.scrollTop = container.scrollHeight;
    }
}


function setupSessionFeature() {
  const btn = document.getElementById('session-toggle-btn');
  if (btn) btn.addEventListener('click', toggleSession);
  
  document.addEventListener('keydown', (e) => {
    // Avoid triggering if user is typing a label for a log
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key.toLowerCase() === 's') {
      toggleSession();
    }
  });
}
window.renderSessionList();
