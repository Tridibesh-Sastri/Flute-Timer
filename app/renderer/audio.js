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
const MFCC_FILTER_COUNT = 26;
const MFCC_COEFFICIENT_COUNT = 13;
const MFCC_HISTORY_SIZE = 5;
const PITCH_WINDOW_SIZE = 5;
const MIN_STABLE_NOTE_FRAMES = 3;
const MIN_STABLE_NOTE_DURATION_MS = 80;
const MFCC_CONSISTENCY_THRESHOLD = 0.35;
const HPS_AGREEMENT_THRESHOLD = 0.45;
const STABLE_NOTE_RATIO = 0.6;
const PITCH_UI_THROTTLE_MS = 75;
const VISUALIZER_FRAME_MS = 33;
const BREATH_LOW_HZ = 1000;
const BREATH_HIGH_HZ = 8000;
const BREATH_SCORE_THRESHOLD = 0.45;
const MIN_PITCH_WINDOW_SIZE = 3;
const MAX_PITCH_WINDOW_SIZE = 5;
const NOTE_LOCK_CONFIDENCE_THRESHOLD = 0.7;
const TRANSITION_CONFIDENCE_THRESHOLD = 0.62;
const TRANSITION_SEMITONE_THRESHOLD = 1.5;
const MIN_FRAME_CONFIDENCE = 0.42;
const MIN_DOMINANT_PEAK_RATIO = 1.25;
const OCTAVE_CORRECTION_SCORE_MARGIN = 0.08;
const HPS_STABILITY_WEIGHT = 0.45;
const MFCC_STABILITY_WEIGHT = 0.35;
const AMPLITUDE_STABILITY_WEIGHT = 0.2;

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
let pendingPitchTracking = null;
let psychoacousticState = null;

window.isRecording = false;
window.latestRawPitchAnalysis = null;
window.latestPitchAnalysis = null;
window.latestPitchReadout = null;
window.latestPsychoacousticFrame = null;
window.latestNoteTimeline = [];
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
    initializePsychoacousticState();
    
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

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function hzToMel(hz) {
  if (!Number.isFinite(hz) || hz <= 0) return 0;
  return 2595 * Math.log10(1 + (hz / 700));
}

function melToHz(mel) {
  if (!Number.isFinite(mel) || mel <= 0) return 0;
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function mapMidiValueToNote(midiValue) {
  if (!Number.isFinite(midiValue)) return null;

  const roundedMidi = Math.round(midiValue);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];

  return {
    midiValue: roundedMidi,
    midiNumber: roundedMidi,
    noteIndex,
    noteName,
    octave,
    noteLabel: `${noteName}${octave}`
  };
}

function calculateFrequencyAgreement(rawFrequencyHz, hpsFrequencyHz) {
  if (!Number.isFinite(rawFrequencyHz) || !Number.isFinite(hpsFrequencyHz) || rawFrequencyHz <= 0 || hpsFrequencyHz <= 0) {
    return 0;
  }

  const difference = Math.abs(rawFrequencyHz - hpsFrequencyHz);
  const reference = Math.max(rawFrequencyHz, hpsFrequencyHz, 1);
  return clamp01(1 - (difference / reference));
}

function createPitchTrackingState() {
  return {
    active: false,
    noteLabel: '',
    noteName: '',
    octave: null,
    midiValue: null,
    startTimeMs: 0,
    startTimeIso: '',
    lastFrameTimeMs: 0,
    frequencySum: 0,
    frequencySquaredSum: 0,
    frequencyCount: 0,
    detectedNotes: [],
    seenNotes: new Set(),
    noteCounts: new Map(),
    confidenceTotals: new Map(),
    firstSeenOrder: new Map(),
    nextOrder: 0,
    frameCount: 0,
    hpsAgreementSum: 0,
    mfccConsistencySum: 0,
    temporalStabilitySum: 0,
    noteConfidenceSum: 0
  };
}

function createPsychoacousticState(sampleRate, fftSize, binCount) {
  const mfccMelEnergies = new Float32Array(MFCC_FILTER_COUNT);
  const mfccLogEnergies = new Float32Array(MFCC_FILTER_COUNT);
  const mfccCoefficients = new Float32Array(MFCC_COEFFICIENT_COUNT);
  const mfccHistory = Array.from({ length: MFCC_HISTORY_SIZE }, () => new Float32Array(MFCC_COEFFICIENT_COUNT));
  const mfccFilterBank = [];
  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);
  const melStep = (melMax - melMin) / (MFCC_FILTER_COUNT + 1);
  const melPoints = new Float32Array(MFCC_FILTER_COUNT + 2);

  for (let i = 0; i < melPoints.length; i++) {
    melPoints[i] = melToHz(melMin + (melStep * i));
  }

  for (let filterIndex = 0; filterIndex < MFCC_FILTER_COUNT; filterIndex++) {
    const weights = new Float32Array(binCount);
    const leftHz = melPoints[filterIndex];
    const centerHz = melPoints[filterIndex + 1];
    const rightHz = melPoints[filterIndex + 2];
    const leftBin = Math.max(0, Math.floor((leftHz * fftSize) / sampleRate));
    const centerBin = Math.max(leftBin + 1, Math.floor((centerHz * fftSize) / sampleRate));
    const rightBin = Math.max(centerBin + 1, Math.min(binCount - 1, Math.ceil((rightHz * fftSize) / sampleRate)));

    for (let bin = leftBin; bin < centerBin && bin < binCount; bin++) {
      const span = Math.max(centerBin - leftBin, 1);
      weights[bin] = (bin - leftBin) / span;
    }

    for (let bin = centerBin; bin <= rightBin && bin < binCount; bin++) {
      const span = Math.max(rightBin - centerBin, 1);
      weights[bin] = (rightBin - bin) / span;
    }

    mfccFilterBank.push(weights);
  }

  const dctBasis = Array.from({ length: MFCC_COEFFICIENT_COUNT }, (_, coefficientIndex) => {
    const basis = new Float32Array(MFCC_FILTER_COUNT);
    const scale = Math.PI * coefficientIndex / MFCC_FILTER_COUNT;

    for (let bandIndex = 0; bandIndex < MFCC_FILTER_COUNT; bandIndex++) {
      basis[bandIndex] = Math.cos(scale * (bandIndex + 0.5));
    }

    return basis;
  });

  return {
    sampleRate,
    fftSize,
    binCount,
    noteTimeline: [],
    mfccFilterBank,
    dctBasis,
    mfccMelEnergies,
    mfccLogEnergies,
    mfccCoefficients,
    mfccHistory,
    mfccHistoryIndex: 0,
    mfccHistoryCount: 0,
    pitchWindowMidi: new Float32Array(PITCH_WINDOW_SIZE),
    pitchWindowConfidence: new Float32Array(PITCH_WINDOW_SIZE),
    pitchWindowTimeMs: new Float64Array(PITCH_WINDOW_SIZE),
    pitchWindowCount: 0,
    pitchWindowIndex: 0,
    pitchWindowScratch: new Float32Array(PITCH_WINDOW_SIZE),
    latestFrame: {
      timestampMs: 0,
      rawFrequency: null,
      hpsFrequency: null,
      rawConfidence: 0,
      hpsConfidence: 0,
      octaveCorrectedFrequency: null,
      octaveCorrectedFrequencyHz: null,
      octaveCorrectedConfidence: 0,
      dominantPeakRatio: 0,
      harmonicSpread: 0,
      amplitudeStrength: 0,
      windowSize: PITCH_WINDOW_SIZE,
      transitionDetected: false,
      noteLocked: false,
      mfccCoefficients,
      mappedNote: {
        midiValue: null,
        noteLabel: '',
        noteName: '',
        octave: null
      },
      stableNote: {
        midiValue: null,
        noteLabel: '',
        noteName: '',
        octave: null
      },
      mappedMidiValue: null,
      stableMidi: null,
      stableFrequency: null,
      noteLabel: '',
      frequencyHz: null,
      pitchConfidence: 0,
      hpsAgreement: 0,
      mfccConsistency: 0,
      temporalStability: 0,
      confidence: 0,
      noteConfidence: 0,
      accepted: false,
      rejectionReason: '',
      isBreathDominant: false,
      sampleRate,
      fftSize
    }
  };
}

function initializePsychoacousticState() {
  if (!audioCtx || !analyser || !pitchSpectrumBuffer) return;
  psychoacousticState = createPsychoacousticState(audioCtx.sampleRate, analyser.fftSize, pitchSpectrumBuffer.length);
  window.latestPsychoacousticFrame = psychoacousticState.latestFrame;
  window.latestNoteTimeline = psychoacousticState.noteTimeline;
  pendingPitchTracking = createPitchTrackingState();
  resetActivePitchTracking();
}

function resetPsychoacousticState() {
  if (!psychoacousticState) {
    window.latestPsychoacousticFrame = null;
    window.latestNoteTimeline = [];
    pendingPitchTracking = createPitchTrackingState();
    resetActivePitchTracking();
    return;
  }

  psychoacousticState.mfccHistoryIndex = 0;
  psychoacousticState.mfccHistoryCount = 0;
  psychoacousticState.pitchWindowCount = 0;
  psychoacousticState.pitchWindowIndex = 0;
  psychoacousticState.noteTimeline.length = 0;
  psychoacousticState.latestFrame.timestampMs = 0;
  psychoacousticState.latestFrame.rawFrequency = null;
  psychoacousticState.latestFrame.hpsFrequency = null;
  psychoacousticState.latestFrame.rawConfidence = 0;
  psychoacousticState.latestFrame.hpsConfidence = 0;
  psychoacousticState.latestFrame.octaveCorrectedFrequency = null;
  psychoacousticState.latestFrame.octaveCorrectedFrequencyHz = null;
  psychoacousticState.latestFrame.octaveCorrectedConfidence = 0;
  psychoacousticState.latestFrame.dominantPeakRatio = 0;
  psychoacousticState.latestFrame.harmonicSpread = 0;
  psychoacousticState.latestFrame.amplitudeStrength = 0;
  psychoacousticState.latestFrame.windowSize = PITCH_WINDOW_SIZE;
  psychoacousticState.latestFrame.transitionDetected = false;
  psychoacousticState.latestFrame.noteLocked = false;
  psychoacousticState.latestFrame.mappedMidiValue = null;
  psychoacousticState.latestFrame.stableMidi = null;
  psychoacousticState.latestFrame.stableFrequency = null;
  psychoacousticState.latestFrame.noteLabel = '';
  psychoacousticState.latestFrame.frequencyHz = null;
  psychoacousticState.latestFrame.pitchConfidence = 0;
  psychoacousticState.latestFrame.hpsAgreement = 0;
  psychoacousticState.latestFrame.mfccConsistency = 0;
  psychoacousticState.latestFrame.temporalStability = 0;
  psychoacousticState.latestFrame.confidence = 0;
  psychoacousticState.latestFrame.noteConfidence = 0;
  psychoacousticState.latestFrame.accepted = false;
  psychoacousticState.latestFrame.rejectionReason = '';
  psychoacousticState.latestFrame.isBreathDominant = false;
  psychoacousticState.latestFrame.mappedNote.midiValue = null;
  psychoacousticState.latestFrame.mappedNote.noteLabel = '';
  psychoacousticState.latestFrame.mappedNote.noteName = '';
  psychoacousticState.latestFrame.mappedNote.octave = null;
  psychoacousticState.latestFrame.stableNote.midiValue = null;
  psychoacousticState.latestFrame.stableNote.noteLabel = '';
  psychoacousticState.latestFrame.stableNote.noteName = '';
  psychoacousticState.latestFrame.stableNote.octave = null;
  pendingPitchTracking = createPitchTrackingState();
  resetActivePitchTracking();
  window.latestPsychoacousticFrame = psychoacousticState.latestFrame;
  window.latestNoteTimeline = psychoacousticState.noteTimeline;
}

function calculateMFCCConsistency() {
  if (!psychoacousticState) return 0;
  if (psychoacousticState.mfccHistoryCount <= 1) return 1;

  const previousIndex = (psychoacousticState.mfccHistoryIndex - 2 + MFCC_HISTORY_SIZE) % MFCC_HISTORY_SIZE;
  const previousCoefficients = psychoacousticState.mfccHistory[previousIndex];
  const coefficients = psychoacousticState.mfccCoefficients;
  let difference = 0;
  let magnitude = 0;

  for (let i = 0; i < coefficients.length; i++) {
    const currentValue = coefficients[i];
    const previousValue = previousCoefficients[i];
    difference += Math.abs(currentValue - previousValue);
    magnitude += Math.abs(currentValue) + Math.abs(previousValue);
  }

  return clamp01(1 - (difference / Math.max(magnitude, 1e-6)));
}

function calculateMFCCCoefficients() {
  if (!psychoacousticState || !pitchSpectrumBuffer) return null;

  const { mfccFilterBank, dctBasis, mfccMelEnergies, mfccLogEnergies, mfccCoefficients, mfccHistory } = psychoacousticState;
  const binCount = pitchSpectrumBuffer.length;

  for (let filterIndex = 0; filterIndex < MFCC_FILTER_COUNT; filterIndex++) {
    const weights = mfccFilterBank[filterIndex];
    let filterEnergy = 0;

    for (let bin = 0; bin < binCount; bin++) {
      const weight = weights[bin];
      if (weight <= 0) continue;
      filterEnergy += weight * getLinearMagnitude(pitchSpectrumBuffer[bin]);
    }

    mfccMelEnergies[filterIndex] = filterEnergy;
    mfccLogEnergies[filterIndex] = Math.log(Math.max(filterEnergy, 1e-6));
  }

  for (let coefficientIndex = 0; coefficientIndex < MFCC_COEFFICIENT_COUNT; coefficientIndex++) {
    const basis = dctBasis[coefficientIndex];
    let coefficient = 0;

    for (let bandIndex = 0; bandIndex < MFCC_FILTER_COUNT; bandIndex++) {
      coefficient += mfccLogEnergies[bandIndex] * basis[bandIndex];
    }

    mfccCoefficients[coefficientIndex] = coefficient / MFCC_FILTER_COUNT;
  }

  const historyIndex = psychoacousticState.mfccHistoryIndex;
  mfccHistory[historyIndex].set(mfccCoefficients);
  psychoacousticState.mfccHistoryIndex = (historyIndex + 1) % MFCC_HISTORY_SIZE;
  psychoacousticState.mfccHistoryCount = Math.min(psychoacousticState.mfccHistoryCount + 1, MFCC_HISTORY_SIZE);

  return mfccCoefficients;
}

function getSpectrumMagnitudeAtBin(binIndex) {
  if (!pitchSpectrumBuffer || binIndex < 0 || binIndex >= pitchSpectrumBuffer.length) return 0;
  return getLinearMagnitude(pitchSpectrumBuffer[binIndex]);
}

function calculateAmplitudeStrength(rms) {
  if (!Number.isFinite(rms)) return 0;

  const silenceFloor = Number.isFinite(window.STOP_THRESHOLD) ? window.STOP_THRESHOLD : 0.01;
  const activeFloor = Number.isFinite(window.START_THRESHOLD) ? window.START_THRESHOLD : 0.02;
  const range = Math.max(activeFloor - silenceFloor, 1e-6);
  return clamp01((rms - silenceFloor) / range);
}

function calculateHarmonicSupportScore(frequencyHz) {
  if (!psychoacousticState || !audioCtx || !pitchSpectrumBuffer || !Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return 0;
  }

  const { sampleRate, fftSize, binCount } = psychoacousticState;
  const baseBin = Math.round((frequencyHz * fftSize) / sampleRate);
  if (baseBin < 1 || baseBin >= binCount) return 0;

  const harmonicWeights = [0.45, 0.25, 0.2, 0.1];
  let score = 0;
  let weightTotal = 0;

  for (let harmonicIndex = 0; harmonicIndex < harmonicWeights.length; harmonicIndex++) {
    const binIndex = baseBin * (harmonicIndex + 1);
    if (binIndex >= binCount) break;

    const weight = harmonicWeights[harmonicIndex];
    score += getSpectrumMagnitudeAtBin(binIndex) * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) return 0;
  return clamp01(score / weightTotal);
}

function selectOctaveCorrectedFrequency(rawFrequencyHz, hpsFrequencyHz) {
  const candidateFrequencies = [];

  if (Number.isFinite(hpsFrequencyHz) && hpsFrequencyHz > 0) {
    candidateFrequencies.push(hpsFrequencyHz);
  }

  if (Number.isFinite(rawFrequencyHz) && rawFrequencyHz > 0) {
    candidateFrequencies.push(rawFrequencyHz);
  }

  if (Number.isFinite(hpsFrequencyHz) && hpsFrequencyHz > 0) {
    candidateFrequencies.push(hpsFrequencyHz / 2);
    candidateFrequencies.push(hpsFrequencyHz / 3);
    candidateFrequencies.push(hpsFrequencyHz / 4);
  }

  let bestFrequencyHz = Number.isFinite(hpsFrequencyHz) ? hpsFrequencyHz : rawFrequencyHz;
  let bestScore = calculateHarmonicSupportScore(bestFrequencyHz);

  for (const candidateFrequencyHz of candidateFrequencies) {
    if (!Number.isFinite(candidateFrequencyHz) || candidateFrequencyHz <= 0) {
      continue;
    }

    if (candidateFrequencyHz < MIN_NOTE_HZ || candidateFrequencyHz > MAX_NOTE_HZ) {
      continue;
    }

    const score = calculateHarmonicSupportScore(candidateFrequencyHz);
    if (!Number.isFinite(score) || score <= 0) {
      continue;
    }

    const isLowerCandidate = candidateFrequencyHz < bestFrequencyHz;
    const scoreDelta = score - bestScore;
    const shouldReplace = scoreDelta > OCTAVE_CORRECTION_SCORE_MARGIN || (Math.abs(scoreDelta) <= OCTAVE_CORRECTION_SCORE_MARGIN && isLowerCandidate);

    if (shouldReplace) {
      bestFrequencyHz = candidateFrequencyHz;
      bestScore = score;
    }
  }

  return {
    frequencyHz: bestFrequencyHz,
    confidence: bestScore
  };
}

function calculateFrameFusionConfidence(hpsStability, mfccConsistency, amplitudeStrength) {
  return clamp01(
    (clamp01(hpsStability) * HPS_STABILITY_WEIGHT) +
    (clamp01(mfccConsistency) * MFCC_STABILITY_WEIGHT) +
    (clamp01(amplitudeStrength) * AMPLITUDE_STABILITY_WEIGHT)
  );
}

function resolveAdaptiveWindowSize(frameConfidence, transitionDetected, noteLocked) {
  if (transitionDetected) {
    return MIN_PITCH_WINDOW_SIZE;
  }

  if (noteLocked && frameConfidence >= 0.72) {
    return MAX_PITCH_WINDOW_SIZE;
  }

  if (frameConfidence >= 0.68) {
    return MAX_PITCH_WINDOW_SIZE;
  }

  if (frameConfidence >= 0.52) {
    return 4;
  }

  return MIN_PITCH_WINDOW_SIZE;
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

  const hpsFrequencyHz = (hpsPeakBin * sampleRate) / fftSize;
  const pitchConfidence = hpsPeakMagnitude / Math.max(hpsTotalMagnitude, 1);
  const breathScore = breathBandMagnitude / Math.max(totalSpectrumMagnitude, 1);
  const isBreathDominant = rms > window.STOP_THRESHOLD && pitchConfidence < MIN_PITCH_CONFIDENCE && breathScore >= BREATH_SCORE_THRESHOLD;
  const pitchBinSpan = Math.max(highBin - lowBin + 1, 1);
  const averagePitchMagnitude = rawTotalMagnitude / pitchBinSpan;
  const dominantPeakRatio = rawPeakMagnitude / Math.max(averagePitchMagnitude, 1e-6);
  const harmonicSpread = clamp01(rawTotalMagnitude > 0 ? ((rawTotalMagnitude - rawPeakMagnitude) / rawTotalMagnitude) : 0);
  const octaveCorrection = selectOctaveCorrectedFrequency(rawFrequencyHz, hpsFrequencyHz);
  const correctedFrequencyHz = Number.isFinite(octaveCorrection.frequencyHz) ? octaveCorrection.frequencyHz : hpsFrequencyHz;

  if (!Number.isFinite(correctedFrequencyHz) || !Number.isFinite(pitchConfidence)) {
    return null;
  }

  return {
    frequencyHz: correctedFrequencyHz,
    hpsFrequencyHz,
    rawFrequencyHz,
    pitchConfidence,
    peakMagnitude: hpsPeakMagnitude,
    totalMagnitude: hpsTotalMagnitude,
    rawPeakMagnitude,
    rawTotalMagnitude,
    dominantPeakRatio,
    harmonicSpread,
    octaveCorrectedFrequencyHz: correctedFrequencyHz,
    octaveCorrectedFrequency: correctedFrequencyHz,
    octaveCorrectedConfidence: Number.isFinite(octaveCorrection.confidence) ? octaveCorrection.confidence : 0,
    breathScore,
    isBreathDominant
  };
}

function filterPitchAnalysis(analysis) {
  if (!analysis) return null;
  if (!Number.isFinite(analysis.frequencyHz) || !Number.isFinite(analysis.pitchConfidence)) return null;
  const correctedConfidence = Number.isFinite(analysis.octaveCorrectedConfidence) ? analysis.octaveCorrectedConfidence : 0;
  if (Math.max(analysis.pitchConfidence, correctedConfidence) < MIN_PITCH_CONFIDENCE) return null;
  if (analysis.dominantPeakRatio < MIN_DOMINANT_PEAK_RATIO && analysis.harmonicSpread > 0.85) return null;
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
    midiValue: midiNumber,
    noteIndex,
    noteName,
    octave,
    noteLabel
  };
}

function sortSmallFloatWindow(values, count) {
  for (let i = 1; i < count; i++) {
    const value = values[i];
    let j = i - 1;
    while (j >= 0 && values[j] > value) {
      values[j + 1] = values[j];
      j -= 1;
    }
    values[j + 1] = value;
  }
}

function getWindowMedianMidi() {
  if (!psychoacousticState || psychoacousticState.pitchWindowCount <= 0) return null;

  const count = psychoacousticState.pitchWindowCount;
  const scratch = psychoacousticState.pitchWindowScratch;
  for (let i = 0; i < count; i++) {
    scratch[i] = psychoacousticState.pitchWindowMidi[i];
  }

  sortSmallFloatWindow(scratch, count);
  const middle = Math.floor(count / 2);
  const median = count % 2 === 1
    ? scratch[middle]
    : ((scratch[middle - 1] + scratch[middle]) / 2);

  return Math.round(median);
}

function updatePitchWindow(candidateMidiValue, frameTimeMs, frameConfidence, targetWindowSize = PITCH_WINDOW_SIZE) {
  if (!psychoacousticState) {
    return {
      stableMidi: null,
      stableCount: 0,
      windowCount: 0,
      windowSize: PITCH_WINDOW_SIZE,
      temporalStability: 0
    };
  }

  const index = psychoacousticState.pitchWindowIndex;
  psychoacousticState.pitchWindowMidi[index] = candidateMidiValue;
  psychoacousticState.pitchWindowConfidence[index] = frameConfidence;
  psychoacousticState.pitchWindowTimeMs[index] = frameTimeMs;
  psychoacousticState.pitchWindowIndex = (index + 1) % PITCH_WINDOW_SIZE;
  psychoacousticState.pitchWindowCount = Math.min(psychoacousticState.pitchWindowCount + 1, PITCH_WINDOW_SIZE);

  const windowSize = Math.max(MIN_PITCH_WINDOW_SIZE, Math.min(MAX_PITCH_WINDOW_SIZE, Number.isFinite(targetWindowSize) ? targetWindowSize : PITCH_WINDOW_SIZE));
  const effectiveWindowCount = Math.min(psychoacousticState.pitchWindowCount, windowSize);
  if (effectiveWindowCount <= 0) {
    return {
      stableMidi: null,
      stableCount: 0,
      windowCount: psychoacousticState.pitchWindowCount,
      windowSize,
      temporalStability: 0
    };
  }

  const scratch = psychoacousticState.pitchWindowScratch;
  let scratchCount = 0;
  let weightedMidiSum = 0;
  let weightSum = 0;

  for (let offset = effectiveWindowCount - 1; offset >= 0; offset--) {
    const bufferIndex = (psychoacousticState.pitchWindowIndex - 1 - offset + PITCH_WINDOW_SIZE) % PITCH_WINDOW_SIZE;
    const midiValue = psychoacousticState.pitchWindowMidi[bufferIndex];
    const confidence = Math.max(0, psychoacousticState.pitchWindowConfidence[bufferIndex]);

    if (!Number.isFinite(midiValue)) {
      continue;
    }

    scratch[scratchCount++] = midiValue;
    weightedMidiSum += midiValue * confidence;
    weightSum += confidence;
  }

  if (scratchCount <= 0) {
    return {
      stableMidi: null,
      stableCount: 0,
      windowCount: psychoacousticState.pitchWindowCount,
      windowSize,
      temporalStability: 0
    };
  }

  sortSmallFloatWindow(scratch, scratchCount);
  const middle = Math.floor(scratchCount / 2);
  const median = scratchCount % 2 === 1
    ? scratch[middle]
    : ((scratch[middle - 1] + scratch[middle]) / 2);
  const weightedAverage = weightSum > 0 ? (weightedMidiSum / weightSum) : median;
  const blendedMidi = Math.abs(weightedAverage - median) <= 0.35 ? weightedAverage : median;
  const stableMidi = Math.round(blendedMidi);

  let stableCount = 0;
  for (let i = 0; i < scratchCount; i++) {
    if (Math.round(scratch[i]) === stableMidi) {
      stableCount += 1;
    }
  }

  const temporalStability = clamp01(stableCount / Math.max(scratchCount, 1));
  return {
    stableMidi,
    stableCount,
    windowCount: scratchCount,
    windowSize,
    temporalStability
  };
}

function recordPitchTrackingSample(tracking, pitchAnalysis, psychoFrame) {
  if (!tracking || !pitchAnalysis || !pitchAnalysis.noteLabel || pitchAnalysis.isBreathDominant) return;

  if (!tracking.startTimeMs && psychoFrame && Number.isFinite(psychoFrame.timestampMs)) {
    tracking.startTimeMs = psychoFrame.timestampMs;
    tracking.startTimeIso = new Date(psychoFrame.timestampMs).toISOString();
  }

  tracking.frequencySum += Number.isFinite(pitchAnalysis.frequencyHz) ? pitchAnalysis.frequencyHz : 0;
  tracking.frequencySquaredSum += Number.isFinite(pitchAnalysis.frequencyHz) ? (pitchAnalysis.frequencyHz * pitchAnalysis.frequencyHz) : 0;
  tracking.frequencyCount += 1;
  tracking.frameCount += 1;
  tracking.lastFrameTimeMs = psychoFrame && Number.isFinite(psychoFrame.timestampMs) ? psychoFrame.timestampMs : tracking.lastFrameTimeMs;

  if (!tracking.seenNotes.has(pitchAnalysis.noteLabel)) {
    tracking.seenNotes.add(pitchAnalysis.noteLabel);
    tracking.detectedNotes.push(pitchAnalysis.noteLabel);
    tracking.firstSeenOrder.set(pitchAnalysis.noteLabel, tracking.nextOrder);
    tracking.nextOrder += 1;
  }

  tracking.noteCounts.set(
    pitchAnalysis.noteLabel,
    (tracking.noteCounts.get(pitchAnalysis.noteLabel) || 0) + 1
  );
  tracking.confidenceTotals.set(
    pitchAnalysis.noteLabel,
    (tracking.confidenceTotals.get(pitchAnalysis.noteLabel) || 0) + (Number.isFinite(pitchAnalysis.pitchConfidence) ? pitchAnalysis.pitchConfidence : 0)
  );

  const hpsAgreement = psychoFrame && Number.isFinite(psychoFrame.hpsAgreement) ? psychoFrame.hpsAgreement : 0;
  const mfccConsistency = psychoFrame && Number.isFinite(psychoFrame.mfccConsistency) ? psychoFrame.mfccConsistency : 0;
  const temporalStability = psychoFrame && Number.isFinite(psychoFrame.temporalStability) ? psychoFrame.temporalStability : 0;
  const noteConfidence = psychoFrame && Number.isFinite(psychoFrame.noteConfidence)
    ? psychoFrame.noteConfidence
    : ((hpsAgreement + mfccConsistency + temporalStability) / 3);

  tracking.hpsAgreementSum += hpsAgreement;
  tracking.mfccConsistencySum += mfccConsistency;
  tracking.temporalStabilitySum += temporalStability;
  tracking.noteConfidenceSum += clamp01(noteConfidence);
}

function finalizePitchTracking(tracking, endTimeMs) {
  if (!tracking || tracking.frameCount <= 0) {
    return null;
  }

  if (!tracking.noteLabel || tracking.frequencyCount <= 0) {
    return null;
  }

  const startTimeMs = Number.isFinite(tracking.startTimeMs) ? tracking.startTimeMs : endTimeMs;
  const duration = Math.max(0, endTimeMs - startTimeMs);
  if (tracking.frameCount < MIN_STABLE_NOTE_FRAMES || duration < MIN_STABLE_NOTE_DURATION_MS) {
    return null;
  }

  const avgFrequency = tracking.frequencySum / Math.max(tracking.frequencyCount, 1);
  const pitchVarianceHz = Math.max(0, (tracking.frequencySquaredSum / Math.max(tracking.frequencyCount, 1)) - (avgFrequency * avgFrequency));
  const pitchStdDevHz = Math.sqrt(pitchVarianceHz);

  let dominantNote = '';
  let dominantCount = 0;
  let dominantConfidence = 0;
  let dominantOrder = Number.POSITIVE_INFINITY;

  tracking.noteCounts.forEach((count, noteLabel) => {
    const confidence = tracking.confidenceTotals.get(noteLabel) || 0;
    const order = tracking.firstSeenOrder.get(noteLabel);
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

  const hpsAgreement = tracking.hpsAgreementSum / Math.max(tracking.frameCount, 1);
  const mfccConsistency = tracking.mfccConsistencySum / Math.max(tracking.frameCount, 1);
  const temporalStability = tracking.temporalStabilitySum / Math.max(tracking.frameCount, 1);
  const noteConfidence = clamp01(tracking.noteConfidenceSum / Math.max(tracking.frameCount, 1));
  const noteLabel = tracking.noteLabel || dominantNote;

  if (!noteLabel) {
    return null;
  }

  return {
    note: noteLabel,
    noteLabel,
    startTime: new Date(startTimeMs).toISOString(),
    endTime: new Date(endTimeMs).toISOString(),
    duration,
    confidence: noteConfidence,
    avgFrequency,
    detectedNotes: [...tracking.detectedNotes],
    dominantNote: dominantNote || noteLabel,
    pitchVarianceHz,
    pitchStdDevHz,
    hpsAgreement,
    mfccConsistency,
    temporalStability,
    label: '',
    description: '',
    tags: []
  };
}

function promotePendingPitchTrackingToActive() {
  if (!pendingPitchTracking || pendingPitchTracking.frameCount <= 0) {
    return null;
  }

  activePitchTracking = pendingPitchTracking;
  activePitchTracking.active = true;
  pendingPitchTracking = createPitchTrackingState();
  return activePitchTracking;
}

function clearPendingPitchTracking() {
  pendingPitchTracking = createPitchTrackingState();
}

function resetPitchWindowState() {
  if (!psychoacousticState) return;
  psychoacousticState.pitchWindowCount = 0;
  psychoacousticState.pitchWindowIndex = 0;
}

function commitFinalizedNoteEvent(noteEvent) {
  if (!noteEvent) return false;

  if (psychoacousticState && Array.isArray(psychoacousticState.noteTimeline)) {
    psychoacousticState.noteTimeline.push(noteEvent);
    window.latestNoteTimeline = psychoacousticState.noteTimeline;
  }

  if (typeof window.appendSessionNoteEvent === 'function') {
    window.appendSessionNoteEvent(noteEvent);
  } else if (window.currentSession) {
    if (!Array.isArray(window.currentSession.notes)) {
      window.currentSession.notes = [];
    }
    window.currentSession.notes.push(noteEvent);
    if (Array.isArray(window.sessions) && window.currentSessionIndex >= 0 && window.sessions[window.currentSessionIndex]) {
      window.sessions[window.currentSessionIndex] = window.currentSession;
    }
  }

  if (typeof window.onNoteComplete === 'function') {
    window.onNoteComplete();
  }

  return true;
}

function finalizeAndCommitActiveNote(endTimeMs) {
  const finalizedNote = finalizePitchTracking(activePitchTracking, endTimeMs);
  activePitchTracking = createPitchTrackingState();
  resetPitchWindowState();

  if (!finalizedNote) {
    return null;
  }

  commitFinalizedNoteEvent(finalizedNote);
  return finalizedNote;
}

function updatePsychoacousticTracking(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, rms, frameTimeMs) {
  if (!psychoacousticState) {
    return null;
  }

  const frame = psychoacousticState.latestFrame;
  frame.timestampMs = frameTimeMs;
  frame.rawFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.rawFrequencyHz) ? rawPitchAnalysis.rawFrequencyHz : null;
  frame.hpsFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.hpsFrequencyHz)
    ? rawPitchAnalysis.hpsFrequencyHz
    : (rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.frequencyHz) ? rawPitchAnalysis.frequencyHz : null);
  frame.rawConfidence = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.pitchConfidence) ? rawPitchAnalysis.pitchConfidence : 0;
  frame.hpsConfidence = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.pitchConfidence) ? filteredPitchAnalysis.pitchConfidence : 0;
  frame.octaveCorrectedFrequency = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.octaveCorrectedFrequencyHz)
    ? filteredPitchAnalysis.octaveCorrectedFrequencyHz
    : (filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.frequencyHz) ? filteredPitchAnalysis.frequencyHz : null);
  frame.octaveCorrectedFrequencyHz = frame.octaveCorrectedFrequency;
  frame.octaveCorrectedConfidence = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.octaveCorrectedConfidence)
    ? filteredPitchAnalysis.octaveCorrectedConfidence
    : 0;
  frame.dominantPeakRatio = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.dominantPeakRatio)
    ? filteredPitchAnalysis.dominantPeakRatio
    : 0;
  frame.harmonicSpread = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.harmonicSpread)
    ? filteredPitchAnalysis.harmonicSpread
    : 0;
  frame.amplitudeStrength = calculateAmplitudeStrength(rms);
  frame.accepted = false;
  frame.rejectionReason = '';
  frame.mappedMidiValue = null;
  frame.stableMidi = null;
  frame.stableFrequency = null;
  frame.frequencyHz = null;
  frame.pitchConfidence = 0;
  frame.noteConfidence = 0;
  frame.confidence = 0;
  frame.hpsAgreement = 0;
  frame.mfccConsistency = 0;
  frame.temporalStability = 0;
  frame.midiNumber = null;
  frame.midiValue = null;
  frame.noteName = '';
  frame.octave = null;
  frame.noteLabel = '';
  frame.windowSize = PITCH_WINDOW_SIZE;
  frame.transitionDetected = false;
  frame.noteLocked = false;
  frame.mappedNote.midiValue = null;
  frame.mappedNote.noteLabel = '';
  frame.mappedNote.noteName = '';
  frame.mappedNote.octave = null;
  frame.stableNote.midiValue = null;
  frame.stableNote.noteLabel = '';
  frame.stableNote.noteName = '';
  frame.stableNote.octave = null;

  const mfccCoefficients = calculateMFCCCoefficients();
  frame.mfccCoefficients = mfccCoefficients || psychoacousticState.mfccCoefficients;

  if (!filteredPitchAnalysis) {
    frame.rejectionReason = 'no-pitch';
    clearPendingPitchTracking();
    if (activePitchTracking && activePitchTracking.active) {
      const activeFrequency = activePitchTracking.frequencyCount > 0
        ? (activePitchTracking.frequencySum / activePitchTracking.frequencyCount)
        : null;
      frame.noteLabel = activePitchTracking.noteLabel;
      frame.frequencyHz = activeFrequency;
      frame.pitchConfidence = activePitchTracking.frameCount > 0
        ? clamp01(activePitchTracking.noteConfidenceSum / Math.max(activePitchTracking.frameCount, 1))
        : 0;
      frame.mappedMidiValue = activePitchTracking.midiValue;
      frame.stableMidi = activePitchTracking.midiValue;
      frame.stableFrequency = activeFrequency;
      frame.octaveCorrectedFrequency = activeFrequency;
      frame.octaveCorrectedFrequencyHz = activeFrequency;
      frame.stableNote.midiValue = activePitchTracking.midiValue;
      frame.stableNote.noteLabel = activePitchTracking.noteLabel;
      frame.stableNote.noteName = activePitchTracking.noteName;
      frame.stableNote.octave = activePitchTracking.octave;
      frame.midiNumber = activePitchTracking.midiValue;
      frame.midiValue = activePitchTracking.midiValue;
      frame.noteName = activePitchTracking.noteName;
      frame.octave = activePitchTracking.octave;
      frame.noteConfidence = frame.pitchConfidence;
      frame.confidence = frame.pitchConfidence;
      frame.noteLocked = true;
    }

    window.latestPsychoacousticFrame = frame;
    return frame;
  }

  const mappedNote = mapFrequencyToNote(filteredPitchAnalysis.frequencyHz);
  if (!mappedNote) {
    frame.rejectionReason = 'out-of-range';
    clearPendingPitchTracking();
    window.latestPsychoacousticFrame = frame;
    return frame;
  }

  frame.mappedMidiValue = mappedNote.midiValue;
  frame.mappedNote.midiValue = mappedNote.midiValue;
  frame.mappedNote.noteLabel = mappedNote.noteLabel;
  frame.mappedNote.noteName = mappedNote.noteName;
  frame.mappedNote.octave = mappedNote.octave;
  frame.midiNumber = mappedNote.midiValue;
  frame.midiValue = mappedNote.midiValue;
  frame.noteName = mappedNote.noteName;
  frame.octave = mappedNote.octave;

  const rawPitchConfidence = Number.isFinite(filteredPitchAnalysis.pitchConfidence) ? filteredPitchAnalysis.pitchConfidence : 0;
  const hpsStability = clamp01(Math.max(rawPitchConfidence, frame.octaveCorrectedConfidence));
  const mfccConsistency = calculateMFCCConsistency();
  const frameConfidence = calculateFrameFusionConfidence(hpsStability, mfccConsistency, frame.amplitudeStrength);
  const hpsAgreement = calculateFrequencyAgreement(frame.rawFrequency, frame.octaveCorrectedFrequency);
  const isBreathDominant = Boolean(filteredPitchAnalysis.isBreathDominant);
  const candidateMatchesActive = Boolean(activePitchTracking && activePitchTracking.active && activePitchTracking.noteLabel === mappedNote.noteLabel);
  const transitionConfidence = Math.max(hpsStability, frameConfidence);
  const transitionDetected = Boolean(
    activePitchTracking &&
    activePitchTracking.active &&
    activePitchTracking.noteLabel &&
    mappedNote.noteLabel !== activePitchTracking.noteLabel &&
    Math.abs(mappedNote.midiValue - activePitchTracking.midiValue) >= TRANSITION_SEMITONE_THRESHOLD &&
    transitionConfidence >= TRANSITION_CONFIDENCE_THRESHOLD
  );
  const noteLockCandidate = Boolean(candidateMatchesActive && frameConfidence >= NOTE_LOCK_CONFIDENCE_THRESHOLD);
  const windowSize = resolveAdaptiveWindowSize(frameConfidence, transitionDetected, noteLockCandidate);

  if (transitionDetected) {
    resetPitchWindowState();
    clearPendingPitchTracking();
  }

  const stableWindow = updatePitchWindow(mappedNote.midiValue, frameTimeMs, frameConfidence, windowSize);
  const stableMidi = stableWindow.stableMidi;
  const stableNoteInfo = Number.isFinite(stableMidi) ? mapMidiValueToNote(stableMidi) : null;
  const temporalStability = stableWindow.temporalStability;
  const noteConfidence = clamp01((hpsAgreement + mfccConsistency + temporalStability) / 3);
  const currentCandidate = transitionDetected ? mappedNote : (stableNoteInfo || mappedNote);
  const noteLocked = Boolean(candidateMatchesActive && (frameConfidence >= NOTE_LOCK_CONFIDENCE_THRESHOLD || noteConfidence >= NOTE_LOCK_CONFIDENCE_THRESHOLD));
  const dominantPeakGate = noteLocked ? (MIN_DOMINANT_PEAK_RATIO * 0.9) : MIN_DOMINANT_PEAK_RATIO;
  const mfccGate = transitionDetected ? (MFCC_CONSISTENCY_THRESHOLD * 0.6) : MFCC_CONSISTENCY_THRESHOLD;
  const confidenceGate = transitionDetected ? TRANSITION_CONFIDENCE_THRESHOLD * 0.9 : MIN_FRAME_CONFIDENCE;
  const accepted = !isBreathDominant && hpsStability >= MIN_PITCH_CONFIDENCE && frameConfidence >= confidenceGate && mfccConsistency >= mfccGate && frame.dominantPeakRatio >= dominantPeakGate;

  frame.hpsAgreement = hpsAgreement;
  frame.mfccConsistency = mfccConsistency;
  frame.temporalStability = temporalStability;
  frame.pitchConfidence = rawPitchConfidence;
  frame.windowSize = stableWindow.windowSize;
  frame.transitionDetected = transitionDetected;
  frame.noteLocked = noteLocked;
  frame.noteConfidence = noteConfidence;
  frame.confidence = frameConfidence;
  frame.accepted = accepted;
  frame.isBreathDominant = isBreathDominant;

  if (!accepted) {
    frame.rejectionReason = isBreathDominant
      ? 'breath-dominant'
      : (rawPitchConfidence < MIN_PITCH_CONFIDENCE
        ? 'low-pitch-confidence'
        : (frame.dominantPeakRatio < MIN_DOMINANT_PEAK_RATIO
          ? 'no-dominant-peak'
          : (frameConfidence < confidenceGate
            ? 'low-confidence'
            : (mfccConsistency < mfccGate
              ? 'mfcc-inconsistency'
              : 'unstable-frequency'))));
    clearPendingPitchTracking();

    if (activePitchTracking && activePitchTracking.active) {
      const activeFrequency = activePitchTracking.frequencyCount > 0
        ? (activePitchTracking.frequencySum / activePitchTracking.frequencyCount)
        : filteredPitchAnalysis.frequencyHz;
      const activeConfidence = activePitchTracking.frameCount > 0
        ? clamp01(activePitchTracking.noteConfidenceSum / Math.max(activePitchTracking.frameCount, 1))
        : rawPitchConfidence;

      frame.noteLabel = activePitchTracking.noteLabel;
      frame.frequencyHz = activeFrequency;
      frame.stableMidi = activePitchTracking.midiValue;
      frame.stableFrequency = activeFrequency;
      frame.octaveCorrectedFrequency = activeFrequency;
      frame.octaveCorrectedFrequencyHz = activeFrequency;
      frame.stableNote.midiValue = activePitchTracking.midiValue;
      frame.stableNote.noteLabel = activePitchTracking.noteLabel;
      frame.stableNote.noteName = activePitchTracking.noteName;
      frame.stableNote.octave = activePitchTracking.octave;
      frame.midiNumber = activePitchTracking.midiValue;
      frame.midiValue = activePitchTracking.midiValue;
      frame.noteName = activePitchTracking.noteName;
      frame.octave = activePitchTracking.octave;
      frame.noteConfidence = activeConfidence;
      frame.confidence = Math.max(frame.confidence, activeConfidence);
      frame.noteLocked = true;
    }

    window.latestPsychoacousticFrame = frame;
    return frame;
  }

  if (activePitchTracking && activePitchTracking.active && activePitchTracking.noteLabel === currentCandidate.noteLabel) {
    recordPitchTrackingSample(activePitchTracking, {
      frequencyHz: filteredPitchAnalysis.frequencyHz,
      pitchConfidence: rawPitchConfidence,
      noteLabel: currentCandidate.noteLabel,
      noteName: currentCandidate.noteName,
      octave: currentCandidate.octave,
      midiNumber: currentCandidate.midiValue,
      midiValue: currentCandidate.midiValue,
      isBreathDominant: false
    }, frame);
    clearPendingPitchTracking();
  } else {
    if (!pendingPitchTracking || pendingPitchTracking.noteLabel !== currentCandidate.noteLabel) {
      pendingPitchTracking = createPitchTrackingState();
      pendingPitchTracking.noteLabel = currentCandidate.noteLabel;
      pendingPitchTracking.noteName = currentCandidate.noteName;
      pendingPitchTracking.octave = currentCandidate.octave;
      pendingPitchTracking.midiValue = currentCandidate.midiValue;
    }

    recordPitchTrackingSample(pendingPitchTracking, {
      frequencyHz: filteredPitchAnalysis.frequencyHz,
      pitchConfidence: rawPitchConfidence,
      noteLabel: currentCandidate.noteLabel,
      noteName: currentCandidate.noteName,
      octave: currentCandidate.octave,
      midiNumber: currentCandidate.midiValue,
      midiValue: currentCandidate.midiValue,
      isBreathDominant: false
    }, frame);

    const pendingDurationMs = frameTimeMs - pendingPitchTracking.startTimeMs;
    const shouldPromoteImmediately = transitionDetected && transitionConfidence >= NOTE_LOCK_CONFIDENCE_THRESHOLD;
    if ((pendingPitchTracking.frameCount >= MIN_STABLE_NOTE_FRAMES && pendingDurationMs >= MIN_STABLE_NOTE_DURATION_MS) || shouldPromoteImmediately) {
      if (activePitchTracking && activePitchTracking.active && activePitchTracking.noteLabel && activePitchTracking.noteLabel !== pendingPitchTracking.noteLabel) {
        finalizeAndCommitActiveNote(pendingPitchTracking.startTimeMs);
      }

      if (!activePitchTracking || !activePitchTracking.active || activePitchTracking.noteLabel !== pendingPitchTracking.noteLabel) {
        activePitchTracking = pendingPitchTracking;
        activePitchTracking.active = true;
        pendingPitchTracking = createPitchTrackingState();
      }
    }
  }

  if (activePitchTracking && activePitchTracking.active) {
    const activeFrequency = activePitchTracking.frequencyCount > 0
      ? (activePitchTracking.frequencySum / activePitchTracking.frequencyCount)
      : filteredPitchAnalysis.frequencyHz;
    const activeConfidence = activePitchTracking.frameCount > 0
      ? clamp01(activePitchTracking.noteConfidenceSum / Math.max(activePitchTracking.frameCount, 1))
      : noteConfidence;

    frame.noteLabel = activePitchTracking.noteLabel || currentCandidate.noteLabel;
    frame.frequencyHz = activeFrequency;
    frame.stableMidi = activePitchTracking.midiValue;
    frame.stableFrequency = activeFrequency;
    frame.stableNote.midiValue = activePitchTracking.midiValue;
    frame.stableNote.noteLabel = activePitchTracking.noteLabel;
    frame.stableNote.noteName = activePitchTracking.noteName;
    frame.stableNote.octave = activePitchTracking.octave;
    frame.midiNumber = activePitchTracking.midiValue;
    frame.midiValue = activePitchTracking.midiValue;
    frame.noteName = activePitchTracking.noteName;
    frame.octave = activePitchTracking.octave;
    frame.pitchConfidence = rawPitchConfidence;
    frame.noteConfidence = activeConfidence;
    frame.confidence = Math.max(frame.confidence, activeConfidence);
    frame.noteLocked = true;
  } else {
    frame.noteLabel = currentCandidate.noteLabel;
    frame.frequencyHz = filteredPitchAnalysis.frequencyHz;
    frame.stableMidi = currentCandidate.midiValue;
    frame.stableFrequency = filteredPitchAnalysis.frequencyHz;
    frame.midiNumber = currentCandidate.midiValue;
    frame.midiValue = currentCandidate.midiValue;
    frame.noteName = currentCandidate.noteName;
    frame.octave = currentCandidate.octave;
  }

  window.latestPsychoacousticFrame = frame;
  return frame;
}

function publishPitchReadout(pitchAnalysis) {
  if (!pitchAnalysis) return;

  const now = performance.now();
  if ((now - lastPitchUiUpdateAt) < PITCH_UI_THROTTLE_MS) return;

  lastPitchUiUpdateAt = now;
  const pitchReadout = {
    timestampMs: Number.isFinite(pitchAnalysis.timestampMs) ? pitchAnalysis.timestampMs : null,
    sampleRate: Number.isFinite(pitchAnalysis.sampleRate) ? pitchAnalysis.sampleRate : (audioCtx ? audioCtx.sampleRate : null),
    fftSize: Number.isFinite(pitchAnalysis.fftSize) ? pitchAnalysis.fftSize : (analyser ? analyser.fftSize : null),
    rawFrequency: Number.isFinite(pitchAnalysis.rawFrequency) ? pitchAnalysis.rawFrequency : (Number.isFinite(pitchAnalysis.rawFrequencyHz) ? pitchAnalysis.rawFrequencyHz : null),
    hpsFrequency: Number.isFinite(pitchAnalysis.hpsFrequency) ? pitchAnalysis.hpsFrequency : (Number.isFinite(pitchAnalysis.hpsFrequencyHz) ? pitchAnalysis.hpsFrequencyHz : (Number.isFinite(pitchAnalysis.frequencyHz) ? pitchAnalysis.frequencyHz : null)),
    rawConfidence: Number.isFinite(pitchAnalysis.rawConfidence) ? pitchAnalysis.rawConfidence : 0,
    hpsConfidence: Number.isFinite(pitchAnalysis.hpsConfidence) ? pitchAnalysis.hpsConfidence : 0,
    frequencyHz: pitchAnalysis.frequencyHz,
    octaveCorrectedFrequency: Number.isFinite(pitchAnalysis.octaveCorrectedFrequency) ? pitchAnalysis.octaveCorrectedFrequency : (Number.isFinite(pitchAnalysis.octaveCorrectedFrequencyHz) ? pitchAnalysis.octaveCorrectedFrequencyHz : null),
    octaveCorrectedFrequencyHz: Number.isFinite(pitchAnalysis.octaveCorrectedFrequencyHz) ? pitchAnalysis.octaveCorrectedFrequencyHz : (Number.isFinite(pitchAnalysis.octaveCorrectedFrequency) ? pitchAnalysis.octaveCorrectedFrequency : null),
    octaveCorrectedConfidence: Number.isFinite(pitchAnalysis.octaveCorrectedConfidence) ? pitchAnalysis.octaveCorrectedConfidence : 0,
    pitchConfidence: pitchAnalysis.pitchConfidence,
    noteLabel: pitchAnalysis.noteLabel,
    noteName: pitchAnalysis.noteName,
    octave: pitchAnalysis.octave,
    midiNumber: pitchAnalysis.midiNumber,
    midiValue: Number.isFinite(pitchAnalysis.midiValue) ? pitchAnalysis.midiValue : (Number.isFinite(pitchAnalysis.midiNumber) ? pitchAnalysis.midiNumber : null),
    mfccCoefficients: pitchAnalysis.mfccCoefficients || (psychoacousticState ? psychoacousticState.mfccCoefficients : null),
    mappedNote: pitchAnalysis.mappedNote || null,
    stableNote: pitchAnalysis.stableNote || null,
    stableMidi: Number.isFinite(pitchAnalysis.stableMidi) ? pitchAnalysis.stableMidi : null,
    confidence: Number.isFinite(pitchAnalysis.confidence) ? pitchAnalysis.confidence : (Number.isFinite(pitchAnalysis.noteConfidence) ? pitchAnalysis.noteConfidence : (Number.isFinite(pitchAnalysis.pitchConfidence) ? pitchAnalysis.pitchConfidence : 0)),
    noteConfidence: Number.isFinite(pitchAnalysis.noteConfidence) ? pitchAnalysis.noteConfidence : (Number.isFinite(pitchAnalysis.confidence) ? pitchAnalysis.confidence : (Number.isFinite(pitchAnalysis.pitchConfidence) ? pitchAnalysis.pitchConfidence : 0)),
    hpsAgreement: Number.isFinite(pitchAnalysis.hpsAgreement) ? pitchAnalysis.hpsAgreement : 0,
    mfccConsistency: Number.isFinite(pitchAnalysis.mfccConsistency) ? pitchAnalysis.mfccConsistency : 0,
    temporalStability: Number.isFinite(pitchAnalysis.temporalStability) ? pitchAnalysis.temporalStability : 0,
    amplitudeStrength: Number.isFinite(pitchAnalysis.amplitudeStrength) ? pitchAnalysis.amplitudeStrength : 0,
    dominantPeakRatio: Number.isFinite(pitchAnalysis.dominantPeakRatio) ? pitchAnalysis.dominantPeakRatio : 0,
    harmonicSpread: Number.isFinite(pitchAnalysis.harmonicSpread) ? pitchAnalysis.harmonicSpread : 0,
    windowSize: Number.isFinite(pitchAnalysis.windowSize) ? pitchAnalysis.windowSize : null,
    transitionDetected: Boolean(pitchAnalysis.transitionDetected),
    noteLocked: Boolean(pitchAnalysis.noteLocked),
    rejectionReason: pitchAnalysis.rejectionReason || '',
    accepted: Boolean(pitchAnalysis.accepted),
    isBreathDominant: Boolean(pitchAnalysis.isBreathDominant),
    updatedAt: now
  };

  window.latestPitchReadout = pitchReadout;
  window.latestPsychoacousticFrame = pitchReadout;

  if (typeof window.onPitchReadout === 'function') {
    window.onPitchReadout(pitchReadout);
  }
}

function buildVisualizerFramePayload(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, isFrameRejected, spectrumBuffer, waveformBuffer) {
  const rawFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.rawFrequencyHz)
    ? rawPitchAnalysis.rawFrequencyHz
    : null;
  const hpsFrequency = rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.hpsFrequencyHz)
    ? rawPitchAnalysis.hpsFrequencyHz
    : (rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.frequencyHz)
      ? rawPitchAnalysis.frequencyHz
      : null);
  const octaveCorrectedFrequency = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.octaveCorrectedFrequencyHz)
    ? filteredPitchAnalysis.octaveCorrectedFrequencyHz
    : (currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.frequencyHz)
      ? currentPitchAnalysis.frequencyHz
      : (filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.frequencyHz) ? filteredPitchAnalysis.frequencyHz : null));
  const windowSize = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.windowSize)
    ? filteredPitchAnalysis.windowSize
    : null;
  const transitionDetected = Boolean(filteredPitchAnalysis && filteredPitchAnalysis.transitionDetected);
  const noteLocked = Boolean(filteredPitchAnalysis && filteredPitchAnalysis.noteLocked);
  const confidence = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.confidence)
    ? filteredPitchAnalysis.confidence
    : (currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.confidence) ? currentPitchAnalysis.confidence : 0);
  const noteConfidence = filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.noteConfidence)
    ? filteredPitchAnalysis.noteConfidence
    : (currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.noteConfidence) ? currentPitchAnalysis.noteConfidence : confidence);
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
    octaveCorrectedFrequency,
    octaveCorrectedFrequencyHz: octaveCorrectedFrequency,
    filteredFrequencyHz: selectedFrequency,
    rawConfidence: rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.pitchConfidence) ? rawPitchAnalysis.pitchConfidence : 0,
    filteredConfidence: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.pitchConfidence) ? filteredPitchAnalysis.pitchConfidence : 0,
    octaveCorrectedConfidence: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.octaveCorrectedConfidence) ? filteredPitchAnalysis.octaveCorrectedConfidence : 0,
    confidence,
    noteConfidence,
    windowSize,
    transitionDetected,
    noteLocked,
    noteLabel: currentPitchAnalysis && currentPitchAnalysis.noteLabel ? currentPitchAnalysis.noteLabel : '',
    noteName: currentPitchAnalysis && currentPitchAnalysis.noteName ? currentPitchAnalysis.noteName : '',
    octave: currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.octave) ? currentPitchAnalysis.octave : null,
    midiNumber: currentPitchAnalysis && Number.isFinite(currentPitchAnalysis.midiNumber) ? currentPitchAnalysis.midiNumber : null,
    rejectedFrames: window.visualizerRejectedFrames,
    rejectedFrame: Boolean(isFrameRejected),
    breathScore: rawPitchAnalysis && Number.isFinite(rawPitchAnalysis.breathScore) ? rawPitchAnalysis.breathScore : 0,
    isBreathDominant: Boolean(rawPitchAnalysis && rawPitchAnalysis.isBreathDominant),
    amplitudeStrength: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.amplitudeStrength) ? filteredPitchAnalysis.amplitudeStrength : 0,
    dominantPeakRatio: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.dominantPeakRatio) ? filteredPitchAnalysis.dominantPeakRatio : 0,
    harmonicSpread: filteredPitchAnalysis && Number.isFinite(filteredPitchAnalysis.harmonicSpread) ? filteredPitchAnalysis.harmonicSpread : 0
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
  activePitchTracking = createPitchTrackingState();
  activePitchTracking.active = false;
}

function recordActivePitchSample(pitchAnalysis, psychoFrame) {
  if (!activePitchTracking || !pitchAnalysis || !pitchAnalysis.noteLabel || pitchAnalysis.isBreathDominant) return;

  recordPitchTrackingSample(activePitchTracking, pitchAnalysis, psychoFrame);
}

function finalizeActivePitchTracking(endTimeMs = Date.now()) {
  if (!activePitchTracking) {
    return {
      avgFrequency: 0,
      detectedNotes: [],
      dominantNote: '',
      pitchVarianceHz: 0,
      pitchStdDevHz: 0,
      confidence: 0
    };
  }

  const pitchSummary = finalizePitchTracking(activePitchTracking, endTimeMs);

  if (!pitchSummary) {
    return {
      avgFrequency: 0,
      detectedNotes: [],
      dominantNote: '',
      pitchVarianceHz: 0,
      pitchStdDevHz: 0,
      confidence: 0
    };
  }

  return {
    avgFrequency: pitchSummary.avgFrequency,
    detectedNotes: pitchSummary.detectedNotes,
    dominantNote: pitchSummary.dominantNote,
    pitchVarianceHz: pitchSummary.pitchVarianceHz,
    pitchStdDevHz: pitchSummary.pitchStdDevHz,
    confidence: pitchSummary.confidence
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
  window.latestPsychoacousticFrame = null;
  clearPendingPitchTracking();
  resetPitchWindowState();
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
  window.latestPsychoacousticFrame = null;

  const noteEndTimeMs = Date.now();
  finalizeAndCommitActiveNote(noteEndTimeMs);
  clearPendingPitchTracking();
  resetPitchWindowState();
  resetActivePitchTracking();
  
  if(window.updateStatusUI) window.updateStatusUI(false);
  
  let elapsed = 0;
  if (window.stopTimerDisplay) {
      const result = window.stopTimerDisplay();
      elapsed = result.elapsed;
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
        ...mappedPitchAnalysis,
        midiValue: mappedPitchAnalysis.midiValue
      };
      window.latestPitchAnalysis = currentPitchAnalysis;
    }
  }

  const frameRejected = Boolean(rawPitchAnalysis && !filteredPitchAnalysis);
  if (frameRejected) {
    window.visualizerRejectedFrames += 1;
  }

  const frameTimeMs = Date.now();
  const psychoacousticFrame = updatePsychoacousticTracking(rawPitchAnalysis, filteredPitchAnalysis, currentPitchAnalysis, rms, frameTimeMs);
  if (psychoacousticFrame) {
    window.latestPsychoacousticFrame = psychoacousticFrame;
    publishPitchReadout(psychoacousticFrame);
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
window.clearPsychoacousticState = resetPsychoacousticState;
