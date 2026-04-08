---
title: Rim Detection & Automated Shot Attribution
status: in_progress
priority: high
type: feature
tags: ["ai", "rim-detection", "shot-logic"]
created_by: agent
created_at: 2026-04-08
position: 7
---

## Notes:
Implement Rim/Ball detection logic for automated shot classification (made/missed) and attribute shots to players on the roster.

## Checklist:
- [x] Research SOTA Rim detection datasets (Roboflow v2 recommended)
- [ ] Add "Rim Detection" and "Shot Logic" toggles to Advanced Settings
- [ ] Update modalService.ts to support dual-model inference (Player + Rim/Ball)
- [ ] Update /api/process-game.ts to forward Rim/Ball config
- [ ] Implement UI indicators for "Hoop Tracking" status