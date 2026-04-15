window.START_THRESHOLD = 0.02;
window.STOP_THRESHOLD = 0.01;
const SILENCE_DELAY_MS = 300;
const ANALYSER_FRAME_SIZE = 2048;
const MIN_PITCH_HZ = 80;
const MAX_PITCH_HZ = 4000;
const MIN_NOTE_HZ = 27.5;
const MAX_NOTE_HZ = 4186.01;
const MIN_PITCH_CONFIDENCE = 0.35;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_UI_THROTTLE_MS = 75;
const VISUALIZER_FRAME_MS = 33;
const BREATH_LOW_HZ = 1000;
const BREATH_HIGH_HZ = 8000;
const BREATH_SCORE_THRESHOLD = 0.45;

let isRecording = false;
let silenceStartTime = 0;
let audioCtx = null;
let analyser = null;
let dataArray = null;
let pitchSpectrumBuffer = null;
let reqFrame = null;
let lastPitchUiUpdateAt = 0;
let lastVisualizerFrameAt = 0;
let activePitchTracking = null;

window.isRecording = false;
window.latestRawPitchAnalysis = null;
window.latestPitchAnalysis = null;
window.latestPitchReadout = null;
window.latestVisualizerFrame = null;
window.visualizerRejectedFrames = 0;

function startAudioLoop() {
  if (reqFrame === null) {
    reqFrame = requestAnimationFrame(processAudio);
  }
}

function stopAudioLoop() {
  if (reqFrame !== null) {
    cancelAnimationFrame(reqFrame);
    reqFrame = null;
  }
}

async function setupAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = ANALYSER_FRAME_SIZE;
    source.connect(analyser);
    
    dataArray = new Uint8Array(analyser.fftSize);
    pitchSpectrumBuffer = new Uint8Array(analyser.frequencyBinCount);
    
    startAudioLoop();
  } catch (err) {
    console.error("Mic access failed:", err);
    if (window.onAudioError) window.onAudioError("Mic Error: Check permissions");
  }
}

function captureAudioFrame() {
  if (!analyser || !dataArray) return null;
  analyser.getByteTimeDomainData(dataArray);
  return dataArray;
}

function captureSpectrumFrame() {
  if (!analyser || !pitchSpectrumBuffer) return null;
  analyser.getByteFrequencyData(pitchSpectrumBuffer);
  return pitchSpectrumBuffer;
}

function getLinearMagnitude(dbValue) {
  if (!Number.isFinite(dbValue)) return 0;
  return Math.max(0, dbValue) / 255;
}

function analyzePitchFrame(rms, minimumRms = window.START_THRESHOLD) {
  if (!analyser || !audioCtx || !pitchSpectrumBuffer) return null;
  if (!Number.isFinite(rms) || rms < minimumRms) return null;

  const sampleRate = audioCtx.sampleRate;
  if (!Number.isFinite(sampleRate) || sampleRate < 44100 || sampleRate > 48000) {
    return null;
  }

  const fftSize = analyser.fftSize;
  const binCount = pitchSpectrumBuffer.length;
  const lowBin = Math.max(1, Math.floor((MIN_PITCH_HZ * fftSize) / sampleRate));
  const highBin = Math.min(binCount - 1, Math.ceil((MAX_PITCH_HZ * fftSize) / sampleRate));

  if (highBin < lowBin) return null;

  let rawPeakBin = -1;
  let rawPeakMagnitude = 0;
  let rawTotalMagnitude = 0;
  let totalSpectrumMagnitude = 0;
  let breathBandMagnitude = 0;
  const breathLowBin = Math.max(1, Math.floor((BREATH_LOW_HZ * fftSize) / sampleRate));
  const breathHighBin = Math.min(binCount - 1, Math.ceil((BREATH_HIGH_HZ * fftSize) / sampleRate));

  for (let i = 0; i < binCount; i++) {
    const magnitude = getLinearMagnitude(pitchSpectrumBuffer[i]);
    totalSpectrumMagnitude += magnitude;

    if (i >= lowBin && i <= highBin) {
      rawTotalMagnitude += magnitude;
      if (magnitude > rawPeakMagnitude) {
        rawPeakMagnitude = magnitude;
        rawPeakBin = i;
      }
    }

    if (i >= breathLowBin && i <= breathHighBin) {
      breathBandMagnitude += magnitude;
    }
  }

  if (rawPeakBin < 0 || rawPeakMagnitude <= 0) return null;

  let rawFrequencyHz = (rawPeakBin * sampleRate) / fftSize;

  if (rawPeakBin > 0 && rawPeakBin < binCount - 1) {
    const leftMagnitude = getLinearMagnitude(pitchSpectrumBuffer[rawPeakBin - 1]);
    const centerMagnitude = rawPeakMagnitude;
    const rightMagnitude = getLinearMagnitude(pitchSpectrumBuffer[rawPeakBin + 1]);
    const denominator = leftMagnitude - (2 * centerMagnitude) + rightMagnitude;

    if (Number.isFinite(denominator) && denominator !== 0) {
      const offset = 0.5 * (leftMagnitude - rightMagnitude) / denominator;
      if (Number.isFinite(offset)) {
        const refinedBin = rawPeakBin + Math.max(-1, Math.min(1, offset));
        const refinedFrequency = (refinedBin * sampleRate) / fftSize;
        if (Number.isFinite(refinedFrequency)) {
          rawFrequencyHz = refinedFrequency;
        }
      }
    }
  }

  const hpsHighBin = Math.min(highBin, Math.floor((binCount - 1) / 4));
  let hpsPeakBin = -1;
  let hpsPeakMagnitude = 0;
  let hpsTotalMagnitude = 0;

  for (let i = lowBin; i <= hpsHighBin; i++) {
    const baseMagnitude = Math.max(0, pitchSpectrumBuffer[i]);
    const magnitude2 = Math.max(0, pitchSpectrumBuffer[i * 2]);
    const magnitude3 = Math.max(0, pitchSpectrumBuffer[i * 3]);
    const magnitude4 = Math.max(0, pitchSpectrumBuffer[i * 4]);
    const hpsMagnitude = baseMagnitude * magnitude2 * magnitude3 * magnitude4;

    hpsTotalMagnitude += hpsMagnitude;
    if (hpsMagnitude > hpsPeakMagnitude) {
      hpsPeakMagnitude = hpsMagnitude;
      hpsPeakBin = i;
    }
  }

  if (hpsPeakBin < 0 || hpsPeakMagnitude <= 0) return null;

  const frequencyHz = (hpsPeakBin * sampleRate) / fftSize;
  const pitchConfidence = hpsPeakMagnitude / Math.max(hpsTotalMagnitude, 1);
  const breathScore = breathBandMagnitude / Math.max(totalSpectrumMagnitude, 1);
  const isBreathDominant = rms > window.STOP_THRESHOLD && pitchConfidence < MIN_PITCH_CONFIDENCE && breathScore >= BREATH_SCORE_THRESHOLD;

  if (!Number.isFinite(frequencyHz) || !Number.isFinite(pitchConfidence)) {
    return null;
  }

  return {
    frequencyHz,
    rawFrequencyHz,
    pitchConfidence,
    peakMagnitude: hpsPeakMagnitude,
    totalMagnitude: hpsTotalMagnitude,
    rawPeakMagnitude,
    rawTotalMagnitude,
    breathScore,
    isBreathDominant
  };
}

function filterPitchAnalysis(analysis) {
  if (!analysis) return null;
  if (!Number.isFinite(analysis.frequencyHz) || !Number.isFinite(analysis.pitchConfidence)) return null;
  if (analysis.pitchConfidence < MIN_PITCH_CONFIDENCE) return null;
  if (analysis.frequencyHz < MIN_NOTE_HZ || analysis.frequencyHz > MAX_NOTE_HZ) return null;
  if (analysis.isBreathDominant) return null;
  return analysis;
}

function mapFrequencyToNote(frequencyHz) {
  if (!Number.isFinite(frequencyHz) || frequencyHz < MIN_NOTE_HZ || frequencyHz > MAX_NOTE_HZ) {
    return null;
  }

  const midiNumber = Math.round(69 + (12 * Math.log2(frequencyHz / 440)));
  const noteIndex = ((midiNumber % 12) + 12) % 12;
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  const noteLabel = `${noteName}${octave}`;

  return {
    midiNumber,
    noteIndex,
    noteName,
    octave,
    noteLabel
  };
}

function publishPitchReadout(pitchAnalysis) {
  if (!pitchAnalysis) return;

  const now = performance.now();
  if ((now - lastPitchUiUpdateAt) < PITCH_UI_THROTTLE_MS) return;

  lastPitchUiUpdateAt = now;
  const pitchReadout = {
    frequencyHz: pitchAnalysis.frequencyHz,
    pitchConfidence: pitchAnalysis.pitchConfidence,
    noteLabel: pitchAnalysis.noteLabel,
    noteName: pitchAnalysis.noteName,
    octave: pitchAnalysis.octave,
    midiNumber: pitchAnalysis.midiNumber,
    updatedAt: now
  };

  window.latestPitchReadout = pitchReadout;

  if (typeof window.onPitchReadout === 'function') {
    window.onPitchReadout(pitchReadout);
  }
}

function buildVisualizerFramePayload(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, isFrameRejected, spectrumBuffer, waveformBuffer) {
  const rawFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.rawFrequencyHz)
    ? rawPitchAnalysis.rawFrequencyHz
    : null;
  const hpsFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.frequencyHz)
    ? rawPitchAnalysis.frequencyHz
    : null;
  const selectedFrequency = currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.frequencyHz)
    ? currentPitchAnalysis.frequencyHz
    : (filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.frequencyHz) ? filteredPitchAnalysis.frequencyHz : null);

  return {
    timestamp: performance.now(),
    sessionActive: window.isSessionActive,
    isRecording,
    sampleRate: audioCtx ? audioCtx.sampleRate : 0,
    fftSize: analyser ? analyser.fftSize : ANALYSER_FRAME_SIZE,
    spectrumData: spectrumBuffer || null,
    spectrumDb: spectrumBuffer || null,
    waveformData: waveformBuffer || null,
    rawFrequency,
    hpsFrequency,
    selectedFrequency,
    rawFrequencyHz: rawFrequency,
    hpsFrequencyHz: hpsFrequency,
    filteredFrequencyHz: selectedFrequency,
    rawConfidence: rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.pitchConfidence) ? rawPitchAnalysis.pitchConfidence : 0,
    filteredConfidence: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.pitchConfidence) ? filteredPitchAnalysis.pitchConfidence : 0,
    noteLabel: currentPitchAnalysis && currentPitchAnalysis.noteLabel ? currentPitchAnalysis.noteLabel : '',
    noteName: currentPitchAnalysis && currentPitchAnalysis.noteName ? currentPitchAnalysis.noteName : '',
    octave: currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.octave) ? currentPitchAnalysis.octave : null,
    midiNumber: currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.midiNumber) ? currentPitchAnalysis.midiNumber : null,
    rejectedFrames: window.visualizerRejectedFrames,
    rejectedFrame: Boolean(isFrameRejected),
    breathScore: rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.breathScore) ? rawPitchAnalysis.breathScore : 0,
    isBreathDominant: Boolean(rawPitchAnalysis && rawPitchAnalysis.isBreathDominant)
  };
}

function publishVisualizerFrame(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, isFrameRejected, spectrumBuffer, waveformBuffer, force = false) {
  if (!window.electronAPI || typeof window.electronAPI.sendVisualizerFrame !== 'function') return;

  const now = performance.now();
  if (!force && (now - lastVisualizerFrameAt) < VISUALIZER_FRAME_MS) return;

  lastVisualizerFrameAt = now;
  const payload = buildVisualizerFramePayload(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, isFrameRejected, spectrumBuffer, waveformBuffer);
  window.latestVisualizerFrame = payload;
  window.electronAPI.sendVisualizerFrame(payload);
}

function resetVisualizerFrameState() {
  lastVisualizerFrameAt = 0;
  window.latestVisualizerFrame = null;
  window.visualizerRejectedFrames = 0;
}

function clearVisualizerFrame() {
  resetVisualizerFrameState();
  publishVisualizerFrame(null, null, null, false, null, null, true);
}

function resetActivePitchTracking() {
  activePitchTracking = {
    frequencySum: 0,
    frequencySquaredSum: 0,
    frequencyCount: 0,
    detectedNotes: [],
    seenNotes: new Set(),
    noteCounts: new Map(),
    confidenceTotals: new Map(),
    firstSeenOrder: new Map(),
    nextOrder: 0
  };
}

function recordActivePitchSample(pitchAnalysis) {
  if (!activePitchTracking || !pitchAnalysis || !pitchAnalysis.noteLabel || pitchAnalysis.isBreathDominant) return;

  activePitchTracking.frequencySum += pitchAnalysis.frequencyHz;
  activePitchTracking.frequencySquaredSum += pitchAnalysis.frequencyHz * pitchAnalysis.frequencyHz;
  activePitchTracking.frequencyCount += 1;

  if (!activePitchTracking.seenNotes.has(pitchAnalysis.noteLabel)) {
    activePitchTracking.seenNotes.add(pitchAnalysis.noteLabel);
    activePitchTracking.detectedNotes.push(pitchAnalysis.noteLabel);
    activePitchTracking.firstSeenOrder.set(pitchAnalysis.noteLabel, activePitchTracking.nextOrder);
    activePitchTracking.nextOrder += 1;
  }

  activePitchTracking.noteCounts.set(
    pitchAnalysis.noteLabel,
    (activePitchTracking.noteCounts.get(pitchAnalysis.noteLabel) || 0) + 1
  );
  activePitchTracking.confidenceTotals.set(
    pitchAnalysis.noteLabel,
    (activePitchTracking.confidenceTotals.get(pitchAnalysis.noteLabel) || 0) + pitchAnalysis.pitchConfidence
  );
}

function finalizeActivePitchTracking() {
  if (!activePitchTracking) {
    return {
      avgFrequency: 0,
      detectedNotes: [],
      dominantNote: ''
    };
  }

  const avgFrequency = activePitchTracking.frequencyCount > 0
    ? activePitchTracking.frequencySum / activePitchTracking.frequencyCount
    : 0;
  const pitchVarianceHz = activePitchTracking.frequencyCount > 0
    ? Math.max(0, (activePitchTracking.frequencySquaredSum / activePitchTracking.frequencyCount) - (avgFrequency * avgFrequency))
    : 0;
  const pitchStdDevHz = Math.sqrt(pitchVarianceHz);

  let dominantNote = '';
  let dominantCount = 0;
  let dominantConfidence = 0;
  let dominantOrder = Number.POSITIVE_INFINITY;

  activePitchTracking.noteCounts.forEach((count, noteLabel) => {
    const confidence = activePitchTracking.confidenceTotals.get(noteLabel) || 0;
    const order = activePitchTracking.firstSeenOrder.get(noteLabel);
    const safeOrder = Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;

    const shouldReplace =
      count > dominantCount ||
      (count === dominantCount && confidence > dominantConfidence) ||
      (count === dominantCount && confidence === dominantConfidence && safeOrder < dominantOrder);

    if (shouldReplace) {
      dominantNote = noteLabel;
      dominantCount = count;
      dominantConfidence = confidence;
      dominantOrder = safeOrder;
    }
  });

  return {
    avgFrequency,
    detectedNotes: [...activePitchTracking.detectedNotes],
    dominantNote,
    pitchVarianceHz,
    pitchStdDevHz
  };
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
  lastPitchUiUpdateAt = 0;
  window.latestRawPitchAnalysis = null;
  window.latestPitchAnalysis = null;
  window.latestPitchReadout = null;
  resetActivePitchTracking();
  if(window.updateStatusUI) window.updateStatusUI(true);
  if(window.startTimerDisplay) window.startTimerDisplay();
}

function onStopRecording() {
  window.isRecording = false;
  isRecording = false;
  lastPitchUiUpdateAt = 0;
  window.latestRawPitchAnalysis = null;
  window.latestPitchAnalysis = null;
  window.latestPitchReadout = null;
  
  if(window.updateStatusUI) window.updateStatusUI(false);
  
  let elapsed = 0;
  if (window.stopTimerDisplay) {
      const result = window.stopTimerDisplay();
      elapsed = result.elapsed;
  }
  
  if (window.currentSession) {
    if (!Array.isArray(window.currentSession.notes)) {
      window.currentSession.notes = [];
    }
    const pitchSummary = finalizeActivePitchTracking();
    window.currentSession.notes.push({
      startTime: new Date(Date.now() - elapsed).toISOString(),
      endTime: new Date().toISOString(),
      duration: elapsed,
      avgFrequency: pitchSummary.avgFrequency,
      detectedNotes: pitchSummary.detectedNotes,
      dominantNote: pitchSummary.dominantNote,
      pitchVarianceHz: pitchSummary.pitchVarianceHz,
      pitchStdDevHz: pitchSummary.pitchStdDevHz,
      label: '',
      description: '',
      tags: []
    });
    activePitchTracking = null;
    if (window.onNoteComplete) {
      window.onNoteComplete();
    }
  }
}
window.onStopRecording = onStopRecording;

function processAudio() {
  reqFrame = null;
  if (!window.isSessionActive) {
      return;
  }
  
  if (!analyser || !dataArray) {
    startAudioLoop();
    return;
  }

  captureAudioFrame();
  const rms = calculateRMS(dataArray);
  captureSpectrumFrame();
  const pitchGate = isRecording ? window.STOP_THRESHOLD : window.START_THRESHOLD;
  
  if (!isRecording && rms > window.START_THRESHOLD) {
    onStartRecording();
    silenceStartTime = 0;
  }
  
  if (isRecording && rms < window.STOP_THRESHOLD) {
    if (silenceStartTime === 0) {
      silenceStartTime = performance.now();
    } else {
      const silenceDuration = performance.now() - silenceStartTime;
      if (silenceDuration >= SILENCE_DELAY_MS) {
        onStopRecording();
      }
    }
  }
  
  if (isRecording && rms >= window.STOP_THRESHOLD) {
    silenceStartTime = 0;
  }

  const rawPitchAnalysis = analyzePitchFrame(rms, pitchGate);
  window.latestRawPitchAnalysis = rawPitchAnalysis;
  const filteredPitchAnalysis = filterPitchAnalysis(rawPitchAnalysis);
  let currentPitchAnalysis = null;
  if (filteredPitchAnalysis) {
    const mappedPitchAnalysis = mapFrequencyToNote(filteredPitchAnalysis.frequencyHz);
    if (mappedPitchAnalysis) {
      currentPitchAnalysis = {
        ...filteredPitchAnalysis,
        ...mappedPitchAnalysis
      };
      window.latestPitchAnalysis = currentPitchAnalysis;
      publishPitchReadout(currentPitchAnalysis);
    }
  }

  const frameRejected = Boolean(rawPitchAnalysis && !filteredPitchAnalysis);
  if (frameRejected) {
    window.visualizerRejectedFrames += 1;
  }

  if (isRecording && currentPitchAnalysis) {
    recordActivePitchSample(currentPitchAnalysis);
  }

  publishVisualizerFrame(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, frameRejected, pitchSpectrumBuffer, dataArray);

  if (!window.isSessionActive) {
    return;
  }

  startAudioLoop();
}

window.setupAudio = setupAudio;
window.startAudioMonitoring = startAudioLoop;
window.stopAudioMonitoring = stopAudioLoop;
window.clearVisualizerFrame = clearVisualizerFrame;
