---
title: Streamline Analysis Pipeline
status: in_progress
priority: high
type: chore
tags: ["performance", "gpu", "optimization"]
created_by: softgen
created_at: 2026-04-09
position: 24
---

## Notes:
Optimize the GPU analysis pipeline for speed and efficiency while maintaining high-accuracy tracking and shot detection.

## Checklist:
- [ ] Implement Adaptive Keyframe Sampling in modal_worker.py
- [ ] Enable VRAM caching to keep model "hot" across chunks
- [ ] Implement parallel metric calculation in opencv_statgen.py
- [ ] Add automatic GPU scaling for long-form videos (>30m)
- [ ] Verify accuracy/speed trade-off with a 10-minute test game