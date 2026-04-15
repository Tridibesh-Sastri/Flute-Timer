# Analytics Prep

## Sub-Skill: Pure CSS Bar Chart Rendering

### 1. Purpose
Render meaningful analytics charts without external chart libraries.

### 2. APIs / Concepts Used
- DOM templating
- CSS width percentages (`style="width: X%"`)
- Flex and Grid layouts

### 3. Step-by-Step Implementation
1. Compute normalized values from session aggregates.
2. Build rows containing label, track, fill, and numeric value.
3. Set fill width by percentage (`width: ${pct}%`).
4. Keep chart read-only and fully derived from persisted sessions.

### 4. Inputs / Outputs
- **Inputs**: Aggregated numeric metrics.
- **Outputs**: Lightweight CSS bars with no canvas dependency.

### 5. Edge Cases
- Empty datasets should render zero-state values, not NaN widths.

### 6. Constraints
- No Chart.js, D3, or any external chart package.

---

## Sub-Skill: Calendar Grid + Day Timeline

### 1. Purpose
Provide month navigation and day-level session inspection with time-aware visual placement.

### 2. APIs / Concepts Used
- CSS Grid for month cells
- Click handlers for day selection
- Absolute positioning for day timeline blocks

### 3. Step-by-Step Implementation
1. Render month grid with day headers and date cells.
2. Highlight cells that contain sessions.
3. On day click, render side detail including session list and day timeline.
4. Convert each session to minute-of-day start/end.
5. Place blocks vertically by start time and height by duration.
6. Compute overlap groups so only truly overlapping sessions share horizontal space.

### 4. Inputs / Outputs
- **Inputs**: Session timestamps and durations.
- **Outputs**: Interactive day inspection view with overlap-correct placement.

### 5. Edge Cases
- Sessions that cross midnight should clamp to visible day range.
- Missing end time should fallback to `start + duration` when possible.

### 6. Constraints
- Keep interaction lightweight and local to dashboard rendering only.
