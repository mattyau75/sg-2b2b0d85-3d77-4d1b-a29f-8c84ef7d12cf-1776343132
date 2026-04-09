<![CDATA[
---
title: Temporal Player ID Tracking
status: in_progress
priority: urgent
type: feature
tags: ["ai", "gpu", "tracking"]
created_by: Softgen
created_at: 2026-04-09
position: 23
---

## Notes:
Implementing state-space tracking (Kalman + IOU) to maintain player identities during camera pans and motion blur.

## Checklist:
- [ ] Implement ByteTrack/DeepSORT logic in modal_worker.py
- [ ] Add Kalman filter for motion prediction during pans
- [ ] Update opencv_statgen.py to handle multi-frame ID persistence
- [ ] Integrate jersey color 'anchoring' for re-identification
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 684 chars.]