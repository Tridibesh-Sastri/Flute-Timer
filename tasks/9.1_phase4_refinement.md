# 10 Phase 4.1 Refinement

## Ordered Execution
1. Sync spec, skills, and task files with dual-window architecture.
2. Keep floating widget minimal and remove analytics/calendar rendering from widget.
3. Ensure dashboard opens/focuses via IPC (`open-dashboard`).
4. Notify dashboard on session completion via IPC (`dashboard-refresh`).
5. Add session `name` default at session creation.
6. Upgrade analytics summary with pure CSS bar charts.
7. Upgrade calendar to month grid + click day details + overlap-aware timeline.
8. Keep dashboard mutation limited to session name editing.
9. Validate no performance regression in floating widget loops.

## Acceptance Checks
1. Widget remains always-on-top and responsive during dashboard use.
2. Dashboard displays Summary / Calendar / Sessions tabs.
3. Session ending in widget refreshes dashboard if open.
4. Session names persist across app restarts.
5. Calendar timeline placement reflects real session timing.
