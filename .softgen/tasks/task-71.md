---
title: Deterministic Modular Handshake & Persistent Logging
status: in_progress
priority: urgent
type: feature
tags: ["infrastructure", "logging", "workflow"]
created_by: agent
created_at: 2026-04-13
position: 71
---

## Notes:
Implement a manual-gated modular workflow for 8GB/1-hour game analysis. Ensure no auto-triggering between modules. Create a persistent notification system that requires manual dismissal.

## Checklist:
- [ ] Upgrade src/components/DiagnosticBanner.tsx for sticky persistence (No auto-hide)
- [ ] Refactor src/pages/games/[id].tsx with manual "Initiate Next Phase" gating
- [ ] Implement src/services/workflowService.ts for state-locked module transitions
- [ ] Standardize game_events table for high-fidelity technical tracing
- [ ] Final UI verification for "Manual X" dismissal