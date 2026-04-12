---
title: "Fix Module 2 Fatal Bottleneck & Cancellation Sync"
status: "in_progress"
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
- [ ] Create `api/reset-game-analysis.ts`: Endpoint to force-clear game metadata and logs.
- [ ] Update `games/[id].tsx`: UI button to trigger the full reset.
- [ ] Update `process-game.ts`: Prevent starting new analysis if state is not clean.
- [ ] Update `modal_worker.py`: Ensure it exits gracefully on status change.