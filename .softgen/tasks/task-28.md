---
title: "Module 1: Video Color Calibration"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ai", "ui", "calibration"]
created_by: "agent"
created_at: "2026-04-09"
position: 28
---

## Notes:
Implement automated jersey color detection for Module 1 to improve player mapping accuracy.

## Checklist:
- [ ] Create/Update `src/pages/api/analyze-colors.ts` to simulate/execute color extraction from video.
- [ ] Update `EditGameTeamsModal.tsx` to trigger color detection on open.
- [ ] Add color toggle UI to allocate detected colors to Home/Away teams.
- [ ] Add Hover "help" tooltip for "Video Color Calibration" context.
- [ ] Persist detected colors to the `games` table in Supabase.