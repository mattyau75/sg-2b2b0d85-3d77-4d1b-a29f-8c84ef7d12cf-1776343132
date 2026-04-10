---
title: "Module 2: Mission Control & Recovery Suite"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ui", "debug", "realtime"]
created_by: "agent"
created_at: "2026-04-10T23:05:00Z"
---

## Notes:
Enhance the Module 2 diagnostic engine with better visibility into bottlenecks and a manual reset capability for stuck analysis states.

## Checklist:
- [x] Implement `handleResetAnalysis` in `[id].tsx` to clear stuck states.
- [x] Add "Reset Swarm Cluster" button to the Diagnostic Engine UI.
- [x] Improve visual feedback for different error categories (GPU vs DB vs Storage).
- [x] Ensure worker logs are visible during both active and failed states.