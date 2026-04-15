window.updateStatusUI = function(isRecording) {
    const statusEl = document.getElementById('status-indicator');
    if (!statusEl) return;
    
    if (isRecording) {
        statusEl.textContent = 'Recording...';
        statusEl.className = 'status-recording';
    } else {
        statusEl.textContent = 'Listening...';
        statusEl.className = 'status-listening';
    }
}

window.onNoteComplete = function() {
    if (window.sessions) {
        localStorage.setItem('sessions', JSON.stringify(window.sessions));
    }
    if (window.renderSessionList) window.renderSessionList();
};

window.onAudioError = function(msg) {
    const statusEl = document.getElementById('status-indicator');
    if (statusEl) statusEl.textContent = msg;
};

window.onPitchReadout = function(readout) {
    window.latestPitchReadout = readout;

    const noteEl = document.getElementById('pitch-note-display');
    if (noteEl) {
        noteEl.textContent = readout && readout.noteLabel ? readout.noteLabel : '—';
    }

    const frequencyEl = document.getElementById('pitch-frequency-display');
    if (frequencyEl) {
        frequencyEl.textContent = readout && Number.isFinite(readout.frequencyHz)
            ? `${readout.frequencyHz.toFixed(1)} Hz`
            : '—';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
  setupWindowControls();
  setupSessionFeature();

    const dashboardBtn = document.getElementById('open-dashboard-btn');
    if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                    if (window.electronAPI && window.electronAPI.openDashboard) {
                            window.electronAPI.openDashboard();
                    }
            });
    }
  
  const slider = document.getElementById('threshold-slider');
  if (slider) {
      slider.addEventListener('input', (e) => {
          let val = parseFloat(e.target.value);
          if (val < 0.005) val = 0.005;
          if (val > 0.1) val = 0.1;
          e.target.value = val;
          window.START_THRESHOLD = val;
          window.STOP_THRESHOLD = window.START_THRESHOLD / 2;
      });
  }
  
  await window.setupAudio();
});
