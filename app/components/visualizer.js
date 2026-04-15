// visualizer.js - real-time FFT spectrum rendering + debug panel
// Called by dashboard.js: window.renderVisualizer(containerId)

(function () {
  const state = {
    panel: null,
    canvas: null,
    ctx: null,
    latestFrame: null,
    pendingDraw: false,
    elements: {
      status: null,
      rawFrequency: null,
      filteredFrequency: null,
      confidence: null,
      noteLabel: null,
      rejectedFrames: null,
      rawNoteLabel: null,
      breathScore: null,
      frameState: null
    }
  };

  const DB_FLOOR = -120;
  const DB_CEILING = 0;

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
    return {
      ctx,
      width: cssWidth,
      height: cssHeight,
      dpr
    };
  }

  function updateDebugPanel(frame) {
    const status = frame && frame.sessionActive
      ? (frame.isBreathDominant ? 'Breath' : frame.rejectedFrame ? 'Rejected' : frame.isRecording ? 'Recording' : 'Live')
      : 'Idle';

    const effectiveFrequency = Number.isFinite(frame && frame.filteredFrequencyHz)
      ? frame.filteredFrequencyHz
      : (frame && Number.isFinite(frame.rawFrequencyHz) ? frame.rawFrequencyHz : null);

    setText(state.elements.status, status);
    setText(state.elements.rawFrequency, formatHz(frame && frame.rawFrequencyHz));
    setText(state.elements.filteredFrequency, formatHz(frame && frame.filteredFrequencyHz));
    setText(state.elements.confidence, formatPercent(frame && Number.isFinite(frame.filteredConfidence) ? frame.filteredConfidence : (frame && Number.isFinite(frame.rawConfidence) ? frame.rawConfidence : 0)));
    setText(state.elements.noteLabel, frame && frame.noteLabel ? frame.noteLabel : '—');
    setText(state.elements.rejectedFrames, String(frame && Number.isFinite(frame.rejectedFrames) ? frame.rejectedFrames : 0));
    setText(state.elements.rawNoteLabel, frame && frame.rawFrequencyHz ? (frame.noteLabel || (frame.rejectedFrame ? 'Filtered' : '—')) : '—');
    setText(state.elements.breathScore, formatPercent(frame && Number.isFinite(frame.breathScore) ? frame.breathScore : 0));
    setText(state.elements.frameState, frame && frame.isBreathDominant
      ? 'Breath filtered'
      : (frame && frame.rejectedFrame
        ? 'Filtered out'
        : (frame && frame.noteLabel ? 'Accepted' : 'Awaiting note')));

    if (state.panel) {
      state.panel.dataset.visualizerStatus = status;
      state.panel.dataset.visualizerNote = frame && frame.noteLabel ? frame.noteLabel : '';
      state.panel.dataset.visualizerFrequency = formatHz(effectiveFrequency);
    }
  }

  function drawIdleState(ctx, width, height, message) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(7, 12, 18, 0.98)');
    background.addColorStop(1, 'rgba(10, 18, 28, 0.96)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    for (let i = 0; i <= 4; i++) {
      const y = marginTop + (plotHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(width - marginRight, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '600 14px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2 - 6);
    ctx.font = '400 12px Inter, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('No live FFT frame available yet.', width / 2, height / 2 + 14);
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
    const spectrum = frame && frame.spectrumDb && typeof frame.spectrumDb.length === 'number'
      ? frame.spectrumDb
      : null;

    if (!spectrum || spectrum.length === 0) {
      drawIdleState(ctx, width, height, 'Visualizer Idle');
      return;
    }

    const marginLeft = 54;
    const marginRight = 18;
    const marginTop = 20;
    const marginBottom = 30;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const maxFrequency = Math.max(1, (frame && Number.isFinite(frame.sampleRate) ? frame.sampleRate : 48000) / 2);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(7, 12, 18, 0.98)');
    background.addColorStop(1, 'rgba(10, 18, 28, 0.96)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

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
      const frequencyLabel = formatAxisFrequency(maxFrequency * tick);
      ctx.fillText(frequencyLabel, x, height - 10);
    });

    const barCount = Math.max(72, Math.min(240, Math.floor(plotWidth / 3)));
    const binsPerBar = spectrum.length / barCount;
    let strongestValue = Number.NEGATIVE_INFINITY;
    let strongestBarIndex = 0;

    for (let barIndex = 0; barIndex < barCount; barIndex++) {
      const startBin = Math.floor(barIndex * binsPerBar);
      const endBin = Math.max(startBin + 1, Math.floor((barIndex + 1) * binsPerBar));
      let maxDb = Number.NEGATIVE_INFINITY;

      for (let bin = startBin; bin < endBin && bin < spectrum.length; bin++) {
        const value = spectrum[bin];
        if (Number.isFinite(value) && value > maxDb) {
          maxDb = value;
        }
      }

      if (!Number.isFinite(maxDb)) maxDb = DB_FLOOR;
      if (maxDb > strongestValue) {
        strongestValue = maxDb;
        strongestBarIndex = barIndex;
      }

      const normalized = Math.max(0, Math.min(1, (maxDb - DB_FLOOR) / (DB_CEILING - DB_FLOOR)));
      const barHeight = Math.max(2, normalized * plotHeight);
      const barWidth = Math.max(1, (plotWidth / barCount) - 1);
      const x = marginLeft + (barIndex / barCount) * plotWidth;
      const y = marginTop + plotHeight - barHeight;
      const hue = 192 - (normalized * 120);
      const lightness = 28 + (normalized * 34);
      ctx.fillStyle = `hsla(${hue}, 90%, ${lightness}%, 0.95)`;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    const peakFrequency = Number.isFinite(frame && frame.filteredFrequencyHz) && frame.filteredFrequencyHz > 0
      ? frame.filteredFrequencyHz
      : (Number.isFinite(frame && frame.rawFrequencyHz) && frame.rawFrequencyHz > 0 ? frame.rawFrequencyHz : null);
    const peakLabel = frame && frame.noteLabel ? frame.noteLabel : (frame && frame.rejectedFrame ? 'Rejected' : 'Peak');
    const peakLineColor = frame && frame.noteLabel ? '#ffcc66' : (frame && frame.rejectedFrame ? '#ff6b6b' : '#8be8f5');

    if (peakFrequency) {
      const peakX = marginLeft + Math.max(0, Math.min(1, peakFrequency / maxFrequency)) * plotWidth;
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

      const bubbleText = `${formatHz(peakFrequency)}${frame && frame.noteLabel ? ` • ${frame.noteLabel}` : ''}`;
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

      const harmonicBase = peakFrequency;
      let harmonicIndex = 2;
      while (harmonicIndex <= 5) {
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
        harmonicIndex += 1;
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

  function drawFrame(frame) {
    if (!state.canvas || !state.ctx) return;
    const size = setCanvasSize(state.canvas);
    if (!size) return;

    if (!frame || !frame.spectrumDb || frame.spectrumDb.length === 0) {
      drawIdleState(size.ctx, size.width, size.height, frame && frame.sessionActive ? 'Waiting for FFT data' : 'Visualizer Idle');
      return;
    }

    drawSpectrum(size.ctx, size.width, size.height, frame);
  }

  function scheduleDraw() {
    if (state.pendingDraw) return;
    state.pendingDraw = true;
    requestAnimationFrame(() => {
      state.pendingDraw = false;
      drawFrame(state.latestFrame);
    });
  }

  function renderVisualizer(containerId) {
    const panel = document.getElementById(containerId);
    if (!panel) return;

    state.panel = panel;
    panel.innerHTML = `
      <div class="visualizer-shell">
        <div class="visualizer-stage">
          <div class="visualizer-stage-header">
            <div>
              <div class="visualizer-title">Live FFT Spectrum</div>
              <div class="visualizer-subtitle">Real-time only. No history is stored.</div>
            </div>
            <div class="visualizer-status" data-role="visualizer-status">Idle</div>
          </div>
          <canvas class="visualizer-canvas" data-role="visualizer-canvas"></canvas>
          <div class="visualizer-axis-caption">Peak, harmonics, and energy distribution update live from the active analyser frame.</div>
        </div>

        <div class="visualizer-summary-grid">
          <div class="visualizer-metric">
            <span>Raw Frequency</span>
            <strong data-role="raw-frequency">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Filtered Frequency</span>
            <strong data-role="filtered-frequency">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Confidence</span>
            <strong data-role="confidence">0%</strong>
          </div>
          <div class="visualizer-metric">
            <span>Current Note</span>
            <strong data-role="note-label">—</strong>
          </div>
          <div class="visualizer-metric">
            <span>Rejected Frames</span>
            <strong data-role="rejected-frames">0</strong>
          </div>
          <div class="visualizer-metric">
            <span>Breath Score</span>
            <strong data-role="breath-score">0%</strong>
          </div>
        </div>

        <div class="visualizer-debug-panel">
          <div class="visualizer-debug-row">
            <span>Frame State</span>
            <strong data-role="frame-state">Awaiting note</strong>
          </div>
          <div class="visualizer-debug-row">
            <span>Peak Note Label</span>
            <strong data-role="raw-note-label">—</strong>
          </div>
        </div>
      </div>`;

    state.canvas = panel.querySelector('[data-role="visualizer-canvas"]');
    state.ctx = state.canvas ? state.canvas.getContext('2d') : null;
    state.elements = {
      status: panel.querySelector('[data-role="visualizer-status"]'),
      rawFrequency: panel.querySelector('[data-role="raw-frequency"]'),
      filteredFrequency: panel.querySelector('[data-role="filtered-frequency"]'),
      confidence: panel.querySelector('[data-role="confidence"]'),
      noteLabel: panel.querySelector('[data-role="note-label"]'),
      rejectedFrames: panel.querySelector('[data-role="rejected-frames"]'),
      rawNoteLabel: panel.querySelector('[data-role="raw-note-label"]'),
      breathScore: panel.querySelector('[data-role="breath-score"]'),
      frameState: panel.querySelector('[data-role="frame-state"]')
    };

    updateDebugPanel(state.latestFrame);
    drawFrame(state.latestFrame);
  }

  function updateVisualizerFrame(frame) {
    state.latestFrame = frame || null;
    updateDebugPanel(state.latestFrame);
    scheduleDraw();
  }

  function clearVisualizerFrame() {
    state.latestFrame = null;
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
