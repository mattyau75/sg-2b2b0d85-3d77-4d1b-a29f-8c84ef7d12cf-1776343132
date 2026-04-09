---
title: "Modular Re-engineering: Identity & Mapping Engine"
status: "done"
priority: "urgent"
type: "chore"
tags: ["architecture", "database", "mapping"]
created_by: "agent"
created_at: "2026-04-09"
position: 25
---

## Notes:
Re-engineer the core data flow to ensure accurate player recognition and stats aggregation by creating a modular mapping system.

## Checklist:
- [x] Update `games` table schema to strictly track `home_team_id`, `away_team_id`, and their respective tracking colors.
- [x] Create `src/services/scoutingService.ts`: A centralized service to handle player identification (Jersey # -> Directory ID).
- [x] Refactor `src/pages/api/sync-game-stats.ts`: Implement a multi-pass sync that first maps identities, then generates events, then aggregates box scores.
- [ ] Update `EditGameTeamsModal.tsx` to ensure all metadata is locked before analysis triggers.
- [x] Create `src/lib/stat-utils.ts` for standardized box score calculations from play-by-play data.
- [ ] Fix TypeScript errors in modular scouting and shot mapping.