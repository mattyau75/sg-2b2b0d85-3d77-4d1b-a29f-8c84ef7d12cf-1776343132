---
title: "Implement AI Visual Snapshots for Mapping"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ai", "ui", "storage"]
created_by: "agent"
created_at: "2026-04-10T19:55:00Z"
---

## Notes:
Enhance the AI Discovery phase to capture visual evidence of every detected player. This provides a "mugshot" for manual mapping, especially for players with obscured jersey numbers.

## Checklist:
- [x] Add `snapshot_url` to `ai_player_mappings` table.
- [ ] Update `opencv_statgen.py`: Extract bounding box crops (JPG) for unique tracks.
- [ ] Update `modal_worker.py`: Handle snapshot upload to R2 and link to mapping DB.
- [ ] Update `MappingDashboard.tsx`: Display snapshot images in the discovery registry.
- [ ] Implement visual fallback: Show a '?' placeholder if snapshot is missing.