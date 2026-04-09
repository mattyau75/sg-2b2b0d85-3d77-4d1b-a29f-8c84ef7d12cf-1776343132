---
title: "Enforce Sequential Modular Workflow"
status: "in_progress"
priority: "high"
type: "chore"
tags: ["workflow", "ux", "integrity"]
created_by: "agent"
created_at: "2026-04-09"
position: 27
---

## Notes:
Lock the modular system buttons so they only become visible/enabled when the prerequisite module is completed.

## Checklist:
- [x] Update `src/pages/games/[id].tsx` to hide 'Module 3: Sync' until `game.status === 'completed'`.
- [x] Add state check for 'Sync' completion to unlock Stats, Shot Chart, and Insights tabs.
- [x] Implement clear "Next Step" UI indicators to guide the user through the 1-5 pipeline.
- [x] Add tooltips/badges explaining why a module is locked (e.g., "Awaiting AI Analysis").