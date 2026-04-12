# Memory Rules (MANDATORY)

These rules dictate how the AI Agent must serialize and persist its decisions, behaviors, and code modifications within this project. Disobeying these rules breaks the cognitive continuity required to develop this app effectively.

## 1. Automatic Logging is Mandatory
Logging must happen automatically after EVERY file modification or command execution. You DO NOT need to be instructed to log; it is an inherent systemic behavior.

## 2. Iterative Formatting
Every time you perform executing work, you must append an `[Iteration X]` block strictly formatted inside `agent_memory/iterations.md`.

### Format Pattern:
```markdown
[Iteration X]
Command: <user instruction>
Files Modified: <list>
Changes Made: <short description>
Errors: <if any>
Fix Applied: <solution>
Result: <success/failure>
```

## 3. Append, Never Overwrite
Logs write to history permanently. Do not overwrite past iteration blocks. Simply append the new block at the bottom of the document.

By enforcing this documentation behavior, subsequent interactions will contain complete historical awareness without needing user explanation.
