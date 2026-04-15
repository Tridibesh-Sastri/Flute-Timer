# Core Features

## Triple Timer Architecture
- **Session Timer (Manual)**: Actively tracks the total duration of the user's practice block.
- **Note Timer (Auto)**: Tracks individual sounds mapped natively to NoteEvents. The relationship bounds dictate that audio timers only exist processing sound mathematically IF the manual Session is currently enabled and tracking.
- **Learning Timer (Manual)**: A user-defined countdown timer that runs completely independently of session/audio timers. Can be started/stopped manually.

## Alarm System
- **Trigger**: Activates precisely when the Learning Timer concludes.
- **Mechanism**: Must provide a designated sound notification combined with a clear visual indication.

## Contextual UI Modes
- **Mode 1 — Floating Mode**: Small, minimal, always-on-top overlay for live tracking during active instrumental practice.
- **Mode 2 — Dashboard Mode**: Full application window displaying intelligence digestions. (See analytics and calendar structures).

## Practice Management Extensions
- The Dashboard window must provide a direct action that restores or focuses the Floating Widget without forcing the user back through the overlay controls.
- Dashboard Settings must expose the Floating Widget opacity as a persistent user preference, with immediate visual feedback when adjusted.
- The Sessions view must support expanding each session into a full detail surface where note labels, tags, and descriptions can be inspected and edited.
- The Calendar day drilldown must provide zoom controls so session timing can be examined at finer granularity, including start time, end time, total duration, and active note duration.
- The Summary view must compare total session duration against active note duration so the user can evaluate how much of the practice block was actually spent producing notes.
