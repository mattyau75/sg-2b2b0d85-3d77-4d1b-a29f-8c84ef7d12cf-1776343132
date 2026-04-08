<![CDATA[
---
title: Advanced Game Analysis Modal
status: in_progress
priority: high
type: feature
tags: ["ai", "ui", "processing"]
created_by: agent
created_at: 2026-04-08
position: 8
---

## Notes:
Create a unified "New Game" modal that captures YouTube URL, Home/Away team selection, and jersey colors to improve AI attribution accuracy.

## Checklist:
- [ ] Create NewGameModal.tsx: Comprehensive form for video processing
- [ ] Implement Team Select dropdowns (fetching from Supabase)
- [ ] Add Team Color Swatches (Jersey Identification)
- [ ] Update modalService.ts to handle team IDs and hex colors
- [ ] Update /api/process-game.ts to forward team metadata to Modal GPU
- [ ] Refactor Dashboard to use the new "New Game" workflow
]]>


[Tool result trimmed: kept first 100 chars and last 100 chars of 858 chars.]