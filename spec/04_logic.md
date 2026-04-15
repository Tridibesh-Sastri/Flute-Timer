# System Behavior Rules

## Operational Logic
- A Session MUST be manually initiated by the user.
- Each continuous detected sound segment becomes an explicit `NoteEvent`.
- Silence natively and immediately resolves the active `NoteEvent`.

## Session State Control
- **Session Start**: When a Session initiates, the Session Timer immediately begins and the Audio Detection system becomes active.
- **Inactive Session**: If a Session is NOT active, audio detection must be explicitly ignored, and no NoteEvent should be created.
- **Session End**: When a Session ends, any concurrently active NoteEvent must be closed, and the total Session duration is finalized.

## Derived Practice Time
- The effective or active practice time for a Session is the sum of all valid `NoteEvent.duration` values inside that Session.
- Dashboard and calendar views may display the active time as a derived metric, but they must not mutate the stored Session duration to match it.
- When the Session duration exceeds the active note duration, the difference is the non-note gap time and should be surfaced as a comparison metric in summary views.

## Learning Timer Relations
- Operates completely independently of the Session structure. 
- When the Learning Timer concludes, the Alarm is triggered but the Session itself continues unless manually stopped by the user.

## Sound Control System
- The volume threshold logic must be fully exposed as adjustable values.
- Implements user-controlled sensitivity interfaces.

## Detail View Interaction
- Session note edits performed in the Dashboard must persist through localStorage updates without changing the computed timing fields.
- Calendar zoom controls must only change the rendered scale of the day timeline and must never change the underlying start or end timestamps of any Session.
