---
title: "Manual Personnel Override Dashboard"
status: "done"
priority: "high"
type: "feature"
tags: ["ui", "mapping", "overrides"]
created_by: "agent"
created_at: "2026-04-10T22:05:00Z"
---

## Notes:
Create an interface in Module 2 that allows scouts to manually correct AI mapping errors. Includes a dropdown/selector to re-assign discovered jersey numbers to different players on the roster.

## Checklist:
- [x] Add "Manual Override" mode to `MappingDashboard.tsx`.
- [x] Implement player selection dropdown for AI entities.
- [x] Create `updateMapping` method in `rosterService.ts`.
- [x] Add visual "Manual" indicator for overridden mappings.
- [x] Verify real-time UI refresh after manual correction.