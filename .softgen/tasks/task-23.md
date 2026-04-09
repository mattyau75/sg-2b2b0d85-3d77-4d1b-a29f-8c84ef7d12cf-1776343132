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
- [x] Implement ByteTrack-inspired PlayerTracker class in opencv_statgen.py
- [x] Add motion prediction (velocity estimation) for pans
- [x] Integrate tracker into the main processing loop
- [x] Implement IOU-based identity association logic
- [x] Finalize re-identification anchoring via jersey color
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 684 chars.]