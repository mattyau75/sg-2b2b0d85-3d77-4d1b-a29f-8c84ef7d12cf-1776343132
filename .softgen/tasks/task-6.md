---
title: YOLO11m Inference Optimization
status: in_progress
priority: high
type: feature
tags: ["ai", "yolo11", "gpu"]
created_by: agent
created_at: 2026-04-08
position: 6
---

## Notes:
Implement optimized inference settings for small jersey number detection in broadcast footage (panning camera).

## Checklist:
- [x] Research SOTA Roboflow datasets for jersey numbers (1280px recommended)
- [ ] Add "Advanced Settings" popover to Dashboard URL input
- [ ] Update modalService.ts to support dynamic inference parameters (imgsz, conf, iou)
- [ ] Update /api/process-game.ts to forward config to Modal GPU bridge
- [ ] Implement ByteTrack/Agnostic NMS toggles in UI