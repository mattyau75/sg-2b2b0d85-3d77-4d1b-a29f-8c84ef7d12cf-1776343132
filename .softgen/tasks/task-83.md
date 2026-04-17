---
title: "Persistent Error Tracking & Modal 401 Fix"
status: "in_progress"
priority: "high"
type: "bug"
tags: ["errors", "modal", "ux"]
created_by: "agent"
created_at: "2026-04-17"
position: 83
---

## Notes:
The user can login, but Modal (Module 2) returns 401. User wants persistent error notifications and a clear tracking panel.

## Checklist:
- [x] Update DiagnosticBanner to be persistent with a dismiss button
- [x] Enhance ErrorMonitor to provide a clear, high-density view of logs
- [x] Add a persistent toggle/button for the Error Monitor on the Dashboard
- [x] Investigate and fix the Modal 401 error in process-game.ts
- [x] Fix TypeScript errors in game details page