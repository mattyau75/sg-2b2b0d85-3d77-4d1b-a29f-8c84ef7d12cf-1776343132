---
title: Full Recursive Game Deletion
status: in_progress
priority: medium
type: chore
tags: ["data", "cleanup", "ux"]
created_by: Softgen
created_at: 2026-04-09
position: 22
---

## Notes:
Implement a "Delete Game" button that removes the game and all associated stats, events, and storage assets.

## Checklist:
- [ ] Add Delete button with AlertDialog confirmation to src/pages/games/[id].tsx
- [ ] Implement handleDeleteGame logic in the game page
- [ ] Add recursive deletion support for play_by_play and stats in Supabase (ON DELETE CASCADE check)
- [ ] Add storage cleanup call to remove video from R2
- [ ] Redirect user to Games index after successful deletion