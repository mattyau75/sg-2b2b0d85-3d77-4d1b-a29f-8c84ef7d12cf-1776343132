---
title: Create AI Accuracy Report Page
status: done
priority: medium
type: feature
tags: ["analytics", "ai", "qc"]
created_by: agent
created_at: 2026-04-10
position: 34
---

## Notes:
Create a dedicated quality control page to visualize the AI's jersey recognition performance. This helps verify the new Temporal Voting and 3x ROI Upscaling engines.

## Checklist:
- [ ] Create `src/pages/accuracy-report.tsx`: Dashboard for AI performance metrics
- [ ] Implement `RecognitionClipCard.tsx`: Individual clip visualization with OCR confidence scores
- [ ] Add 'Temporal Voting' chart: Show how the AI's guess stabilizes over time (30-60 frames)
- [ ] Include 'Model Comparison' table: YOLOv11m vs Ground Truth accuracy
- [ ] Add navigation link in Sidebar/Settings