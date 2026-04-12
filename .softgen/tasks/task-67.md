---
title: "Re-engineer Unified GPU Factory (Modules 2-4)"
status: "done"
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
- [x] Consolidate M2, M3, M4 into a single Raw Discovery Pipeline
- [x] Remove roster dependency from GPU ignition
- [x] Implement Async Fire-and-Forget Spawn pattern
- [x] Update modal_worker.py to output raw tracking/event data