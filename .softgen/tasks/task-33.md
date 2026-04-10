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
- [ ] Implement Temporal Voting Engine in `opencv_statgen.py`
- [ ] Add Roster-Aware OCR filtering (constrain search to active team numbers)
- [ ] Implement 3x Resolution ROI Torso Cropping for small number recognition
- [ ] Update Supabase RLS and Workers for 'First Breath' heartbeat
- [ ] Add 'Low Confidence' flag for manual human-in-the-loop review