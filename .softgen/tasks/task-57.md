---
title: Implement High-Density Diagnostic Banner System
status: in_progress
priority: high
created_by: agent
created_at: 2026-04-11
position: 57
---
## Notes:
Replace transient toast notifications with a persistent, high-density banner/bar system for granular error reporting and GPU handshake status.

## Checklist:
- [x] Create `DiagnosticBanner` component with "X" close functionality
- [x] Integrate banner into the top of the Module 2 dashboard in `games/[id].tsx`
- [x] Map granular GPU errors (Cold-start, Secret mismatch, Timeout) to specific banner content
- [x] Ensure banner state resets on new analysis attempts