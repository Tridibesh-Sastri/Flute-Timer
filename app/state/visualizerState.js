(function () {
  if (window.visualizerState) return;

  window.visualizerState = {
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
      columnCount: 240,
      bandCount: 64,
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
      melEnergies: new Float32Array(26),
      logEnergies: new Float32Array(26),
      coefficients: new Float32Array(13)
    }
  };
})();