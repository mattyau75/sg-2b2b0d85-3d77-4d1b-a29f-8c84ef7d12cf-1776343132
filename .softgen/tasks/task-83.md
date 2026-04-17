---
title: "Persistent Error Tracking & Modal 401 Fix"
status: "done"
priority: "high"
type: "bug"
tags: ["ui", "api", "diagnostics"]
created_by: "agent"
created_at: "2026-04-17"
position: 83
---

## Notes:
Improved the diagnostic visibility by making banners persistent and adding a sticky error console. Addressed the 401 error in game processing by refining the Modal endpoint path and authorization logic.

## Checklist:
- [x] Update DiagnosticBanner to be persistent with a dismiss button
- [x] Enhance ErrorMonitor to provide a clear, high-density view of logs
- [x] Add a persistent toggle/button for the Error Monitor on the Dashboard
- [x] Investigate and fix the Modal 401 error in process-game.ts
- [x] Fix TypeScript errors in game details page