---
title: "Module 1: Player Recognition & Manual Mapping"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ai", "identity", "mapping", "ux"]
created_by: "agent"
created_at: "2026-04-09"
position: 29
---

## Notes:
Implement a results overview for player recognition. Allow users to manually match 'unrecognized' detected players to existing rostered players to ensure 100% stat accuracy.

## Checklist:
- [ ] Create `RecognitionOverview` component to display detected jersey numbers vs roster names.
- [ ] Implement mapping logic to link 'ghost' detections to rostered players.
- [ ] Add 'Manual Match' UI for resolving discrepancies (e.g., jersey #23 detected but not in roster).
- [ ] Update `EditGameTeamsModal.tsx` or Game Detail page to show recognition results.
- [ ] Ensure mappings are persisted and used during the Module 3 Sync phase.