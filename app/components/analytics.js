// analytics.js - read-only aggregation + pure CSS bar rendering
// Called by dashboard.js: window.renderAnalytics(containerId, sessions)

function msToStr(ms) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSessionActiveDuration(session) {
  if (!session || !Array.isArray(session.notes)) return 0;
  return session.notes.reduce((sum, note) => sum + Math.max(0, Number(note.duration) || 0), 0);
}

function getAllNotes(sessions) {
  const notes = [];
  sessions.forEach((session) => {
    if (!Array.isArray(session.notes)) return;
    session.notes.forEach((note) => notes.push(note));
  });
  return notes;
}

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationVariance(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const average = mean(values);
  return values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
}

function formatDecimal(value, digits = 2) {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(digits);
}

function getNotePitchStability(note) {
  if (!note) return 0;

  const avgFrequency = Number(note.avgFrequency) || 0;
  if (avgFrequency <= 0) return 0;

  const pitchStdDevHz = Number.isFinite(note.pitchStdDevHz)
    ? note.pitchStdDevHz
    : Math.sqrt(Math.max(0, Number(note.pitchVarianceHz) || 0));

  if (!Number.isFinite(pitchStdDevHz)) return 0;
  return Math.max(0, 1 - (pitchStdDevHz / Math.max(avgFrequency, 1)));
}

function getPitchStabilityScore(notes) {
  const values = notes.map(getNotePitchStability);
  return mean(values);
}

function getPitchStabilityVariance(notes) {
  const values = notes.map(getNotePitchStability);
  return populationVariance(values);
}

function getFrequencyVariance(notes) {
  const frequencies = notes
    .map(note => Number(note.avgFrequency) || 0)
    .filter(value => value > 0);

  if (!frequencies.length) return 0;
  return populationVariance(frequencies);
}

function buildNoteDistribution(notes) {
  const distribution = new Map();

  notes.forEach((note) => {
    const label = String(note && note.dominantNote ? note.dominantNote : '').trim();
    if (!label) return;

    const duration = Math.max(0, Number(note.duration) || 0);
    const entry = distribution.get(label) || { count: 0, duration: 0 };
    entry.count += 1;
    entry.duration += duration;
    distribution.set(label, entry);
  });

  return distribution;
}

function getMostPlayedNote(distribution) {
  const entries = [...distribution.entries()].map(([label, value]) => ({
    label,
    count: value.count,
    duration: value.duration
  }));

  if (!entries.length) {
    return { label: '', count: 0, duration: 0 };
  }

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.duration !== a.duration) return b.duration - a.duration;
    return a.label.localeCompare(b.label);
  });

  return entries[0];
}

function calculateStreak(sessions) {
  const dayKeys = sessions
    .filter(s => s.startTime)
    .map(s => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    });

  const unique = [...new Set(dayKeys)]
    .map(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d);
    })
    .sort((a, b) => a - b);

  if (!unique.length) return 0;

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(todayOnly.getTime() - 86400000);
  const last = unique[unique.length - 1];

  if (last.getTime() !== todayOnly.getTime() && last.getTime() !== yesterdayOnly.getTime()) {
    return 0;
  }

  let streak = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const diff = (unique[i].getTime() - unique[i - 1].getTime()) / 86400000;
    if (Math.round(diff) <= 1) streak++;
    else break;
  }
  return streak;
}

function buildBarRows(rows, maxValue, labelFmt, valueFmt) {
  const safeMax = Math.max(maxValue, 1);
  return rows.map(row => {
    const pct = Math.round((row.value / safeMax) * 100);
    return `
      <div class="bar-row">
        <span class="bar-label">${labelFmt(row)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="bar-count">${valueFmt(row)}</span>
      </div>`;
  }).join('');
}

function buildNoteDistributionBars(notes) {
  const distribution = buildNoteDistribution(notes);
  const rows = [...distribution.entries()].map(([label, value]) => ({
    label,
    value: value.count,
    duration: value.duration
  }));

  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.duration !== a.duration) return b.duration - a.duration;
    return a.label.localeCompare(b.label);
  });

  const maxValue = Math.max(...rows.map(row => row.value), 1);
  return buildBarRows(
    rows,
    maxValue,
    row => row.label,
    row => String(row.value)
  );
}

function buildComparisonRows(rows, maxDuration) {
  const safeMax = Math.max(maxDuration, 1);
  return rows.map(row => {
    const sessionPct = Math.round((row.duration / safeMax) * 100);
    const activePct = Math.min(Math.round((row.activeDuration / safeMax) * 100), sessionPct);
    const gapPct = Math.max(sessionPct - activePct, 0);
    const efficiency = row.duration > 0 ? Math.round((row.activeDuration / row.duration) * 100) : 0;

    return `
      <div class="comparison-row">
        <div class="comparison-row-header">
          <span class="comparison-label">${escapeHtml(row.label)}</span>
          <span class="comparison-meta">${msToStr(row.duration)} total · ${msToStr(row.activeDuration)} active · ${msToStr(row.gapDuration)} gap · ${efficiency}% active</span>
        </div>
        <div class="comparison-track">
          <div class="comparison-fill-active" style="width: ${activePct}%"></div>
          <div class="comparison-fill-gap" style="width: ${gapPct}%"></div>
        </div>
      </div>`;
  }).join('');
}

window.renderAnalytics = function(containerId, sessions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!Array.isArray(sessions)) {
    try {
      const parsed = JSON.parse(localStorage.getItem('sessions'));
      sessions = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      sessions = [];
    }
  }

  const sessionMetrics = sessions.map((session, index) => {
    const duration = session.duration || 0;
    const activeDuration = getSessionActiveDuration(session);
    const gapDuration = Math.max(duration - activeDuration, 0);
    const noteCount = Array.isArray(session.notes) ? session.notes.length : 0;
    const name = session.name || `Session #${index + 1}`;
    return {
      session,
      index,
      duration,
      activeDuration,
      gapDuration,
      noteCount,
      label: name
    };
  });

  const allNotes = getAllNotes(sessions);
  const pitchStabilityScore = getPitchStabilityScore(allNotes);
  const pitchStabilityVariance = getPitchStabilityVariance(allNotes);
  const frequencyVariance = getFrequencyVariance(allNotes);
  const noteDistribution = buildNoteDistribution(allNotes);
  const mostPlayedNote = getMostPlayedNote(noteDistribution);

  let totalDuration = 0;
  let totalActiveDuration = 0;
  let totalGapDuration = 0;
  let totalNotes = 0;
  let totalNoteDuration = 0;
  let longestNote = 0;
  let shortestNote = Number.POSITIVE_INFINITY;
  let mostNotesSession = 0;
  const dayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  sessionMetrics.forEach((metric) => {
    const { session, duration, activeDuration, gapDuration } = metric;
    totalDuration += duration;
    totalActiveDuration += activeDuration;
    totalGapDuration += gapDuration;

    if (metric.noteCount > mostNotesSession) mostNotesSession = metric.noteCount;

    if (Array.isArray(session.notes)) {
      session.notes.forEach((note) => {
        const noteDur = note.duration || 0;
        if (noteDur <= 0) return;
        totalNotes++;
        totalNoteDuration += noteDur;
        longestNote = Math.max(longestNote, noteDur);
        shortestNote = Math.min(shortestNote, noteDur);
      });
    }

    if (session.startTime) {
      const day = new Date(session.startTime).getDay();
      dayMap[day] = (dayMap[day] || 0) + 1;
    }
  });

  const totalSessions = sessions.length;
  const avgSession = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  const avgNote = totalNotes > 0 ? Math.round(totalNoteDuration / totalNotes) : 0;
  const efficiency = totalDuration > 0 ? Math.round((totalActiveDuration / totalDuration) * 100) : 0;
  const streak = calculateStreak(sessions);
  const shortestNoteDisplay = Number.isFinite(shortestNote) ? shortestNote : 0;
  const noteDistributionBars = buildNoteDistributionBars(allNotes);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayRows = dayNames.map((name, idx) => ({ label: name, value: dayMap[idx] || 0 }));

  const recent = sessionMetrics.slice(-7);

  const durationRows = recent.map((row, idx) => ({
    label: row.label || `S${Math.max(1, totalSessions - recent.length + idx + 1)}`,
    value: row.duration
  }));

  const noteRows = recent.map((row, idx) => ({
    label: row.label || `S${Math.max(1, totalSessions - recent.length + idx + 1)}`,
    value: row.noteCount
  }));

  const comparisonRows = recent.map((row, idx) => ({
    label: row.label || `S${Math.max(1, totalSessions - recent.length + idx + 1)}`,
    duration: row.duration,
    activeDuration: row.activeDuration,
    gapDuration: row.gapDuration
  }));

  const weekdayBars = buildBarRows(
    weekdayRows,
    Math.max(...weekdayRows.map(r => r.value), 1),
    row => row.label,
    row => String(row.value)
  );

  const durationBars = buildBarRows(
    durationRows,
    Math.max(...durationRows.map(r => r.value), 1),
    row => row.label,
    row => msToStr(row.value)
  );

  const noteBars = buildBarRows(
    noteRows,
    Math.max(...noteRows.map(r => r.value), 1),
    row => row.label,
    row => String(row.value)
  );

  const comparisonBars = buildComparisonRows(
    comparisonRows,
    Math.max(...comparisonRows.map(row => row.duration), 1)
  );

  container.innerHTML = `
    <div class="cards-row">
      <div class="stat-card">
        <div class="stat-value">${totalSessions}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(totalDuration)}</div>
        <div class="stat-label">Total Session Duration</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(totalActiveDuration)}</div>
        <div class="stat-label">Total Active Note Duration</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(totalGapDuration)}</div>
        <div class="stat-label">Total Gap Time</div>
      </div>
    </div>

    <div class="cards-row">
      <div class="stat-card">
        <div class="stat-value">${totalNotes}</div>
        <div class="stat-label">Total Notes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(avgSession)}</div>
        <div class="stat-label">Avg Session</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(avgNote)}</div>
        <div class="stat-label">Avg Note Duration</div>
      </div>
      <div class="stat-card ${streak >= 2 ? 'card-highlight' : ''}">
        <div class="stat-value">${streak}</div>
        <div class="stat-label">Practice Streak</div>
      </div>
    </div>

    <div class="cards-row">
      <div class="stat-card">
        <div class="stat-value">${msToStr(longestNote)}</div>
        <div class="stat-label">Longest Note</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${msToStr(shortestNoteDisplay)}</div>
        <div class="stat-label">Shortest Note</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${mostNotesSession}</div>
        <div class="stat-label">Most Notes in One Session</div>
      </div>
      <div class="stat-card ${efficiency >= 70 ? 'card-highlight' : ''}">
        <div class="stat-value">${efficiency}%</div>
        <div class="stat-label">Practice Efficiency</div>
      </div>
    </div>

    <div class="cards-row">
      <div class="stat-card ${pitchStabilityScore >= 0.75 ? 'card-highlight' : ''}">
        <div class="stat-value">${Math.round(pitchStabilityScore * 100)}%</div>
        <div class="stat-label">Pitch Stability</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatDecimal(pitchStabilityVariance, 3)}</div>
        <div class="stat-label">Pitch Stability Variance</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${escapeHtml(mostPlayedNote.label || '—')}</div>
        <div class="stat-label">Most Played Note</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatDecimal(frequencyVariance, 2)}</div>
        <div class="stat-label">Frequency Variance</div>
      </div>
    </div>

    <div class="comparison-section">
      <div class="chart-title">Session Duration vs Active Note Time (Recent)</div>
      <div class="comparison-list">
        ${comparisonBars || '<div class="cal-timeline-empty">No session comparisons available yet.</div>'}
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-title">Practice Frequency by Day</div>
      <div class="bar-chart">${weekdayBars}</div>
    </div>

    <div class="chart-section">
      <div class="chart-title">Session Duration Trend (Recent)</div>
      <div class="bar-chart">${durationBars}</div>
    </div>

    <div class="chart-section">
      <div class="chart-title">Note Count per Session (Recent)</div>
      <div class="bar-chart">${noteBars}</div>
    </div>

    <div class="chart-section">
      <div class="chart-title">Note Distribution</div>
      <div class="bar-chart">${noteDistributionBars || '<div class="cal-timeline-empty">No pitch distribution available yet.</div>'}</div>
    </div>

    <div class="chart-section">
      <div class="chart-title">Most Notes in One Session</div>
      <div class="bar-chart">
        <div class="bar-row">
          <span class="bar-label">Best</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: 100%"></div>
          </div>
          <span class="bar-count">${mostNotesSession}</span>
        </div>
      </div>
    </div>
  `;
};
