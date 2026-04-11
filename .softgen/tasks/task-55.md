---
title: Implement Strict Sequential Module Control
status: done
priority: urgent
type: feature
tags: [ui, logic, flow]
created_by: agent
created_at: 2026-04-11
position: 55
---

## Notes:
Ensure no module auto-starts and each depends on the explicit completion of the previous one. Fix the 10% hang with a "Cluster Warming" state.

## Checklist:
- [x] Remove auto-start logic from `process-game.ts`
- [x] Add "Cluster Warming" visual state to `games/[id].tsx`
- [x] Implement prop-based "Locked" state for Module 3 until M2 is complete
- [x] Add explicit manual "Initialize" button for each stage