---
title: Redesign Module 2 Mapping Engine
status: in_progress
priority: urgent
type: feature
created_by: softgen
---
## Notes:
Complete overhaul of the player mapping logic to handle small jersey numbers and roster synchronization.

## Checklist:
- [x] Implement Temporal Voting Engine in `opencv_statgen.py`
- [x] Add Roster-Aware OCR filtering (constrain search to active team numbers)
- [x] Implement 3x Resolution ROI Torso Cropping for small number recognition
- [x] Update Supabase RLS and Workers for 'First Breath' heartbeat
- [ ] Add 'Low Confidence' flag for manual human-in-the-loop review