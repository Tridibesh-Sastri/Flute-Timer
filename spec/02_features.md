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
