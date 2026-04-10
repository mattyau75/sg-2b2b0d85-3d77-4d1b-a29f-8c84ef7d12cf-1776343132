---
title: "Re-engineer Module 2: AI Roster Mapping Engine"
status: "todo"
priority: "urgent"
type: "feature"
created_by: "agent"
created_at: "2026-04-10"
position: 1
---

## Notes:
Complete pivot of Module 2 from full game analysis to a dedicated Recognition & Mapping Service.

## Checklist:
- [x] Create `ai_player_mappings` table: `game_id`, `ai_detected_id`, `real_player_id`, `team_side`, `confidence`
- [x] Strip `modal_worker.py`: Remove all shot/event detection logic. Focus on color clustering and Jersey OCR.
- [x] Update `opencv_statgen.py`: Refactor output to return a JSON list of unique [Team, Number] pairs found.
- [x] Implement `src/pages/api/prepare-mapping.ts`: Post-analysis hook that populates the mapping table with AI results.
- [x] Create Mapping UI: A dashboard in `games/[id].tsx` to visualize and manually edit player mappings.
- [x] Color Calibration: Integrate team hex colors into the AI detection payload for better Home/Away separation.