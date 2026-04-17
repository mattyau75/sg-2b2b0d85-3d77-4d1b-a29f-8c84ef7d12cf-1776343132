---
title: Implement Advanced Box Score Analytics
status: done
priority: high
type: feature
tags: [analytics, boxscore, advanced-stats]
created_by: agent
created_at: 2026-04-17
position: 91
---

## Notes:
Add elite analytics features to box score: +/- (plus/minus), EFF (efficiency rating), RNK (weighted player ranking), and Team Lineup Analyzer to identify best on-court player combinations.

## Checklist:
- [x] Add plus_minus column to box_scores table
- [x] Update BoxScore.tsx to display +/-, EFF, and RNK columns
- [x] Implement efficiency calculation logic
- [x] Implement weighted ranking calculation
- [x] Create lineups table to track 5-player combinations
- [x] Build LineupAnalyzer component for best lineup identification
- [x] Calculate lineup metrics: +/-, rebounds, turnovers, steals, blocks
- [x] Add lineup visualization with sortable metrics