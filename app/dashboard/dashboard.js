// dashboard.js — orchestrates all dashboard rendering

function loadSessions() {
  return JSON.parse(localStorage.getItem('sessions')) || [];
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

// ─── Tab Navigation ───────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// ─── Sessions Tab ─────────────────────────────────────────────
function renderSessionsTab(sessions) {
  const panel = document.getElementById('panel-sessions');
  if (!panel) return;

  if (!sessions.length) {
    panel.innerHTML = '<div class="empty-state">No sessions recorded yet.<br>Open the widget and start practicing!</div>';
    return;
  }

  // Render newest first
  const reversed = sessions.map((s, i) => ({ ...s, _origIdx: i })).reverse();

  panel.innerHTML = reversed.map(session => {
    const name = session.name || `Session #${session._origIdx + 1}`;
    const safeName = name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const date = session.startTime ? new Date(session.startTime).toLocaleDateString() : '—';
    const time = session.startTime
      ? new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const dur = msToStr(session.duration || 0);
    const noteCount = session.notes ? session.notes.length : 0;

    const notesHTML = (session.notes && session.notes.length > 0)
      ? session.notes.map((n, ni) => `
          <div class="session-note-row">
            <span class="note-label">${n.label || `Note ${ni + 1}`}</span>
            <span class="note-dur">${msToStr(n.duration || 0)}</span>
            ${n.description ? `<span class="note-desc">${n.description}</span>` : ''}
          </div>`).join('')
      : '<div class="no-notes">No notes in this session.</div>';

    return `
      <div class="session-card">
        <div class="session-card-header">
          <input
            class="session-name-input"
            value="${safeName}"
            data-index="${session._origIdx}"
            placeholder="Session name..."
          >
          <div class="session-card-meta">
            ${date} ${time} &middot; ${dur} &middot; ${noteCount} note${noteCount !== 1 ? 's' : ''}
          </div>
        </div>
        <details class="session-notes-drawer">
          <summary>${noteCount} Note${noteCount !== 1 ? 's' : ''} — click to expand</summary>
          <div class="session-notes-list">${notesHTML}</div>
        </details>
      </div>`;
  }).join('');

  // Session name editing — safe indexing, immediate persistence
  panel.querySelectorAll('.session-name-input').forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.index);
      const allSessions = JSON.parse(localStorage.getItem('sessions')) || [];
      if (allSessions[idx] !== undefined) {
        allSessions[idx].name = input.value.trim() || `Session #${idx + 1}`;
        localStorage.setItem('sessions', JSON.stringify(allSessions));
      }
    });
  });
}

// ─── Full Dashboard Render ────────────────────────────────────
function renderDashboard() {
  const sessions = loadSessions();
  if (window.renderAnalytics) window.renderAnalytics('panel-summary', sessions);
  if (window.renderCalendar) window.renderCalendar('panel-calendar', sessions);
  renderSessionsTab(sessions);
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderDashboard();

  // Window controls
  const api = window.electronAPI;
  document.getElementById('dash-min-btn').addEventListener('click', () => api && api.minimize());
  document.getElementById('dash-max-btn').addEventListener('click', () => api && api.maximize());
  document.getElementById('dash-close-btn').addEventListener('click', () => api && api.close());

  // Live refresh: triggered when widget ends a session
  if (api && api.onRefresh) {
    api.onRefresh(() => renderDashboard());
  }
});
