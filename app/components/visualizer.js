// visualizer.js - dashboard canvas renderer for FFT, spectrogram, waveform, MFCC, note timeline, and summary
// Called by dashboard.js: window.mountVisualizer(containerId)

(function () {
  const RENDER_INTERVAL_MS = 100;
  const FFT_MAX_FREQUENCY = 4000;
  const SPECTROGRAM_COLUMN_COUNT = 240;
  const SPECTROGRAM_BAND_COUNT = 64;
  const MFCC_FILTER_COUNT = 26;
  const MFCC_COEFFICIENT_COUNT = 13;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_MARKS = [110, 220, 440, 880, 1760, 3520, 4000];

  const state = window.visualizerState = window.visualizerState || {
    panel: null,
    containerId: null,
    latestFrame: null,
    sessionActive: false,
    pendingDraw: false,
    drawTimer: null,
    lastRenderAt: 0,
    spectrumCanvas: null,
    spectrogramCanvas: null,
    waveformCanvas: null,
    mfccCanvas: null,
    timelineCanvas: null,
    summaryCanvas: null,
    spectrumCtx: null,
    spectrogramCtx: null,
    waveformCtx: null,
    mfccCtx: null,
    timelineCtx: null,
    summaryCtx: null,
    spectrogram: {
      columnCount: SPECTROGRAM_COLUMN_COUNT,
      bandCount: SPECTROGRAM_BAND_COUNT,
      columns: [],
      timestamps: [],
      writeIndex: 0,
      count: 0,
      sourceBinCount: 0,
      palette: []
    },
    mfcc: {
      sourceBinCount: 0,
      sampleRate: 0,
      fftSize: 0,
      filterBank: [],
      dctBasis: [],
      melEnergies: new Float32Array(MFCC_FILTER_COUNT),
      logEnergies: new Float32Array(MFCC_FILTER_COUNT),
      coefficients: new Float32Array(MFCC_COEFFICIENT_COUNT)
    }
  };

  function clamp01(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  function formatHz(value) {
    if (!Number.isFinite(value) || value <= 0) return '—';
    if (value >= 1000) {
      const scaled = value / 1000;
      return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)} kHz`;
    }
    return `${value.toFixed(1)} Hz`;
  }

  function formatAxisFrequency(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 Hz';
    if (value >= 1000) {
      const scaled = value / 1000;
      return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)} kHz`;
    }
    return `${value.toFixed(0)} Hz`;
  }

  function formatAxisFrequencyWithNote(value) {
    const label = midiToNoteLabel(frequencyToMidi(value));
    if (!label || !Number.isFinite(value) || value <= 0) return formatAxisFrequency(value);
    return `${formatAxisFrequency(value)} | ${label}`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.round(Math.max(0, value) * 100)}%`;
  }

  function getFrameSpectrum(frame) {
    if (!frame) return null;
    const spectrum = frame.spectrumData || frame.spectrumDb;
    return spectrum && typeof spectrum.length === 'number' ? spectrum : null;
  }

  function getFrameWaveform(frame) {
    if (!frame) return null;
    const waveform = frame.waveformData || frame.timeDomainData;
    return waveform && typeof waveform.length === 'number' ? waveform : null;
  }

  function getRawFrequency(frame) {
    if (!frame) return null;
    if (Number.isFinite(frame.rawFrequency)) return frame.rawFrequency;
    if (Number.isFinite(frame.rawFrequencyHz)) return frame.rawFrequencyHz;
    return null;
  }

  function getHpsFrequency(frame) {
    if (!frame) return null;
    if (Number.isFinite(frame.hpsFrequency)) return frame.hpsFrequency;
    if (Number.isFinite(frame.hpsFrequencyHz)) return frame.hpsFrequencyHz;
    if (Number.isFinite(frame.filteredFrequencyHz)) return frame.filteredFrequencyHz;
    return null;
  }

  function getSelectedFrequency(frame) {
    if (!frame) return null;
    if (Number.isFinite(frame.selectedFrequency)) return frame.selectedFrequency;
    if (Number.isFinite(frame.filteredFrequencyHz)) return frame.filteredFrequencyHz;
    return getHpsFrequency(frame);
  }

  function getFrameNoteLabel(frame) {
    if (!frame) return '';
    if (frame.stableNote && frame.stableNote.noteLabel) return frame.stableNote.noteLabel;
    if (frame.mappedNote && frame.mappedNote.noteLabel) return frame.mappedNote.noteLabel;
    if (frame.noteLabel) return frame.noteLabel;
    if (typeof frame.note === 'string') return frame.note;
    return '';
  }

  function getFrameConfidence(frame) {
    if (!frame) return 0;
    if (Number.isFinite(frame.confidence)) return frame.confidence;
    if (Number.isFinite(frame.noteConfidence)) return frame.noteConfidence;
    if (Number.isFinite(frame.filteredConfidence)) return frame.filteredConfidence;
    if (Number.isFinite(frame.rawConfidence)) return frame.rawConfidence;
    return 0;
  }

  function noteLabelToMidi(noteLabel) {
    const match = /^\s*([A-G])([#b]?)(-?\d+)\s*$/.exec(String(noteLabel || ''));
    if (!match) return null;

    const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const letter = match[1];
    const accidental = match[2];
    const octave = Number(match[3]);
    if (!Number.isFinite(octave) || baseMap[letter] === undefined) return null;

    let semitone = baseMap[letter];
    if (accidental === '#') semitone += 1;
    if (accidental === 'b') semitone -= 1;
    return ((octave + 1) * 12) + semitone;
  }

  function frequencyToMidi(frequency) {
    if (!Number.isFinite(frequency) || frequency <= 0) return null;
    return Math.round(69 + (12 * Math.log2(frequency / 440)));
  }

  function midiToNoteLabel(midiValue) {
    if (!Number.isFinite(midiValue)) return '';
    const roundedMidi = Math.round(midiValue);
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
  }

  function noteColorFromLabel(noteLabel, alpha = 1) {
    const midi = noteLabelToMidi(noteLabel);
    const hue = Number.isFinite(midi) ? ((midi * 23) % 360) : 190;
    return `hsla(${hue}, 86%, 64%, ${alpha})`;
  }

  function normalizeMagnitude(value) {
    if (!Number.isFinite(value)) return 0;
    if (value >= 0 && value <= 1) return value;
    if (value >= 0 && value <= 255) return value / 255;
    if (value < 0) return Math.max(0, (value + 120) / 120);
    return 0;
  }

  function normalizeWaveformSample(value) {
    if (!Number.isFinite(value)) return 0;
    if (value >= -1 && value <= 1) return value;
    return (value - 128) / 128;
  }

  function buildSpectrogramPalette() {
    const palette = new Array(256);
    const stops = [
      { stop: 0, color: [8, 14, 24] },
      { stop: 0.55, color: [0, 188, 212] },
      { stop: 1, color: [255, 204, 102] }
    ];

    const lerp = (start, end, amount) => start + ((end - start) * amount);
    for (let i = 0; i < palette.length; i++) {
      const t = i / (palette.length - 1);
      const left = t <= stops[1].stop ? stops[0] : stops[1];
      const right = t <= stops[1].stop ? stops[1] : stops[2];
      const span = Math.max(0.0001, right.stop - left.stop);
      const localT = Math.min(1, Math.max(0, (t - left.stop) / span));
      const red = Math.round(lerp(left.color[0], right.color[0], localT));
      const green = Math.round(lerp(left.color[1], right.color[1], localT));
      const blue = Math.round(lerp(left.color[2], right.color[2], localT));
      palette[i] = `rgb(${red}, ${green}, ${blue})`;
    }

    return palette;
  }

  function buildPitchMarkers(maxFrequency) {
    return NOTE_MARKS
      .filter((frequency) => frequency > 0 && frequency <= maxFrequency)
      .map((frequency) => ({
        frequency,
        noteLabel: midiToNoteLabel(frequencyToMidi(frequency))
      }));
  }

  function loadSessionsFromStorage() {
    try {
      const parsed = JSON.parse(localStorage.getItem('sessions'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function getTimelineSession(sessions) {
    if (!Array.isArray(sessions) || !sessions.length) return null;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const session = sessions[i];
      if (session && Array.isArray(session.notes) && session.notes.length) return session;
    }
    return sessions[sessions.length - 1] || null;
  }

  function getTimelineNoteLabel(note) {
    if (!note) return '';
    return String(note.noteLabel || note.note || note.dominantNote || note.label || '').trim();
  }

  function getTimelineEntries(session) {
    if (!session || !Array.isArray(session.notes)) return [];

    const sessionStart = session.startTime ? new Date(session.startTime).getTime() : null;
    const entries = [];

    session.notes.forEach((note, index) => {
      const noteLabel = getTimelineNoteLabel(note);
      if (!noteLabel) return;

      const startTime = note.startTime ? new Date(note.startTime).getTime() : null;
      const endTime = note.endTime ? new Date(note.endTime).getTime() : null;
      const duration = Math.max(0, Number(note.duration) || 0);
      const startOffset = Number.isFinite(startTime) && Number.isFinite(sessionStart) ? Math.max(0, startTime - sessionStart) : index * 100;
      const endOffset = Number.isFinite(endTime) && Number.isFinite(sessionStart)
        ? Math.max(startOffset + 1, endTime - sessionStart)
        : (duration > 0 ? startOffset + duration : startOffset + 120);

      entries.push({
        noteLabel,
        midi: noteLabelToMidi(noteLabel),
        startOffset,
        endOffset
      });
    });

    return entries;
  }

  function buildMfccState(sourceBinCount, sampleRate, fftSize) {
    const melMin = 0;
    const melMax = 2595 * Math.log10(1 + ((sampleRate / 2) / 700));
    const melStep = (melMax - melMin) / (MFCC_FILTER_COUNT + 1);
    const melPoints = new Float32Array(MFCC_FILTER_COUNT + 2);

    for (let i = 0; i < melPoints.length; i++) {
      const melValue = melMin + (melStep * i);
      melPoints[i] = 700 * (Math.pow(10, melValue / 2595) - 1);
    }

    const filterBank = [];
    for (let filterIndex = 0; filterIndex < MFCC_FILTER_COUNT; filterIndex++) {
      const weights = new Float32Array(sourceBinCount);
      const leftHz = melPoints[filterIndex];
      const centerHz = melPoints[filterIndex + 1];
      const rightHz = melPoints[filterIndex + 2];
      const leftBin = Math.max(0, Math.floor((leftHz * fftSize) / sampleRate));
      const centerBin = Math.max(leftBin + 1, Math.floor((centerHz * fftSize) / sampleRate));
      const rightBin = Math.max(centerBin + 1, Math.min(sourceBinCount - 1, Math.ceil((rightHz * fftSize) / sampleRate)));

      for (let bin = leftBin; bin < centerBin && bin < sourceBinCount; bin++) {
        const span = Math.max(centerBin - leftBin, 1);
        weights[bin] = (bin - leftBin) / span;
      }

      for (let bin = centerBin; bin <= rightBin && bin < sourceBinCount; bin++) {
        const span = Math.max(rightBin - centerBin, 1);
        weights[bin] = (rightBin - bin) / span;
      }

      filterBank.push(weights);
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
      sourceBinCount,
      sampleRate,
      fftSize,
      filterBank,
      dctBasis,
      melEnergies: new Float32Array(MFCC_FILTER_COUNT),
      logEnergies: new Float32Array(MFCC_FILTER_COUNT),
      coefficients: new Float32Array(MFCC_COEFFICIENT_COUNT)
    };
  }

  function ensureMfccState(frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) return null;

    const sampleRate = Number.isFinite(frame && frame.sampleRate) ? frame.sampleRate : 48000;
    const fftSize = Number.isFinite(frame && frame.fftSize) ? frame.fftSize : spectrum.length * 2;

    if (!state.mfcc.filterBank.length || state.mfcc.sourceBinCount !== spectrum.length || state.mfcc.sampleRate !== sampleRate || state.mfcc.fftSize !== fftSize) {
      state.mfcc = buildMfccState(spectrum.length, sampleRate, fftSize);
    }

    return state.mfcc;
  }

  function computeDisplayMfccCoefficients(frame) {
    if (!frame) return state.mfcc.coefficients;

    if (frame.mfccCoefficients && typeof frame.mfccCoefficients.length === 'number' && frame.mfccCoefficients.length >= MFCC_COEFFICIENT_COUNT) {
      for (let i = 0; i < MFCC_COEFFICIENT_COUNT; i++) {
        state.mfcc.coefficients[i] = Number(frame.mfccCoefficients[i]) || 0;
      }
      return state.mfcc.coefficients;
    }

    const spectrum = getFrameSpectrum(frame);
    const mfccState = ensureMfccState(frame);
    if (!spectrum || !mfccState) return state.mfcc.coefficients;

    for (let filterIndex = 0; filterIndex < MFCC_FILTER_COUNT; filterIndex++) {
      const weights = mfccState.filterBank[filterIndex];
      let filterEnergy = 0;

      for (let bin = 0; bin < spectrum.length; bin++) {
        const weight = weights[bin];
        if (weight > 0) {
          filterEnergy += weight * normalizeMagnitude(spectrum[bin]);
        }
      }

      mfccState.melEnergies[filterIndex] = filterEnergy;
      mfccState.logEnergies[filterIndex] = Math.log(Math.max(filterEnergy, 1e-6));
    }

    for (let coefficientIndex = 0; coefficientIndex < MFCC_COEFFICIENT_COUNT; coefficientIndex++) {
      const basis = mfccState.dctBasis[coefficientIndex];
      let coefficient = 0;

      for (let bandIndex = 0; bandIndex < MFCC_FILTER_COUNT; bandIndex++) {
        coefficient += mfccState.logEnergies[bandIndex] * basis[bandIndex];
      }

      mfccState.coefficients[coefficientIndex] = coefficient / MFCC_FILTER_COUNT;
    }

    frame.mfccCoefficients = mfccState.coefficients;
    return mfccState.coefficients;
  }

  function ensureSpectrogramState(frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) return false;

    if (!state.spectrogram.columns.length || state.spectrogram.sourceBinCount !== spectrum.length) {
      state.spectrogram.sourceBinCount = spectrum.length;
      state.spectrogram.columns = Array.from(
        { length: state.spectrogram.columnCount },
        () => new Float32Array(state.spectrogram.bandCount)
      );
      state.spectrogram.timestamps = new Float64Array(state.spectrogram.columnCount);
      state.spectrogram.writeIndex = 0;
      state.spectrogram.count = 0;
      state.spectrogram.palette = buildSpectrogramPalette();
    }

    return true;
  }

  function resetSpectrogramState() {
    if (!state.spectrogram.columns.length) return;
    for (const column of state.spectrogram.columns) {
      column.fill(0);
    }
    state.spectrogram.timestamps.fill(0);
    state.spectrogram.writeIndex = 0;
    state.spectrogram.count = 0;
  }

  function pushSpectrogramFrame(frame) {
    if (!ensureSpectrogramState(frame)) return;

    const spectrum = getFrameSpectrum(frame);
    const columnIndex = state.spectrogram.writeIndex;
    const column = state.spectrogram.columns[columnIndex];
    if (!column) return;
    const timestamp = Number.isFinite(frame.timestamp) ? frame.timestamp : performance.now();

    const sampleRate = Number.isFinite(frame.sampleRate) ? frame.sampleRate : 48000;
    const fftSize = Number.isFinite(frame.fftSize) ? frame.fftSize : spectrum.length * 2;
    const maxVisibleBin = Math.max(1, Math.min(spectrum.length - 1, Math.floor((FFT_MAX_FREQUENCY * fftSize) / sampleRate)));
    const bandCount = state.spectrogram.bandCount;

    for (let band = 0; band < bandCount; band++) {
      const startBin = Math.floor((band * maxVisibleBin) / bandCount);
      const endBin = Math.max(startBin + 1, Math.floor(((band + 1) * maxVisibleBin) / bandCount));
      let total = 0;
      let totalCount = 0;

      for (let bin = startBin; bin < endBin && bin < spectrum.length; bin++) {
        total += normalizeMagnitude(spectrum[bin]);
        totalCount += 1;
      }

      column[band] = totalCount > 0 ? (total / totalCount) : 0;
    }

    state.spectrogram.timestamps[columnIndex] = timestamp;
    state.spectrogram.writeIndex = (state.spectrogram.writeIndex + 1) % state.spectrogram.columnCount;
    state.spectrogram.count = Math.min(state.spectrogram.count + 1, state.spectrogram.columnCount);
  }

  function drawRoundedRectPath(ctx, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }

  function setCanvasSize(canvas) {
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = Math.max(1, Math.floor(rect.height));
    if (!cssWidth || !cssHeight) return null;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(cssWidth * dpr);
    const targetHeight = Math.round(cssHeight * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: cssWidth, height: cssHeight };
  }

  function drawPanelBackground(ctx, width, height) {
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(7, 12, 18, 0.98)');
    background.addColorStop(1, 'rgba(10, 18, 28, 0.96)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  function drawIdleState(ctx, width, height, message, subtitle = 'No live frame available yet.') {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotHeight = height - marginTop - marginBottom;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = marginTop + (plotHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.font = '600 14px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2 - 6);
    ctx.font = '400 12px Inter, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(subtitle, width / 2, height / 2 + 14);
    ctx.restore();
  }

  function drawSpectrum(ctx, width, height, frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) {
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for FFT data' : 'FFT Idle', 'Spectrum, harmonics, and peak markers appear once the analyser is live.');
      return;
    }

    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const maxFrequency = Math.max(1, Number.isFinite(frame && frame.sampleRate) ? frame.sampleRate / 2 : 24000);

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = marginTop + (plotHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - (i * 25)}%`, marginLeft - 8, y + 3);
    }

    const xTicks = [0, 110, 220, 440, 880, 1760, 3520, maxFrequency]
      .filter((frequency, index, list) => list.indexOf(frequency) === index && frequency >= 0 && frequency <= maxFrequency);

    xTicks.forEach((frequency) => {
      const tick = frequency / maxFrequency;
      const x = marginLeft + (plotWidth * tick);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, height - marginBottom);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(frequency === 0 ? '0' : formatAxisFrequencyWithNote(frequency), x, height - 10);
    });

    const barCount = Math.max(72, Math.min(240, Math.floor(plotWidth / 3)));
    const binsPerBar = spectrum.length / barCount;
    for (let barIndex = 0; barIndex < barCount; barIndex++) {
      const startBin = Math.floor(barIndex * binsPerBar);
      const endBin = Math.max(startBin + 1, Math.floor((barIndex + 1) * binsPerBar));
      let maxMagnitude = 0;
      for (let bin = startBin; bin < endBin && bin < spectrum.length; bin++) {
        const value = normalizeMagnitude(spectrum[bin]);
        if (value > maxMagnitude) maxMagnitude = value;
      }

      const normalized = clamp01(maxMagnitude);
      const barHeight = Math.max(2, normalized * plotHeight);
      const barWidth = Math.max(1, (plotWidth / barCount) - 1);
      const x = marginLeft + (barIndex / barCount) * plotWidth;
      const y = marginTop + plotHeight - barHeight;
      const hue = 192 - (normalized * 120);
      const lightness = 28 + (normalized * 34);
      ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, 0.95)`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    const rawFrequency = getRawFrequency(frame);
    const hpsFrequency = getHpsFrequency(frame);
    const selectedFrequency = getSelectedFrequency(frame) || hpsFrequency || rawFrequency;
    const noteLabel = getFrameNoteLabel(frame);
    const peakLineColor = noteLabel ? noteColorFromLabel(noteLabel, 0.96) : '#8be8f5';

    if (rawFrequency) {
      const rawX = marginLeft + Math.max(0, Math.min(1, rawFrequency / maxFrequency)) * plotWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(rawX, marginTop);
      ctx.lineTo(rawX, marginTop + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (selectedFrequency) {
      const peakX = marginLeft + Math.max(0, Math.min(1, selectedFrequency / maxFrequency)) * plotWidth;
      ctx.strokeStyle = peakLineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.shadowColor = peakLineColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(peakX, marginTop);
      ctx.lineTo(peakX, marginTop + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      ctx.fillStyle = peakLineColor;
      ctx.fillRect(peakX - 3, marginTop + plotHeight - 10, 6, 10);

      const bubbleText = `${formatHz(selectedFrequency)}${noteLabel ? ` • ${noteLabel}` : ''}`;
      const bubbleWidth = Math.max(112, bubbleText.length * 7.2 + 18);
      const bubbleX = Math.max(marginLeft + 8, Math.min(peakX - (bubbleWidth / 2), width - marginRight - bubbleWidth));
      const bubbleY = marginTop + 4;

      ctx.fillStyle = 'rgba(6, 12, 20, 0.92)';
      ctx.strokeStyle = peakLineColor;
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, bubbleX, bubbleY, bubbleWidth, 30, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f5f7fb';
      ctx.font = '600 12px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bubbleText, bubbleX + bubbleWidth / 2, bubbleY + 19);

      for (let harmonicIndex = 2; harmonicIndex <= 5; harmonicIndex++) {
        const harmonicFrequency = selectedFrequency * harmonicIndex;
        if (harmonicFrequency > maxFrequency) break;
        const harmonicX = marginLeft + (harmonicFrequency / maxFrequency) * plotWidth;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 - ((harmonicIndex - 2) * 0.03)})`;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(harmonicX, marginTop + 16);
        ctx.lineTo(harmonicX, marginTop + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '10px Inter, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${harmonicIndex}x`, harmonicX, marginTop + 12);
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Frequency (Hz)', marginLeft, height - 10);
    ctx.save();
    ctx.translate(14, marginTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Intensity', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawSpectrogram(ctx, width, height, frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) {
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for spectrogram data' : 'Spectrogram Idle', 'The rolling buffer fills from the same live FFT frame stream.');
      return;
    }

    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const palette = state.spectrogram.palette.length ? state.spectrogram.palette : buildSpectrogramPalette();

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = marginTop + (plotHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    const frequencyTicks = [0, 110, 220, 440, 880, 1760, 3520, FFT_MAX_FREQUENCY]
      .filter((frequency, index, list) => list.indexOf(frequency) === index);
    frequencyTicks.forEach((frequency) => {
      const tick = frequency / FFT_MAX_FREQUENCY;
      const y = marginTop + plotHeight - (plotHeight * tick);
      ctx.fillText(frequency === 0 ? '0' : formatAxisFrequencyWithNote(frequency), marginLeft - 8, y + 3);
    });

    if (!state.spectrogram.count) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.font = '600 14px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for live FFT columns', width / 2, height / 2 - 4);
      ctx.font = '400 12px Inter, Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText('Columns update from the active session stream.', width / 2, height / 2 + 16);
      ctx.restore();
      return;
    }

    const columnCount = state.spectrogram.count;
    const bandCount = state.spectrogram.bandCount;
    const startIndex = (state.spectrogram.writeIndex - columnCount + state.spectrogram.columnCount) % state.spectrogram.columnCount;
    const columnWidth = plotWidth / columnCount;
    const bandHeight = plotHeight / bandCount;

    for (let x = 0; x < columnCount; x++) {
      const columnIndex = (startIndex + x) % state.spectrogram.columnCount;
      const column = state.spectrogram.columns[columnIndex];
      const drawX = marginLeft + (x * columnWidth);

      for (let band = 0; band < bandCount; band++) {
        const intensity = clamp01(column[band] || 0);
        const paletteIndex = Math.max(0, Math.min(255, Math.round(intensity * 255)));
        const drawY = marginTop + plotHeight - ((band + 1) * bandHeight);
        ctx.fillStyle = palette[paletteIndex];
        ctx.fillRect(drawX, drawY, Math.max(1, columnWidth + 0.25), bandHeight + 0.25);
      }
    }

    const selectedFrequency = getSelectedFrequency(frame) || getHpsFrequency(frame) || getRawFrequency(frame);
    const noteLabel = getFrameNoteLabel(frame);
    if (selectedFrequency) {
      const markerY = marginTop + plotHeight - (Math.max(0, Math.min(FFT_MAX_FREQUENCY, selectedFrequency)) / FFT_MAX_FREQUENCY) * plotHeight;
      const markerColor = noteColorFromLabel(noteLabel || midiToNoteLabel(frequencyToMidi(selectedFrequency)), 0.95);
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.shadowColor = markerColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(marginLeft, markerY);
      ctx.lineTo(width - marginRight, markerY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      const bubbleText = `${formatHz(selectedFrequency)}${noteLabel ? ` • ${noteLabel}` : ''}`;
      const bubbleWidth = Math.max(120, bubbleText.length * 6.8 + 18);
      const bubbleX = Math.max(marginLeft + 6, width - marginRight - bubbleWidth - 4);
      const bubbleY = Math.max(marginTop + 4, Math.min(markerY - 15, height - marginBottom - 34));

      ctx.fillStyle = 'rgba(6, 12, 20, 0.92)';
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, bubbleX, bubbleY, bubbleWidth, 28, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f7fbff';
      ctx.font = '600 11px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bubbleText, bubbleX + (bubbleWidth / 2), bubbleY + 18);
    }

    const latestTimestamp = Number.isFinite(frame && frame.timestamp) ? frame.timestamp : performance.now();
    const oldestTimestamp = state.spectrogram.count > 0
      ? state.spectrogram.timestamps[(state.spectrogram.writeIndex - state.spectrogram.count + state.spectrogram.columnCount) % state.spectrogram.columnCount]
      : latestTimestamp;
    const timeSpan = Math.max(1, latestTimestamp - oldestTimestamp);
    const timeTicks = [0, 0.33, 0.66, 1];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    timeTicks.forEach((tick) => {
      const x = marginLeft + (plotWidth * tick);
      const sampleTime = oldestTimestamp + (timeSpan * tick);
      const label = tick === 1 ? 'Now' : `-${((latestTimestamp - sampleTime) / 1000).toFixed(1)}s`;
      ctx.fillText(label, x, height - 10);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Time →', marginLeft, height - 10);
    ctx.save();
    ctx.translate(14, marginTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Frequency', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawWaveform(ctx, width, height, frame) {
    const waveform = getFrameWaveform(frame);
    if (!waveform || waveform.length === 0) {
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for waveform data' : 'Waveform Idle', 'The waveform uses only the current analyser time-domain frame.');
      return;
    }

    const marginLeft = 22;
    const marginRight = 18;
    const marginTop = 18;
    const marginBottom = 20;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const baselineY = marginTop + (plotHeight / 2);
    const noteLabel = getFrameNoteLabel(frame);
    const accentColor = noteColorFromLabel(noteLabel, 0.96);
    const fillColor = noteColorFromLabel(noteLabel, 0.24);
    const points = [];

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i++) {
      const y = marginTop + (plotHeight * i) / 2;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, baselineY);
    ctx.lineTo(width - marginRight, baselineY);
    ctx.stroke();

    const samples = waveform.length;
    for (let x = 0; x < plotWidth; x++) {
      const sampleIndex = Math.min(samples - 1, Math.floor((x / Math.max(1, plotWidth - 1)) * (samples - 1)));
      const sample = normalizeWaveformSample(waveform[sampleIndex]);
      const y = baselineY - (sample * (plotHeight / 2));
      points.push({ x: marginLeft + x, y });
    }

    const gradient = ctx.createLinearGradient(marginLeft, marginTop, width - marginRight, height - marginBottom);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, 'rgba(0, 188, 212, 0.04)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, baselineY);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, baselineY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Amplitude', marginLeft, 12);
    ctx.textAlign = 'right';
    ctx.fillText('1', marginLeft - 8, marginTop + 3);
    ctx.fillText('0', marginLeft - 8, baselineY + 3);
    ctx.fillText('-1', marginLeft - 8, marginTop + plotHeight - 1);

    if (noteLabel) {
      const chipWidth = Math.max(74, noteLabel.length * 7.2 + 16);
      const chipX = width - marginRight - chipWidth;
      const chipY = marginTop + 4;
      ctx.fillStyle = 'rgba(6, 12, 20, 0.92)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, chipX, chipY, chipWidth, 24, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f7fbff';
      ctx.font = '600 11px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(noteLabel, chipX + (chipWidth / 2), chipY + 16);
    }

    ctx.restore();
  }

  function drawMfcc(ctx, width, height, frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) {
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for MFCC data' : 'MFCC Idle', 'The coefficient bars are derived from the same live FFT frame.');
      return;
    }

    const coefficients = computeDisplayMfccCoefficients(frame);
    const noteLabel = getFrameNoteLabel(frame);
    const accentColor = noteColorFromLabel(noteLabel, 0.95);
    let maxAbs = 0;
    for (let i = 0; i < coefficients.length; i++) {
      const value = Math.abs(coefficients[i]);
      if (value > maxAbs) maxAbs = value;
    }
    maxAbs = Math.max(maxAbs, 1);

    const marginLeft = 24;
    const marginRight = 12;
    const marginTop = 22;
    const marginBottom = 24;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const baselineY = marginTop + (plotHeight / 2);
    const barWidth = plotWidth / coefficients.length;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = marginTop + (plotHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(marginLeft, baselineY);
    ctx.lineTo(width - marginRight, baselineY);
    ctx.stroke();

    for (let index = 0; index < coefficients.length; index++) {
      const coefficient = coefficients[index];
      const normalized = Math.max(0.06, Math.min(1, Math.abs(coefficient) / maxAbs));
      const barHeight = normalized * (plotHeight / 2);
      const x = marginLeft + (index * barWidth) + 2;
      const y = coefficient >= 0 ? baselineY - barHeight : baselineY;
      const fill = coefficient >= 0 ? accentColor : 'rgba(139, 232, 245, 0.88)';

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.max(1, barWidth - 4), Math.max(2, barHeight));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.font = '10px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`c${index + 1}`, x + ((barWidth - 4) / 2), height - 9);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MFCC Coefficients', marginLeft, 12);
    ctx.textAlign = 'right';
    ctx.fillText('High', marginLeft - 8, marginTop + 3);
    ctx.fillText('0', marginLeft - 8, baselineY + 3);
    ctx.fillText('Low', marginLeft - 8, marginTop + plotHeight - 1);

    if (noteLabel) {
      const chipWidth = Math.max(70, noteLabel.length * 7.2 + 16);
      const chipX = width - marginRight - chipWidth;
      const chipY = marginTop + 4;
      ctx.fillStyle = 'rgba(6, 12, 20, 0.92)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, chipX, chipY, chipWidth, 24, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f7fbff';
      ctx.font = '600 11px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(noteLabel, chipX + (chipWidth / 2), chipY + 16);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.54)';
    ctx.font = '10px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    const mfccArrayText = Array.from(coefficients, (value) => value.toFixed(2)).join('  ');
    ctx.fillText(`mfccCoefficients: ${mfccArrayText}`, marginLeft, height - 10);

    ctx.restore();
  }

  function drawTimeline(ctx, width, height, frame) {
    const sessions = loadSessionsFromStorage();
    const session = getTimelineSession(sessions);
    if (!session) {
      drawIdleState(ctx, width, height, 'Waiting for note timeline', 'Finalized notes appear here in discrete pitch steps.');
      return;
    }

    const entries = getTimelineEntries(session);
    if (!entries.length) {
      drawIdleState(ctx, width, height, 'No finalized notes yet', 'The timeline fills once a stable NoteEvent closes.');
      return;
    }

    const rowLabels = [...new Map(entries.map((entry) => [entry.noteLabel, entry])).values()]
      .sort((left, right) => {
        const leftMidi = Number.isFinite(left.midi) ? left.midi : Number.POSITIVE_INFINITY;
        const rightMidi = Number.isFinite(right.midi) ? right.midi : Number.POSITIVE_INFINITY;
        if (leftMidi !== rightMidi) return leftMidi - rightMidi;
        return left.noteLabel.localeCompare(right.noteLabel);
      });

    const rowIndex = new Map();
    rowLabels.forEach((entry, index) => rowIndex.set(entry.noteLabel, index));

    const marginLeft = 80;
    const marginRight = 12;
    const marginTop = 18;
    const marginBottom = 22;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const rowHeight = plotHeight / Math.max(1, rowLabels.length);
    const sessionDuration = Math.max(1, Number(session.duration) || 0, ...entries.map((entry) => entry.endOffset));
    const accentColor = noteColorFromLabel(getFrameNoteLabel(frame), 0.95);

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= rowLabels.length; i++) {
      const y = marginTop + (rowHeight * i);
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    const xTicks = [0, 0.25, 0.5, 0.75, 1];
    xTicks.forEach((tick) => {
      const x = marginLeft + (plotWidth * tick);
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, marginTop + plotHeight);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    rowLabels.forEach((entry, index) => {
      const y = marginTop + (index + 0.5) * rowHeight;
      ctx.fillText(entry.noteLabel, marginLeft - 10, y + 3);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    xTicks.forEach((tick) => {
      const x = marginLeft + (plotWidth * tick);
      const label = tick === 1 ? 'Now' : `${Math.round((sessionDuration * tick) / 1000)}s`;
      ctx.fillText(label, x, height - 8);
    });

    entries.forEach((entry) => {
      const row = rowIndex.get(entry.noteLabel);
      if (!Number.isFinite(row)) return;

      const rowTop = marginTop + (row * rowHeight) + 2;
      const innerHeight = Math.max(10, rowHeight - 4);
      const startX = marginLeft + ((entry.startOffset / sessionDuration) * plotWidth);
      const endX = marginLeft + ((entry.endOffset / sessionDuration) * plotWidth);
      const segmentWidth = Math.max(2, endX - startX);
      const segmentColor = noteColorFromLabel(entry.noteLabel, 0.88);

      ctx.fillStyle = segmentColor;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, startX, rowTop, segmentWidth, innerHeight, 6);
      ctx.fill();
      ctx.stroke();

      if (segmentWidth > 36) {
        ctx.fillStyle = '#f7fbff';
        ctx.font = '600 10px Inter, Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(entry.noteLabel, startX + 6, rowTop + innerHeight - 4);
      }
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Time →', marginLeft, height - 8);
    ctx.save();
    ctx.translate(16, marginTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Note', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawSummary(ctx, width, height, frame) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawPanelBackground(ctx, width, height);

    const rawFrequency = getRawFrequency(frame);
    const hpsFrequency = getHpsFrequency(frame);
    const selectedFrequency = getSelectedFrequency(frame);
    const noteLabel = getFrameNoteLabel(frame) || '—';
    const confidence = getFrameConfidence(frame);
    const mfcc = computeDisplayMfccCoefficients(frame);
    const sessions = loadSessionsFromStorage();
    const currentSession = getTimelineSession(sessions);
    const noteCount = currentSession && Array.isArray(currentSession.notes) ? currentSession.notes.length : 0;
    const accentColor = noteColorFromLabel(noteLabel, 0.95);
    const cardW = (width - 30) / 3;
    const cardH = (height - 34) / 2;
    const cards = [
      ['Status', frame && frame.sessionActive ? (frame.isBreathDominant ? 'Breath' : frame.rejectedFrame ? 'Rejected' : 'Live') : 'Idle'],
      ['Raw FFT', formatHz(rawFrequency)],
      ['HPS', formatHz(hpsFrequency)],
      ['Selected', formatHz(selectedFrequency)],
      ['Note', noteLabel],
      ['Confidence', formatPercent(confidence)]
    ];

    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 10 + (col * (cardW + 5));
      const y = 10 + (row * (cardH + 5));
      ctx.fillStyle = 'rgba(8, 13, 20, 0.92)';
      ctx.strokeStyle = index === 0 ? accentColor : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      drawRoundedRectPath(ctx, x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.font = '600 10px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card[0], x + 10, y + 16);

      ctx.fillStyle = '#f7fbff';
      ctx.font = '700 15px Inter, Segoe UI, sans-serif';
      ctx.fillText(card[1], x + 10, y + 36);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '600 10px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Pipeline', 10, height - 18);
    ctx.font = '500 10px Inter, Segoe UI, sans-serif';
    ctx.fillText('FFT → HPS → MFCC → Stable Note', 70, height - 18);
    ctx.textAlign = 'right';
    ctx.fillText(`Notes ${noteCount}`, width - 10, height - 18);

    const mfccPreview = Array.from(mfcc, (value) => value.toFixed(2)).join('  ');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(`mfccCoefficients: ${mfccPreview}`, width - 10, height - 6);

    ctx.restore();
  }

  function drawFrame(frame) {
    if (state.spectrumCanvas) {
      const spectrumSize = setCanvasSize(state.spectrumCanvas);
      if (spectrumSize) drawSpectrum(spectrumSize.ctx, spectrumSize.width, spectrumSize.height, frame);
    }

    if (state.spectrogramCanvas) {
      const spectrogramSize = setCanvasSize(state.spectrogramCanvas);
      if (spectrogramSize) drawSpectrogram(spectrogramSize.ctx, spectrogramSize.width, spectrogramSize.height, frame);
    }

    if (state.waveformCanvas) {
      const waveformSize = setCanvasSize(state.waveformCanvas);
      if (waveformSize) drawWaveform(waveformSize.ctx, waveformSize.width, waveformSize.height, frame);
    }

    if (state.mfccCanvas) {
      const mfccSize = setCanvasSize(state.mfccCanvas);
      if (mfccSize) drawMfcc(mfccSize.ctx, mfccSize.width, mfccSize.height, frame);
    }

    if (state.timelineCanvas) {
      const timelineSize = setCanvasSize(state.timelineCanvas);
      if (timelineSize) drawTimeline(timelineSize.ctx, timelineSize.width, timelineSize.height, frame);
    }

    if (state.summaryCanvas) {
      const summarySize = setCanvasSize(state.summaryCanvas);
      if (summarySize) drawSummary(summarySize.ctx, summarySize.width, summarySize.height, frame);
    }
  }

  function startRenderLoop() {
    if (state.drawTimer || !state.sessionActive) return;

    const tick = () => {
      state.drawTimer = window.setTimeout(tick, RENDER_INTERVAL_MS);
      drawFrame(state.latestFrame);
    };

    drawFrame(state.latestFrame);
    state.drawTimer = window.setTimeout(tick, RENDER_INTERVAL_MS);
  }

  function stopRenderLoop() {
    if (!state.drawTimer) return;
    clearTimeout(state.drawTimer);
    state.drawTimer = null;
  }

  function mountVisualizer(containerId = 'visualizer-container') {
    const host = document.getElementById(containerId) || document.getElementById('visualizer-container');
    if (!host) return;

    const panel = host.id === 'visualizer-container' ? host : host.querySelector('#visualizer-container');
    if (!panel) return;

    state.panel = panel;
    state.containerId = panel.id || containerId;
    panel.innerHTML = `
      <section class="visualizer-stage visualizer-stage-spectrum">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">FFT Spectrum</div>
            <div class="visualizer-subtitle">Frequency labels, note labels, and the dominant peak are painted from the live analyser frame.</div>
          </div>
          <div class="visualizer-status">Live</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-spectrum" data-role="spectrum-canvas"></canvas>
        <div class="visualizer-axis-caption">The dominant frequency stays highlighted while harmonics remain visible.</div>
      </section>

      <section class="visualizer-stage visualizer-stage-spectrogram">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">Spectrogram</div>
            <div class="visualizer-subtitle">A bounded rolling history with time and note labels over the same live FFT stream.</div>
          </div>
          <div class="visualizer-status visualizer-status-muted">Rolling</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-spectrogram" data-role="spectrogram-canvas"></canvas>
        <div class="visualizer-axis-caption">Time runs left to right; frequency is labeled with matching musical notes.</div>
      </section>

      <section class="visualizer-stage visualizer-stage-waveform">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">Waveform</div>
            <div class="visualizer-subtitle">Current time-domain analyser frame only, rendered with stronger amplitude contrast.</div>
          </div>
          <div class="visualizer-status visualizer-status-muted">Realtime</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-waveform" data-role="waveform-canvas"></canvas>
        <div class="visualizer-axis-caption">The trace uses the current note color when a stable pitch is available.</div>
      </section>

      <section class="visualizer-stage visualizer-stage-mfcc">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">MFCC Coefficients</div>
            <div class="visualizer-subtitle">A display-side coefficient bar graph derived from the same live FFT frame.</div>
          </div>
          <div class="visualizer-status visualizer-status-muted">13 bands</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-mfcc" data-role="mfcc-canvas"></canvas>
        <div class="visualizer-axis-caption">The coefficient array remains visible as bars and inline values.</div>
      </section>

      <section class="visualizer-stage visualizer-stage-timeline">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">Note Timeline</div>
            <div class="visualizer-subtitle">Discrete note steps plotted against time from the stored session timeline.</div>
          </div>
          <div class="visualizer-status visualizer-status-muted">Session</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-timeline" data-role="timeline-canvas"></canvas>
        <div class="visualizer-axis-caption">Time runs on X; note labels are stacked on discrete Y rows.</div>
      </section>

      <section class="visualizer-stage visualizer-stage-summary">
        <div class="visualizer-stage-header">
          <div>
            <div class="visualizer-title">Analysis Summary</div>
            <div class="visualizer-subtitle">Raw, HPS, selected note, confidence, and pipeline state rendered without DOM churn.</div>
          </div>
          <div class="visualizer-status visualizer-status-muted">Live metrics</div>
        </div>
        <canvas class="visualizer-canvas visualizer-canvas-summary" data-role="summary-canvas"></canvas>
        <div class="visualizer-axis-caption">The summary card stays in sync with the latest live frame snapshot.</div>
      </section>`;

    state.spectrumCanvas = panel.querySelector('[data-role="spectrum-canvas"]');
    state.spectrogramCanvas = panel.querySelector('[data-role="spectrogram-canvas"]');
    state.waveformCanvas = panel.querySelector('[data-role="waveform-canvas"]');
    state.mfccCanvas = panel.querySelector('[data-role="mfcc-canvas"]');
    state.timelineCanvas = panel.querySelector('[data-role="timeline-canvas"]');
    state.summaryCanvas = panel.querySelector('[data-role="summary-canvas"]');

    state.spectrumCtx = state.spectrumCanvas ? state.spectrumCanvas.getContext('2d') : null;
    state.spectrogramCtx = state.spectrogramCanvas ? state.spectrogramCanvas.getContext('2d') : null;
    state.waveformCtx = state.waveformCanvas ? state.waveformCanvas.getContext('2d') : null;
    state.mfccCtx = state.mfccCanvas ? state.mfccCanvas.getContext('2d') : null;
    state.timelineCtx = state.timelineCanvas ? state.timelineCanvas.getContext('2d') : null;
    state.summaryCtx = state.summaryCanvas ? state.summaryCanvas.getContext('2d') : null;

    drawFrame(state.latestFrame);
    startRenderLoop();
  }

  function unmountVisualizer() {
    if (state.panel) {
      state.panel.innerHTML = '';
    }

    state.panel = null;
    state.containerId = null;
    state.spectrumCanvas = null;
    state.spectrogramCanvas = null;
    state.waveformCanvas = null;
    state.mfccCanvas = null;
    state.timelineCanvas = null;
    state.summaryCanvas = null;
    state.spectrumCtx = null;
    state.spectrogramCtx = null;
    state.waveformCtx = null;
    state.mfccCtx = null;
    state.timelineCtx = null;
    state.summaryCtx = null;

    if (!state.sessionActive) {
      stopRenderLoop();
    }
  }

  function updateVisualizerFrame(frame) {
    state.latestFrame = frame || null;
    state.sessionActive = Boolean(state.latestFrame && state.latestFrame.sessionActive);

    if (state.sessionActive) {
      pushSpectrogramFrame(state.latestFrame);
      startRenderLoop();
    } else {
      resetSpectrogramState();
      stopRenderLoop();
    }
  }

  function clearVisualizerFrame() {
    state.latestFrame = null;
    state.sessionActive = false;
    resetSpectrogramState();
    stopRenderLoop();
    if (state.panel) {
      drawFrame(null);
    }
  }

  function refreshVisualizerLayout() {
    drawFrame(state.latestFrame);
  }

  window.mountVisualizer = mountVisualizer;
  window.unmountVisualizer = unmountVisualizer;
  window.renderVisualizer = mountVisualizer;
  window.updateVisualizerFrame = updateVisualizerFrame;
  window.clearVisualizerFrame = clearVisualizerFrame;
  window.refreshVisualizerLayout = refreshVisualizerLayout;

  window.addEventListener('resize', () => {
    if (state.panel) {
      drawFrame(state.latestFrame);
    }
  });
})();
