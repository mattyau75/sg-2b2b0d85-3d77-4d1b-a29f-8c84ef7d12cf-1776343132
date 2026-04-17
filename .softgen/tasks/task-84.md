---
title: Resolve Stalled Dashboard and Sync Inconsistencies
status: in_progress
priority: urgent
type: bug
tags: [ui, backend, gpu, sync]
created_by: agent
created_at: 2026-04-17
position: 84
---

## Notes:
The user reports the app is stalled at 0% with no errors. Analysis reveals the GPU cluster updates the `game_analysis` table, but the Dashboard listens to the `games` table. This mismatch prevents status/progress propagation.

## Checklist:
- [ ] Audit `games` and `game_analysis` tables for status/progress columns
- [ ] Add DB trigger to automatically sync `game_analysis` -> `games` for UI compatibility
- [ ] Update `index.tsx` with a 5-second polling fallback alongside real-time updates
- [ ] Update `process-game.ts` to ensure consistent status naming across tables
- [ ] Update `modal_worker.py` to update the `games` table directly for immediate feedback