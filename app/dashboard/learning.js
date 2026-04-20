(function () {
  const CURSOR_INTERVAL_MS = 50;
  const CURSOR_PX_PER_MS = 0.14;

  const state = {
    expectedSequence: [],
    userSequence: [],
    expectedBlocks: [],
    userBlocks: [],
    activeExpectedBlock: null,
    activeActualBlock: null,
    currentComparisonResult: null,
    latestDetectedNote: null,
    cursorStartTimeMs: 0,
    cursorTimer: null,
    timelineWidthPx: 0,
    expectedTrack: null,
    userTrack: null,
    cursor: null,
    comparisonStage: null,
    liveFeedback: null,
    sequenceStatus: null,
    latestDetectedStatus: null,
    input: null,
    parseButton: null
  };

  const NOTE_BASES = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };

  function clampNumber(value, minimum, maximum) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return minimum;
    return Math.min(maximum, Math.max(minimum, numericValue));
  }

  function clamp01(value) {
    return clampNumber(value, 0, 1);
  }

  function parseTimestampValue(value) {
    if (value instanceof Date) {
      const parsedDate = value.getTime();
      return Number.isFinite(parsedDate) ? parsedDate : null;
    }

    if (Number.isFinite(value)) {
      return Number(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const numericValue = Number(trimmed);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }

      const parsedDate = Date.parse(trimmed);
      return Number.isFinite(parsedDate) ? parsedDate : null;
    }

    return null;
  }

  function normalizeNoteLabel(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    if (/^REST$/i.test(text)) return null;
    const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(text);
    if (!match) return text.toUpperCase();
    return `${match[1].toUpperCase()}${match[2]}${match[3]}`;
  }

  function parseDuration(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const rounded = Math.round(numericValue);
    return rounded > 0 ? rounded : null;
  }

  function parseLearningSequence(text) {
    const lines = String(text || '').split(/\r?\n/);
    const sequence = [];
    let cursor = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const match = /^([A-G](?:#|b)?-?\d+|REST)\s+(\d+(?:\.\d+)?)$/i.exec(line);
      if (!match) continue;

      const note = normalizeNoteLabel(match[1]);
      const duration = parseDuration(match[2]);
      if (duration === null) continue;

      const entry = {
        note,
        start: cursor,
        duration,
        startTimeMs: cursor,
        durationMs: duration
      };

      sequence.push(entry);
      cursor += duration;
    }

    return sequence;
  }

  function loadSessions() {
    try {
      const stored = JSON.parse(localStorage.getItem('sessions'));
      return Array.isArray(stored) ? stored : [];
    } catch (err) {
      return [];
    }
  }

  function getLatestSessionWithNotes(sessions) {
    if (!Array.isArray(sessions)) return null;

    for (let i = sessions.length - 1; i >= 0; i--) {
      const session = sessions[i];
      if (session && Array.isArray(session.notes) && session.notes.length) {
        return session;
      }
    }

    return null;
  }

  function getEntryDuration(entry) {
    if (!entry) return 0;
    if (Number.isFinite(entry.duration)) return Math.max(0, entry.duration);
    if (Number.isFinite(entry.durationMs)) return Math.max(0, entry.durationMs);
    return 0;
  }

  function getEntryNoteLabel(entry) {
    if (!entry) return null;
    return normalizeNoteLabel(entry.note || entry.noteLabel || entry.dominantNote || entry.label);
  }

  function getNoteMidi(noteLabel) {
    const normalized = normalizeNoteLabel(noteLabel);
    if (!normalized) return null;

    const match = /^([A-G])([#b]?)(-?\d+)$/.exec(normalized);
    if (!match) return null;

    const base = NOTE_BASES[match[1]];
    const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    const octave = Number(match[3]);

    if (!Number.isFinite(base) || !Number.isFinite(octave)) return null;
    return ((octave + 1) * 12) + base + accidental;
  }

  function getDetectedNoteLabel(value) {
    if (!value || typeof value !== 'object') {
      return normalizeNoteLabel(value);
    }

    return normalizeNoteLabel(value.note || value.noteLabel || value.label);
  }

  function getDetectedNoteTimestampMs(value) {
    if (!value || typeof value !== 'object') {
      return parseTimestampValue(value);
    }

    return parseTimestampValue(
      value.timestamp ??
      value.startTimeMs ??
      value.startTime ??
      value.endTimeMs ??
      value.endTime
    );
  }

  function getDetectedNoteDurationMs(value) {
    if (!value || typeof value !== 'object') {
      return 0;
    }

    const durationMs = Number(value.durationMs ?? value.duration);
    if (Number.isFinite(durationMs)) {
      return Math.max(0, durationMs);
    }

    const startTimeMs = parseTimestampValue(value.startTimeMs ?? value.startTime);
    const endTimeMs = parseTimestampValue(value.endTimeMs ?? value.endTime);
    if (Number.isFinite(startTimeMs) && Number.isFinite(endTimeMs)) {
      return Math.max(0, endTimeMs - startTimeMs);
    }

    return 0;
  }

  function normalizeDetectedNote(note) {
    if (!note || typeof note !== 'object') {
      return null;
    }

    const noteLabel = getDetectedNoteLabel(note);
    if (!noteLabel) {
      return null;
    }

    const startTimeMs = parseTimestampValue(note.startTimeMs ?? note.startTime ?? note.timestamp);
    const endTimeMs = parseTimestampValue(note.endTimeMs ?? note.endTime);
    const durationValue = Number(note.durationMs ?? note.duration);
    const durationMs = Number.isFinite(durationValue)
      ? Math.max(0, durationValue)
      : (Number.isFinite(startTimeMs) && Number.isFinite(endTimeMs) ? Math.max(0, endTimeMs - startTimeMs) : 0);

    return {
      note: noteLabel,
      noteLabel,
      timestamp: Number.isFinite(startTimeMs) ? startTimeMs : (Number.isFinite(endTimeMs) ? endTimeMs : Date.now()),
      confidence: clamp01(Number(note.confidence ?? note.noteConfidence ?? note.pitchConfidence ?? 0)),
      durationMs,
      startTimeMs,
      endTimeMs,
      source: note
    };
  }

  function getLatestDetectedNoteFromSessions() {
    const sessions = window.sessions = loadSessions();
    const session = getLatestSessionWithNotes(sessions);
    if (!session || !Array.isArray(session.notes) || !session.notes.length) {
      return null;
    }

    const latestNote = normalizeDetectedNote(session.notes[session.notes.length - 1]);
    if (!latestNote) {
      return null;
    }

    latestNote.sessionId = session.id || null;
    latestNote.noteIndex = session.notes.length - 1;
    latestNote.sessionStartTimeMs = parseTimestampValue(session.startTime);
    return latestNote;
  }

  function syncLatestDetectedNoteFromSessions() {
    const latestNote = getLatestDetectedNoteFromSessions();
    window.latestDetectedNote = latestNote;
    state.latestDetectedNote = latestNote;
    return latestNote;
  }

  function getCurrentDetectedNote() {
    const currentNote = normalizeDetectedNote(window.latestDetectedNote);
    if (currentNote) {
      return currentNote;
    }

    return state.latestDetectedNote ? normalizeDetectedNote(state.latestDetectedNote) : null;
  }

  function getExpectedNoteAtTime(timeMs) {
    const elapsedMs = Math.max(0, Number(timeMs) || 0);

    for (let i = 0; i < state.expectedSequence.length; i++) {
      const entry = state.expectedSequence[i];
      const startTimeMs = Number.isFinite(entry.startTimeMs) ? entry.startTimeMs : Number(entry.start) || 0;
      const durationMs = getEntryDuration(entry);

      if (elapsedMs >= startTimeMs && elapsedMs < startTimeMs + durationMs) {
        return {
          ...entry,
          sequenceIndex: i
        };
      }
    }

    return null;
  }

  function comparePitch(expected, actual) {
    const expectedNote = getEntryNoteLabel(expected);
    const actualNote = getDetectedNoteLabel(actual);

    if (expectedNote === null && actualNote === null) {
      return 1;
    }

    if (expectedNote === null || actualNote === null) {
      return 0;
    }

    const expectedMidi = getNoteMidi(expectedNote);
    const actualMidi = getNoteMidi(actualNote);
    if (!Number.isFinite(expectedMidi) || !Number.isFinite(actualMidi)) {
      return expectedNote === actualNote ? 1 : 0;
    }

    const semitoneDistance = Math.abs(actualMidi - expectedMidi);
    if (semitoneDistance === 0) {
      return 1;
    }

    if (semitoneDistance <= 1) {
      return 0.6;
    }

    return 0;
  }

  function compareTiming(expectedStart, actualTime) {
    const expectedMs = parseTimestampValue(expectedStart);
    const actualMs = parseTimestampValue(actualTime);

    if (!Number.isFinite(expectedMs) || !Number.isFinite(actualMs)) {
      return {
        timingErrorMs: null,
        timingScore: 0
      };
    }

    const timingErrorMs = actualMs - expectedMs;
    const absErrorMs = Math.abs(timingErrorMs);

    let timingScore = 0;
    if (absErrorMs <= 50) {
      timingScore = 1;
    } else if (absErrorMs <= 120) {
      timingScore = 0.6;
    }

    return {
      timingErrorMs,
      timingScore
    };
  }

  function compareDuration(expectedDuration, actualDuration) {
    const expectedMs = Math.max(0, Number(expectedDuration) || 0);
    const actualMs = Math.max(0, Number(actualDuration) || 0);
    const absErrorMs = Math.abs(actualMs - expectedMs);

    if (absErrorMs <= 50) {
      return 1;
    }

    if (absErrorMs <= 120) {
      return 0.6;
    }

    return 0;
  }

  function buildComparisonResult(expected, actual) {
    const expectedNote = getEntryNoteLabel(expected);
    const actualNote = getDetectedNoteLabel(actual);
    const expectedStartMs = expected && Number.isFinite(expected.startTimeMs)
      ? expected.startTimeMs
      : (expected && Number.isFinite(expected.start) ? expected.start : null);
    const actualTimestampMs = getDetectedNoteTimestampMs(actual);
    const expectedDurationMs = getEntryDuration(expected);
    const actualDurationMs = getDetectedNoteDurationMs(actual);

    const pitchScore = comparePitch(expected, actual);

    let timingResult = {
      timingErrorMs: null,
      timingScore: 0
    };

    if (expectedNote === null && actualNote === null) {
      timingResult = {
        timingErrorMs: 0,
        timingScore: 1
      };
    } else if (expectedStartMs !== null && actualTimestampMs !== null) {
      timingResult = compareTiming(expectedStartMs, actualTimestampMs);
    }

    const durationScore = compareDuration(expectedDurationMs, actualNote === null ? 0 : actualDurationMs);
    const confidence = clamp01((pitchScore + timingResult.timingScore + durationScore) / 3);

    return {
      pitchScore,
      timingErrorMs: timingResult.timingErrorMs,
      durationScore,
      confidence,
      timingScore: timingResult.timingScore,
      expectedNote,
      actualNote,
      expectedDurationMs,
      actualDurationMs: actualNote === null ? 0 : actualDurationMs,
      expectedStartMs,
      actualTimestampMs,
      expectedIsRest: expectedNote === null,
      restPenalty: expectedNote === null && actualNote !== null
    };
  }

  function ensureLiveFeedbackElement() {
    if (state.liveFeedback && state.liveFeedback.isConnected) {
      return state.liveFeedback;
    }

    if (!state.comparisonStage) {
      state.comparisonStage = document.querySelector('.comparison-stage');
    }

    if (!state.comparisonStage) {
      return null;
    }

    let liveFeedback = document.getElementById('live-feedback');
    if (!liveFeedback) {
      liveFeedback = document.createElement('div');
      liveFeedback.id = 'live-feedback';
      liveFeedback.style.marginTop = '6px';
      liveFeedback.style.padding = '10px 12px';
      liveFeedback.style.borderRadius = '12px';
      liveFeedback.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      liveFeedback.style.background = 'rgba(10, 15, 24, 0.92)';
      liveFeedback.style.color = '#d9e1ea';
      liveFeedback.style.fontSize = '12px';
      liveFeedback.style.lineHeight = '1.5';
      liveFeedback.style.whiteSpace = 'pre-line';
      liveFeedback.style.minHeight = '56px';
      state.comparisonStage.appendChild(liveFeedback);
    }

    state.liveFeedback = liveFeedback;
    return liveFeedback;
  }

  function resetComparisonBlockVisual(block) {
    if (!block) return;

    block.classList.remove('is-active');
    block.style.background = '';
    block.style.borderColor = '';
    block.style.color = '';
    block.style.boxShadow = '';
    block.dataset.comparisonState = '';
  }

  function applyComparisonBlockVisual(block, result) {
    if (!block) return;

    const pitchScore = Number(result && result.pitchScore);
    let background = 'rgba(239, 68, 68, 0.84)';
    let borderColor = 'rgba(239, 68, 68, 0.98)';
    let color = '#ffffff';
    let shadow = '0 0 0 2px rgba(239, 68, 68, 0.22)';
    let comparisonState = 'miss';

    if (pitchScore === 1) {
      background = 'rgba(34, 197, 94, 0.82)';
      borderColor = 'rgba(34, 197, 94, 0.96)';
      shadow = '0 0 0 2px rgba(34, 197, 94, 0.24)';
      comparisonState = 'perfect';
    } else if (pitchScore > 0) {
      background = 'rgba(234, 179, 8, 0.84)';
      borderColor = 'rgba(234, 179, 8, 0.96)';
      color = '#1f2937';
      shadow = '0 0 0 2px rgba(234, 179, 8, 0.24)';
      comparisonState = 'partial';
    }

    block.classList.add('is-active');
    block.dataset.comparisonState = comparisonState;
    block.style.background = background;
    block.style.borderColor = borderColor;
    block.style.color = color;
    block.style.boxShadow = shadow;
  }

  function findMatchingUserBlock(actualNote) {
    const noteLabel = getDetectedNoteLabel(actualNote);
    if (!noteLabel) {
      return null;
    }

    for (let i = state.userSequence.length - 1; i >= 0; i--) {
      if (getEntryNoteLabel(state.userSequence[i]) === noteLabel) {
        return {
          block: state.userBlocks[i] || null,
          index: i
        };
      }
    }

    return null;
  }

  function clearComparisonState() {
    resetComparisonBlockVisual(state.activeExpectedBlock);
    resetComparisonBlockVisual(state.activeActualBlock);
    state.activeExpectedBlock = null;
    state.activeActualBlock = null;
  }

  function updateLiveFeedback(expected, actual, result) {
    const liveFeedback = ensureLiveFeedbackElement();
    if (!liveFeedback) return;

    const expectedLabel = expected ? (expected.note || 'REST') : '—';
    const actualLabel = actual ? (actual.note || 'REST') : '—';
    const timingLabel = Number.isFinite(result && result.timingErrorMs)
      ? `${Math.round(result.timingErrorMs)} ms`
      : '—';
    const durationLabel = Number.isFinite(result && result.actualDurationMs)
      ? `${Math.round(result.actualDurationMs)} ms`
      : '—';
    const confidenceLabel = Number.isFinite(result && result.confidence)
      ? `${Math.round(result.confidence * 100)}%`
      : '—';

    liveFeedback.textContent = [
      `Expected: ${expectedLabel}`,
      `Played: ${actualLabel}`,
      `Timing: ${timingLabel}`,
      `Duration: ${durationLabel}`,
      `Confidence: ${confidenceLabel}`
    ].join('\n');

    if (result.pitchScore === 1) {
      liveFeedback.style.borderColor = 'rgba(34, 197, 94, 0.45)';
      liveFeedback.style.background = 'rgba(12, 24, 18, 0.94)';
    } else if (result.pitchScore > 0) {
      liveFeedback.style.borderColor = 'rgba(234, 179, 8, 0.45)';
      liveFeedback.style.background = 'rgba(31, 25, 8, 0.94)';
    } else {
      liveFeedback.style.borderColor = 'rgba(239, 68, 68, 0.45)';
      liveFeedback.style.background = 'rgba(28, 11, 11, 0.94)';
    }
  }

  function updateComparisonFrame() {
    if (!state.expectedSequence.length) {
      clearComparisonState();
      if (state.liveFeedback) {
        state.liveFeedback.textContent = 'Load a sequence to start comparison.';
      }
      return;
    }

    const elapsedMs = state.cursorStartTimeMs ? Math.max(0, Date.now() - state.cursorStartTimeMs) : 0;
    const expected = getExpectedNoteAtTime(elapsedMs);
    const actual = getCurrentDetectedNote();

    if (actual && Number.isFinite(actual.confidence) && actual.confidence < 0.5) {
      return;
    }

    const result = buildComparisonResult(expected, actual);
    state.currentComparisonResult = result;

    const nextExpectedBlock = expected ? state.expectedBlocks[expected.sequenceIndex] || null : null;
    const nextActualMatch = actual ? findMatchingUserBlock(actual) : null;
    const nextActualBlock = nextActualMatch ? nextActualMatch.block : null;

    if (state.activeExpectedBlock && state.activeExpectedBlock !== nextExpectedBlock) {
      resetComparisonBlockVisual(state.activeExpectedBlock);
      state.activeExpectedBlock = null;
    }

    if (state.activeActualBlock && state.activeActualBlock !== nextActualBlock) {
      resetComparisonBlockVisual(state.activeActualBlock);
      state.activeActualBlock = null;
    }

    if (nextExpectedBlock) {
      state.activeExpectedBlock = nextExpectedBlock;
      applyComparisonBlockVisual(nextExpectedBlock, result);
    }

    if (nextActualBlock) {
      state.activeActualBlock = nextActualBlock;
      applyComparisonBlockVisual(nextActualBlock, result);
    }

    if (state.latestDetectedStatus) {
      state.latestDetectedStatus.textContent = actual
        ? `Latest detected: ${actual.note} (${Math.round(clamp01(actual.confidence) * 100)}%)`
        : 'Latest detected: —';
    }

    updateLiveFeedback(expected, actual, result);
  }

  function getSequenceTotalDuration(sequence) {
    if (!Array.isArray(sequence) || !sequence.length) return 0;
    return sequence.reduce((sum, entry) => sum + getEntryDuration(entry), 0);
  }

  function compareNotes(expectedEntry, actualEntry) {
    const expectedNote = getEntryNoteLabel(expectedEntry);
    const actualNote = getEntryNoteLabel(actualEntry);
    return expectedNote === actualNote;
  }

  function buildUserSequenceFromSessions() {
    const sessions = window.sessions = loadSessions();
    const session = getLatestSessionWithNotes(sessions);
    if (!session) {
      return [];
    }

    const sessionStart = session.startTime ? new Date(session.startTime).getTime() : 0;
    const sequence = [];

    session.notes.forEach((note, index) => {
      const duration = clampNumber(Number(note && note.duration) || 0, 0, Number.MAX_SAFE_INTEGER);
      const noteLabel = getEntryNoteLabel(note);
      const noteStart = note && note.startTime ? new Date(note.startTime).getTime() : NaN;
      const start = Number.isFinite(noteStart) && Number.isFinite(sessionStart)
        ? Math.max(0, noteStart - sessionStart)
        : sequence.reduce((sum, entry) => sum + getEntryDuration(entry), 0);

      sequence.push({
        note: noteLabel,
        start,
        duration,
        startTimeMs: start,
        durationMs: duration,
        noteIndex: index,
        sourceSessionId: session.id || null
      });
    });

    return sequence;
  }

  function ensureTrack(container) {
    if (!container) return null;

    let track = container.querySelector('.timeline-track');
    if (!track) {
      track = document.createElement('div');
      track.className = 'timeline-track';
      container.innerHTML = '';
      container.appendChild(track);
    }

    return track;
  }

  function renderSequenceRow(container, sequence, comparisonEntries, rowType) {
    const track = ensureTrack(container);
    if (!track) return;

    track.innerHTML = '';

    const widthPx = Math.max(100, Math.ceil(state.timelineWidthPx));
    track.style.width = `${widthPx}px`;

    sequence.forEach((entry, index) => {
      const block = document.createElement('div');
      const noteLabel = getEntryNoteLabel(entry);
      const duration = Math.max(1, getEntryDuration(entry));
      const comparisonEntry = comparisonEntries[index] || null;
      const isMatch = comparisonEntry ? compareNotes(comparisonEntry.expected, comparisonEntry.actual) : false;
      const isRest = noteLabel === null;

      block.className = 'note-block';
      block.style.width = `${Math.max(36, Math.round(duration * CURSOR_PX_PER_MS))}px`;
      block.textContent = noteLabel || 'REST';
      block.dataset.index = String(index);
      block.dataset.note = noteLabel || '';
      block.dataset.startTimeMs = String(Number.isFinite(entry.startTimeMs) ? entry.startTimeMs : Number(entry.start) || 0);
      block.dataset.durationMs = String(duration);
      block.dataset.rowType = rowType;

      if (rowType === 'expected') {
        state.expectedBlocks[index] = block;
      } else {
        state.userBlocks[index] = block;
      }

      if (isRest) {
        block.classList.add('is-rest');
      } else if (isMatch) {
        block.classList.add('is-match');
      } else {
        block.classList.add('is-mismatch');
      }

      if (rowType === 'user' && getDetectedNoteLabel(window.latestDetectedNote) === noteLabel) {
        block.classList.add('is-active');
      }

      track.appendChild(block);
    });
  }

  function renderComparison() {
    const expectedTotal = getSequenceTotalDuration(state.expectedSequence);
    const userTotal = getSequenceTotalDuration(state.userSequence);
    const totalDuration = Math.max(expectedTotal, userTotal, 1);
    state.timelineWidthPx = Math.max(100, Math.ceil(totalDuration * CURSOR_PX_PER_MS) + 16);

    state.expectedBlocks = [];
    state.userBlocks = [];
    clearComparisonState();

    const latestDetectedNote = syncLatestDetectedNoteFromSessions();

    const comparisonEntries = [];
    const comparisonLength = Math.max(state.expectedSequence.length, state.userSequence.length);
    for (let i = 0; i < comparisonLength; i++) {
      comparisonEntries.push({
        expected: state.expectedSequence[i] || null,
        actual: state.userSequence[i] || null
      });
    }

    renderSequenceRow(state.expectedTrack, state.expectedSequence, comparisonEntries, 'expected');
    renderSequenceRow(state.userTrack, state.userSequence, comparisonEntries, 'user');

    if (state.latestDetectedStatus) {
      state.latestDetectedStatus.textContent = latestDetectedNote && latestDetectedNote.note
        ? `Latest detected: ${latestDetectedNote.note} (${Math.round(clamp01(latestDetectedNote.confidence) * 100)}%)`
        : 'Latest detected: —';
    }

    if (state.sequenceStatus) {
      state.sequenceStatus.textContent = state.expectedSequence.length
        ? `${state.expectedSequence.length} step${state.expectedSequence.length !== 1 ? 's' : ''} loaded`
        : 'No sequence loaded';
    }

    positionCursor();
  }

  function timeToPixels(timeMs) {
    return Math.max(0, Math.round(Number(timeMs) || 0) * CURSOR_PX_PER_MS);
  }

  function positionCursor() {
    if (!state.cursor) return;

    const totalWidth = Math.max(100, state.timelineWidthPx);
    const elapsed = state.cursorStartTimeMs ? Math.max(0, Date.now() - state.cursorStartTimeMs) : 0;
    const cursorX = clampNumber(timeToPixels(elapsed), 0, Math.max(0, totalWidth - 2));
    const expectedTop = state.expectedTrack ? state.expectedTrack.offsetTop : 34;
    const leftPadding = 10;

    state.cursor.style.left = `${leftPadding + cursorX}px`;
    state.cursor.style.top = `${expectedTop}px`;
    state.cursor.style.height = `${Math.max(40, state.expectedTrack ? state.expectedTrack.offsetHeight : 40)}px`;

    updateComparisonFrame();
  }

  function startCursor() {
    stopCursor();
    state.cursorStartTimeMs = Date.now();
    positionCursor();
    state.cursorTimer = window.setInterval(positionCursor, CURSOR_INTERVAL_MS);
  }

  function stopCursor() {
    if (state.cursorTimer) {
      window.clearInterval(state.cursorTimer);
      state.cursorTimer = null;
    }
  }

  function loadAndRenderSequence() {
    const sequence = parseLearningSequence(state.input.value);
    state.expectedSequence = sequence;
    state.userSequence = buildUserSequenceFromSessions();
    renderComparison();

    if (sequence.length) {
      startCursor();
    } else {
      stopCursor();
      state.cursorStartTimeMs = 0;
      positionCursor();
    }
  }

  function refreshUserTimeline() {
    syncLatestDetectedNoteFromSessions();
    const nextUserSequence = buildUserSequenceFromSessions();
    const previousSignature = JSON.stringify(state.userSequence.map((entry) => [entry.note, entry.start, entry.duration]));
    const nextSignature = JSON.stringify(nextUserSequence.map((entry) => [entry.note, entry.start, entry.duration]));

    if (nextSignature === previousSignature) {
      return;
    }

    state.userSequence = nextUserSequence;
    renderComparison();
  }

  function initialize() {
    state.input = document.getElementById('learning-input');
    state.parseButton = document.getElementById('parse-sequence');
    state.expectedTrack = document.getElementById('timeline-container');
    state.userTrack = document.getElementById('user-timeline');
    state.cursor = document.getElementById('time-cursor');
    state.sequenceStatus = document.getElementById('sequence-status');
    state.latestDetectedStatus = document.getElementById('latest-detected-status');
    state.comparisonStage = document.querySelector('.comparison-stage');

    window.sessions = loadSessions();
    syncLatestDetectedNoteFromSessions();
    window.parseLearningSequence = parseLearningSequence;
    window.getExpectedNoteAtTime = getExpectedNoteAtTime;
    window.comparePitch = comparePitch;
    window.compareTiming = compareTiming;
    window.buildComparisonResult = buildComparisonResult;
    window.startLearningCursor = startCursor;

    ensureLiveFeedbackElement();

    if (state.parseButton) {
      state.parseButton.addEventListener('click', loadAndRenderSequence);
    }

    if (state.input) {
      state.input.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          loadAndRenderSequence();
        }
      });
    }

    window.addEventListener('storage', (event) => {
      if (!event || event.key === 'sessions') {
        refreshUserTimeline();
      }
    });

    window.addEventListener('resize', () => {
      renderComparison();
    });

    window.addEventListener('beforeunload', stopCursor);

    refreshUserTimeline();
    renderComparison();
  }

  document.addEventListener('DOMContentLoaded', initialize);
  window.addEventListener('load', positionCursor);
})();