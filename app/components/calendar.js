// calendar.js - month grid + click detail panel + overlap-aware day timeline
// Called by dashboard.js: window.renderCalendar(containerId, sessions)

(function () {
  let _sessions = [];
  let _containerId = null;
  let _year = new Date().getFullYear();
  let _month = new Date().getMonth();
  let _selectedDay = null;
  let _timelineZoom = 1;

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function msToStr(ms) {
    if (!ms || ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  function getSessionActiveDuration(session) {
    if (!session || !Array.isArray(session.notes)) return 0;
    return session.notes.reduce((sum, note) => sum + Math.max(0, Number(note.duration) || 0), 0);
  }

  function clampZoom(value) {
    return Math.min(2.5, Math.max(0.5, value));
  }

  function updateZoom(delta) {
    _timelineZoom = clampZoom(Math.round((_timelineZoom + delta) * 100) / 100);
    renderGrid();
  }

  function loadStoredSessions() {
    try {
      const parsed = JSON.parse(localStorage.getItem('sessions'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function timeLabel(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function buildDateMap(sessions, year, month) {
    const map = {};
    sessions.forEach((session) => {
      if (!session.startTime) return;
      const d = new Date(session.startTime);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(session);
      }
    });
    return map;
  }

  function getSessionWindowForDay(session, dayStart, dayEnd, index) {
    if (!session.startTime) return null;

    const start = new Date(session.startTime);
    if (Number.isNaN(start.getTime())) return null;

    let end = null;
    if (session.endTime) {
      const parsed = new Date(session.endTime);
      if (!Number.isNaN(parsed.getTime())) end = parsed;
    }
    if (!end) {
      end = new Date(start.getTime() + Math.max(0, session.duration || 0));
    }

    if (end <= dayStart || start >= dayEnd) return null;

    const clippedStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));
    if (clippedEnd <= clippedStart) return null;

    const startMin = (clippedStart.getTime() - dayStart.getTime()) / 60000;
    const endMin = (clippedEnd.getTime() - dayStart.getTime()) / 60000;

    return {
      id: session.id || `session-${index}`,
      name: session.name || `Session #${index + 1}`,
      notes: Array.isArray(session.notes) ? session.notes.length : 0,
      duration: session.duration || 0,
      activeDuration: getSessionActiveDuration(session),
      originalStart: start,
      originalEnd: end,
      startMin,
      endMin,
      lane: 0,
      laneCount: 1
    };
  }

  function assignOverlapLanes(items) {
    const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
    const groups = [];

    sorted.forEach((item) => {
      if (!groups.length) {
        groups.push({ maxEnd: item.endMin, items: [item] });
        return;
      }

      const group = groups[groups.length - 1];
      if (item.startMin < group.maxEnd) {
        group.items.push(item);
        group.maxEnd = Math.max(group.maxEnd, item.endMin);
      } else {
        groups.push({ maxEnd: item.endMin, items: [item] });
      }
    });

    groups.forEach((group) => {
      const laneEnds = [];
      group.items.forEach((item) => {
        let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMin);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(item.endMin);
        } else {
          laneEnds[lane] = item.endMin;
        }
        item.lane = lane;
      });

      const laneCount = Math.max(1, laneEnds.length);
      group.items.forEach((item) => {
        item.laneCount = laneCount;
      });
    });

    return sorted;
  }

  function buildTimelineHtml(daySessions, dayStart, dayEnd) {
    const timelineHeight = Math.round(640 * _timelineZoom);
    const dayMinutes = 24 * 60;
    const pxPerMinute = timelineHeight / dayMinutes;
    const hourStep = _timelineZoom >= 1.5 ? 1 : 2;

    const windows = daySessions
      .map((session, idx) => getSessionWindowForDay(session, dayStart, dayEnd, idx))
      .filter(Boolean);

    if (!windows.length) {
      return '<div class="cal-timeline-empty">No timed sessions to plot.</div>';
    }

    const positioned = assignOverlapLanes(windows);

    const hourLines = [];
    for (let h = 0; h <= 24; h += hourStep) {
      const top = Math.round(h * 60 * pxPerMinute);
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      hourLines.push(`
        <div class="cal-hour-line" style="top:${top}px">
          <span class="cal-hour-label">${hourLabel}</span>
        </div>
      `);
    }

    const blocks = positioned.map((item) => {
      const top = Math.round(item.startMin * pxPerMinute);
      const height = Math.max(10, Math.round((item.endMin - item.startMin) * pxPerMinute));
      const widthPct = 100 / item.laneCount;
      const leftPct = item.lane * widthPct;
      const safeName = escapeHtml(item.name);
      const range = `${timeLabel(item.originalStart)} - ${timeLabel(item.originalEnd)}`;
      return `
        <div class="cal-time-block" style="top:${top}px;height:${height}px;left:${leftPct}%;width:${widthPct}%">
          <div class="cal-time-block-name">${safeName}</div>
          <div class="cal-time-block-meta">${range}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="cal-timeline-wrap">
        <div class="cal-timeline-title">Day Timeline</div>
        <div class="cal-timeline" style="height:${timelineHeight}px">
          ${hourLines.join('')}
          ${blocks}
        </div>
      </div>
    `;
  }

  function renderSidePanel(daySessions, day) {
    const panel = document.getElementById('cal-side-panel');
    if (!panel) return;

    const dayStart = new Date(_year, _month, day, 0, 0, 0, 0);
    const dayEnd = new Date(_year, _month, day + 1, 0, 0, 0, 0);

    const sorted = [...daySessions].sort((a, b) => {
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      return at - bt;
    });

    const totalDuration = sorted.reduce((sum, session) => sum + Math.max(0, Number(session.duration) || 0), 0);
    const totalActiveDuration = sorted.reduce((sum, session) => sum + getSessionActiveDuration(session), 0);
    const totalGapDuration = Math.max(totalDuration - totalActiveDuration, 0);

    const items = sorted.map((session, i) => {
      const name = escapeHtml(session.name || `Session #${i + 1}`);
      const start = session.startTime ? new Date(session.startTime) : null;
      const end = session.endTime ? new Date(session.endTime) : new Date((start ? start.getTime() : Date.now()) + (session.duration || 0));
      const range = start ? `${timeLabel(start)} - ${timeLabel(end)}` : '—';
      const dur = msToStr(session.duration || 0);
      const active = msToStr(getSessionActiveDuration(session));
      const gap = msToStr(Math.max((session.duration || 0) - getSessionActiveDuration(session), 0));
      const notes = Array.isArray(session.notes) ? session.notes.length : 0;
      return `
        <div class="cal-session-item">
          <div class="cal-session-name">${name}</div>
          <div class="cal-session-meta">${range} · ${dur} total · ${active} active · ${gap} gap · ${notes} note${notes !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');

    const dateLabel = `${MONTHS_SHORT[_month]} ${day}, ${_year}`;
    const timeline = buildTimelineHtml(sorted, dayStart, dayEnd);
    const hasSessions = sorted.length > 0;

    panel.innerHTML = `
      <div class="cal-side-header">
        <div>
          <div class="cal-side-title">${dateLabel}</div>
          <div class="cal-side-subtitle">${hasSessions ? `${sorted.length} sessions · ${msToStr(totalDuration)} total · ${msToStr(totalActiveDuration)} active` : 'No sessions recorded on this day'}</div>
        </div>
        <div class="cal-zoom-controls">
          <button class="cal-zoom-btn" id="cal-zoom-out" title="Zoom out">−</button>
          <span class="cal-zoom-value">${Math.round(_timelineZoom * 100)}%</span>
          <button class="cal-zoom-btn" id="cal-zoom-in" title="Zoom in">+</button>
        </div>
      </div>
      <div class="cal-day-summary">
        <div class="cal-day-summary-item">
          <span>Sessions</span>
          <strong>${sorted.length}</strong>
        </div>
        <div class="cal-day-summary-item">
          <span>Total</span>
          <strong>${msToStr(totalDuration)}</strong>
        </div>
        <div class="cal-day-summary-item">
          <span>Active</span>
          <strong>${msToStr(totalActiveDuration)}</strong>
        </div>
        <div class="cal-day-summary-item">
          <span>Gap</span>
          <strong>${msToStr(totalGapDuration)}</strong>
        </div>
      </div>
      ${hasSessions ? items : '<div class="cal-side-empty">No sessions on this day.</div>'}
      ${hasSessions ? timeline : '<div class="cal-timeline-empty">No timed sessions to plot.</div>'}
    `;
  }

  function renderGrid() {
    const container = document.getElementById(_containerId);
    if (!container) return;

    const firstWeekDay = new Date(_year, _month, 1).getDay();
    const daysInMonth = new Date(_year, _month + 1, 0).getDate();
    const today = new Date();
    const dateMap = buildDateMap(_sessions, _year, _month);

    const headers = DAY_HEADERS.map((d) => `<div class="cal-day-header">${d}</div>`).join('');
    const empties = Array(firstWeekDay).fill('<div class="cal-cell empty"></div>').join('');

    let dayCells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const sessionsOnDay = dateMap[d] || [];
      const hasSessions = sessionsOnDay.length > 0;
      const isToday = today.getDate() === d && today.getMonth() === _month && today.getFullYear() === _year;
      const isSelected = _selectedDay === d;
      const cls = [
        'cal-cell',
        hasSessions ? 'has-sessions' : '',
        isToday ? 'is-today' : '',
        isSelected ? 'is-selected' : ''
      ].filter(Boolean).join(' ');
      const dot = hasSessions ? `<div class="cal-dot">${sessionsOnDay.length}</div>` : '';
      dayCells += `<div class="${cls}" data-day="${d}">${d}${dot}</div>`;
    }

    container.innerHTML = `
      <div class="cal-wrapper">
        <div class="cal-main">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="cal-prev">◀</button>
            <span class="cal-month-label">${MONTHS[_month]} ${_year}</span>
            <button class="cal-nav-btn" id="cal-next">▶</button>
          </div>
          <div class="cal-grid">
            ${headers}
            ${empties}
            ${dayCells}
          </div>
        </div>
        <div class="cal-side-panel" id="cal-side-panel">
          <div class="cal-side-empty">Select a day<br>to view sessions</div>
        </div>
      </div>`;

    document.getElementById('cal-prev').addEventListener('click', () => {
      _month -= 1;
      if (_month < 0) {
        _month = 11;
        _year -= 1;
      }
      _selectedDay = null;
      renderGrid();
    });

    document.getElementById('cal-next').addEventListener('click', () => {
      _month += 1;
      if (_month > 11) {
        _month = 0;
        _year += 1;
      }
      _selectedDay = null;
      renderGrid();
    });

    container.querySelectorAll('.cal-cell:not(.empty)').forEach((cell) => {
      cell.addEventListener('click', () => {
        const day = parseInt(cell.dataset.day, 10);
        _selectedDay = day;

        container.querySelectorAll('.cal-cell').forEach((c) => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        renderSidePanel(dateMap[day] || [], day);
      });
    });

    if (_selectedDay !== null) {
      renderSidePanel(dateMap[_selectedDay] || [], _selectedDay);
      const zoomOutButton = document.getElementById('cal-zoom-out');
      const zoomInButton = document.getElementById('cal-zoom-in');

      if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => updateZoom(-0.25));
      }

      if (zoomInButton) {
        zoomInButton.addEventListener('click', () => updateZoom(0.25));
      }
    }
  }

  window.renderCalendar = function(containerId, sessions) {
    _containerId = containerId;
    _sessions = Array.isArray(sessions) ? sessions : loadStoredSessions();
    renderGrid();
  };
})();
