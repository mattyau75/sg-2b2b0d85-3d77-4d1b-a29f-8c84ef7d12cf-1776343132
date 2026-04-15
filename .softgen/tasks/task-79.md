---
title: "Elite Roster Mapping Interface"
status: "in_progress"
priority: "urgent"
type: "feature"
tags: ["mapping", "ai", "ux"]
created_by: "agent"
created_at: "2026-04-15"
position: 79
---

## Notes:
Implement the high-density manual override dashboard for mapping AI-detected players to actual roster entries. This is the primary workspace for scouts to ensure 100% data precision.

## Checklist:
- [x] Implement MappingDashboard.tsx: High-density grid view of AI entities vs Team Rosters
- [x] Add Manual Mapping Interface: Dropdown selection for linking AI detection to player profiles
- [x] Create Mapping Service: Backend logic to persist AI-to-Human links in Supabase
- [x] Integrate with Game Detail: Add a "Tactical Mapping" tab to the [id].tsx page
- [x] Real-time Confidence Display: Show AI confidence scores for each suggested mapping