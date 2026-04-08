---
title: Team & Player Roster Management
status: in_progress
priority: medium
type: feature
tags: ["roster", "teams", "players"]
created_by: agent
created_at: 2026-04-08
position: 5
---

## Notes:
Create a centralized hub for managing and viewing teams and their player rosters. This should integrate with the existing Supabase schema and follow the dark tactical design system.

## Checklist:
- [ ] Create rosterService.ts for Supabase CRUD operations
- [ ] Add "Roster" navigation link to Layout.tsx
- [ ] Create /roster/index.tsx: Team directory with high-contrast cards
- [ ] Create /roster/[id].tsx: Detailed team view with player list table
- [ ] Implement "Add Team" and "Add Player" modals (Admin/Scout level)
- [ ] Add player performance badges (Position, Height, Number)