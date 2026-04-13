---
title: Manual GPU Ignition & De-coupled Upload Workflow
status: done
priority: urgent
type: feature
tags: ["workflow", "gpu", "ui"]
created_by: agent
created_at: 2026-04-13
position: 74
---

## Notes:
Remove auto-triggering of /api/process-game from UploadContext. Implement a manual "Ignite AI Analysis" button on the Game page/card that only becomes available after the video upload is complete.

## Checklist:
- [x] Remove automatic process-game call from src/contexts/UploadContext.tsx
- [x] Implement "Ignite AI" manual trigger in src/pages/games/[id].tsx
- [x] Add "Awaiting Analysis" status indicator to Game Cards in src/pages/games/index.tsx
- [x] Ensure ignition payload includes verified video paths and calibration data