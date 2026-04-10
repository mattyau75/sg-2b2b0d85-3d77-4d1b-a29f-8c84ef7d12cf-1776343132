---
title: "Full App Audit & Dead Code Removal"
status: "done"
priority: "medium"
type: "chore"
tags: ["maintenance", "optimization"]
created_by: "agent"
created_at: "2026-04-10T20:10:00Z"
---

## Notes:
Perform a deep sweep of the codebase to align all components with the new "Zero-Stat" Roster Mapping vision. Remove all legacy event-tracking logic.

## Checklist:
- [x] Strip `opencv_statgen.py`: Remove all shot/stat/rebound logic and unused imports.
- [x] Clean `modal_worker.py`: Remove stat aggregation and unused function signatures.
- [x] Refactor `games/[id].tsx`: Remove unused tabs (Shot Chart, Play-by-Play) and state variables.
- [x] Update `process-game.ts`: Ensure only mapping-essential metadata is sent to GPU.
- [x] Fix Hydration/Lint: Resolve any minor UI warnings or type mismatches.