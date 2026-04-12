window.isSessionActive = false;
window.currentSession = null;
window.sessions = JSON.parse(localStorage.getItem('sessions')) || [];

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
    window.currentSession = {
        id: crypto.randomUUID(),
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: null,
        duration: 0,
        notes: []
    };
    btn.textContent = 'Stop Session (S)';
    updateSessionDisplay();
  } else {
    // Stop
    if (window.isRecording && typeof window.onStopRecording === 'function') {
        window.onStopRecording();
    }
    
    window.isSessionActive = false;
    cancelAnimationFrame(sessionAnimationFrame);
    const elapsed = Date.now() - sessionStartTime;
    
    window.currentSession.endTime = new Date().toISOString();
    window.currentSession.duration = elapsed;
    window.sessions.push(window.currentSession);
    localStorage.setItem('sessions', JSON.stringify(window.sessions));
    window.currentSession = null;
    
    sessionDuration += elapsed;
    
    document.getElementById('session-timer-display').textContent = '00:00:00';
    btn.textContent = 'Start Session (S)';
    
    window.renderSessionList();
  }
}

window.renderSessionList = function() {
    const container = document.getElementById('entry-logs');
    if (!container) return;
    
    container.innerHTML = '';
    window.sessions.forEach(session => {
        const el = document.createElement('div');
        el.className = 'session-entry';
        el.innerText = `Session ${session.id.substring(0,8)} | Notes: ${session.notes.length} | Dur: ${session.duration}ms`;
        container.appendChild(el);
        
        session.notes.forEach(note => {
            const nEl = document.createElement('div');
            nEl.className = 'note-entry';
            nEl.style.paddingLeft = '20px';
            nEl.innerText = `└─ Note | Dur: ${note.duration}ms`;
            container.appendChild(nEl);
        });
    });
    
    if (window.currentSession) {
        const el = document.createElement('div');
        el.className = 'session-entry current-session';
        el.innerText = `Live Session | Notes: ${window.currentSession.notes.length} | Dur: Tracking...`;
        container.appendChild(el);
        
        window.currentSession.notes.forEach(note => {
            const nEl = document.createElement('div');
            nEl.className = 'note-entry';
            nEl.style.paddingLeft = '20px';
            nEl.innerText = `└─ Note | Dur: ${note.duration}ms`;
            container.appendChild(nEl);
        });
    }
    
    container.scrollTop = container.scrollHeight;
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
