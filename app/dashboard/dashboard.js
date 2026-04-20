// dashboard.js — orchestrates all dashboard rendering

const SESSION_EXPANDED_STATE = new Set();

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem('sessions'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem('sessions', JSON.stringify(sessions));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function msToStr(ms) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

function getSessionActiveDuration(session) {
  if (!session || !Array.isArray(session.notes)) return 0;
  return session.notes.reduce((sum, note) => sum + Math.max(0, Number(note.duration) || 0), 0);
}

function getSessionKey(session, index) {
  return session.id || `session-${index}`;
}

const VISUALIZER_PANEL_SIZES_KEY = 'panelSizes';
const DEFAULT_VISUALIZER_PANEL_SIZES = {
  rowHeights: [34, 33, 33],
  columnWidths: {
    top: 50,
    middle: 50,
    bottom: 50
  }
};

let visualizerPanelSizes = loadVisualizerPanelSizes();
let visualizerResizeObserver = null;
let visualizerDragState = null;
let visualizerRefreshTimer = null;

function cloneDefaultVisualizerPanelSizes() {
  return {
    rowHeights: [...DEFAULT_VISUALIZER_PANEL_SIZES.rowHeights],
    columnWidths: { ...DEFAULT_VISUALIZER_PANEL_SIZES.columnWidths }
  };
}

function clampNumber(value, minimum, maximum) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return minimum;
  return Math.min(maximum, Math.max(minimum, numericValue));
}

function normalizeRowHeights(rowHeights) {
  const fallback = [...DEFAULT_VISUALIZER_PANEL_SIZES.rowHeights];
  if (!Array.isArray(rowHeights) || rowHeights.length !== 3) {
    return fallback;
  }

  const values = rowHeights.map((value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return fallback;

  return values.map((value) => Math.round((value / total) * 10000) / 100);
}

function normalizeColumnWidths(columnWidths) {
  const fallback = { ...DEFAULT_VISUALIZER_PANEL_SIZES.columnWidths };
  if (!columnWidths || typeof columnWidths !== 'object') {
    return fallback;
  }

  return {
    top: clampNumber(columnWidths.top, 20, 80),
    middle: clampNumber(columnWidths.middle, 20, 80),
    bottom: clampNumber(columnWidths.bottom, 20, 80)
  };
}

function loadVisualizerPanelSizes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISUALIZER_PANEL_SIZES_KEY));
    if (!parsed || typeof parsed !== 'object') {
      return cloneDefaultVisualizerPanelSizes();
    }

    return {
      rowHeights: normalizeRowHeights(parsed.rowHeights),
      columnWidths: normalizeColumnWidths(parsed.columnWidths)
    };
  } catch (err) {
    return cloneDefaultVisualizerPanelSizes();
  }
}

function saveVisualizerPanelSizes() {
  localStorage.setItem(VISUALIZER_PANEL_SIZES_KEY, JSON.stringify(visualizerPanelSizes));
}

function requestVisualizerRefresh() {
  if (visualizerRefreshTimer) return;

  visualizerRefreshTimer = window.setTimeout(() => {
    visualizerRefreshTimer = null;
    if (typeof window.refreshVisualizerLayout === 'function') {
      window.refreshVisualizerLayout();
    }
  }, 16);
}

function observeVisualizerContainer(container) {
  if (!container || typeof ResizeObserver === 'undefined') return;

  if (visualizerResizeObserver) {
    visualizerResizeObserver.disconnect();
  }

  visualizerResizeObserver = new ResizeObserver(() => {
    requestVisualizerRefresh();
  });
  visualizerResizeObserver.observe(container);
}

function applyVisualizerPanelSizes(container) {
  if (!container) return;

  container.style.setProperty('--visualizer-row-1', `${visualizerPanelSizes.rowHeights[0]}fr`);
  container.style.setProperty('--visualizer-row-2', `${visualizerPanelSizes.rowHeights[1]}fr`);
  container.style.setProperty('--visualizer-row-3', `${visualizerPanelSizes.rowHeights[2]}fr`);

  const rows = Array.from(container.querySelectorAll('.dashboard-row'));
  rows.forEach((row, index) => {
    const panels = Array.from(row.querySelectorAll('.panel'));
    if (panels.length < 2) return;

    const columnKey = index === 0 ? 'top' : index === 1 ? 'middle' : 'bottom';
    const leftWidth = visualizerPanelSizes.columnWidths[columnKey];
    const rightWidth = 100 - leftWidth;

    panels[0].style.flex = `${leftWidth} 1 0%`;
    panels[1].style.flex = `${rightWidth} 1 0%`;
  });
}

function teardownVisualizerWorkspace() {
  if (visualizerResizeObserver) {
    visualizerResizeObserver.disconnect();
    visualizerResizeObserver = null;
  }

  if (visualizerRefreshTimer) {
    window.clearTimeout(visualizerRefreshTimer);
    visualizerRefreshTimer = null;
  }

  visualizerDragState = null;
  if (document.body) {
    document.body.classList.remove('dashboard-resizing');
  }
}

function attachSplitterHandlers(container) {
  if (!container) return;

  container.querySelectorAll('.splitter').forEach((splitter) => {
    if (splitter.dataset.bound === 'true') return;
    splitter.dataset.bound = 'true';
    splitter.addEventListener('mousedown', beginSplitterDrag);
  });
}

function buildVisualizerWorkspace() {
  const container = document.getElementById('visualizer-container');
  if (!container) return false;

  const rows = container.querySelectorAll('.dashboard-row');
  if (rows.length === 3) {
    applyVisualizerPanelSizes(container);
    attachSplitterHandlers(container);
    observeVisualizerContainer(container);
    return true;
  }

  const stages = Array.from(container.querySelectorAll('.visualizer-stage'));
  if (stages.length < 6) return false;

  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const row = document.createElement('div');
    row.className = 'dashboard-row';
    row.dataset.rowIndex = String(rowIndex);

    const leftPanel = stages[rowIndex * 2];
    const rightPanel = stages[rowIndex * 2 + 1];
    leftPanel.classList.add('panel');
    rightPanel.classList.add('panel');

    const verticalSplitter = document.createElement('div');
    verticalSplitter.className = 'splitter vertical';
    verticalSplitter.dataset.bound = 'false';
    verticalSplitter.dataset.rowIndex = String(rowIndex);

    row.append(leftPanel, verticalSplitter, rightPanel);
    fragment.append(row);

    if (rowIndex < 2) {
      const horizontalSplitter = document.createElement('div');
      horizontalSplitter.className = 'splitter horizontal';
      horizontalSplitter.dataset.bound = 'false';
      horizontalSplitter.dataset.rowIndex = String(rowIndex);
      fragment.append(horizontalSplitter);
    }
  }

  container.replaceChildren(fragment);
  applyVisualizerPanelSizes(container);
  attachSplitterHandlers(container);
  observeVisualizerContainer(container);
  requestVisualizerRefresh();
  return true;
}

function beginSplitterDrag(event) {
  if (event.button !== 0) return;

  const splitter = event.currentTarget;
  const container = document.getElementById('visualizer-container');
  if (!splitter || !container) return;

  visualizerDragState = {
    splitter,
    container,
    axis: splitter.classList.contains('vertical') ? 'vertical' : 'horizontal'
  };

  if (document.body) {
    document.body.classList.add('dashboard-resizing');
  }

  event.preventDefault();
}

function handleSplitterMouseMove(event) {
  if (!visualizerDragState) return;

  const { splitter, container, axis } = visualizerDragState;

  if (axis === 'vertical') {
    const row = splitter.parentElement;
    const leftPanel = splitter.previousElementSibling;
    const rightPanel = splitter.nextElementSibling;
    if (!row || !leftPanel || !rightPanel) return;

    const rowIndex = Number(row.dataset.rowIndex);
    const leftRect = leftPanel.getBoundingClientRect();
    const rightRect = rightPanel.getBoundingClientRect();
    const pairWidth = leftRect.width + rightRect.width;
    if (pairWidth <= 0) return;

    const minimum = 20;
    const maximum = 100 - minimum;
    const nextLeftWidth = clampNumber(event.clientX - leftRect.left, (minimum / 100) * pairWidth, pairWidth - ((minimum / 100) * pairWidth));
    const nextLeftPercent = clampNumber((nextLeftWidth / pairWidth) * 100, minimum, maximum);

    if (rowIndex === 0) visualizerPanelSizes.columnWidths.top = nextLeftPercent;
    if (rowIndex === 1) visualizerPanelSizes.columnWidths.middle = nextLeftPercent;
    if (rowIndex === 2) visualizerPanelSizes.columnWidths.bottom = nextLeftPercent;
  }

  if (axis === 'horizontal') {
    const topRow = splitter.previousElementSibling;
    const bottomRow = splitter.nextElementSibling;
    if (!topRow || !bottomRow) return;

    const topIndex = Number(topRow.dataset.rowIndex);
    const bottomIndex = Number(bottomRow.dataset.rowIndex);
    const topRect = topRow.getBoundingClientRect();
    const bottomRect = bottomRow.getBoundingClientRect();
    const pairHeight = topRect.height + bottomRect.height;
    if (pairHeight <= 0) return;

    const pairSum = visualizerPanelSizes.rowHeights[topIndex] + visualizerPanelSizes.rowHeights[bottomIndex];
    const minimum = 15;
    const maximum = Math.max(minimum, pairSum - minimum);
    const nextTopHeight = clampNumber(event.clientY - topRect.top, (minimum / 100) * pairHeight, pairHeight - ((minimum / 100) * pairHeight));
    const nextTopPercent = clampNumber((nextTopHeight / pairHeight) * pairSum, minimum, maximum);

    visualizerPanelSizes.rowHeights[topIndex] = nextTopPercent;
    visualizerPanelSizes.rowHeights[bottomIndex] = pairSum - nextTopPercent;
  }

  applyVisualizerPanelSizes(container);
  saveVisualizerPanelSizes();
  requestVisualizerRefresh();
}

function handleSplitterMouseUp() {
  if (!visualizerDragState) return;

  visualizerDragState = null;
  if (document.body) {
    document.body.classList.remove('dashboard-resizing');
  }

  saveVisualizerPanelSizes();
  requestVisualizerRefresh();
}

document.addEventListener('mousemove', handleSplitterMouseMove);
document.addEventListener('mouseup', handleSplitterMouseUp);
document.addEventListener('mouseleave', handleSplitterMouseUp);

// ─── Tab Navigation ───────────────────────────────────────────
function syncVisualizerPanelState() {
  const visualizerPanel = document.getElementById('panel-visualizer');
  const visualizerContainer = document.getElementById('visualizer-container');
  if (!visualizerPanel || !visualizerContainer) return;

  const isActive = visualizerPanel.classList.contains('active');
  if (isActive) {
    if (visualizerContainer.childElementCount === 0 && typeof window.mountVisualizer === 'function') {
      window.mountVisualizer('visualizer-container');
    }

    buildVisualizerWorkspace();

    if (typeof window.refreshVisualizerLayout === 'function') {
      window.refreshVisualizerLayout();
    }

    return;
  }

  teardownVisualizerWorkspace();
  if (typeof window.unmountVisualizer === 'function') {
    window.unmountVisualizer();
  }
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.dataset.tab);
      if (targetPanel) targetPanel.classList.add('active');

      syncVisualizerPanelState();
    });
  });
}
function renderSettingsTab() {
  const panel = document.getElementById('panel-settings');
  if (!panel) return;

  const storedOpacity = Number(localStorage.getItem('floatingWindowOpacity'));
  const opacity = Number.isFinite(storedOpacity) ? Math.min(1, Math.max(0.35, storedOpacity)) : 1;
  const percent = Math.round(opacity * 100);

  panel.innerHTML = `
    <div class="settings-shell">
      <div class="settings-card">
        <div class="settings-card-heading">Floating Widget Transparency</div>
        <div class="settings-card-copy">
          Control how translucent the live practice widget appears while you work.
          The setting is saved immediately and applied to the active widget window.
        </div>
        <div class="settings-slider-row">
          <label for="floating-opacity-slider" class="settings-slider-label">Opacity</label>
          <span id="floating-opacity-value" class="settings-slider-value">${percent}%</span>
        </div>
        <input
          id="floating-opacity-slider"
          type="range"
          min="0.35"
          max="1"
          step="0.01"
          value="${opacity}"
        >
        <div class="settings-hint">Lower values increase transparency; higher values make the widget more solid.</div>
      </div>
    </div>`;

  localStorage.setItem('floatingWindowOpacity', String(opacity));

  const api = window.electronAPI;
  if (api && api.setFloatingOpacity) {
    api.setFloatingOpacity(opacity);
  }

  const slider = panel.querySelector('#floating-opacity-slider');
  const valueLabel = panel.querySelector('#floating-opacity-value');

  if (!slider) return;

  const applyOpacity = (rawValue) => {
    const nextOpacity = Math.min(1, Math.max(0.35, Number(rawValue) || 1));
    localStorage.setItem('floatingWindowOpacity', String(nextOpacity));
    slider.value = String(nextOpacity);
    if (valueLabel) valueLabel.textContent = `${Math.round(nextOpacity * 100)}%`;
    if (api && api.setFloatingOpacity) {
      api.setFloatingOpacity(nextOpacity);
    }
  };

  slider.addEventListener('input', (event) => applyOpacity(event.target.value));
}

function buildNoteRow(sessionIndex, note, noteIndex) {
  const noteStart = note.startTime
    ? new Date(note.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const noteDuration = msToStr(note.duration || 0);
  const tagsValue = normalizeTags(note.tags).join(', ');
  const descriptionValue = note.description || '';

  return `
    <div class="session-note-row">
      <div class="session-note-header">
        <div class="session-note-title">Note ${noteIndex + 1}</div>
        <div class="session-note-meta">Start ${escapeHtml(noteStart)} · Duration ${escapeHtml(noteDuration)}</div>
      </div>
      <div class="session-note-fields">
        <label class="session-note-field">
          <span>Label</span>
          <input
            class="session-note-input"
            data-session-index="${sessionIndex}"
            data-note-index="${noteIndex}"
            data-field="label"
            value="${escapeAttr(note.label || '')}"
            placeholder="Session note label"
          >
        </label>
        <label class="session-note-field">
          <span>Tags</span>
          <input
            class="session-note-input"
            data-session-index="${sessionIndex}"
            data-note-index="${noteIndex}"
            data-field="tags"
            value="${escapeAttr(tagsValue)}"
            placeholder="scale, tone, breath"
          >
        </label>
        <label class="session-note-field session-note-field-wide">
          <span>Description</span>
          <textarea class="session-note-input" data-session-index="${sessionIndex}" data-note-index="${noteIndex}" data-field="description" placeholder="Describe the technique, phrase, or issue...">${escapeHtml(descriptionValue)}</textarea>
        </label>
      </div>
    </div>`;
}

// ─── Sessions Tab ─────────────────────────────────────────────
function renderSessionsTab(sessions) {
  const panel = document.getElementById('panel-sessions');
  if (!panel) return;

  if (!sessions.length) {
    panel.innerHTML = '<div class="empty-state">No sessions recorded yet.<br>Open the widget and start practicing!</div>';
    return;
  }

  const reversed = sessions.map((session, index) => ({ ...session, _origIdx: index })).reverse();

  panel.innerHTML = reversed.map(session => {
    const sessionKey = getSessionKey(session, session._origIdx);
    const isExpanded = SESSION_EXPANDED_STATE.has(sessionKey);
    const name = session.name || `Session #${session._origIdx + 1}`;
    const safeName = escapeAttr(name);
    const startDate = session.startTime ? new Date(session.startTime) : null;
    const endDate = session.endTime ? new Date(session.endTime) : null;
    const date = startDate ? startDate.toLocaleDateString() : '—';
    const time = startDate
      ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';
    const endTime = endDate
      ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';
    const sessionDuration = msToStr(session.duration || 0);
    const activeDuration = msToStr(getSessionActiveDuration(session));
    const gapDuration = msToStr(Math.max((session.duration || 0) - getSessionActiveDuration(session), 0));
    const noteCount = Array.isArray(session.notes) ? session.notes.length : 0;

    const notesHTML = noteCount > 0
      ? session.notes.map((note, noteIndex) => buildNoteRow(session._origIdx, note, noteIndex)).join('')
      : '<div class="no-notes">No notes in this session.</div>';

    return `
      <div class="session-card ${isExpanded ? 'is-expanded' : ''}" data-session-key="${sessionKey}">
        <div class="session-card-header">
          <button
            type="button"
            class="session-expand-btn"
            data-session-key="${sessionKey}"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            title="Toggle session details"
          >${isExpanded ? '▾' : '▸'}</button>
          <div class="session-card-main">
            <input
              class="session-name-input"
              value="${safeName}"
              data-index="${session._origIdx}"
              placeholder="Session name..."
            >
            <div class="session-card-meta">
              <span>${date}</span>
              <span>${time}</span>
              <span>${sessionDuration}</span>
              <span>Active ${activeDuration}</span>
              <span>Gap ${gapDuration}</span>
              <span>${noteCount} note${noteCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div class="session-card-body ${isExpanded ? 'is-visible' : ''}">
          <div class="session-detail-stats">
            <div class="session-detail-stat">
              <span>Start</span>
              <strong>${date} ${time}</strong>
            </div>
            <div class="session-detail-stat">
              <span>End</span>
              <strong>${endDate ? `${endDate.toLocaleDateString()} ${endTime}` : '—'}</strong>
            </div>
            <div class="session-detail-stat">
              <span>Total Duration</span>
              <strong>${sessionDuration}</strong>
            </div>
            <div class="session-detail-stat">
              <span>Active Duration</span>
              <strong>${activeDuration}</strong>
            </div>
            <div class="session-detail-stat">
              <span>Gap Duration</span>
              <strong>${gapDuration}</strong>
            </div>
          </div>
          <div class="session-notes-list">
            ${notesHTML}
          </div>
        </div>
      </div>`;
  }).join('');

  panel.querySelectorAll('.session-expand-btn').forEach(button => {
    button.addEventListener('click', () => {
      const sessionKey = button.dataset.sessionKey;
      const card = panel.querySelector(`.session-card[data-session-key="${sessionKey}"]`);
      if (!card) return;

      const nextExpanded = !card.classList.contains('is-expanded');
      card.classList.toggle('is-expanded', nextExpanded);
      button.textContent = nextExpanded ? '▾' : '▸';
      button.setAttribute('aria-expanded', String(nextExpanded));

      if (nextExpanded) SESSION_EXPANDED_STATE.add(sessionKey);
      else SESSION_EXPANDED_STATE.delete(sessionKey);
    });
  });

  panel.querySelectorAll('.session-name-input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.index);
      const allSessions = loadSessions();
      if (allSessions[idx] !== undefined) {
        allSessions[idx].name = input.value.trim() || `Session #${idx + 1}`;
        saveSessions(allSessions);
      }
    });
  });

  panel.querySelectorAll('.session-note-input').forEach(field => {
    field.addEventListener('input', () => {
      const sessionIdx = Number(field.dataset.sessionIndex);
      const noteIdx = Number(field.dataset.noteIndex);
      const fieldName = field.dataset.field;
      const allSessions = loadSessions();
      const session = allSessions[sessionIdx];
      if (!session || !Array.isArray(session.notes) || !session.notes[noteIdx]) return;

      if (fieldName === 'tags') {
        session.notes[noteIdx].tags = normalizeTags(field.value);
      } else {
        session.notes[noteIdx][fieldName] = field.value;
      }

      saveSessions(allSessions);
    });
  });
}

// ─── Full Dashboard Render ────────────────────────────────────
function renderDashboard() {
  const sessions = loadSessions();
  if (window.renderAnalytics) window.renderAnalytics('panel-summary', sessions);
  if (window.renderCalendar) window.renderCalendar('panel-calendar', sessions);
  renderSessionsTab(sessions);
  renderSettingsTab();
  syncVisualizerPanelState();
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderDashboard();

  const api = window.electronAPI;

  const widgetButton = document.getElementById('dash-widget-btn');
  if (widgetButton) {
    widgetButton.addEventListener('click', () => {
      if (api && api.openFloating) api.openFloating();
    });
  }

  const minimizeButton = document.getElementById('dash-min-btn');
  const maximizeButton = document.getElementById('dash-max-btn');
  const closeButton = document.getElementById('dash-close-btn');

  if (minimizeButton) minimizeButton.addEventListener('click', () => api && api.minimize());
  if (maximizeButton) maximizeButton.addEventListener('click', () => api && api.maximize());
  if (closeButton) closeButton.addEventListener('click', () => api && api.close());

  if (api && api.onRefresh) {
    api.onRefresh(() => renderDashboard());
  }

  if (api && api.onVisualizerFrame) {
    api.onVisualizerFrame((frame) => {
      if (typeof window.updateVisualizerFrame === 'function') {
        window.updateVisualizerFrame(frame);
      }
    });
  }
});
