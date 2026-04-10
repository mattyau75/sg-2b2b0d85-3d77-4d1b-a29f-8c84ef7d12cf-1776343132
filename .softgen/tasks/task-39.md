<![CDATA[
---
title: "Full App Audit & Dead Code Removal"
status: "in_progress"
priority: "medium"
type: "chore"
tags: ["maintenance", "optimization"]
created_by: "agent"
created_at: "2026-04-10T20:10:00Z"
---

## Notes:
Perform a deep sweep of the codebase to align all components with the new "Zero-Stat" Roster Mapping vision. Remove all legacy event-tracking logic.

## Checklist:
- [ ] Strip `opencv_statgen.py`: Remove all shot/stat/rebound logic and unused imports.
- [ ] Clean `modal_worker.py`: Remove stat aggregation and unused function signatures.
- [ ] Refactor `games/[id].tsx`: Remove unused tabs (Shot Chart, Play-by-Play) and state variables.
- [ ] Update `process-game.ts`: Ensure only mapping-essential metadata is sent to GPU.
- [ ] Fix Hydration/Lint: Resolve any minor UI warnings or type mismatches.
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 876 chars.]