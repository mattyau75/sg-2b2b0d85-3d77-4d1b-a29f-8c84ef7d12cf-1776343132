---
title: "Implement Camera Recording Type Calibration"
status: "done"
priority: "medium"
type: "feature"
tags: ["ui", "metadata", "optimization"]
created_by: "agent"
created_at: "2026-04-10T21:22:00Z"
---

## Notes:
Add a 'Camera Recording Type' toggle to Step 2 (EditGameTeamsModal) to differentiate between 'Panning' and 'Fixed' footage. This metadata will be used to optimize AI detection and tracking in all subsequent modules.

## Checklist:
- [x] Add `camera_type` selection UI to `EditGameTeamsModal.tsx`.
- [x] Update state management to track and save the selected camera type.
- [x] Ensure the value is correctly passed to the database `games` table.
- [x] Verify the metadata is available for the GPU Discovery phase (Module 2).