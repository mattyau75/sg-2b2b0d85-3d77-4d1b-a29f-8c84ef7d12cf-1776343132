---
title: "Build Elite Mapping Dashboard UI"
status: "in_progress"
priority: "high"
type: "feature"
created_by: "agent"
created_at: "2026-04-10"
position: 1
---

## Notes:
The UI must allow users to see what the AI found and manually link 'Unmatched' AI tracks to actual roster players.

## Checklist:
- [ ] Create `MappingDashboard.tsx` component: Split view showing AI Tracks vs Roster.
- [ ] Implement `update-mapping` API: Endpoint to save manual overrides to `ai_player_mappings`.
- [ ] Add 'Confidence' indicators: Visual cues for AI recognition certainty.
- [ ] Integrate 'Color Swatches': Show detected player colors next to tracks.