// visualizer.js - real-time FFT spectrum rendering + spectrogram + waveform + debug panel
// Called by dashboard.js: window.renderVisualizer(containerId)

(function () {
  const SPECTROGRAM_COLUMN_COUNT = 240;
  const SPECTROGRAM_BAND_COUNT = 64;
  const SPECTROGRAM_MAX_FREQUENCY = 4000;

  const state = {
    panel: null,
    spectrumCanvas: null,
    spectrogramCanvas: null,
    waveformCanvas: null,
    spectrumCtx: null,
    spectrogramCtx: null,
    waveformCtx: null,
    latestFrame: null,
    pendingDraw: false,
    spectrogram: {
      columns: [],
      writeIndex: 0,
      count: 0,
      columnCount: SPECTROGRAM_COLUMN_COUNT,
      bandCount: SPECTROGRAM_BAND_COUNT,
      sourceBinCount: 0,
      palette: []
    },
    elements: {
      status: null,
      rawFrequency: null,
      hpsFrequency: null,
      selectedFrequency: null,
      confidence: null,
      noteLabel: null,
      rejectedFrames: null,
      breathScore: null,
      frameState: null,
      sampleRate: null,
      fftSize: null
    }
  };

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

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.round(Math.max(0, value) * 100)}%`;
  }

  function setText(element, value) {
    if (element) element.textContent = value;
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

  function ensureSpectrogramState(frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) return false;

    if (!state.spectrogram.columns.length || state.spectrogram.sourceBinCount !== spectrum.length) {
      state.spectrogram.sourceBinCount = spectrum.length;
      state.spectrogram.columns = Array.from(
        { length: state.spectrogram.columnCount },
        () => new Float32Array(state.spectrogram.bandCount)
      );
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
    state.spectrogram.writeIndex = 0;
    state.spectrogram.count = 0;
  }

  function pushSpectrogramFrame(frame) {
    if (!ensureSpectrogramState(frame)) return;

    const spectrum = getFrameSpectrum(frame);
    const column = state.spectrogram.columns[state.spectrogram.writeIndex];
    if (!column) return;

    const sampleRate = Number.isFinite(frame.sampleRate) ? frame.sampleRate : 48000;
    const fftSize = Number.isFinite(frame.fftSize) ? frame.fftSize : spectrum.length * 2;
    const maxVisibleBin = Math.max(1, Math.min(spectrum.length - 1, Math.floor((SPECTROGRAM_MAX_FREQUENCY * fftSize) / sampleRate)));
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

    state.spectrogram.writeIndex = (state.spectrogram.writeIndex + 1) % state.spectrogram.columnCount;
    state.spectrogram.count = Math.min(state.spectrogram.count + 1, state.spectrogram.columnCount);
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
    return { ctx, width: cssWidth, height: cssHeight, dpr };
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

  function drawSpectrum(ctx, width, height, frame) {
    const spectrum = getFrameSpectrum(frame);
    if (!spectrum || spectrum.length === 0) {
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for FFT data' : 'Visualizer Idle', 'Spectrum and harmonics will appear once the analyser stream is live.');
      return;
    }

    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const maxFrequency = Math.max(1, (Number.isFinite(frame && frame.sampleRate) ? frame.sampleRate : 48000) / 2);

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

      const label = `${100 - (i * 25)}%`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, marginLeft - 8, y + 3);
    }

    const xTicks = [0, 0.25, 0.5, 0.75, 1];
    xTicks.forEach((tick) => {
      const x = marginLeft + (plotWidth * tick);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, height - marginBottom);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(formatAxisFrequency(maxFrequency * tick), x, height - 10);
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

      const normalized = Math.max(0, Math.min(1, maxMagnitude));
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
    const peakLineColor = frame && frame.noteLabel ? '#ffcc66' : '#8be8f5';

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
      ctx.beginPath();
      ctx.moveTo(peakX, marginTop);
      ctx.lineTo(peakX, marginTop + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = peakLineColor;
      ctx.fillRect(peakX - 3, marginTop + plotHeight - 10, 6, 10);

      const bubbleText = `${formatHz(selectedFrequency)}${frame && frame.noteLabel ? ` • ${frame.noteLabel}` : ''}`;
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

      const harmonicBase = selectedFrequency;
      for (let harmonicIndex = 2; harmonicIndex <= 5; harmonicIndex++) {
        const harmonicFrequency = harmonicBase * harmonicIndex;
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
      drawIdleState(ctx, width, height, frame && frame.sessionActive ? 'Waiting for spectrogram data' : 'Spectrogram Idle', 'Columns update from the current analyser frame only.');
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
    [0, 1000, 2000, 3000, 4000].forEach((frequency) => {
      const tick = frequency / SPECTROGRAM_MAX_FREQUENCY;
      const y = marginTop + plotHeight - (plotHeight * tick);
      ctx.fillText(formatAxisFrequency(frequency), marginLeft - 8, y + 3);
    });

    if (!state.spectrogram.count) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.font = '600 14px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for live FFT columns', width / 2, height / 2 - 4);
      ctx.font = '400 12px Inter, Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText('The rolling buffer fills from the same session frame stream.', width / 2, height / 2 + 16);
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
        const intensity = Math.max(0, Math.min(1, column[band] || 0));
        const paletteIndex = Math.max(0, Math.min(255, Math.round(intensity * 255)));
        const drawY = marginTop + plotHeight - ((band + 1) * bandHeight);
        ctx.fillStyle = palette[paletteIndex];
        ctx.fillRect(drawX, drawY, Math.max(1, columnWidth + 0.25), bandHeight + 0.25);
      }
    }

    const selectedFrequency = getSelectedFrequency(frame) || getHpsFrequency(frame) || getRawFrequency(frame);
    if (selectedFrequency) {
      const markerY = marginTop + plotHeight - (Math.max(0, Math.min(SPECTROGRAM_MAX_FREQUENCY, selectedFrequency)) / SPECTROGRAM_MAX_FREQUENCY) * plotHeight;
      ctx.strokeStyle = 'rgba(255, 204, 102, 0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(marginLeft, markerY);
      ctx.lineTo(width - marginRight, markerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

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

    ctx.strokeStyle = '#8be8f5';
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    const samples = waveform.length;
    for (let x = 0; x < plotWidth; x++) {
      const sampleIndex = Math.min(samples - 1, Math.floor((x / Math.max(1, plotWidth - 1)) * (samples - 1)));
      const sample = normalizeWaveformSample(waveform[sampleIndex]);
      const y = baselineY - (sample * (plotHeight / 2));

      if (x === 0) ctx.moveTo(marginLeft + x, y);
      else ctx.lineTo(marginLeft + x, y);
    }

    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    ctx.font = '600 11px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Amplitude', marginLeft, 12);
    ctx.textAlign = 'right';
    ctx.fillText('1', marginLeft - 8, marginTop + 3);
    ctx.fillText('0', marginLeft - 8, baselineY + 3);
    ctx.fillText('-1', marginLeft - 8, marginTop + plotHeight - 1);

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
  }

  function scheduleDraw() {
    if (state.pendingDraw) return;
    state.pendingDraw = true;
    requestAnimationFrame(() => {
      state.pendingDraw = false;
      drawFrame(state.latestFrame);
    });
  }

  function updateDebugPanel(frame) {
    const status = frame && frame.sessionActive
      ? (frame.isBreathDominant ? 'Breath' : frame.rejectedFrame ? 'Rejected' : frame.isRecording ? 'Recording' : 'Live')
      : 'Idle';

    const rawFrequency = getRawFrequency(frame);
    const hpsFrequency = getHpsFrequency(frame);
    const selectedFrequency = getSelectedFrequency(frame);

    setText(state.elements.status, status);
    setText(state.elements.rawFrequency, formatHz(rawFrequency));
    setText(state.elements.hpsFrequency, formatHz(hpsFrequency));
    setText(state.elements.selectedFrequency, formatHz(selectedFrequency));
    setText(state.elements.confidence, formatPercent(frame && Number.isFinite(frame.filteredConfidence) ? frame.filteredConfidence : (frame && Number.isFinite(frame.rawConfidence) ? frame.rawConfidence : 0)));
    setText(state.elements.noteLabel, frame && frame.noteLabel ? frame.noteLabel : '—');
    setText(state.elements.rejectedFrames, String(frame && Number.isFinite(frame.rejectedFrames) ? frame.rejectedFrames : 0));
    setText(state.elements.breathScore, formatPercent(frame && Number.isFinite(frame.breathScore) ? frame.breathScore : 0));
    setText(state.elements.frameState, frame && frame.isBreathDominant
      ? 'Breath filtered'
      : (frame && frame.rejectedFrame
        ? 'Filtered out'
        : (frame && frame.noteLabel ? 'Accepted' : 'Awaiting note')));
    setText(state.elements.sampleRate, formatAxisFrequency(frame && Number.isFinite(frame.sampleRate) ? frame.sampleRate : 0));
    setText(state.elements.fftSize, String(frame && Number.isFinite(frame.fftSize) ? frame.fftSize : '—'));

    if (state.panel) {
      state.panel.dataset.visualizerStatus = status;
      state.panel.dataset.visualizerNote = frame && frame.noteLabel ? frame.noteLabel : '';
      state.panel.dataset.visualizerFrequency = formatHz(selectedFrequency);
    }
  }

  function renderVisualizer(containerId) {
    const panel = document.getElementById(containerId);
    if (!panel) return;

    state.panel = panel;
    panel.innerHTML = `
      <div class="visualizer-shell">
        <div class="visualizer-stage visualizer-stage-spectrum">
          <div class="visualizer-stage-header">
            <div>
              <div class="visualizer-title">Live FFT Spectrum</div>
              <div class="visualizer-subtitle">Real-time only. No history is stored.</div>
            </div>
            <div class="visualizer-status" data-role="visualizer-status">Idle</div>
          </div>
          <canvas class="visualizer-canvas visualizer-canvas-spectrum" data-role="visualizer-canvas"></canvas>
          <div class="visualizer-axis-caption">Peak, harmonics, and energy distribution update live from the active analyser frame.</div>
        </div>

        <div class="visualizer-stage visualizer-stage-spectrogram">
          <div class="visualizer-stage-header">
            <div>
              <div class="visualizer-title">Live Spectrogram</div>
              <div class="visualizer-subtitle">Time flows left to right from the same FFT frame stream.</div>
            </div>
            <div class="visualizer-status visualizer-status-muted">Rolling</div>
          </div>
          <canvas class="visualizer-canvas visualizer-canvas-spectrogram" data-role="spectrogram-canvas"></canvas>
          <div class="visualizer-axis-caption">X axis = time, Y axis = frequency, color = amplitude.</div>
        </div>

        <div class="visualizer-stage visualizer-stage-waveform">
          <div class="visualizer-stage-header">
            <div>
              <div class="visualizer-title">Live Waveform</div>
              <div class="visualizer-subtitle">Current time-domain analyser frame only.</div>
            </div>
            <div class="visualizer-status visualizer-status-muted">Realtime</div>
          </div>
          <canvas class="visualizer-canvas visualizer-canvas-waveform" data-role="waveform-canvas"></canvas>
          <div class="visualizer-axis-caption">Amplitude is normalized from the current analyser frame without history.</div>
        </div>

        <div class="visualizer-summary-grid">
          <div class="visualizer-metric">
            <span>Raw FFT Peak</span>
            <strong data-role="raw-frequency">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>HPS Frequency</span>
            <strong data-role="hps-frequency">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Final Selected</span>
            <strong data-role="selected-frequency">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Current Note</span>
            <strong data-role="note-label">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Confidence</span>
            <strong data-role="confidence">0%</strong>
          </div>
          <div class="visualizer-metric">
            <span>Rejected Frames</span>
            <strong data-role="rejected-frames">0</strong>
          </div>
        </div>

        <div class="visualizer-debug-panel">
          <div class="visualizer-debug-row">
            <span>Frame State</span>
            <strong data-role="frame-state">Awaiting note</strong>
          </div>
          <div class="visualizer-debug-row">
            <span>Breath Score</span>
            <strong data-role="breath-score">0%</strong>
          </div>
          <div class="visualizer-debug-row">
            <span>Sample Rate</span>
            <strong data-role="sample-rate">—</strong>
          </div>
          <div class="visualizer-debug-row">
            <span>FFT Size</span>
            <strong data-role="fft-size">—</strong>
          </div>
        </div>
      </div>`;

    state.spectrumCanvas = panel.querySelector('[data-role="visualizer-canvas"]');
    state.spectrogramCanvas = panel.querySelector('[data-role="spectrogram-canvas"]');
    state.waveformCanvas = panel.querySelector('[data-role="waveform-canvas"]');
    state.spectrumCtx = state.spectrumCanvas ? state.spectrumCanvas.getContext('2d') : null;
    state.spectrogramCtx = state.spectrogramCanvas ? state.spectrogramCanvas.getContext('2d') : null;
    state.waveformCtx = state.waveformCanvas ? state.waveformCanvas.getContext('2d') : null;

    state.elements = {
      status: panel.querySelector('[data-role="visualizer-status"]'),
      rawFrequency: panel.querySelector('[data-role="raw-frequency"]'),
      hpsFrequency: panel.querySelector('[data-role="hps-frequency"]'),
      selectedFrequency: panel.querySelector('[data-role="selected-frequency"]'),
      confidence: panel.querySelector('[data-role="confidence"]'),
      noteLabel: panel.querySelector('[data-role="note-label"]'),
      rejectedFrames: panel.querySelector('[data-role="rejected-frames"]'),
      breathScore: panel.querySelector('[data-role="breath-score"]'),
      frameState: panel.querySelector('[data-role="frame-state"]'),
      sampleRate: panel.querySelector('[data-role="sample-rate"]'),
      fftSize: panel.querySelector('[data-role="fft-size"]')
    };

    updateDebugPanel(state.latestFrame);
    drawFrame(state.latestFrame);
  }

  function updateVisualizerFrame(frame) {
    state.latestFrame = frame || null;
    if (state.latestFrame && state.latestFrame.sessionActive) {
      pushSpectrogramFrame(state.latestFrame);
    } else if (!state.latestFrame || state.latestFrame.sessionActive === false) {
      resetSpectrogramState();
    }
    updateDebugPanel(state.latestFrame);
    scheduleDraw();
  }

  function clearVisualizerFrame() {
    state.latestFrame = null;
    resetSpectrogramState();
    updateDebugPanel(null);
    drawFrame(null);
  }

  function refreshVisualizerLayout() {
    drawFrame(state.latestFrame);
  }

  window.renderVisualizer = renderVisualizer;
  window.updateVisualizerFrame = updateVisualizerFrame;
  window.clearVisualizerFrame = clearVisualizerFrame;
  window.refreshVisualizerLayout = refreshVisualizerLayout;

  window.addEventListener('resize', () => {
    if (state.panel) {
      scheduleDraw();
    }
  });
})();
