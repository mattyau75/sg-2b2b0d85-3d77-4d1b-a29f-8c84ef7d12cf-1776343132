---
title: "Build Elite Scout Analytics Dashboard"
status: "todo"
priority: "high"
type: "feature"
tags: ["analytics", "ui", "stats"]
created_by: "agent"
created_at: "2026-04-12T00:15:00Z"
position: 64
---

## Notes:
Build a high-density, tactical analytics dashboard for coaches and scouts to analyze game data processed by the AI worker.

## Checklist:
- [ ] Create `AnalyticsDashboard.tsx`: High-density layout with tactical dark mode styling.
- [ ] Implement `ShotMap.tsx`: Interactive court visualization for field goal attempts.
- [ ] Build `PersonnelTable.tsx`: Detailed player-by-player scouting data with Geist Mono font for stats.
- [ ] Integrate real-time data fetching from Supabase `game_stats` table.
- [ ] Add "Export Scout Report" functionality for PDF/Print output.