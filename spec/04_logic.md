# System Behavior Rules

## Operational Logic
- A Session MUST be manually initiated by the user.
- Each continuous detected sound segment becomes an explicit `NoteEvent`.
- Silence natively and immediately resolves the active `NoteEvent`.

## Session State Control
- **Session Start**: When a Session initiates, the Session Timer immediately begins and the Audio Detection system becomes active.
- **Inactive Session**: If a Session is NOT active, audio detection must be explicitly ignored, and no NoteEvent should be created.
- **Session End**: When a Session ends, any concurrently active NoteEvent must be closed, and the total Session duration is finalized.

## Learning Timer Relations
- Operates completely independently of the Session structure. 
- When the Learning Timer concludes, the Alarm is triggered but the Session itself continues unless manually stopped by the user.

## Sound Control System
- The volume threshold logic must be fully exposed as adjustable values.
- Implements user-controlled sensitivity interfaces.
