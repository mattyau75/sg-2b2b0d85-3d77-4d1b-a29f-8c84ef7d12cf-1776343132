---
title: "Re-engineer Unified GPU Factory (Modules 2-4)"
status: "in_progress"
priority: "urgent"
type: "feature"
tags: ["gpu", "unified-pipeline", "raw-data"]
created_by: "agent"
created_at: "2026-04-12T04:15:00Z"
position: 67
---

## Notes:
Combine Personnel Discovery (M2), Statistical Analysis (M3), and Tactical Insights (M4) into a single, decoupled GPU process that produces raw AI-Entity data.

## Checklist:
- [ ] Refactor `modal_worker.py` to produce a unified `raw_payload` (Entities + Events)
- [ ] Update `process-game.ts` to launch the Unified Factory in Fire-and-Forget mode
- [ ] Create `src/services/mappingService.ts` to handle the new "Module 5" logic
- [ ] Update Game Dashboard to support "Ghost" Entity mapping