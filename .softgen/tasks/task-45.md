---
title: "Sequential Tabbed Module Framework"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ui", "workflow", "logic"]
created_by: "agent"
created_at: "2026-04-10T21:44:00Z"
---

## Notes:
Transform the Game Detail page into a tabbed interface with 4 modules. Enforce sequential completion (Module N requires N-1 to be done). Show a "Locked" message for out-of-order access.

## Checklist:
- [ ] Update `games` table schema with module completion flags.
- [ ] Refactor `src/pages/games/[id].tsx` to use a tabbed layout.
- [ ] Implement `ModuleGuard` component for sequential logic.
- [ ] Create specialized views for Module 1 (Calibration), Module 2 (Discovery), Module 3 (Analysis), and Module 4 (Insights).
- [ ] Add "Locked" state messaging and visual indicators.