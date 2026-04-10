---
title: Split Scouting Workflow into Module 1 and Module 2
status: in_progress
priority: high
type: feature
tags: ["workflow", "ui", "api"]
created_by: agent
created_at: 2026-04-10
position: 30
---

## Notes:
Split the existing "Module 1" into two distinct steps:
1. Module 1: Team Metadata & Color Calibration (Modal).
2. Module 2: AI Identity Mapping (Triggered from Game Details tab).
Include automatic database pre-population of rosters after Module 1 is saved.

## Checklist:
- [x] Update `EditGameTeamsModal.tsx` to only handle Metadata & Color Calibration (Remove AI trigger).
- [x] Create `src/pages/api/prepare-mapping.ts` to pre-populate game rosters in the database after Module 1.
- [x] Modify `GameDetails` ([id].tsx) to include a "Start AI Mapping" trigger in the Identity Mapping tab.
- [ ] Update `process-game.ts` to focus solely on the AI analysis phase (Module 2).