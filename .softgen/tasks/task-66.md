---
title: "Re-engineer Module 2: Raw Personnel Discovery"
status: "done"
priority: "urgent"
type: "bug"
tags: ["gpu", "analysis", "sync"]
created_by: "agent"
created_at: "2026-04-12T01:45:00Z"
position: 66
---

## Notes:
Resolve the fatal bottleneck where analysis remains "cancelled" or stuck after a user stop. Ensure all previous instances are cleared from the DB and GPU.

## Checklist:
- [x] Decouple GPU from Roster Mapping (Raw Discovery Mode)
- [x] Implement Async Fire-and-Forget Ignition
- [x] Update Mapping Dashboard for Raw AI entities
- [x] Verify Live Pulse Heartbeat for progress tracking