# Phase 6 Learning System Tasks

Execute these tasks in order. Do not start the next task until the current one validates cleanly. Keep each task small, isolated, and aligned with spec/13_learning_system.md and the matching skills docs.

Strict separation applies throughout this phase:
- Audio System → Detection ONLY
- Learning System → Comparison ONLY

No UI rendering or audio modification is part of this task set.

## 1. Input Parser
Primary files: spec/13_learning_system.md, skills/25_learning_sequence_parser.md
1. Define how user text is parsed into a structured `LearningSequence`.
2. Validate that parsed entries remain sequential, non-overlapping, and absolute-time based.
3. Preserve rests as `note = null` entries instead of discarding them.
Validation:
1. Structured sequences preserve the original order of the user text.
2. Invalid fragments do not create overlapping or ambiguous entries.
3. Rest entries are retained as valid comparison inputs.

## 2. Timeline Builder
Primary files: spec/13_learning_system.md, skills/26_timeline_builder.md
1. Define how the expected timeline is built from a validated `LearningSequence`.
2. Align expected and user timeline segments to the same absolute session reference.
3. Preserve sequential boundaries for both note and rest entries.
Validation:
1. Expected timeline entries remain ordered and non-overlapping.
2. Rest segments occupy valid timeline positions.
3. Timeline output stays compatible with later comparison steps.

## 3. Cursor System
Primary files: spec/13_learning_system.md, skills/27_time_cursor.md
1. Define a continuously moving session-time cursor for comparison alignment.
2. Keep the cursor bound to absolute session elapsed time.
3. Preserve stable cursor behavior during pauses and session completion.
Validation:
1. Cursor position advances continuously from the session start reference.
2. Cursor state remains deterministic for the same time input.
3. End-of-session state clamps to valid bounds.

## 4. Live Data Integration
Primary files: spec/13_learning_system.md, app/components/sessionTimer.js
1. Define how completed Phase 5 note output feeds the learning system as read-only input.
2. Reuse persisted session notes and finalized note timelines without changing detection behavior.
3. Keep the learning system isolated from raw audio and frame analysis.
Validation:
1. Learning input comes from completed note data only.
2. No audio capture or detection logic is changed.
3. Phase 5 note output remains the source of truth for user playback data.

## 5. Comparison Engine
Primary files: spec/13_learning_system.md, skills/28_note_comparison.md
1. Define comparison between expected and actual notes at a shared timestamp.
2. Produce `ComparisonResult` values with pitch, timing, duration, and confidence fields.
3. Keep note comparison deterministic and sequence-aware.
Validation:
1. Comparison results are produced for aligned expected and actual notes.
2. Timing error remains measured in milliseconds.
3. Comparison treats rests and note mismatches as valid outcomes.

## 6. Feedback System
Primary files: spec/13_learning_system.md, skills/30_feedback_system.md
1. Define real-time feedback outputs from comparison and accuracy data.
2. Map comparison outcomes to color and text feedback states.
3. Keep feedback output descriptive only and separate from storage.
Validation:
1. Feedback remains tied to the current comparison state.
2. Color and text mappings stay derived from learning data only.
3. Feedback does not mutate session or note records.

## 7. Scoring System
Primary files: spec/13_learning_system.md, skills/29_accuracy_calculation.md, skills/31_score_aggregation.md
1. Define pitch, timing, and duration accuracy from comparison results.
2. Aggregate the accuracy values into a session-level `SessionScore`.
3. Keep score output derived and recomputable from saved learning data.
Validation:
1. Component accuracies remain normalized.
2. SessionScore is derived from comparison outcomes only.
3. Recomputing the same inputs yields the same score.

## 8. Validation
Primary files: spec/13_learning_system.md, tasks/13_learning_system.md
1. Test sample learning sequences with notes and rests.
2. Confirm timeline construction, cursor movement, comparison, feedback, and scoring all remain consistent.
3. Verify the separation rule: detection stays in the Audio System and comparison stays in the Learning System.
Validation:
1. Sample sequences produce stable comparison results.
2. Rest handling and sequential timing remain correct.
3. No UI rendering or audio modification is introduced by the learning task plan.
