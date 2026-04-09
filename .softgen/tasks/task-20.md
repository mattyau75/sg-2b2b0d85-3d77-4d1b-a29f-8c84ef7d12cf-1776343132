---
title: AI-to-Roster Data Linking
status: done
priority: urgent
type: bug
tags: [data, sync, ai]
created_by: agent
created_at: 2026-04-09
position: 20
---

## Notes:
Resolve the disconnect between AI-generated events (jersey numbers) and database player records (UUIDs).

## Checklist:
- [x] Audit raw play_by_play data to identify player identification fields
- [x] Restore missing home_team_id and away_team_id for the latest game
- [x] Update sync-game-stats.ts to resolve player_id via jersey number + team_id
- [x] Implement auto-generation of "Unknown" players if a jersey number is detected that isn't on the roster
- [x] Re-calculate stats for the latest game to verify fix