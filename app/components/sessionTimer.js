let isSessionActive = false;
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
  if (!isSessionActive) {
    // Start
    isSessionActive = true;
    sessionStartTime = Date.now();
    btn.textContent = 'Stop Session (S)';
    updateSessionDisplay();
  } else {
    // Stop
    isSessionActive = false;
    cancelAnimationFrame(sessionAnimationFrame);
    const elapsed = Date.now() - sessionStartTime;
    const finalStr = formatElapsed(elapsed);
    sessionDuration += elapsed;
    
    document.getElementById('session-timer-display').textContent = '00:00:00';
    btn.textContent = 'Start Session (S)';
    
    // Fallback/log entry directly into main list marking distinction
    if (typeof addLogEntry === 'function') {
      addLogEntry(`[Session End: ${finalStr}]`);
    }
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
