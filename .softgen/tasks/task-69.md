---
title: "Implement Manual Step-by-Step Ignition for Module 2"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["devops", "module-2", "debugging"]
created_by: "agent"
created_at: "2026-04-12T23:05:00Z"
---

## Notes:
Break the automated "Ignite AI" process into 4 manual stages to provide 100% visibility and sequential control.

## Checklist:
- [ ] Add `manualMode` and `currentManualStep` state to Dashboard (`index.tsx`).
- [ ] Implement `handleManualStep1`: Initialize Realtime Channel and confirm 'Subscribed' status.
- [ ] Implement `handleManualStep2`: Verify Game/Video DB record and log 'Payload Validated'.
- [ ] Implement `handleManualStep3`: Trigger the actual API call to Modal.com.
- [ ] Implement `handleManualStep4`: Manually set `m2_complete` to true in the `games` table.
- [ ] Build the UI Stepper with conditional visibility for each button.