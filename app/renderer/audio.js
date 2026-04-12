const START_THRESHOLD = 0.02;
const STOP_THRESHOLD = 0.01;
const SILENCE_DELAY_MS = 300;

let isRecording = false;
let silenceStartTime = 0;
let audioCtx = null;
let analyser = null;
let dataArray = null;
let reqFrame = null;

window.isRecording = false;

async function setupAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    dataArray = new Uint8Array(analyser.fftSize);
    
    processAudio();
  } catch (err) {
    console.error("Mic access failed:", err);
    document.getElementById('status-indicator').textContent = "Mic Error: Check permissions";
  }
}

function calculateRMS(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128;
    const squared = normalized * normalized;
    sum += squared;
  }
  return Math.sqrt(sum / data.length);
}

function onStartRecording() {
  window.isRecording = true;
  isRecording = true;
  document.getElementById('status-indicator').textContent = 'Recording...';
  document.getElementById('status-indicator').className = 'status-recording';
  startTimerDisplay();
}

function onStopRecording() {
  window.isRecording = false;
  isRecording = false;
  document.getElementById('status-indicator').textContent = 'Listening...';
  document.getElementById('status-indicator').className = 'status-listening';
  
  const { finalTimeStr, elapsed } = stopTimerDisplay();
  
  if (window.currentSession) {
    window.currentSession.notes.push({
      startTime: new Date(Date.now() - elapsed).toISOString(),
      duration: elapsed
    });
    window.renderSessionList();
  }
}
window.onStopRecording = onStopRecording;

function processAudio() {
  reqFrame = requestAnimationFrame(processAudio);
  if (!window.isSessionActive) {
      return; 
  }
  
  analyser.getByteTimeDomainData(dataArray);
  const rms = calculateRMS(dataArray);
  
  if (!isRecording && rms > START_THRESHOLD) {
    onStartRecording();
    silenceStartTime = 0;
  }
  
  if (isRecording && rms < STOP_THRESHOLD) {
    if (silenceStartTime === 0) {
      silenceStartTime = performance.now();
    } else {
      const silenceDuration = performance.now() - silenceStartTime;
      if (silenceDuration >= SILENCE_DELAY_MS) {
        onStopRecording();
      }
    }
  }
  
  if (isRecording && rms >= STOP_THRESHOLD) {
    silenceStartTime = 0;
  }
  
  
}

window.setupAudio = setupAudio;
