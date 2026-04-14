---
title: "Redesign Game Detail to Tactical Command Center"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ui", "ux", "modular"]
created_by: "agent"
created_at: "2026-04-14"
---

## Notes:
Convert the tabbed Game Detail page into a modular, stage-based UI. Use popup modals for deep tasks (Mapping, Calibration) to keep the core context visible.

## Checklist:
- [x] Remove Tab-based navigation from `pages/games/[id].tsx`.
- [x] Implement Stage-based Module UI with status indicators.
- [ ] Create `MappingModal` wrapper to move the Mapping Dashboard into a popup.
- [x] Wire up "Force Deploy" and "Calibration" buttons as modal triggers.
- [ ] Add real-time AI status ticker to the Command Center.