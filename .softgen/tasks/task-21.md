---
title: Video-First Jersey Calibration
status: done
priority: high
type: feature
tags: ["ai", "ui", "ux"]
created_by: Softgen
created_at: 2026-04-09
position: 21
---

## Notes:
Instead of relying on team directory colors, we'll sample the video first to identify the actual jerseys being worn.

## Checklist:
- [x] Add detected_home_color and detected_away_color to games table
- [x] Create /api/analyze-colors micro-service bridge
- [x] Add "Visual Calibration" UI step to NewGameModal.tsx
- [x] Implement color swatch selection (Team A vs Team B)
- [x] Update full analysis trigger to use these calibrated colors