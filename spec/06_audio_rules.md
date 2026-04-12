# Audio Handling Rules

## Hardware Interactions
- Access driven exclusively by Web Audio API (`AnalyserNode`).
- Volume and intensity states measured exclusively by calculating RMS from time-domain arrays.

## Output Mechanisms
- Required to prevent noise flickering explicitly through standard hysteresis.
- Its SOLE architectural responsibility is driving the System's **Detection Layer** by emitting raw trigger logic mapping to NoteEvents.
