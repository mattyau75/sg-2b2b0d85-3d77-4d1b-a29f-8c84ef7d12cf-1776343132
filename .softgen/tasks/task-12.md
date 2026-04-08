---
title: Roster Management Enhancements
status: in_progress
priority: medium
type: feature
tags: ["roster", "ui", "database"]
created_by: agent
created_at: 2026-04-08
position: 12
---

## Notes:
Add editing capabilities for teams and players to allow for roster adjustments and corrections.

## Checklist:
- [ ] Add updateTeam and updatePlayer methods to rosterService.ts
- [ ] Implement Edit Team dialog in src/pages/roster/index.tsx
- [ ] Implement Edit Player dialog in src/pages/roster/[id].tsx
- [ ] Verify RLS policies allow for anonymous updates
- [ ] Add success/error toast notifications for edits