---
title: "Optimize YOLO11m for Elite Roster Discovery"
status: "done"
priority: "high"
type: "chore"
tags: ["ai", "yolo11", "optimization"]
created_by: "agent"
created_at: "2026-04-10T20:05:00Z"
---

## Notes:
Calibrate YOLO11m settings specifically for indoor gym environments, focusing on small jersey number detection and track persistence during camera pans.

## Checklist:
- [x] Upgrade Inference Resolution: Set `imgsz=1280` for better small-object resolution.
- [x] Implement BoT-SORT Tracking: Use BoT-SORT for improved ID retention during crossovers.
- [x] Multi-Stage Confidence Filtering: Implement higher consensus requirements for identity resolution.
- [x] ROI Zoom for OCR: Enhance Jersey OCR by cropping higher-resolution ROIs before Tesseract processing.
- [x] Augmentation Bypass: Disable TTA (Test Time Augmentation) to prioritize real-time mapping speed.