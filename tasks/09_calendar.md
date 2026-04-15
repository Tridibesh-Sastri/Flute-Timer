# 09 Calendar Integration (Phase 4.1 Active)

## Current Scope
1. Month grid with previous/next navigation.
2. Clickable day cells that show session details.
3. Day timeline with time-positioned session blocks.

## Placement Rules
1. Vertical placement is based on session start/end times.
2. Sessions only share horizontal space when true overlap exists.
3. No artificial overlap between non-overlapping sessions.

## Constraints
1. Dashboard-only rendering (not in floating widget).
2. Read-only calendar data; no mutation in calendar component.
3. Source is localStorage `sessions` array.
