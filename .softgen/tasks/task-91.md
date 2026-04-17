---
title: Implement Advanced Box Score Analytics
status: in_progress
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
- [ ] Add plus_minus column to box_scores table
- [ ] Update BoxScore.tsx to display +/-, EFF, and RNK columns
- [ ] Implement efficiency calculation logic
- [ ] Implement weighted ranking calculation
- [ ] Create lineups table to track 5-player combinations
- [ ] Build LineupAnalyzer component for best lineup identification
- [ ] Calculate lineup metrics: +/-, rebounds, turnovers, steals, blocks
- [ ] Add lineup visualization with sortable metrics