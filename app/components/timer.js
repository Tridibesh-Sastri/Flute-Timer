let startTime = 0;
let timerAnimationFrame = null;

function formatElapsed(elapsed) {
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const milliseconds = Math.floor((elapsed % 1000) / 10);
  
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');
  const msStr = String(milliseconds).padStart(2, '0');
  
  return `${mStr}:${sStr}:${msStr}`;
}

function startTimerDisplay() {
  startTime = Date.now();
  const display = document.getElementById('timer-display');
  
  function update() {
    const elapsed = Date.now() - startTime;
    display.textContent = formatElapsed(elapsed);
    timerAnimationFrame = requestAnimationFrame(update);
  }
  
  update();
}

function stopTimerDisplay() {
  if (timerAnimationFrame) {
    cancelAnimationFrame(timerAnimationFrame);
  }
  let elapsed = 0;
  if (startTime > 0) {
    elapsed = Date.now() - startTime;
  }
  const finalTimeStr = formatElapsed(elapsed);
  
  // Reset display
  document.getElementById('timer-display').textContent = '00:00:00';
  startTime = 0;
  
  return finalTimeStr;
}

function addLogEntry(durationStr) {
  const div = document.createElement('div');
  div.className = 'log-entry';
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = durationStr;
  
  const input = document.createElement('input');
  input.className = 'log-label';
  input.type = 'text';
  input.placeholder = 'Label (e.g. Sa)';
  
  div.appendChild(timeSpan);
  div.appendChild(input);
  
  const logsContainer = document.getElementById('entry-logs');
  logsContainer.appendChild(div);
  
  // auto scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
}
